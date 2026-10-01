"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { refreshPendingCount, syncAll } from "@/features/supervision/offline/outbox";
import { useSupervisorUiStore } from "@/features/supervision/store";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

const DOCUMENTS = "supervision-docs-v1";
const ASSETS = "supervision-assets-v1";
const SHELL = ["/login", "/visitas", "/escanear"];

export function SyncStatusBadge() {
  const isOnline = useSupervisorUiStore((state) => state.isOnline);
  const isSyncing = useSupervisorUiStore((state) => state.isSyncing);
  const pendingCount = useSupervisorUiStore((state) => state.pendingCount);
  const setOnline = useSupervisorUiStore((state) => state.setOnline);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshPendingCount();
    void registerAndWarm();
    void syncAll();

    function onOnline() {
      setOnline(true);
      void syncAll();
    }

    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [setOnline]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={isOnline ? "online" : "offline"}>
        {isOnline ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
        {isOnline ? "En línea" : "Sin conexión"}
        <span>· {pendingCount} por enviar</span>
      </Badge>
      <Button
        size="sm"
        variant="outline"
        disabled={!isOnline || isSyncing || pendingCount === 0}
        onClick={() => void syncAll()}
      >
        {isSyncing ? "Enviando…" : "Enviar"}
      </Button>
    </div>
  );
}

async function registerAndWarm() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  await warmShell();
}

async function warmShell() {
  if (!("caches" in window)) {
    return;
  }

  const documents = await caches.open(DOCUMENTS);
  await Promise.all(SHELL.map((path) => putIfOk(documents, path)));

  const assets = await caches.open(ASSETS);
  const urls = new Set<string>();
  document.querySelectorAll("script[src], link[rel='stylesheet'][href]").forEach((node) => {
    if (node instanceof HTMLScriptElement && node.src) {
      urls.add(node.src);
    }
    if (node instanceof HTMLLinkElement && node.href) {
      urls.add(node.href);
    }
  });

  await Promise.all([...urls].map((url) => putIfOk(assets, url)));
}

async function putIfOk(cache: Cache, url: string) {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (response.ok && !response.redirected) {
      await cache.put(url, response);
    }
  } catch {
    // Sin red no hay nada nuevo que guardar.
  }
}
