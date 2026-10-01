"use server";

import { getSession } from "@/app/(auth)/session";
import {
  DataError,
  recalculateVisitGeofence,
  upsertChecklistItemResult,
  upsertEvidence,
  upsertNovelty,
  upsertQrScan,
  upsertVisit,
} from "@/shared/lib/data";
import type { OutboxOp, SyncOperationResult, VisitSyncPayload } from "@/shared/types";

/**
 * Punto único de sincronización del supervisor.
 * Despacha al helper de Juan según `op.type` y traduce `DataError` a
 * `SyncOperationResult` con `ok: false`. Un padre ausente no se lanza:
 * el outbox lo reintenta.
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
        const session = await getSession();

        if (!session || session.role !== "SUPERVISOR") {
          return {
            ok: false,
            clientId: op.clientId,
            error: "La evidencia solo la envia un supervisor con sesion activa.",
          };
        }

        const row = await upsertEvidence(op.payload, session.id);
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
