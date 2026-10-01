"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { circlePolygon, MAP_STYLE } from "@/features/coordinacion/components/mapStyle";

export function QrSpotMap({
  lat,
  lng,
  radiusMeters,
  label,
}: {
  lat: number;
  lng: number;
  radiusMeters: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [lng, lat],
      zoom: 17,
    });

    let marker: maplibregl.Marker | null = null;

    map.on("load", () => {
      map.addSource("radius", {
        type: "geojson",
        data: circlePolygon(lng, lat, radiusMeters),
      });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": "#fb923c", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": "#c2410c", "line-width": 2 },
      });

      const element = document.createElement("div");
      element.style.width = "16px";
      element.style.height = "16px";
      element.style.borderRadius = "9999px";
      element.style.background = "#fb923c";
      element.style.border = "2px solid #9a3412";
      marker = new maplibregl.Marker({ element })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 12, closeButton: false }).setText(label))
        .addTo(map);
      marker.togglePopup();
    });

    return () => {
      marker?.remove();
      map.remove();
    };
  }, [lat, lng, radiusMeters, label]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-xl border border-zinc-200"
    />
  );
}
