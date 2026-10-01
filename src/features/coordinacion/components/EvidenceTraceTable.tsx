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
        <CardTitle>Evidencias</CardTitle>
        <CardDescription>
          Quién la envió, a qué hora la tomó en campo y a qué hora llegó al servidor.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supervisor</TableHead>
              <TableHead>De</TableHead>
              <TableHead>En campo</TableHead>
              <TableHead>Recibida</TableHead>
              <TableHead>Foto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>Todavía no llega ninguna foto.</TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.authorName}</TableCell>
                  <TableCell>{ownerLabel[row.ownerType]}</TableCell>
                  <TableCell>{formatWhen(row.clientCreatedAt)}</TableCell>
                  <TableCell>{formatWhen(row.receivedAt)}</TableCell>
                  <TableCell>
                    <a href={row.url} className="text-sm underline">
                      Ver
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
