"use server";

import {
  DataError,
  recalculateVisitGeofence,
  upsertChecklistItemResult,
  upsertEvidence,
  upsertNovelty,
  upsertQrScan,
  upsertVisit,
} from "@/shared/lib/data";
import type { OutboxOp, SyncOperationResult } from "@/shared/types";

/**
 * Punto único de sincronización del supervisor.
 * Despacha al helper de Juan según `op.type` (upsert por `clientId`).
 * Un padre ausente vuelve como `ok: false` para que el outbox reintente.
 */
export async function syncOperation(op: OutboxOp): Promise<SyncOperationResult> {
  if (op.clientId !== op.payload.clientId) {
    return {
      ok: false,
      clientId: op.clientId,
      error: "El clientId de la operación y el del payload no coinciden.",
    };
  }

  try {
    const row = await dispatch(op);

    return {
      ok: true,
      clientId: op.clientId,
      serverId: row.id,
    };
import type { OutboxOp, SyncOperationResult, VisitSyncPayload } from "@/shared/types";

/**
 * Punto único de sincronización del supervisor.
 * Despacha al helper de Juan según `op.type` y traduce `DataError` a
 * `SyncOperationResult` con `ok: false`. Un padre ausente no se lanza:
 * el outbox lo reintenta.
 */
export async function syncOperation(op: OutboxOp): Promise<SyncOperationResult> {
  try {
    switch (op.type) {
      case "visit.upsert":
        return await syncVisit(op.clientId, op.payload);

      case "qrScan.upsert": {
        const row = await upsertQrScan(op.payload);
        return ok(op.clientId, row.id);
      }

      case "novelty.upsert": {
        const row = await upsertNovelty(op.payload);
        return ok(op.clientId, row.id);
      }

      case "evidence.upsert": {
        const row = await upsertEvidence(op.payload);
        return ok(op.clientId, row.id);
      }

      case "checklistItem.upsert": {
        const row = await upsertChecklistItemResult(op.payload);
        return ok(op.clientId, row.id);
      }
    }
  } catch (error) {
    return {
      ok: false,
      clientId: op.clientId,
      error: messageFrom(error),
    };
  }
}

async function dispatch(op: OutboxOp) {
  switch (op.type) {
    case "visit.upsert":
      return upsertVisit(op.payload);
    case "qrScan.upsert":
      return upsertQrScan(op.payload);
    case "novelty.upsert":
      return upsertNovelty(op.payload);
    case "evidence.upsert":
      return upsertEvidence(op.payload);
    case "checklistItem.upsert":
      return upsertChecklistItemResult(op.payload);
  }
}

function messageFrom(error: unknown): string {
  if (error instanceof DataError) {
    return error.message;
  }

  if (error instanceof Error && error.name === "DataError") {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Error inesperado al sincronizar.";
      error: error instanceof Error ? error.message : "Error de sincronizacion",
    };
  }
}

async function syncVisit(
  clientId: string,
  payload: VisitSyncPayload,
): Promise<SyncOperationResult> {
  const visit = await upsertVisit(payload);

  if (visit.status === "CANCELLED") {
    return ok(clientId, visit.id);
  }

  if (payload.checkInAt !== null) {
    await recalculateVisitGeofence(visit.id, "checkIn");
  }

  if (payload.checkOutAt !== null) {
    await recalculateVisitGeofence(visit.id, "checkOut");
  }

  return ok(clientId, visit.id);
}

function ok(clientId: string, serverId: string): SyncOperationResult {
  return { ok: true, clientId, serverId };
}
