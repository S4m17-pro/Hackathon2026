import { syncOperation } from "@/features/supervision/actions";
import { db } from "@/features/supervision/offline/db";
import { useSupervisorUiStore } from "@/features/supervision/store";
import type {
  EvidenceSyncPayload,
  NoveltySyncPayload,
  OutboxOp,
  OutboxOpType,
  OutboxStatus,
  QrScanSyncPayload,
  VisitSyncPayload,
} from "@/shared/types";

/**
 * Generador de UUID v4 criptográficamente seguro con fallback para entornos móviles.
 */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback estándar RFC 4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Actualiza el contador de operaciones pendientes en el estado global (Zustand).
 */
export async function refreshPendingCount(): Promise<number> {
  try {
    const count = await db.outbox
      .where("status")
      .anyOf("pending", "failed", "syncing")
      .count();

    if (typeof window !== "undefined") {
      useSupervisorUiStore.getState().setPendingCount(count);
    }

    return count;
  } catch (error) {
    console.error("Error al obtener conteo de pendientes de Dexie:", error);
    return 0;
  }
}

/**
 * Encola una operación genérica en Dexie (`db.outbox`) con garantía de idempotencia.
 */
export async function enqueueOutboxOp(op: OutboxOp): Promise<void> {
  if (op.clientId !== op.payload.clientId) {
    throw new Error(
      `Inconsistencia: el clientId (${op.clientId}) debe ser idéntico al de su payload (${op.payload.clientId})`
    );
  }

  await db.outbox.put(op);
  await refreshPendingCount();
}

/**
 * Encola una operación de Visita (Check-in, Check-out o creación).
 */
export async function enqueueVisit(
  payload: Omit<VisitSyncPayload, "clientId" | "clientCreatedAt"> & {
    clientId?: string;
    clientCreatedAt?: string;
  }
): Promise<OutboxOp> {
  const clientId = payload.clientId ?? generateClientId();
  const clientCreatedAt = payload.clientCreatedAt ?? new Date().toISOString();

  const fullPayload: VisitSyncPayload = {
    ...payload,
    clientId,
    clientCreatedAt,
  };

  const op: OutboxOp = {
    clientId,
    type: "visit.upsert",
    payload: fullPayload,
    status: "pending",
    attempts: 0,
    lastError: null,
    enqueuedAt: new Date().toISOString(),
  };

  await enqueueOutboxOp(op);
  return op;
}

/**
 * Encola un Escaneo de código QR asociado a una visita.
 */
export async function enqueueQrScan(
  payload: Omit<QrScanSyncPayload, "clientId"> & {
    clientId?: string;
  }
): Promise<OutboxOp> {
  const clientId = payload.clientId ?? generateClientId();

  const fullPayload: QrScanSyncPayload = {
    ...payload,
    clientId,
  };

  const op: OutboxOp = {
    clientId,
    type: "qrScan.upsert",
    payload: fullPayload,
    status: "pending",
    attempts: 0,
    lastError: null,
    enqueuedAt: new Date().toISOString(),
  };

  await enqueueOutboxOp(op);
  return op;
}

/**
 * Encola una Novedad reportada en campo con su respectiva prioridad y descripción.
 */
export async function enqueueNovelty(
  payload: Omit<NoveltySyncPayload, "clientId" | "clientCreatedAt"> & {
    clientId?: string;
    clientCreatedAt?: string;
  }
): Promise<OutboxOp> {
  const clientId = payload.clientId ?? generateClientId();
  const clientCreatedAt = payload.clientCreatedAt ?? new Date().toISOString();

  const fullPayload: NoveltySyncPayload = {
    ...payload,
    clientId,
    clientCreatedAt,
  };

  const op: OutboxOp = {
    clientId,
    type: "novelty.upsert",
    payload: fullPayload,
    status: "pending",
    attempts: 0,
    lastError: null,
    enqueuedAt: new Date().toISOString(),
  };

  await enqueueOutboxOp(op);
  return op;
}

/**
 * Encola el registro de una Evidencia (fotografía u otro adjunto).
 */
export async function enqueueEvidence(
  payload: Omit<EvidenceSyncPayload, "clientId"> & {
    clientId?: string;
  }
): Promise<OutboxOp> {
  const clientId = payload.clientId ?? generateClientId();

  const fullPayload: EvidenceSyncPayload = {
    ...payload,
    clientId,
  };

  const op: OutboxOp = {
    clientId,
    type: "evidence.upsert",
    payload: fullPayload,
    status: "pending",
    attempts: 0,
    lastError: null,
    enqueuedAt: new Date().toISOString(),
  };

  await enqueueOutboxOp(op);
  return op;
}

/**
 * Obtiene todas las operaciones pendientes o fallidas en estricto orden cronológico.
 */
export async function listRetryableOutboxOps(): Promise<OutboxOp[]> {
  return db.outbox
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("enqueuedAt");
}

/**
 * Actualiza el estado de una operación en la cola.
 */
