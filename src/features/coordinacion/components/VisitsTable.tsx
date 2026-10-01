import type { VisitStatus } from "@/shared/types";
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

export interface DashboardVisitRow {
  id: string;
  center: string;
  supervisor: string;
  status: VisitStatus;
  checkIn: string;
}

const statusLabel: Record<VisitStatus, string> = {
  ASSIGNED: "Asignada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export function VisitsTable({ rows }: { rows: DashboardVisitRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas del día</CardTitle>
        <CardDescription>Horario de Bogotá. El check-in es la hora en campo.</CardDescription>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No hay visitas para hoy.</TableCell>
              </TableRow>
            ) : (
              rows.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell className="font-medium">{visit.center}</TableCell>
                  <TableCell>{visit.supervisor}</TableCell>
                  <TableCell>
                    <Badge
                      tone={
                        visit.status === "COMPLETED"
                          ? "done"
                          : visit.status === "IN_PROGRESS"
                            ? "progress"
                            : "neutral"
                      }
                    >
                      {statusLabel[visit.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{visit.checkIn}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
