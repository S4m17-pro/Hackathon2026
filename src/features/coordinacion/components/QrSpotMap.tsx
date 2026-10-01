"use client";

import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function FocusPoint({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lng], 17);
    const timer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(timer);
  }, [lat, lng, map]);

  return null;
}

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
  return (
    <div className="h-64 w-full overflow-hidden rounded-xl border border-zinc-200">
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <FocusPoint lat={lat} lng={lng} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle
          center={[lat, lng]}
          radius={radiusMeters}
          pathOptions={{ color: "#c2410c", fillColor: "#fb923c", fillOpacity: 0.2, weight: 2 }}
        />
        <CircleMarker
          center={[lat, lng]}
          radius={8}
          pathOptions={{ color: "#9a3412", fillColor: "#fb923c", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top">
            {label}
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
