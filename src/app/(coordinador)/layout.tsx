import type { ReactNode } from "react";

export default function CoordinadorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header>
        <p>Coordinación</p>
        <nav>
          <a href="/dashboard">Dashboard</a>
          <a href="/asignaciones">Asignaciones</a>
          <a href="/novedades">Novedades</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
