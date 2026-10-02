"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

const BOGOTA = { lng: -74.0681, lat: 4.6784 };

function createPickerIcon() {
  return L.divIcon({
    className: "custom-picker-pin",
    html: `<div style="
      width: 18px;
      height: 18px;
      border-radius: 9999px;
      background-color: #ea580c;
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -9],
  });
}

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
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focus = point ?? center ?? BOGOTA;
    const map = L.map(container, {
      center: [focus.lat, focus.lng],
      zoom: point || center ? 16 : 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    const updateMarker = (lat: number, lng: number) => {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], { icon: createPickerIcon() }).addTo(map);
      }
    };

    if (point) {
      updateMarker(point.lat, point.lng);
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      updateMarker(e.latlng.lat, e.latlng.lng);
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      markerRef.current = null;
    };
  }, [center, point]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-2xl border border-zinc-200 shadow-xs z-0 cursor-crosshair"
    />
  );
}
