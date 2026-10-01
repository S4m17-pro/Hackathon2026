/**
 * Contrato compartido entre el cliente (PWA / outbox) y el servidor.
 * Las fechas viajan como ISO-8601. En Prisma son `DateTime`.
 * `clientId` es el UUID generado en el dispositivo y la clave de idempotencia.
 */

export type Role = "SUPERVISOR" | "COORDINADOR";

export type VisitStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export type NoveltyPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type NoveltyStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";

export type EvidenceOwnerType = "VISIT" | "NOVELTY" | "QR_SCAN";

export type OutboxStatus = "pending" | "syncing" | "failed";

export type OutboxOpType =
  | "visit.upsert"
  | "qrScan.upsert"
  | "novelty.upsert"
  | "evidence.upsert";

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
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  clientId: string;
  supervisorId: string;
  costCenterId: string;
  status: VisitStatus;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAt: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QrPoint {
  id: string;
  code: string;
  costCenterId: string;
  areaName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface Novelty {
  id: string;
  clientId: string;
  visitId: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  description: string;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  clientId: string;
  ownerType: EvidenceOwnerType;
  ownerId: string;
  url: string;
  createdAt: string;
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
  checkInAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutAt: string | null;
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
}

export interface NoveltySyncPayload {
  clientId: string;
  visitClientId: string;
  priority: NoveltyPriority;
  status: NoveltyStatus;
  description: string;
  clientCreatedAt: string;
}

/**
 * `ownerClientId` es el `clientId` del dueño (visita, novedad o escaneo).
 * El servidor lo resuelve a `ownerId` según `ownerType`.
 * `url` queda vacío hasta que el route handler de fotos responda.
 */
export interface EvidenceSyncPayload {
  clientId: string;
  ownerType: EvidenceOwnerType;
  ownerClientId: string;
  url: string;
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
  | (OutboxOpBase & { type: "evidence.upsert"; payload: EvidenceSyncPayload });

export interface SyncOperationResult {
  ok: boolean;
  clientId: string;
  serverId?: string;
  error?: string;
}
