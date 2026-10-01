"use server";

import {
  DataError,
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
}
