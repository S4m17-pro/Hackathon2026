import type { EvidenceOwnerType } from "@/shared/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

export interface EvidenceTraceRow {
  id: string;
  url: string;
  authorName: string;
  ownerType: EvidenceOwnerType;
  clientCreatedAt: string;
  receivedAt: string;
}

const ownerLabel: Record<EvidenceOwnerType, string> = {
  VISIT: "Visita",
  NOVELTY: "Novedad",
  QR_SCAN: "Área QR",
  CHECKLIST_ITEM: "Checklist",
};

export function EvidenceTraceTable({ rows }: { rows: EvidenceTraceRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-zinc-900">Trazabilidad de Evidencias Fotográficas</CardTitle>
        <CardDescription>
          Registro de auditoría (RNF-14): autoría en campo vs hora de recepción sincronizada en el servidor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supervisor</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Hora en campo</TableHead>
              <TableHead>Hora de recepción</TableHead>
              <TableHead className="text-right">Evidencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-zinc-500">
                  No se registran evidencias fotográficas sincronizadas.
                </TableCell>
              </TableRow>
            ) : (
              rows.slice(0, 30).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-zinc-900">{row.authorName}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                      {ownerLabel[row.ownerType]}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-600">{formatWhen(row.clientCreatedAt)}</TableCell>
                  <TableCell className="text-zinc-600">{formatWhen(row.receivedAt)}</TableCell>
                  <TableCell className="text-right">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-200 transition-colors"
                    >
                      Ver foto
                    </a>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}
