import Dexie, { type Table } from "dexie";

import type { OutboxOp } from "@/shared/types";

/**
 * Blob de una evidencia todavía no subida.
 * `clientId` coincide con `Evidence.clientId` / la operación `evidence.upsert`.
 */
export interface LocalPhoto {
  clientId: string;
  blob: Blob;
  mimeType: string;
  fileName: string;
  createdAt: string;
}

/**
 * Copia local de `QrPoint` para validar un escaneo sin red.
 * La llave primaria es `code` (lo que lee la cámara).
 */
export interface CachedQrPoint {
  code: string;
  id: string;
  costCenterId: string;
  areaName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
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
  }
}

export const db = new SupervisionDB();
