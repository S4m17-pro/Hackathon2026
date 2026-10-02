"use client";

import {
  CalendarCheck,
  FileSearch,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Radio,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { cn } from "@/shared/ui/cn";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/asignaciones", label: "Asignaciones", icon: CalendarCheck },
  { href: "/novedades", label: "Novedades", icon: TriangleAlert },
  { href: "/documentos", label: "Documentos", icon: FileSearch },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet },
];

export default function CoordinadorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-6 text-center md:hidden">
        <div className="flex max-w-sm flex-col gap-3 text-zinc-50">
          <p className="text-xs font-medium tracking-[0.2em] text-lime-400 uppercase">
            Coordinación
          </p>
          <h1 className="text-2xl font-semibold">Panel de control exclusivo para escritorio</h1>
          <p className="text-sm text-zinc-400">Amplía la ventana para ver el tablero.</p>
        </div>
      </div>

      <div className="hidden h-dvh bg-zinc-100 text-zinc-950 md:flex overflow-hidden">
        <aside className="flex w-64 shrink-0 flex-col gap-6 bg-zinc-950 px-5 py-6 text-zinc-100 border-r border-zinc-800/80 h-full overflow-y-auto">
          <div className="flex items-center gap-3 px-1">
            <div className="flex size-10 items-center justify-center rounded-xl bg-lime-400/10 text-lime-400 border border-lime-400/20">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-lime-400 uppercase">
                <Radio className="size-2.5 animate-pulse" /> Operación
              </span>
              <p className="text-base font-bold text-white tracking-tight">Coordinación</p>
            </div>
          </div>

          <div className="h-px w-full bg-zinc-800/80" />

          <nav className="flex flex-col gap-1.5">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  prefetch={true}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-white text-zinc-950 shadow-xs font-semibold"
                      : "text-zinc-400 hover:bg-zinc-900/90 hover:text-zinc-100",
                  )}
                >
                  <link.icon
                    className={cn(
                      "size-4.5 transition-colors",
                      active ? "text-zinc-950" : "text-zinc-400 group-hover:text-zinc-200",
                    )}
                    aria-hidden
                  />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3 pt-4">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
              <p className="text-xs font-medium text-zinc-300">Modo Coordinador</p>
              <p className="text-[11px] text-zinc-400">Control central y telemetría</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-rose-400 transition-colors cursor-pointer text-left"
              onClick={() => {
                void signOut().then(() => {
                  router.push("/login");
                  router.refresh();
                });
              }}
            >
              <LogOut className="size-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>
        <div className="min-w-0 flex-1 h-full overflow-y-auto overflow-x-hidden">{children}</div>
      </div>
    </>
  );
}
