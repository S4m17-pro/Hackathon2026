import {
  ChecklistItemResult as PrismaChecklistItemResult,
  ChecklistTemplateItem,
  Evidence as PrismaEvidence,
  Novelty as PrismaNovelty,
  QrScan as PrismaQrScan,
  Visit as PrismaVisit,
} from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import type {
  ChecklistItemResult as SharedChecklistItemResult,
  ChecklistItemResultSyncPayload,
  Evidence as SharedEvidence,
  EvidenceSyncPayload,
  GeoPoint,
  Novelty as SharedNovelty,
  NoveltyPriority,
  NoveltyStatus,
  NoveltySyncPayload,
  QrScan as SharedQrScan,
  QrScanSyncPayload,
  Visit as SharedVisit,
  VisitStatus,
  VisitSyncPayload,
} from "@/shared/types";

/**
 * Helpers de acceso a datos. Este archivo es de Juan: nadie mas lo edita.
 *
 * Reglas que respetan todos estos helpers:
 *
 * 1. Idempotencia por `clientId` (regla 2). Reintentar una operacion no
 *    duplica filas.
 * 2. El dispositivo manda referencias por `clientId` (no por `id` de servidor).
 *    Estos helpers las resuelven con `resolve*ByClientId` antes de escribir.
 * 3. Un `update` nunca pisa `supervisorId`, `costCenterId` ni `scheduledAt`.
 *    Los asigna el coordinador. Una visita `CANCELLED` no se reabre desde el
 *    dispositivo: `upsertVisit` devuelve la fila tal cual. `CANCELLED` en el
 *    payload se ignora; cancelar es `cancelVisit` del coordinador.
 * 4. `clientCreatedAt` es la hora del dispositivo y nunca se recalcula en el
 *    update. `receivedAt` lo pone el servidor y no se toca (regla 5).
 * 5. Fuera de rango se marca, no se bloquea (regla 3). Ningun helper rechaza
 *    una operacion por geolocalizacion.
 *
 * Lewis y Sebastian usan estos helpers en vez de escribir Prisma suelto.
 */

/** Radio por defecto de un punto QR (RF-QR-01). */
export const DEFAULT_QR_RADIUS_METERS = 50;

/** Error de negocio. `syncOperation` lo convierte en `SyncOperationResult`. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code:
      | "PARENT_NOT_FOUND"
      | "OWNER_NOT_FOUND"
      | "INVALID_PAYLOAD"
      | "NO_CHECKIN"
      | "INCOMPLETE_CHECKLIST"
      | "ALREADY_CHECKED_IN",
  ) {
    super(message);
    this.name = "DataError";
  }
}

function toDate(iso: string, field: string): Date {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    throw new DataError(
      `${field} no es una fecha ISO-8601 valida: ${iso}`,
      "INVALID_PAYLOAD",
    );
  }

  return parsed;
}

function toNullableDate(iso: string | null, field: string): Date | null {
  return iso === null ? null : toDate(iso, field);
}

function toNumberOrNull(value: number | null, field: string): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DataError(`${field} debe ser un numero finito o null.`, "INVALID_PAYLOAD");
  }

  return value;
}

// --------------------------------------------------------------------------
// Resolucion de referencias del dispositivo
// --------------------------------------------------------------------------

/** Resuelve el `clientId` de una visita a su `id` de servidor. */
export async function resolveVisitIdByClientId(
  visitClientId: string,
): Promise<string | null> {
  const visit = await prisma.visit.findUnique({
    where: { clientId: visitClientId },
    select: { id: true },
  });

  return visit?.id ?? null;
}

/**
 * Resuelve el `clientId` de un dueño polimorfico a su `id` de servidor.
 * `Evidence` no tiene FK en el schema, asi que la validacion va aqui.
 */
export async function resolveOwnerIdByClientId(
  ownerType: EvidenceSyncPayload["ownerType"],
  ownerClientId: string,
): Promise<string | null> {
  switch (ownerType) {
    case "VISIT":
      return resolveVisitIdByClientId(ownerClientId);

    case "NOVELTY": {
      const novelty = await prisma.novelty.findUnique({
        where: { clientId: ownerClientId },
        select: { id: true },
      });

      return novelty?.id ?? null;
    }

    case "QR_SCAN": {
      const scan = await prisma.qrScan.findUnique({
        where: { clientId: ownerClientId },
        select: { id: true },
      });

      return scan?.id ?? null;
    }

    case "CHECKLIST_ITEM": {
      const result = await prisma.checklistItemResult.findUnique({
        where: { clientId: ownerClientId },
        select: { id: true },
      });

      return result?.id ?? null;
    }
  }
}

