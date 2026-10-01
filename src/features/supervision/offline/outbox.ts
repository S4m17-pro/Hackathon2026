import { db } from "@/features/supervision/offline/db";
import type { OutboxOp } from "@/shared/types";

/**
 * Guarda o reemplaza la operación pendiente de una entidad.
 * `clientId` es la llave primaria: un reintento no duplica la fila.
 */
export async function enqueueOutboxOp(op: OutboxOp): Promise<void> {
  if (op.clientId !== op.payload.clientId) {
    throw new Error("El clientId de la operación y el del payload deben coincidir.");
  }

  await db.outbox.put(op);
}

export async function listRetryableOutboxOps(): Promise<OutboxOp[]> {
  return db.outbox
    .where("status")
    .anyOf("pending", "failed")
    .sortBy("enqueuedAt");
}

export async function markOutboxOp(
  clientId: string,
  patch: Partial<Pick<OutboxOp, "status" | "attempts" | "lastError">>,
): Promise<void> {
  await db.outbox.update(clientId, patch);
}

export async function removeOutboxOp(clientId: string): Promise<void> {
  await db.outbox.delete(clientId);
}
