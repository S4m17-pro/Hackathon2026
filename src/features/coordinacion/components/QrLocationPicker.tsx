"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { MAP_STYLE } from "@/features/coordinacion/components/mapStyle";

const BARRANQUILLA = { lng: -74.7813, lat: 10.9685 };

export function QrLocationPicker({
  center,
  point,
  onPick,
}: {
  center: { lat: number; lng: number } | null;
  point: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focus = point ?? center ?? BARRANQUILLA;
    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [focus.lng, focus.lat],
      zoom: point || center ? 16 : 13,
    });

    let marker: maplibregl.Marker | null = null;

    const showPoint = (lat: number, lng: number) => {
      marker?.remove();
      const element = document.createElement("div");
      element.style.width = "16px";
      element.style.height = "16px";
      element.style.borderRadius = "9999px";
      element.style.background = "#fb923c";
      element.style.border = "2px solid #9a3412";
      marker = new maplibregl.Marker({ element }).setLngLat([lng, lat]).addTo(map);
    };

    map.on("click", (event: maplibregl.MapMouseEvent) => {
      onPickRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    if (point) {
      map.on("load", () => showPoint(point.lat, point.lng));
    }

    return () => {
      marker?.remove();
      map.remove();
    };
  }, [center, point]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-zinc-200"
      />
      <p className="text-sm text-zinc-500">
        {point
          ? `Punto marcado: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
          : "Haz clic en el mapa para ubicar el código."}
      </p>
    </div>
  );
}
