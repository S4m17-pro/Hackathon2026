"use client";

import { CalendarCheck, FileSpreadsheet, LayoutDashboard, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { cn } from "@/shared/ui/cn";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/asignaciones", label: "Asignaciones", icon: CalendarCheck },
  { href: "/novedades", label: "Novedades", icon: TriangleAlert },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet },
];

export default function CoordinadorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-center md:hidden">
        <div className="flex max-w-sm flex-col gap-3 text-zinc-50">
          <p className="text-xs font-medium tracking-[0.2em] text-lime-300 uppercase">
            Coordinación
          </p>
          <h1 className="text-2xl font-semibold">Panel de control exclusivo para escritorio</h1>
          <p className="text-sm text-zinc-400">Amplía la ventana para ver el tablero.</p>
        </div>
      </div>

      <div className="hidden min-h-dvh bg-zinc-100 text-zinc-950 md:flex">
        <aside className="flex w-64 shrink-0 flex-col gap-8 bg-zinc-950 px-5 py-6 text-zinc-100">
          <div className="flex flex-col gap-1">
            <p className="text-xs tracking-[0.18em] text-lime-300 uppercase">Campo</p>
            <p className="text-lg font-semibold">Coordinación</p>
          </div>
          <nav className="flex flex-col gap-1">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                    active ? "bg-white text-zinc-950" : "text-zinc-300 hover:bg-zinc-900",
                  )}
                >
                  <link.icon className="size-4" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            className="mt-auto text-left text-sm text-zinc-400"
            onClick={() => {
              void signOut().then(() => {
                router.push("/login");
                router.refresh();
              });
            }}
          >
            Salir
          </button>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
