import { Evidence, Novelty, QrScan, Visit } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import type {
  Evidence as SharedEvidence,
  EvidenceSyncPayload,
  Novelty as SharedNovelty,
  NoveltySyncPayload,
  QrScan as SharedQrScan,
  QrScanSyncPayload,
  Visit as SharedVisit,
  VisitSyncPayload,
} from "@/shared/types";

/**
 * Helpers de acceso a datos. Este archivo es de Juan: nadie mas lo edita.
 *
 * Reglas que respetan todos estos helpers:
 *
 * 1. Idempotencia por `clientId`. Reintentar una operacion no duplica filas.
 * 2. El dispositivo manda referencias por `clientId` (no por `id` de servidor).
 *    Estos helpers las resuelven con `resolve*ByClientId` antes de escribir.
 * 3. Un `update` nunca pisa `supervisorId` ni `costCenterId` de una visita. Los
 *    asigna el coordinador en el servidor; un dispositivo con copia vieja
 *    revierte la reasignacion si los sobreescribe. Solo se setean al crear.
 *
 * Lewis y Sebastian usan estos helpers en vez de escribir Prisma suelto.
 */

/** Error de negocio. `syncOperation` lo convierte en `SyncOperationResult`. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code:
      | "PARENT_NOT_FOUND"
      | "OWNER_NOT_FOUND"
      | "INVALID_PAYLOAD",
  ) {
    super(message);
    this.name = "DataError";
  }
}

function toDate(iso: string, field: string): Date {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) {
    throw new DataError(`${field} no es una fecha ISO-8601 valida: ${iso}`, "INVALID_PAYLOAD");
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
 * dispositivo. Al actualizar solo se tocan los campos que el dispositivo
 * posee: `status`, check-in y check-out. Los campos de asignacion no se
 * tocan, para que una reasignacion del coordinador no se revierta.
 */
export async function upsertVisit(payload: VisitSyncPayload): Promise<Visit> {
  const data = {
    status: payload.status,
    checkInLat: toNumberOrNull(payload.checkInLat, "checkInLat"),
    checkInLng: toNumberOrNull(payload.checkInLng, "checkInLng"),
    checkInAt: toNullableDate(payload.checkInAt, "checkInAt"),
    checkOutLat: toNumberOrNull(payload.checkOutLat, "checkOutLat"),
    checkOutLng: toNumberOrNull(payload.checkOutLng, "checkOutLng"),
    checkOutAt: toNullableDate(payload.checkOutAt, "checkOutAt"),
    clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
  };

  return prisma.visit.upsert({
    where: { clientId: payload.clientId },
    create: {
      clientId: payload.clientId,
      supervisorId: payload.supervisorId,
      costCenterId: payload.costCenterId,
      ...data,
    },
    update: data,
  });
}

/**
 * Upsert de escaneo QR por `clientId`.
 * `visitClientId` del payload se resuelve a `Visit.id` antes de guardar.
 */
export async function upsertQrScan(payload: QrScanSyncPayload): Promise<QrScan> {
  const visitId = await requireVisitId(payload.visitClientId);

  const data = {
    qrPointId: payload.qrPointId,
    visitId,
    distanceMeters: payload.distanceMeters,
    verified: payload.verified,
  };

  return prisma.qrScan.upsert({
    where: { clientId: payload.clientId },
    create: { clientId: payload.clientId, ...data },
    update: data,
  });
}

/**
 * Upsert de novedad por `clientId`.
 * `visitClientId` del payload se resuelve a `Visit.id` antes de guardar.
 */
export async function upsertNovelty(payload: NoveltySyncPayload): Promise<Novelty> {
  const visitId = await requireVisitId(payload.visitClientId);

  const data = {
    visitId,
    priority: payload.priority,
    status: payload.status,
    description: payload.description,
    clientCreatedAt: toDate(payload.clientCreatedAt, "clientCreatedAt"),
  };

  return prisma.novelty.upsert({
    where: { clientId: payload.clientId },
    create: { clientId: payload.clientId, ...data },
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
export async function upsertEvidence(payload: EvidenceSyncPayload): Promise<Evidence> {
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
    },
    update: { ownerType: payload.ownerType, ownerId, url: payload.url },
  });
}

// --------------------------------------------------------------------------
// Mapeo Prisma -> tipos compartidos
// --------------------------------------------------------------------------
//
// Prisma devuelve `Date`, el contrato compartido usa ISO-8601. Estas
// funciones son el unico puente permitido entre los dos. Los Server
// Components pasan las fechas ya como string; los Server Components que
// llamen a las queries de Sebastian reciben esto, no filas crudas de Prisma.

export function toVisitDTO(visit: Visit): SharedVisit {
  return {
    id: visit.id,
    clientId: visit.clientId,
    supervisorId: visit.supervisorId,
    costCenterId: visit.costCenterId,
    status: visit.status,
    checkInLat: visit.checkInLat,
    checkInLng: visit.checkInLng,
    checkInAt: visit.checkInAt?.toISOString() ?? null,
    checkOutLat: visit.checkOutLat,
    checkOutLng: visit.checkOutLng,
    checkOutAt: visit.checkOutAt?.toISOString() ?? null,
    clientCreatedAt: visit.clientCreatedAt.toISOString(),
    createdAt: visit.createdAt.toISOString(),
    updatedAt: visit.updatedAt.toISOString(),
  };
}

export function toQrScanDTO(scan: QrScan): SharedQrScan {
  return {
    id: scan.id,
    clientId: scan.clientId,
    qrPointId: scan.qrPointId,
    visitId: scan.visitId,
    distanceMeters: scan.distanceMeters,
    verified: scan.verified,
    createdAt: scan.createdAt.toISOString(),
    updatedAt: scan.updatedAt.toISOString(),
  };
}

export function toNoveltyDTO(novelty: Novelty): SharedNovelty {
  return {
    id: novelty.id,
    clientId: novelty.clientId,
    visitId: novelty.visitId,
    priority: novelty.priority,
    status: novelty.status,
    description: novelty.description,
    clientCreatedAt: novelty.clientCreatedAt.toISOString(),
    createdAt: novelty.createdAt.toISOString(),
    updatedAt: novelty.updatedAt.toISOString(),
  };
}

export function toEvidenceDTO(evidence: Evidence): SharedEvidence {
  return {
    id: evidence.id,
    clientId: evidence.clientId,
    ownerType: evidence.ownerType,
    ownerId: evidence.ownerId,
    url: evidence.url,
    createdAt: evidence.createdAt.toISOString(),
    updatedAt: evidence.updatedAt.toISOString(),
  };
}