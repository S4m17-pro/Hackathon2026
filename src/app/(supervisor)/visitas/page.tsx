import { CheckInButton } from "@/features/supervision/components/CheckInButton";
import { SyncStatusBadge } from "@/features/supervision/components/SyncStatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default function VisitasPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-zinc-500 uppercase">Hoy</p>
          <h1 className="text-2xl font-semibold">Visitas</h1>
        </div>
        <SyncStatusBadge />
      </header>

      <Card>
        <CardHeader>
          <CardDescription>08:00 · Centro Norte</CardDescription>
          <CardTitle>Revisión de baños y zonas comunes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Asignada a Ana Ruiz. El check-in guarda la llegada en el teléfono y la envía cuando hay red.
          </p>
          <CheckInButton />
        </CardContent>
      </Card>
    </main>
  );
}
