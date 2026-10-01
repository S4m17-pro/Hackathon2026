"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/shared/ui/cn";

const tabs = [
  { href: "/visitas", label: "Visitas" },
  { href: "/escanear", label: "Escanear" },
];

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <div className="hidden min-h-dvh items-center justify-center bg-zinc-950 px-6 text-center md:flex">
        <div className="flex max-w-sm flex-col gap-3 text-zinc-50">
          <p className="text-xs font-medium tracking-[0.2em] text-lime-300 uppercase">
            Supervisor
          </p>
          <h1 className="text-2xl font-semibold">PWA móvil exclusiva para supervisores</h1>
          <p className="text-sm text-zinc-400">
            Abre esta vista en un teléfono o reduce el ancho del navegador.
          </p>
        </div>
      </div>

      <div className="mx-auto block min-h-dvh max-w-md bg-zinc-50 text-zinc-950 md:hidden">
        <div className="pb-24">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-zinc-200 bg-white">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex h-16 flex-1 items-center justify-center text-sm font-medium",
                  active ? "text-zinc-950" : "text-zinc-400",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
