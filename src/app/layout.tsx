import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Supervisión de campo",
  description: "Supervisión inteligente de servicios de aseo",
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
