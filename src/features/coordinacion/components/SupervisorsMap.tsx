"use client";

import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

/** Vista inicial por defecto: Bogotá D.C. (donde operan los centros de costo del sistema). */
const BOGOTA_CENTER: [number, number] = [4.6784, -74.0681];

export interface MapCostCenter {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MapSupervisor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  checkInLabel: string;
}

export interface MapScannedQr {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

/**
 * Controlador interno para resolver el bug de 'pantalla gris' de Leaflet en Next.js
 * ejecutando invalidateSize() tras el montaje y ajustando automáticamente el encuadre (fitBounds).
 */
function MapController({
  centers,
  supervisors,
  scans,
}: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  const map = useMap();

  useEffect(() => {
    // 1. Resuelve el renderizado gris forzando el cálculo de dimensiones del contenedor
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  useEffect(() => {
    // 2. Encuadre dinámico de los sitios y supervisores
    const allCoords: [number, number][] = [];

    centers.forEach((c) => {
      if (typeof c.lat === "number" && typeof c.lng === "number") {
        allCoords.push([c.lat, c.lng]);
      }
    });

    supervisors.forEach((person) => {
      if (typeof person.lat === "number" && typeof person.lng === "number") {
        allCoords.push([person.lat, person.lng]);
      }
    });

    scans.forEach((scan) => {
      if (typeof scan.lat === "number" && typeof scan.lng === "number") {
        allCoords.push([scan.lat, scan.lng]);
      }
    });

    if (allCoords.length === 1) {
      map.setView(allCoords[0], 14);
    } else if (allCoords.length > 1) {
      map.fitBounds(allCoords, { padding: [50, 50], maxZoom: 15 });
    }
  }, [centers, supervisors, scans, map]);

  return null;
}

export function SupervisorsMap({
  centers,
  supervisors,
  scans,
}: {
  centers: MapCostCenter[];
  supervisors: MapSupervisor[];
  scans: MapScannedQr[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <style>{`
        .field-map .leaflet-container {
          height: 32rem;
          width: 100%;
          background: #fff;
        }
        .field-map .leaflet-container img.leaflet-tile {
          max-width: none !important;
          max-height: none !important;
        }
      `}</style>
      <div className="field-map relative h-[32rem] w-full overflow-hidden rounded-2xl border border-zinc-200">
        <MapContainer
          center={BOGOTA_CENTER}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <MapController centers={centers} supervisors={supervisors} scans={scans} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            noWrap
          />

          {/* Marcadores de Centros de Costo */}
          {centers.map((center) => (
            <CircleMarker
              key={center.id}
              center={[center.lat, center.lng]}
              radius={10}
              pathOptions={{
                color: "#09090b",
                fillColor: "#18181b",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Tooltip permanent={false} direction="top">
                <span className="font-semibold">{center.name}</span>
                <br />
                <span className="text-xs text-zinc-500">
                  {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                </span>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Marcadores de Supervisores (Última posición GPS) */}
          {supervisors.map((person) => (
            <CircleMarker
              key={person.id}
              center={[person.lat, person.lng]}
              radius={9}
              pathOptions={{
                color: "#3f6212",
                fillColor: "#84cc16",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Tooltip permanent={false} direction="top">
                <span className="font-semibold">{person.name}</span>
                <br />
                <span className="text-xs">Último check-in: {person.checkInLabel}</span>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Marcadores de Escaneos de Códigos QR */}
          {scans.map((scan) => (
            <CircleMarker
              key={scan.id}
              center={[scan.lat, scan.lng]}
              radius={7}
              pathOptions={{
                color: "#9a3412",
                fillColor: "#fb923c",
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Tooltip direction="top">
                <span className="text-xs font-semibold">{scan.label}</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-zinc-950" />
            Centros de costo ({centers.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-lime-500" />
            Supervisores en campo ({supervisors.length})
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-orange-400" />
            QR escaneados ({scans.length})
          </span>
        </div>
        {supervisors.length === 0 ? (
          <span className="text-xs text-zinc-400">
            Sin check-ins de supervisores activos hoy.
          </span>
        ) : null}
      </div>
    </section>
  );
}
