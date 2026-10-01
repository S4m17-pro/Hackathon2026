export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
