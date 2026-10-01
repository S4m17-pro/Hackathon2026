"use client";

import { QrCode } from "lucide-react";
import { useRouter } from "next/navigation";

import type { VisitStatus } from "@/shared/types";
import { Button } from "@/shared/ui/button";

interface CheckInVisit {
  clientId: string;
  status: VisitStatus;
}

export function CheckInButton({ visit }: { visit: CheckInVisit }) {
  const router = useRouter();
  const done = visit.status === "COMPLETED" || visit.status === "CANCELLED";
  const started = visit.status === "IN_PROGRESS";

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="contrast"
        size="lg"
        className="w-full gap-2"
        disabled={done}
        onClick={() => router.push(`/escanear?visita=${encodeURIComponent(visit.clientId)}`)}
      >
        <QrCode className="size-5" aria-hidden />
        {done ? "Visita cerrada" : started ? "Escanear otra área" : "Llegué: escanear código"}
      </Button>
      {done ? null : (
        <p className="text-sm text-zinc-500">
          {started
            ? "El código abre el formulario de esa área."
            : "Primero el código del área. Después se guarda tu ubicación y se abre el formulario."}
        </p>
      )}
    </div>
  );
}
