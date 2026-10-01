"use client";

import { ClipboardList, QrCode, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { SyncStatusBadge } from "@/features/supervision/components/SyncStatusBadge";
import { cn } from "@/shared/ui/cn";

const tabs: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/visitas", label: "Visitas", icon: ClipboardList },
  { href: "/escanear", label: "Escanear", icon: QrCode },
];

export default function SupervisorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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
        <div className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
          <SyncStatusBadge />
        </div>
        <div className="pb-24">{children}</div>
        <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-zinc-200 bg-white">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-zinc-950" : "text-zinc-400",
                )}
              >
                <tab.icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="px-3 text-xs text-zinc-400"
            onClick={() => {
              void signOut().then(() => {
                router.push("/login");
                router.refresh();
              });
            }}
          >
            Salir
          </button>
        </nav>
      </div>
    </>
  );
}
