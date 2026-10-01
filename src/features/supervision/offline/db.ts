import Dexie, { type Table } from "dexie";

import type { OutboxOp, QrPoint } from "@/shared/types";

/**
 * Blob de una evidencia todavía no subida.
 * `clientId` coincide con la operación `evidence.upsert`.
 * `ownerClientId` es el `clientId` de la visita, novedad o escaneo dueño.
 */
export interface LocalPhoto {
  clientId: string;
  ownerClientId: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  createdAt: string;
}

/** Copia local de `QrPoint`. La llave primaria es `code` (lo que lee la cámara). */
export interface CachedQrPoint
  extends Pick<
    QrPoint,
    "code" | "id" | "costCenterId" | "areaName" | "lat" | "lng" | "radiusMeters"
  > {
  cachedAt: string;
}

class SupervisionDB extends Dexie {
  outbox!: Table<OutboxOp, string>;
  photos!: Table<LocalPhoto, string>;
  qrPoints!: Table<CachedQrPoint, string>;

  constructor() {
    super("supervision");

    this.version(1).stores({
      outbox: "clientId, type, status, enqueuedAt",
      photos: "clientId, createdAt",
      qrPoints: "code, id, costCenterId",
    });

    this.version(2).stores({
      outbox: "clientId, type, status, enqueuedAt",
      photos: "clientId, ownerClientId",
      qrPoints: "code, id, costCenterId",
    });
  }
}

export const db = new SupervisionDB();