export async function markOutboxOp(
  clientId: string,
  patch: Partial<Pick<OutboxOp, "status" | "attempts" | "lastError">>
): Promise<void> {
  await db.outbox.update(clientId, patch);
}

/**
 * Elimina una operación completada de la cola outbox.
 */
export async function removeOutboxOp(clientId: string): Promise<void> {
  await db.outbox.delete(clientId);
  await refreshPendingCount();
}

export interface SyncSummary {
  total: number;
  synced: number;
  failed: number;
  skipped: boolean;
  errors: Array<{ clientId: string; type: OutboxOpType; error: string }>;
}

// Candado en memoria para evitar ejecuciones concurrentes de syncAll
let isSyncInProgress = false;

/**
 * Procesa la cola de operaciones pendientes en orden cronológico (FIFO).
 * Ejecuta la Server Action `syncOperation` para cada registro.
 *
 * En caso de éxito, elimina el registro de la tabla outbox local.
 * En caso de fallo o desconexión, actualiza los reintentos y preserva los datos
 * para la siguiente sincronización.
 */
export async function syncAll(): Promise<SyncSummary> {
  if (isSyncInProgress) {
    return {
      total: 0,
      synced: 0,
      failed: 0,
      skipped: true,
      errors: [],
    };
  }

  // Si el navegador reporta estar fuera de línea, no desgastamos reintentos
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (typeof window !== "undefined") {
      useSupervisorUiStore.getState().setOnline(false);
    }
    return {
      total: 0,
      synced: 0,
      failed: 0,
      skipped: true,
      errors: [{ clientId: "NETWORK", type: "visit.upsert", error: "Dispositivo sin conexión a internet" }],
    };
  }

  isSyncInProgress = true;
  if (typeof window !== "undefined") {
    useSupervisorUiStore.getState().setSyncing(true);
  }

  const summary: SyncSummary = {
    total: 0,
    synced: 0,
    failed: 0,
    skipped: false,
    errors: [],
  };

  try {
    const pendingOps = await listRetryableOutboxOps();
    summary.total = pendingOps.length;

    if (pendingOps.length === 0) {
      return summary;
    }

    for (const op of pendingOps) {
      // Marcamos estado local como 'syncing'
      await markOutboxOp(op.clientId, { status: "syncing" });

      try {
        // Si es una evidencia fotográfica guardada en IndexedDB, subimos primero el blob a /api/photos
        if (op.type === "evidence.upsert" && (!op.payload.url || !op.payload.url.startsWith("/"))) {
          const localPhoto = await db.photos.get(op.clientId);
          if (localPhoto) {
            const formData = new FormData();
            formData.append("clientId", op.clientId);
            formData.append("file", localPhoto.blob, localPhoto.fileName);

            const uploadRes = await fetch("/api/photos", {
              method: "POST",
              body: formData,
            });

            if (!uploadRes.ok) {
              const errJson = await uploadRes.json().catch(() => ({}));
              throw new Error(errJson.error ?? `Error al subir foto (HTTP ${uploadRes.status})`);
            }

            const uploadData = await uploadRes.json();
            if (uploadData.url) {
              op.payload.url = uploadData.url;
            }
          }
        }

        const result = await syncOperation(op);

        if (result.ok) {
          // Éxito: eliminamos la operación y su foto local de Dexie
          await db.outbox.delete(op.clientId);
          await db.photos.delete(op.clientId);
          summary.synced += 1;
        } else {
          // El servidor devolvió un error de validación o procesamiento
          const nextAttempts = (op.attempts || 0) + 1;
          const errorMsg = result.error ?? "Error desconocido en el servidor";

          await markOutboxOp(op.clientId, {
            status: "failed",
            attempts: nextAttempts,
            lastError: errorMsg,
          });

          summary.failed += 1;
          summary.errors.push({
            clientId: op.clientId,
            type: op.type,
            error: errorMsg,
          });
        }
      } catch (networkOrSystemError) {
        // Error de red, timeout o excepción inesperada durante la llamada
        const nextAttempts = (op.attempts || 0) + 1;
        const errorMsg =
          networkOrSystemError instanceof Error
            ? networkOrSystemError.message
            : "Error de red al sincronizar con el servidor";

        await markOutboxOp(op.clientId, {
          status: "failed",
          attempts: nextAttempts,
          lastError: errorMsg,
        });

        summary.failed += 1;
        summary.errors.push({
          clientId: op.clientId,
          type: op.type,
          error: errorMsg,
        });

        // Si se detecta desconexión total durante la transmisión, detenemos el lote
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          if (typeof window !== "undefined") {
            useSupervisorUiStore.getState().setOnline(false);
          }
          break;
        }
      }
    }
  } finally {
    isSyncInProgress = false;
    await refreshPendingCount();

    if (typeof window !== "undefined") {
      useSupervisorUiStore.getState().setSyncing(false);
    }
  }

  return summary;
}
