import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Supervisión Inteligente de Servicios en Campo",
    short_name: "Supervisión",
    description:
      "Control, trazabilidad, evidencias fotográficas y escaneo QR offline para supervisores y coordinadores.",
    start_url: "/visitas",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#84cc16",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
