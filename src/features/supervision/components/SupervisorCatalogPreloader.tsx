"use client";

import { useEffect } from "react";
import { bulkCacheQrPoints, DEFAULT_SEED_QR_POINTS } from "@/features/supervision/offline/qrLookup";
import type { CachedQrPoint } from "@/features/supervision/offline/db";

export function SupervisorCatalogPreloader({
  points,
}: {
  points?: Array<Omit<CachedQrPoint, "cachedAt">>;
}) {
  useEffect(() => {
    // Si llegan puntos de la base de datos (listQrPoints), los guardamos en Dexie
    if (points && points.length > 0) {
      void bulkCacheQrPoints(points);
    } else {
      // Si la base estaba vacía o inaccesible, aseguramos la precarga de los puntos semilla oficiales
      void bulkCacheQrPoints(DEFAULT_SEED_QR_POINTS);
    }
  }, [points]);

  return null;
}
