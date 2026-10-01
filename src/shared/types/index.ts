/**
 * Contrato compartido entre el cliente (PWA / outbox) y el servidor.
 * Las fechas viajan como ISO-8601. En Prisma son `DateTime`.
 *
 * `clientId` es el UUID generado en el dispositivo y la clave de idempotencia
 * (regla 2 del MICRO_SDD). Todo payload que nace en el dispositivo lo lleva.
 *
 * Doble timestamp (regla 5, CA-05): los registros que nacen en el dispositivo
 * exponen DOS fechas. `clientCreatedAt` es la hora local del hecho, intocable.
 * `receivedAt` es la hora en que el servidor lo recibio. El panel debe mostrar
 * `clientCreatedAt`; `receivedAt` sirve para auditoria de sincronizacion.
 */

export type Role = "SUPERVISOR" | "COORDINADOR";

export type VisitStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export type NoveltyPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type NoveltyStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

export type EvidenceOwnerType = "VISIT" | "NOVELTY" | "QR_SCAN" | "CHECKLIST_ITEM";

export type ChecklistItemStatus = "PENDING" | "DONE" | "NOT_DONE";

export type OutboxStatus = "pending" | "syncing" | "failed";

export type OutboxOpType =
  | "visit.upsert"
  | "qrScan.upsert"
  | "novelty.upsert"
  | "evidence.upsert"
  | "checklistItem.upsert";

/**
 * `passwordHash` no aparece aca a proposito (RNF-07). Esta vista de User es la
 * que viaja al cliente; el hash nunca sale del servidor.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface CostCenter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /** RF-ASI-03: plantilla de checklist asociada por defecto. */
  checklistTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  clientId: string;
  supervisorId: string;
  costCenterId: string;
  status: VisitStatus;

  /** Copia de la plantilla para poder diligenciarla sin red (RF-OFF-01). */
  checklistTemplateId: string | null;

  checkInLat: number | null;
  checkInLng: number | null;
  /** Precision GPS en metros, reportada por el dispositivo. */
  checkInAccuracyM: number | null;
  checkInAt: string | null;
  /** Distancia recalculada por el servidor al sincronizar (regla 3). */
  checkInDistanceM: number | null;
  /** true = dentro del radio tolerado. */
  checkInVerified: boolean;
  /** Regla 3: estar fuera de rango marca, no bloquea el check-in. */
  checkInOutOfRange: boolean;

  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracyM: number | null;
  checkOutAt: string | null;
  checkOutDistanceM: number | null;
  checkOutVerified: boolean;
  checkOutOutOfRange: boolean;
  /** RF-VIS-02: observaciones de cierre. */
  checkOutNotes: string | null;
  /** RF-SUP-03: observaciones generales de la visita. */
  notes: string | null;

  /** Regla 5. Hora del dispositivo. */
  clientCreatedAt: string;
  /** Regla 5. Hora de recepcion en el servidor. */
  receivedAt: string;
  updatedAt: string;
}

export interface QrPoint {
  id: string;
  code: string;
  costCenterId: string;
  areaName: string;
  lat: number;
  lng: number;
  /** Default 50 m segun RF-QR-01. */
  radiusMeters: number;
  /** RF-QR-02 / RF-QR-06: inactivo es distinto de inexistente. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QrScan {
  id: string;
  clientId: string;
  qrPointId: string;
  visitId: string;
  distanceMeters: number;
  verified: boolean;
  /** CA-05: momento del escaneo en campo. */
  clientCreatedAt: string;
  receivedAt: string;
  updatedAt: string;
}