/** Exige que la visita exista. Lanza `PARENT_NOT_FOUND` si no. */
async function requireVisitId(visitClientId: string): Promise<string> {
  const visitId = await resolveVisitIdByClientId(visitClientId);

  if (visitId === null) {
    throw new DataError(
      `No existe una visita con clientId ${visitClientId}. Sincroniza la visita antes que sus hijos.`,
      "PARENT_NOT_FOUND",
    );
  }

  return visitId;
}

// --------------------------------------------------------------------------
// Upserts
// --------------------------------------------------------------------------

/**
 * Upsert de visita por `clientId`.
 *
 * Al crear se guardan `supervisorId` y `costCenterId` tal cual llegan del
 * dispositivo. `scheduledAt` no se toca: la pone el coordinador.
 * Al actualizar solo se tocan los campos que el dispositivo posee: `status`,
 * check-in, check-out y observaciones. Los campos de asignacion no se tocan,
 * para que una reasignacion del coordinador no se revierta.
 * `clientCreatedAt` tampoco se toca (regla 5).
 *
 * Si la visita ya esta `CANCELLED`, se devuelve sin escribir. Un payload con
 * `status: CANCELLED` no cancela: ese estado solo lo escribe el coordinador.
 *
 * Check-out sin check-in (ni en el payload ni en la fila) tira `NO_CHECKIN`
 * para que el outbox reintente cuando llegue el check-in.
 *
 * No bloquea por estar fuera de rango (regla 3): guarda el flag y sigue.
 */
export async function upsertVisit(payload: VisitSyncPayload): Promise<PrismaVisit> {
  const existing = await prisma.visit.findUnique({
    where: { clientId: payload.clientId },
    select: { id: true, status: true, checkInAt: true },
  });

  if (existing?.status === "CANCELLED") {
    return prisma.visit.findUniqueOrThrow({ where: { id: existing.id } });
  }

  const checkInAt = toNullableDate(payload.checkInAt, "checkInAt");
  const checkOutAt = toNullableDate(payload.checkOutAt, "checkOutAt");

  if (checkOutAt !== null && checkInAt === null && existing?.checkInAt == null) {
    throw new DataError(
      "No se puede hacer check-out sin un check-in previo.",
      "NO_CHECKIN",
    );
  }

  const deviceStatus = payload.status === "CANCELLED" ? null : payload.status;

  const fields = {
    checkInLat: toNumberOrNull(payload.checkInLat, "checkInLat"),
    checkInLng: toNumberOrNull(payload.checkInLng, "checkInLng"),
    checkInAccuracyM: toNumberOrNull(payload.checkInAccuracyM, "checkInAccuracyM"),
    checkInAt,
    checkInDistanceM: toNumberOrNull(payload.checkInDistanceM, "checkInDistanceM"),
    checkInVerified: payload.checkInVerified,
    checkInOutOfRange: payload.checkInOutOfRange,
    checkOutLat: toNumberOrNull(payload.checkOutLat, "checkOutLat"),
    checkOutLng: toNumberOrNull(payload.checkOutLng, "checkOutLng"),
    checkOutAccuracyM: toNumberOrNull(payload.checkOutAccuracyM, "checkOutAccuracyM"),
    checkOutAt,
    checkOutDistanceM: toNumberOrNull(payload.checkOutDistanceM, "checkOutDistanceM"),
    checkOutVerified: payload.checkOutVerified,
    checkOutOutOfRange: payload.checkOutOutOfRange,
    checkOutNotes: payload.checkOutNotes,
    notes: payload.notes,
  };

  return prisma.visit.upsert({
    where: { clientId: payload.clientId },
    create: {
      clientId: payload.clientId,
      supervisorId: payload.supervisorId,
      costCenterId: payload.costCenterId,
      status: deviceStatus ?? "ASSIGNED",
      clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
      ...fields,
    },
    update: {
      ...(deviceStatus !== null ? { status: deviceStatus } : {}),
      ...fields,
    },
  });
}

