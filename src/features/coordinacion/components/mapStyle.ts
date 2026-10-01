import type { StyleSpecification } from "maplibre-gl";

/** Paleta cercana a un mapa callejero: suelo claro, vías amarillas, edificios en recuadros grises. */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#e8eaed" } },
    {
      id: "landuse-residential",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landuse",
      filter: ["==", ["get", "class"], "residential"],
      paint: { "fill-color": "#f3f0e6" },
    },
    {
      id: "park",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "park",
      paint: { "fill-color": "#c8e6c9" },
    },
    {
      id: "landcover-wood",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": "#d7ead3" },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": "#a7d8f0" },
    },
    {
      id: "building",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      paint: { "fill-color": "#d0d3d8", "fill-outline-color": "#9aa0a6" },
    },
    {
      id: "road-casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      paint: {
        "line-color": "#c6a43a",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 4, 16, 8],
      },
    },
    {
      id: "road",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      paint: {
        "line-color": "#ffe082",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 2.5, 16, 6],
      },
    },
    {
      id: "road-label",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      layout: {
        "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
        "text-size": 11,
        "symbol-placement": "line",
      },
      paint: { "text-color": "#5f6368", "text-halo-color": "#fff8e1", "text-halo-width": 1.2 },
    },
  ],
};

export function circlePolygon(lng: number, lat: number, radiusMeters: number, steps = 64) {
  const earth = 6_378_137;
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = (dy / earth) * (180 / Math.PI);
    const dLng = (dx / (earth * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    ring.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
    properties: {},
  };
}
