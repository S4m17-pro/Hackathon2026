"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { refreshPendingCount } from "@/features/supervision/offline/outbox";
import { useSupervisorUiStore } from "@/features/supervision/store";
import { Badge } from "@/shared/ui/badge";

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
    void refreshPendingCount().then((count) => setPendingCount(count));
  }, [setPendingCount]);

  return (
    <Badge tone={isOnline ? "online" : "offline"}>
      {isOnline ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
      {isOnline ? "En línea" : "Sin conexión"}
      <span>· {pendingCount} por enviar</span>
    </Badge>
  );
}
