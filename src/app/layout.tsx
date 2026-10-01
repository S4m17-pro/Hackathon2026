import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#84cc16",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Supervisión de campo",
  description: "Supervisión inteligente de servicios de aseo",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Supervisión",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-zinc-100 font-sans text-zinc-950 antialiased">
        {children}
      </body>
    </html>
  );
}
