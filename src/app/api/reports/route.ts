import {
  bogotaToday,
  getOperationsReport,
  operationsReportToCsv,
} from "@/features/coordinacion/queries";

export const runtime = "nodejs";

/**
 * RF-REP-01, RF-REP-02, RF-REP-03.
 * Genera y descarga el reporte consolidado de operaciones en formato CSV / Excel
 * con filtros de fecha (from, to), supervisor y centro de costo.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const today = bogotaToday();

    const from = url.searchParams.get("from") ?? `${today}T00:00:00.000-05:00`;
    const to = url.searchParams.get("to") ?? `${today}T23:59:59.999-05:00`;
    const supervisorId = url.searchParams.get("supervisorId") || undefined;
    const costCenterId = url.searchParams.get("costCenterId") || undefined;

    const report = await getOperationsReport({
      from,
      to,
      supervisorId,
      costCenterId,
    });

    const csvContent = operationsReportToCsv(report);

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporte_operaciones_${today}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al generar el reporte consolidado",
      },
      { status: 500 }
    );
  }
}
