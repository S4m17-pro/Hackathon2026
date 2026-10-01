"use client";

import { useEffect } from "react";

import { useSupervisorUiStore } from "@/features/supervision/store";
import { Badge } from "@/shared/ui/badge";

const MOCK_PENDING_COUNT = 3;

export function SyncStatusBadge() {
  const isOnline = useSupervisorUiStore((state) => state.isOnline);
  const pendingCount = useSupervisorUiStore((state) => state.pendingCount);
  const setOnline = useSupervisorUiStore((state) => state.setOnline);
  const setPendingCount = useSupervisorUiStore((state) => state.setPendingCount);

  useEffect(() => {
    const syncOnline = () => setOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, [setOnline]);

  useEffect(() => {
    if (useSupervisorUiStore.getState().pendingCount === 0) {
      setPendingCount(MOCK_PENDING_COUNT);
    }
  }, [setPendingCount]);

  const visibleCount = pendingCount > 0 ? pendingCount : MOCK_PENDING_COUNT;

  return (
    <Badge tone={isOnline ? "online" : "offline"}>
      <span
        className={isOnline ? "size-1.5 rounded-full bg-lime-600" : "size-1.5 rounded-full bg-amber-600"}
        aria-hidden
      />
      {isOnline ? "En línea" : "Sin conexión"}
      <span>· {visibleCount} por enviar</span>
    </Badge>
  );
}