/**
 * Upsert de escaneo QR por `clientId`.
 * `visitClientId` del payload se resuelve a `Visit.id` antes de guardar.
 */
export async function upsertQrScan(payload: QrScanSyncPayload): Promise<PrismaQrScan> {
  const visitId = await requireVisitId(payload.visitClientId);

  const data = {
    qrPointId: payload.qrPointId,
    visitId,
    distanceMeters: payload.distanceMeters,
    verified: payload.verified,
  };

  return prisma.qrScan.upsert({
    where: { clientId: payload.clientId },
    create: {
      clientId: payload.clientId,
      clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
      ...data,
    },
    update: data,
  });
}

/**
 * Upsert de novedad por `clientId`.
 * `visitClientId` del payload se resuelve a `Visit.id` antes de guardar.
 *
 * Los campos de cierre no se tocan: son del coordinador, no del dispositivo
 * (regla 4). Para cerrar hay que usar `closeNovelty`.
 */
export async function upsertNovelty(payload: NoveltySyncPayload): Promise<PrismaNovelty> {
  const visitId = await requireVisitId(payload.visitClientId);

  const data = {
    visitId,
    priority: payload.priority,
    description: payload.description,
    lat: toNumberOrNull(payload.lat, "lat"),
    lng: toNumberOrNull(payload.lng, "lng"),
  };

  return prisma.novelty.upsert({
    where: { clientId: payload.clientId },
    create: {
      clientId: payload.clientId,
      // El estado inicial lo define el payload. En un update NO se toca: el
      // ciclo de vida es del coordinador (regla 4) y un dispositivo con copia
      // vieja no puede reabrir una novedad ya cerrada.
      status: payload.status,
      clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
      ...data,
    },
    update: data,
  });
}

/**
 * Upsert de evidencia por `clientId`.
 *
 * `ownerClientId` se resuelve segun `ownerType` y se valida que exista.
 * Sin FK en el schema, ese chequeo es lo que evita evidencias colgadas.
 * La `url` la escribe el route handler de fotos de Lewis.
 */
export async function upsertEvidence(
  payload: EvidenceSyncPayload,
): Promise<PrismaEvidence> {
  const ownerId = await resolveOwnerIdByClientId(payload.ownerType, payload.ownerClientId);

  if (ownerId === null) {
    throw new DataError(
      `No existe ${payload.ownerType} con clientId ${payload.ownerClientId}. Sincroniza el dueño antes que su evidencia.`,
      "OWNER_NOT_FOUND",
    );
  }

  return prisma.evidence.upsert({
    where: { clientId: payload.clientId },
    create: {
      clientId: payload.clientId,
      ownerType: payload.ownerType,
      ownerId,
      url: payload.url,
      clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
    },
    update: { ownerType: payload.ownerType, ownerId, url: payload.url },
  });
}

/**
 * Upsert de un item de checklist diligenciado (RF-SUP-02).
 *
 * El `@@unique([visitId, itemId])` del schema es una segunda red contra
 * duplicados: si dos sync distintos del mismo item llegan con `clientId`
 * distinto, el segundo choca contra ese indice en vez de duplicar.
 */
export async function upsertChecklistItemResult(
  payload: ChecklistItemResultSyncPayload,
): Promise<PrismaChecklistItemResult> {
  const visitId = await requireVisitId(payload.visitClientId);

  // Sin esta comprobacion, un `itemId` desconocido revienta con un P2003 crudo
  // de Prisma en vez de un DataError. Lewis necesita un error tipado para
  // distinguir "reintentable" de "descartar".
  const itemExists = await prisma.checklistTemplateItem.findUnique({
    where: { id: payload.itemId },
    select: { id: true },
  });

  if (itemExists === null) {
    throw new DataError(
      `No existe el item de checklist ${payload.itemId}.`,
      "PARENT_NOT_FOUND",
    );
  }

  const data = {
    status: payload.status,
    comment: payload.comment,
  };

  // El upsert va por `(visitId, itemId)` y no por `clientId`: la llave natural
  // de una respuesta de checklist es "este item en esta visita", y hay una
  // sola. Asi, si el dispositivo reintenta con otro `clientId` (por ejemplo
  // tras reinstalar la PWA y perder el UUID local), la fila se actualiza en
  // vez de chocar contra el indice unico con un P2002 crudo.
  //
  // `clientCreatedAt` no se toca en el update: es la hora de la primera
  // marcacion en campo (regla 5).
  return prisma.checklistItemResult.upsert({
    where: { visitId_itemId: { visitId, itemId: payload.itemId } },
    create: {
      clientId: payload.clientId,
      visitId,
      itemId: payload.itemId,
      clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
      ...data,
    },
    update: data,
  });
}