export interface Novelty {
  id: string;
  clientId: string;
  visitId: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  description: string;
  /** RF-NOV-01. Null si el usuario no concedio GPS (RNF-10). */
  lat: number | null;
  lng: number | null;
  /** Regla 4: los tres son obligatorios si `status = RESOLVED`. */
  closedAt: string | null;
  closedById: string | null;
  resolutionAction: string | null;
  clientCreatedAt: string;
  receivedAt: string;
  updatedAt: string;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  createdById: string | null;
  isActive: boolean;
  items: ChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  costCenterId: string | null;
  label: string;
  position: number;
  /** Si es obligatorio, no puede quedar PENDING al cerrar la visita. */
  required: boolean;
}

/** Un item de checklist diligenciado por el supervisor en una visita. */
export interface ChecklistItemResult {
  id: string;
  clientId: string;
  visitId: string;
  itemId: string;
  status: ChecklistItemStatus;
  /** RF-SUP-02. */
  comment: string | null;
  clientCreatedAt: string;
  receivedAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  clientId: string;
  ownerType: EvidenceOwnerType;
  ownerId: string;
  url: string;
  /** CA-05: hora en que se tomo la foto en campo. */
  clientCreatedAt: string;
  receivedAt: string;
  updatedAt: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Campos que el dispositivo conoce al hacer check-in / check-out. */
export interface VisitSyncPayload {
  clientId: string;
  supervisorId: string;
  costCenterId: string;
  status: VisitStatus;

  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracyM: number | null;
  checkInAt: string | null;
  checkInDistanceM: number | null;
  checkInVerified: boolean;
  checkInOutOfRange: boolean;

  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAccuracyM: number | null;
  checkOutAt: string | null;
  checkOutDistanceM: number | null;
  checkOutVerified: boolean;
  checkOutOutOfRange: boolean;
  checkOutNotes: string | null;
  notes: string | null;

  clientCreatedAt: string;
}

/**
 * `visitClientId` es el `clientId` de la visita padre.
 * El servidor lo resuelve a `Visit.id` antes del upsert.
 */
export interface QrScanSyncPayload {
  clientId: string;
  qrPointId: string;
  visitClientId: string;
  distanceMeters: number;
  verified: boolean;
  /** Regla 5. */
  clientCreatedAt: string;
}

export interface NoveltySyncPayload {
  clientId: string;
  visitClientId: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  description: string;
  /** RF-NOV-01. */
  lat: number | null;
  lng: number | null;
  clientCreatedAt: string;
}

/**
 * `ownerClientId` es el `clientId` del dueño (visita, novedad, escaneo o item
 * de checklist). El servidor lo resuelve a `ownerId` segun `ownerType`.
 * `url` queda vacio hasta que el route handler de fotos responda.
 */
export interface EvidenceSyncPayload {
  clientId: string;
  ownerType: EvidenceOwnerType;
  ownerClientId: string;
  url: string;
  /** CA-05: hora de la toma en campo, no la de subida. */
  clientCreatedAt: string;
}

/** RF-SUP-02. Se crea en el dispositivo cuando el supervisor marca el item. */
export interface ChecklistItemResultSyncPayload {
  clientId: string;
  visitClientId: string;
  itemId: string;
  status: ChecklistItemStatus;
  comment: string | null;
  /** Regla 5. */
  clientCreatedAt: string;
}

interface OutboxOpBase {
  /** Llave primaria en Dexie y clave de `prisma.upsert`. */
  clientId: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  /** ISO-8601. Momento en que el dispositivo encoló la operación. */
  enqueuedAt: string;
}

export type OutboxOp =
  | (OutboxOpBase & { type: "visit.upsert"; payload: VisitSyncPayload })
  | (OutboxOpBase & { type: "qrScan.upsert"; payload: QrScanSyncPayload })
  | (OutboxOpBase & { type: "novelty.upsert"; payload: NoveltySyncPayload })
  | (OutboxOpBase & { type: "evidence.upsert"; payload: EvidenceSyncPayload })
  | (OutboxOpBase & {
      type: "checklistItem.upsert";
      payload: ChecklistItemResultSyncPayload;
    });

export interface SyncOperationResult {
  ok: boolean;
  clientId: string;
  serverId?: string;
  error?: string;
}