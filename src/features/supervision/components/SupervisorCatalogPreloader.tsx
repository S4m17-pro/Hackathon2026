"use client";

import { useEffect } from "react";
import type { CachedQrPoint } from "@/features/supervision/offline/db";
import { bulkCacheQrPoints, dropRetiredQrPoints } from "@/features/supervision/offline/qrLookup";

export function SupervisorCatalogPreloader({
  points,
}: {
  points?: Array<Omit<CachedQrPoint, "cachedAt">>;
}) {
  useEffect(() => {
    void dropRetiredQrPoints();
    if (points && points.length > 0) {
      void bulkCacheQrPoints(points);
    }
  }, [points]);

  return null;
}