// --------------------------------------------------------------------------
// Operaciones de negocio
// --------------------------------------------------------------------------

/**
 * Distancia en metros entre dos puntos (Haversine).
 * El servidor recalcula la distancia al sincronizar: es la entidad definitiva
 * de verdad (regla 3), por encima de lo que midio el dispositivo.
 */
export function haversineMeters(origin: GeoPoint, target: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(target.lat - origin.lat);
  const deltaLng = toRadians(target.lng - origin.lng);
  const lat1 = toRadians(origin.lat);
  const lat2 = toRadians(target.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Recalcula la distancia de una visita contra el centro de costo y deja los
 * flags de verificado / fuera de rango (regla 3).
 *
 * Devuelve la distancia. No bloquea: la visita se guarda igual.
 */
export async function recalculateVisitGeofence(
  visitId: string,
  phase: "checkIn" | "checkOut",
): Promise<number | null> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      costCenterId: true,
      checkInLat: true,
      checkInLng: true,
      checkOutLat: true,
      checkOutLng: true,
    },
  });

  if (visit === null) {
    throw new DataError(`No existe la visita ${visitId}.`, "PARENT_NOT_FOUND");
  }

  const lat = phase === "checkIn" ? visit.checkInLat : visit.checkOutLat;
  const lng = phase === "checkIn" ? visit.checkInLng : visit.checkOutLng;

  if (lat === null || lng === null) {
    return null;
  }

  const costCenter = await prisma.costCenter.findUnique({
    where: { id: visit.costCenterId },
    select: { lat: true, lng: true },
  });

  if (costCenter === null) {
    throw new DataError(
      `No existe el centro de costo ${visit.costCenterId}.`,
      "PARENT_NOT_FOUND",
    );
  }

  const distanceMeters = haversineMeters({ lat, lng }, costCenter);

  const flagData =
    phase === "checkIn"
      ? {
          checkInDistanceM: distanceMeters,
          checkInVerified: distanceMeters <= 50,
          checkInOutOfRange: distanceMeters > 50,
        }
      : {
          checkOutDistanceM: distanceMeters,
          checkOutVerified: distanceMeters <= 50,
          checkOutOutOfRange: distanceMeters > 50,
        };

  await prisma.visit.update({ where: { id: visitId }, data: flagData });

  return distanceMeters;
}

/**
 * RF-VIS-04: no se puede cerrar una visita sin check-in previo.
 * Lo valida el servidor; el dispositivo solo da feedback.
 */
export async function assertCanCheckOut(visitId: string): Promise<void> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { checkInAt: true, status: true },
  });

  if (visit === null) {
    throw new DataError(`No existe la visita ${visitId}.`, "PARENT_NOT_FOUND");
  }

  if (visit.status === "CANCELLED") {
    throw new DataError("La visita fue cancelada por el coordinador.", "INVALID_PAYLOAD");
  }

  if (visit.checkInAt === null) {
    throw new DataError(
      "No se puede hacer check-out sin un check-in previo.",
      "NO_CHECKIN",
    );
  }
}

/**
 * RF-VIS-04: no se puede hacer check-in dos veces en la misma visita.
 */
export async function assertCanCheckIn(visitId: string): Promise<void> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { checkInAt: true, status: true },
  });

  if (visit === null) {
    throw new DataError(`No existe la visita ${visitId}.`, "PARENT_NOT_FOUND");
  }

  if (visit.status === "CANCELLED") {
    throw new DataError("La visita fue cancelada por el coordinador.", "INVALID_PAYLOAD");
  }

  if (visit.checkInAt !== null) {
    throw new DataError("La visita ya tiene un check-in registrado.", "ALREADY_CHECKED_IN");
  }
}

