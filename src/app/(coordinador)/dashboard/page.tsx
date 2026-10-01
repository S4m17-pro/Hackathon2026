import { KpiCards } from "@/features/coordinacion/components/KpiCards";
import { VisitsTable } from "@/features/coordinacion/components/VisitsTable";

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-zinc-500 uppercase">Operación</p>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
      </header>
      <KpiCards />
      <VisitsTable />
    </main>
  );
}
