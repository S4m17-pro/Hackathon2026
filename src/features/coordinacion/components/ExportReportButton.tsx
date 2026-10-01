"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";

export function ExportReportButton() {
  const [downloading, setDownloading] = useState(false);

  function handleDownload() {
    setDownloading(true);
    // Dispara la descarga del reporte generado por el endpoint /api/reports
    const link = document.createElement("a");
    link.href = "/api/reports";
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(false);
    }, 1500);
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={downloading}
      className="gap-2 text-xs font-semibold shadow-xs hover:border-zinc-400"
      title="Exportar reporte consolidado de operaciones a Excel / CSV"
    >
      <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden />
      {downloading ? "Generando reporte…" : "Exportar Reporte (CSV / Excel)"}
    </Button>
  );
}
