"use server";

import type { OutboxOp, SyncOperationResult } from "@/shared/types";

/**
 * Punto único de sincronización del supervisor.
 * Cada operación debe hacer `prisma.upsert` por `clientId`.
 */
export async function syncOperation(op: OutboxOp): Promise<SyncOperationResult> {
  return {
    ok: false,
    clientId: op.clientId,
    error: "syncOperation pendiente de implementación",
  };
}