/**
 * Cambia el estado de una novedad (regla 4).
 *
 * Para `RESOLVED` exige `closedAt`, `closedById` y `resolutionAction`
 * (RF-NOV-05, CA-07). Los tres juntos o ninguno.
 */
export async function changeNoveltyStatus(
  noveltyId: string,
  status: NoveltyStatus,
  closure?: { closedById: string; resolutionAction: string },
): Promise<PrismaNovelty> {
  if (status === "RESOLVED") {
    if (closure === undefined) {
      throw new DataError(
        "Cerrar una novedad exige usuario responsable y accion tomada.",
        "INVALID_PAYLOAD",
      );
    }

    return prisma.novelty.update({
      where: { id: noveltyId },
      data: {
        status,
        closedAt: new Date(),
        closedById: closure.closedById,
        resolutionAction: closure.resolutionAction,
      },
    });
  }

  return prisma.novelty.update({ where: { id: noveltyId }, data: { status } });
}

/**
 * Asigna una plantilla de checklist a un centro de costo (RF-ASI-03).
 */
export async function assignChecklistTemplateToCostCenter(
  costCenterId: string,
  checklistTemplateId: string | null,
): Promise<void> {
  await prisma.costCenter.update({
    where: { id: costCenterId },
    data: { checklistTemplateId },
  });
}

/**
 * Asocia una plantilla de checklist a una visita (RF-SUP-01).
 *
 * NO crea filas de `ChecklistItemResult`. Un item sin marcar no se materializa:
 * lo pendiente se deduce de la plantilla, no de una fila en PENDING.
 *
 * Asi el supervisor puede arrancar el dia sin red (RF-OFF-01): precarga la
 * plantilla con sus items, y cada marca encola un `checklistItem.upsert` que
 * crea la fila con el `clientId` real del dispositivo y su hora de campo
 * (regla 5). Precrear filas obligaria a inventar un `clientId` y una
 * `clientCreatedAt` que no corresponden a ningun hecho real del supervisor.
 *
 * Devuelve los items de la plantilla para que la PWA los muestre ya en orden.
 */
export async function assignChecklistTemplateToVisit(
  visitId: string,
  templateId: string,
): Promise<ChecklistTemplateItem[]> {
  await prisma.visit.update({
    where: { id: visitId },
    data: { checklistTemplateId: templateId },
  });

  return prisma.checklistTemplateItem.findMany({
    where: { templateId, OR: [{ costCenterId: null }] },
    orderBy: { position: "asc" },
  });
}

/**
 * CA-02: items obligatorios que el supervisor todavia no marco.
 *
 * Se calcula contra la plantilla de la visita, no contra filas existentes: un
 * item sin fila significa "no marcado", igual que una fila en PENDING.
 * Devuelve los labels para que el panel los muestre.
 */
export async function findPendingRequiredItems(visitId: string): Promise<string[]> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { checklistTemplateId: true },
  });

  if (visit === null) {
    throw new DataError(`No existe la visita ${visitId}.`, "PARENT_NOT_FOUND");
  }

  if (visit.checklistTemplateId === null) {
    return [];
  }

  const results = await prisma.checklistItemResult.findMany({
    where: { visitId },
    select: { itemId: true, status: true },
  });

  const marked = new Map(results.map((r) => [r.itemId, r.status]));

  const items = await prisma.checklistTemplateItem.findMany({
    where: {
      templateId: visit.checklistTemplateId,
      required: true,
      OR: [{ costCenterId: null }],
    },
    select: { id: true, label: true },
    orderBy: { position: "asc" },
  });

  return items
    .filter((item) => {
      const status = marked.get(item.id);

      return status === undefined || status === "PENDING";
    })
    .map((item) => item.label);
}

/**
 * Plantilla de una visita con el estado de cada item, para pintar el checklist.
 * Un item sin fila aparece como PENDING.
 */
export async function getVisitChecklist(visitId: string): Promise<
  Array<
    ChecklistTemplateItem & {
      result: PrismaChecklistItemResult | null;
    }
  >
