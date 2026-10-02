import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export interface KpiItem {
  label: string;
  value: string;
  hint: string;
}

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((kpi) => (
        <Card
          key={kpi.label}
          className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {kpi.label}
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
              {kpi.value}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-zinc-500 leading-relaxed">{kpi.hint}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
