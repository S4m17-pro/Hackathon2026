import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

const kpis = [
  { label: "Visitas de hoy", value: "12", hint: "4 centros activos" },
  { label: "En curso", value: "5", hint: "Supervisores en sitio" },
  { label: "Novedades abiertas", value: "7", hint: "2 críticas" },
  { label: "Cumplimiento", value: "86%", hint: "Check-in a tiempo" },
];

export function KpiCards() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-3xl">{kpi.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">{kpi.hint}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
