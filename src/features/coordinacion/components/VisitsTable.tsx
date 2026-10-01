import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

const visits = [
  {
    center: "Centro Norte",
    supervisor: "Ana Ruiz",
    status: "En curso",
    tone: "progress",
    checkIn: "08:12",
  },
  {
    center: "Torre Central",
    supervisor: "Luis Pérez",
    status: "Asignada",
    tone: "neutral",
    checkIn: "—",
  },
  {
    center: "Plaza Mayor",
    supervisor: "Camila Soto",
    status: "Completada",
    tone: "done",
    checkIn: "07:40",
  },
  {
    center: "Bodega Sur",
    supervisor: "Ana Ruiz",
    status: "En curso",
    tone: "progress",
    checkIn: "09:05",
  },
] as const;

export function VisitsTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas del día</CardTitle>
        <CardDescription>Datos de muestra hasta conectar las lecturas del coordinador.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Check-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.map((visit) => (
              <TableRow key={`${visit.center}-${visit.supervisor}`}>
                <TableCell className="font-medium">{visit.center}</TableCell>
                <TableCell>{visit.supervisor}</TableCell>
                <TableCell>
                  <Badge tone={visit.tone}>{visit.status}</Badge>
                </TableCell>
                <TableCell>{visit.checkIn}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
