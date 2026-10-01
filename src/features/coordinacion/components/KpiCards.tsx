import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export interface KpiItem {
  label: string;
  value: string;
  hint: string;
}

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((kpi) => (
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