> {
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { checklistTemplateId: true },
  });

  if (visit === null) {
    throw new DataError(`No existe la visita ${visitId}.`, "PARENT_NOT_FOUND");
  }

  if (visit.checklistTemplateId === null) {
    return [];
  }

  const items = await prisma.checklistTemplateItem.findMany({
    where: { templateId: visit.checklistTemplateId, OR: [{ costCenterId: null }] },
    orderBy: { position: "asc" },
  });

  const results = await prisma.checklistItemResult.findMany({
    where: { visitId },
  });
  const byItem = new Map(results.map((r) => [r.itemId, r]));

  return items.map((item) => ({ ...item, result: byItem.get(item.id) ?? null }));
}

// --------------------------------------------------------------------------
// Mapeo Prisma -> tipos compartidos
// --------------------------------------------------------------------------
//
// Prisma devuelve `Date`, el contrato compartido usa ISO-8601. Estas funciones
// son el unico puente permitido entre los dos.

export function toVisitDTO(visit: PrismaVisit): SharedVisit {
  return {
    id: visit.id,
    clientId: visit.clientId,
    supervisorId: visit.supervisorId,
    costCenterId: visit.costCenterId,
    status: visit.status,
    scheduledAt: visit.scheduledAt?.toISOString() ?? null,
    checklistTemplateId: visit.checklistTemplateId,
    checkInLat: visit.checkInLat,
    checkInLng: visit.checkInLng,
    checkInAccuracyM: visit.checkInAccuracyM,
    checkInAt: visit.checkInAt?.toISOString() ?? null,
    checkInDistanceM: visit.checkInDistanceM,
    checkInVerified: visit.checkInVerified,
    checkInOutOfRange: visit.checkInOutOfRange,
    checkOutLat: visit.checkOutLat,
    checkOutLng: visit.checkOutLng,
    checkOutAccuracyM: visit.checkOutAccuracyM,
    checkOutAt: visit.checkOutAt?.toISOString() ?? null,
    checkOutDistanceM: visit.checkOutDistanceM,
    checkOutVerified: visit.checkOutVerified,
    checkOutOutOfRange: visit.checkOutOutOfRange,
    checkOutNotes: visit.checkOutNotes,
    notes: visit.notes,
    clientCreatedAt: visit.clientCreatedAt.toISOString(),
    receivedAt: visit.receivedAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  };
}

export function toQrScanDTO(scan: PrismaQrScan): SharedQrScan {
  return {
    id: scan.id,
    clientId: scan.clientId,
    qrPointId: scan.qrPointId,
    visitId: scan.visitId,
    distanceMeters: scan.distanceMeters,
    verified: scan.verified,
    clientCreatedAt: scan.clientCreatedAt.toISOString(),
    receivedAt: scan.receivedAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

export function toNoveltyDTO(novelty: PrismaNovelty): SharedNovelty {
  return {
    id: novelty.id,
    clientId: novelty.clientId,
    visitId: novelty.visitId,
    priority: novelty.priority,
    status: novelty.status,
    description: novelty.description,
    lat: novelty.lat,
    lng: novelty.lng,
    closedAt: novelty.closedAt?.toISOString() ?? null,
    closedById: novelty.closedById,
    resolutionAction: novelty.resolutionAction,
    clientCreatedAt: novelty.clientCreatedAt.toISOString(),
    receivedAt: novelty.receivedAt.toISOString(),
    updatedAt: novelty.updatedAt.toISOString(),
  };
}

export function toChecklistItemResultDTO(
  result: PrismaChecklistItemResult,
): SharedChecklistItemResult {
  return {
    id: result.id,
    clientId: result.clientId,
    visitId: result.visitId,
    itemId: result.itemId,
    status: result.status,
    comment: result.comment,
    clientCreatedAt: result.clientCreatedAt.toISOString(),
    receivedAt: result.receivedAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export function toEvidenceDTO(evidence: PrismaEvidence): SharedEvidence {
  return {
    id: evidence.id,
    clientId: evidence.clientId,
    ownerType: evidence.ownerType,
    ownerId: evidence.ownerId,
    url: evidence.url,
    clientCreatedAt: evidence.clientCreatedAt.toISOString(),
    receivedAt: evidence.receivedAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
  };
}

export type { NoveltyPriority, VisitStatus };