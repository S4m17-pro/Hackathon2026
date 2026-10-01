import type { ReactNode } from "react";

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header>
        <p>Supervisor</p>
        <nav>
          <a href="/visitas">Visitas</a>
          <a href="/escanear">Escanear</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
