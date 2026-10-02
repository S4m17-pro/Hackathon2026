"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileCheck,
  FileSearch,
  FileText,
  Filter,
  KeyRound,
  Layers,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Split,
  UploadCloud,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/ui/cn";

export interface RecordOption {
  id: string;
  label: string;
  type: "VISITA" | "NOVEDAD";
  author: string;
  center: string;
  date: string;
  text: string;
}

export interface DuplicatePair {
  id: string;
  matchScore: number;
  category: string;
  risk: "ALTO" | "MEDIO" | "BAJO";
  reason: string;
  recordA: {
    id: string;
    type: string;
    author: string;
    center: string;
    date: string;
    excerpt: string;
  };
  recordB: {
    id: string;
    type: string;
    author: string;
    center: string;
    date: string;
    excerpt: string;
  };
  recommendation?: string;
}

interface RepetitivePattern {
  patternText: string;
  occurrencesCount: number;
  supervisors: string[];
  comment: string;
}

interface AuditResponse {
  mode: "audit";
  overallIntegrityScore?: number;
  executiveSummary?: string;
  duplicatePairs?: DuplicatePair[];
  repetitivePatterns?: RepetitivePattern[];
  bestPracticesNotes?: string;
  totalRecordsAudited?: number;
  error?: string;
  needsKey?: boolean;
}

interface MatchDetail {
  id?: string;
  kind?: string;
  similarityPercent?: number;
  author?: string;
  costCenter?: string;
  submittedExcerpt?: string;
  databaseExcerpt?: string;
  reason?: string;
}

interface DocumentCheckResult {
  mode: "document";
  verdict?: "original" | "similar" | "duplicado" | "plagio_critico" | string;
  plagiarismScore?: number;
  summary?: string;
  recommendation?: string;
  patternsDetected?: string[];
  matches?: MatchDetail[];
  examinedChars?: number;
  error?: string;
  needsKey?: boolean;
}

interface CompareResult {
  mode: "compare";
  similarityPercent?: number;
  verdict?: string;
  verbatimMatchesCount?: number;
  analysis?: string;
  matchingFragments?: Array<{
    textAFragment: string;
    textBFragment: string;
    nature: string;
  }>;
  conclusion?: string;
  error?: string;
  needsKey?: boolean;
}

const SAMPLE_SUSPICIOUS_TEXT = `Durante el recorrido en las instalaciones se evidenció que todas las áreas de bodega y pasillos principales se encuentran en perfecto orden y aseo. No se registraron novedades con el personal de turno. Se verificó el cumplimiento de extintores y señalización en salidas de emergencia conforme al protocolo estándar de la compañía.`;

const SAMPLE_ORIGINAL_TEXT = `Visita técnica al bloque B del Hospital San Rafael a las 09:45 AM. Se encontró una fuga leve en la válvula de la esclusa norte del piso 2 y acumulación de cartón en el pasillo de descarga. Se notificó de inmediato al señor Mario Gómez de mantenimiento (ticket #402) y se acordó recolección antes de las 2:00 PM.`;

export function DocumentCheckForm({ availableRecords }: { availableRecords: RecordOption[] }) {
  const [tab, setTab] = useState<"duplicates" | "document" | "compare">("duplicates");
  const [apiKey, setApiKey] = useState("");
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Duplicates scanner state
  const [auditPending, setAuditPending] = useState(false);
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "HIGH_SCORE" | "CROSS_SUPERVISOR" | "SAME_SUPERVISOR">("ALL");

  // Document Tab state
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [docPending, setDocPending] = useState(false);
  const [docResult, setDocResult] = useState<DocumentCheckResult | null>(null);

  // Compare Tab state
  const [selectedRecordA, setSelectedRecordA] = useState<string>("");
  const [selectedRecordB, setSelectedRecordB] = useState<string>("");
  const [customTextA, setCustomTextA] = useState("");
  const [customTextB, setCustomTextB] = useState("");
  const [comparePending, setComparePending] = useState(false);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("groq_api_key");
    if (saved) {
      setApiKey(saved);
      setKeySaved(true);
    }
  }, []);

  function handleSaveKey(key: string) {
    const trimmed = key.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem("groq_api_key", trimmed);
      setKeySaved(true);
      setShowKeyConfig(false);
    } else {
      localStorage.removeItem("groq_api_key");
      setKeySaved(false);
    }
  }

  function getHeaders(): HeadersInit {
    const headers: Record<string, string> = {};
    if (apiKey.trim()) {
      headers["x-groq-api-key"] = apiKey.trim();
    }
    return headers;
  }

  // Auto-scan duplicates with Groq
  async function runDuplicateScan() {
    setAuditPending(true);
    setAuditData(null);

    try {
      const response = await fetch("/api/documents/check", {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mode: "audit" }),
      });
      const data = (await response.json()) as AuditResponse;
      setAuditData(data);
      if (data.needsKey) {
        setShowKeyConfig(true);
      }
    } catch {
      setAuditData({ mode: "audit", error: "Error escaneando duplicados en la base de datos." });
    } finally {
      setAuditPending(false);
    }
  }

  async function onDocumentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDocPending(true);
    setDocResult(null);

    const body = new FormData();
    body.set("text", text);
    if (file) {
      body.set("file", file);
    }

    try {
      const response = await fetch("/api/documents/check", {
        method: "POST",
        headers: getHeaders(),
        body,
      });
      const data = (await response.json()) as DocumentCheckResult;
      setDocResult(data);
      if (data.needsKey) {
        setShowKeyConfig(true);
      }
    } catch {
      setDocResult({ mode: "document", error: "No se pudo conectar con el servidor de auditoría." });
    } finally {
      setDocPending(false);
    }
  }

  async function runCompare() {
    const textA = customTextA.trim() || availableRecords.find((r) => r.id === selectedRecordA)?.text || "";
    const textB = customTextB.trim() || availableRecords.find((r) => r.id === selectedRecordB)?.text || "";
    const labelA = availableRecords.find((r) => r.id === selectedRecordA)?.label || "Registro A";
    const labelB = availableRecords.find((r) => r.id === selectedRecordB)?.label || "Registro B";

    if (!textA || !textB) return;

    setComparePending(true);
    setCompareResult(null);

    try {
      const response = await fetch("/api/documents/check", {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "compare",
          textA,
          textB,
          labelA,
          labelB,
        }),
      });
      const data = (await response.json()) as CompareResult;
      setCompareResult(data);
      if (data.needsKey) {
        setShowKeyConfig(true);
      }
    } catch {
      setCompareResult({ mode: "compare", error: "Error al comparar los registros." });
    } finally {
      setComparePending(false);
    }
  }

  function copyText(id: string, textToCopy: string) {
    void navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // Filtered duplicate pairs
  const filteredPairs = useMemo(() => {
    if (!auditData?.duplicatePairs) return [];
    if (filterType === "HIGH_SCORE") {
      return auditData.duplicatePairs.filter((p) => p.matchScore >= 80);
    }
    if (filterType === "CROSS_SUPERVISOR") {
      return auditData.duplicatePairs.filter((p) => p.recordA.author !== p.recordB.author);
    }
    if (filterType === "SAME_SUPERVISOR") {
      return auditData.duplicatePairs.filter((p) => p.recordA.author === p.recordB.author);
    }
    return auditData.duplicatePairs;
  }, [auditData, filterType]);

  return (
    <div className="flex flex-col gap-6">
      {/* Groq Engine & API Key Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-lime-400/20 text-lime-800">
            <Bot className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">Motor de Inteligencia GroqCloud</h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                <Sparkles className="size-3 text-amber-500" /> LLaMA 3.3 70B (Detección de Duplicados & Plagio)
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Auditoría en tiempo real sobre {availableRecords.length} registros de notas y novedades en campo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {keySaved ? (
            <span className="flex items-center gap-1.5 rounded-xl border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-medium text-lime-800">
              <CheckCircle2 className="size-3.5 text-lime-600" /> API Key Configurada
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
              <AlertTriangle className="size-3.5 text-amber-600" /> Usando clave de entorno (.env)
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
          >
            <KeyRound className="size-3.5 text-zinc-500" />
            {showKeyConfig ? "Ocultar" : "Configurar API Key"}
          </button>
        </div>
      </div>

      {/* Expandable Key Configuration */}
      {showKeyConfig ? (
        <div className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4 transition-all">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800">
                Ingresa tu clave de API de GroqCloud (`gsk_...`):
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-lime-700 hover:underline font-medium"
              >
                Obtener API Key gratis en GroqCloud →
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="gsk_..."
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-mono text-zinc-900 outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500"
              />
              <Button type="button" onClick={() => handleSaveKey(apiKey)} className="shrink-0">
                Guardar
              </Button>
              {keySaved ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSaveKey("")}
                  className="shrink-0 text-rose-600"
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-zinc-500">
              La clave se guarda de manera segura en tu navegador local para las peticiones de este panel.
            </p>
          </div>
        </div>
      ) : null}

      {/* Tabs Selector */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setTab("duplicates")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
            tab === "duplicates"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <Split className="size-4 text-lime-400" />
          <span>Detección de Registros Duplicados en BD</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("document")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
            tab === "document"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <FileSearch className="size-4" />
          <span>Auditar Archivo / Documento Externo</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("compare")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer",
            tab === "compare"
              ? "bg-zinc-900 text-white shadow-xs"
              : "text-zinc-600 hover:bg-zinc-100",
          )}
        >
          <Scale className="size-4" />
          <span>Comparador Directo (A vs B)</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1 (PRINCIPAL): DETECTOR DE REGISTROS DUPLICADOS EN LA BASE DE DATOS */}
      {/* ========================================================================= */}
      {tab === "duplicates" ? (
        <div className="flex flex-col gap-6">
          {/* Main Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-lime-300 bg-gradient-to-r from-lime-50 via-emerald-50 to-teal-50 p-6 shadow-xs">
            <div className="flex flex-col gap-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-lime-600 px-2 py-0.5 text-[11px] font-bold text-white uppercase">
                  IA Automática
                </span>
                <h2 className="text-lg font-bold text-zinc-900">
                  Escanear y Agrupar Registros con Mismo Contenido
                </h2>
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                Groq analiza semánticamente todas las visitas, notas de check-out y descripciones de novedades para encontrar registros duplicados, textos copiados entre diferentes supervisores y reportes reciclados.
              </p>
            </div>

            <Button
              onClick={() => void runDuplicateScan()}
              disabled={auditPending}
              className="bg-zinc-900 hover:bg-zinc-800 text-white font-semibold px-6 py-2.5 shadow-md transition-all cursor-pointer"
            >
              {auditPending ? (
                <>
                  <RefreshCw className="size-4 animate-spin mr-2" />
                  Analizando base de datos con Groq...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-lime-400 mr-2" />
                  Escanear Base de Datos Ahora
                </>
              )}
            </Button>
          </div>

          {auditData?.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="size-4 text-rose-600" />
                <span>Error en el escaneo de duplicados</span>
              </div>
              <p className="mt-1 text-xs">{auditData.error}</p>
            </div>
          ) : null}

          {/* Results Area */}
          {auditData && !auditData.error ? (
            <div className="flex flex-col gap-6">
              {/* Top summary metrics */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-zinc-200">
                  <CardHeader className="pb-1">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                      Índice de Integridad
                    </CardDescription>
                    <CardTitle
                      className={cn(
                        "text-3xl font-extrabold",
                        (auditData.overallIntegrityScore ?? 100) >= 80
                          ? "text-lime-600"
                          : (auditData.overallIntegrityScore ?? 100) >= 60
                            ? "text-amber-600"
                            : "text-rose-600",
                      )}
                    >
                      {auditData.overallIntegrityScore ?? 100}%
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500">
                      {auditData.totalRecordsAudited ?? availableRecords.length} registros evaluados
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-zinc-200 sm:col-span-2">
                  <CardHeader className="pb-1">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                      Dictamen del Auditor de IA
                    </CardDescription>
                    <CardTitle className="text-sm font-semibold text-zinc-800 leading-snug">
                      {auditData.executiveSummary}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500 italic">
                      {auditData.bestPracticesNotes}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Duplicate pairs list */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900">
                      Registros Identificados con Mismo Contenido o Duplicidad
                    </h3>
                    <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-bold text-white">
                      {auditData.duplicatePairs?.length ?? 0}
                    </span>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterType("ALL")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                        filterType === "ALL" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                      )}
                    >
                      Todos ({auditData.duplicatePairs?.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("HIGH_SCORE")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                        filterType === "HIGH_SCORE" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                      )}
                    >
                      Copia Alta ({">"}80%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("CROSS_SUPERVISOR")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                        filterType === "CROSS_SUPERVISOR" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                      )}
                    >
                      Entre Distintos Supervisores
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("SAME_SUPERVISOR")}
                      className={cn(
                        "rounded-lg px-2.5 py-1 font-medium transition-colors cursor-pointer",
                        filterType === "SAME_SUPERVISOR" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                      )}
                    >
                      Mismo Supervisor (Reciclado)
                    </button>
                  </div>
                </div>

                {filteredPairs.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {filteredPairs.map((pair) => (
                      <Card key={pair.id} className="border-zinc-200 shadow-sm overflow-hidden">
                        {/* Header bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-50 px-5 py-3 border-b border-zinc-200">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                "flex items-center justify-center rounded-lg px-2.5 py-1 text-xs font-black text-white",
                                pair.matchScore >= 85
                                  ? "bg-rose-600"
                                  : pair.matchScore >= 60
                                    ? "bg-amber-600"
                                    : "bg-lime-600",
                              )}
                            >
                              {pair.matchScore}% Similitud
                            </span>
                            <span className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
                              {pair.category}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                                pair.risk === "ALTO"
                                  ? "bg-rose-100 text-rose-800"
                                  : pair.risk === "MEDIO"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-zinc-200 text-zinc-800",
                              )}
                            >
                              Riesgo {pair.risk}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => copyText(pair.id, `${pair.category}: ${pair.reason}`)}
                              className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                            >
                              <Copy className="size-3" />
                              {copiedId === pair.id ? "Copiado!" : "Copiar dictamen"}
                            </button>
                          </div>
                        </div>

                        <CardContent className="flex flex-col gap-4 p-5">
                          {/* Reason by AI */}
                          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 text-xs text-amber-950">
                            <span className="font-bold block mb-0.5">🔍 Dictamen de la IA:</span>
                            {pair.reason}
                          </div>

                          {/* Side by side comparison */}
                          <div className="grid gap-4 md:grid-cols-2">
                            {/* Record A */}
                            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="flex items-center justify-between text-xs border-b border-zinc-100 pb-2">
                                <span className="font-bold text-zinc-900">
                                  {pair.recordA.type} · {pair.recordA.author}
                                </span>
                                <span className="text-zinc-400 text-[11px]">{pair.recordA.date}</span>
                              </div>
                              <div className="text-[11px] text-zinc-500 font-medium">
                                Centro: {pair.recordA.center}
                              </div>
                              <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 leading-relaxed font-mono">
                                "{pair.recordA.excerpt}"
                              </div>
                            </div>

                            {/* Record B */}
                            <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4">
                              <div className="flex items-center justify-between text-xs border-b border-zinc-100 pb-2">
                                <span className="font-bold text-zinc-900">
                                  {pair.recordB.type} · {pair.recordB.author}
                                </span>
                                <span className="text-zinc-400 text-[11px]">{pair.recordB.date}</span>
                              </div>
                              <div className="text-[11px] text-zinc-500 font-medium">
                                Centro: {pair.recordB.center}
                              </div>
                              <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 leading-relaxed font-mono">
                                "{pair.recordB.excerpt}"
                              </div>
                            </div>
                          </div>

                          {/* Recommendation */}
                          {pair.recommendation ? (
                            <div className="rounded-lg bg-lime-50 px-3.5 py-2 text-xs text-lime-900 border border-lime-200/60 flex items-center gap-2">
                              <ShieldCheck className="size-4 text-lime-700 shrink-0" />
                              <span>
                                <strong>Recomendación:</strong> {pair.recommendation}
                              </span>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-lime-200 bg-lime-50/60 p-8 text-center text-sm font-medium text-lime-900">
                    <CheckCircle2 className="size-8 text-lime-600 mx-auto mb-2" />
                    No se encontraron registros duplicados con el filtro seleccionado.
                  </div>
                )}

                {/* Repetitive patterns */}
                {auditData.repetitivePatterns && auditData.repetitivePatterns.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-zinc-900">
                      Frases y Plantillas Genéricas Repetidas Detectadas
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {auditData.repetitivePatterns.map((pat, idx) => (
                        <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-800">"{pat.patternText}"</span>
                            <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                              {pat.occurrencesCount} veces
                            </span>
                          </div>
                          <p className="text-zinc-600 text-[11px]">{pat.comment}</p>
                          <div className="text-[10px] text-zinc-400">
                            Supervisores: {pat.supervisors.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 mb-3">
                <Split className="size-7" />
              </div>
              <h3 className="text-base font-bold text-zinc-800">Listo para escanear duplicados en la base de datos</h3>
              <p className="text-xs text-zinc-500 max-w-md mt-1 mb-4">
                Haz clic en el botón superior para que Groq analice las notas de todas las visitas y novedades e identifique qué registros comparten el mismo contenido o fueron copiados.
              </p>
              <Button
                onClick={() => void runDuplicateScan()}
                disabled={auditPending}
                className="bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
              >
                <Sparkles className="size-4 text-lime-400 mr-2" />
                Ejecutar Escaneo de Duplicados Ahora
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 2: AUDITOR DE ARCHIVO / DOCUMENTO EXTERNO */}
      {/* ========================================================================= */}
      {tab === "document" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            className="flex flex-col gap-4 lg:col-span-6"
            onSubmit={(event) => void onDocumentSubmit(event)}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-zinc-900">
                  Auditar Documento o Informe Externo
                </CardTitle>
                <CardDescription>
                  Pega el texto o sube un archivo PDF/Word para contrastarlo contra toda la base de datos histórica.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-700">Texto del reporte:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setText(SAMPLE_SUSPICIOUS_TEXT)}
                        className="text-[11px] font-medium text-amber-700 hover:underline"
                      >
                        Ejemplo Duplicado
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={() => setText(SAMPLE_ORIGINAL_TEXT)}
                        className="text-[11px] font-medium text-lime-700 hover:underline"
                      >
                        Ejemplo Original
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={7}
                    placeholder="Pega aquí el informe, notas de inspección o texto a evaluar..."
                    className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  />
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Mínimo 15 caracteres</span>
                    <span>{text.length} caracteres</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-700">
                    O adjunta un archivo (PDF, DOCX o TXT):
                  </label>
                  <div className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/70 p-4 text-center hover:bg-zinc-100/50 transition-colors">
                    {file ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                        <FileCheck className="size-5 text-lime-600" />
                        <span>{file.name}</span>
                        <span className="text-xs text-zinc-400">({(file.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="ml-2 rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="size-6 text-zinc-400" />
                        <p className="mt-1 text-xs text-zinc-600">
                          Arrastra o <span className="text-lime-700 font-semibold cursor-pointer">selecciona un archivo</span>
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">PDF, DOCX o TXT hasta 8 MB</p>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={docPending || (text.trim().length < 15 && !file)}
                  className="mt-2 flex w-full items-center justify-center gap-2 font-medium"
                >
                  {docPending ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      Evaluando contra base de datos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 text-lime-300" />
                      Validar Documento con Groq AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>

          {/* Document results */}
          <div className="flex flex-col gap-4 lg:col-span-6">
            {docResult?.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <p className="font-semibold">Error al evaluar:</p>
                <p className="text-xs mt-1">{docResult.error}</p>
              </div>
            ) : null}

            {docResult && !docResult.error ? (
              <Card className="border-zinc-200 shadow-md">
                <CardHeader className="pb-3 border-b border-zinc-100">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-zinc-900">
                      Dictamen de Integridad
                    </CardTitle>
                    <button
                      type="button"
                      onClick={() => copyText("doc-verdict", docResult.summary ?? "")}
                      className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
                    >
                      <Copy className="size-3" />
                      {copiedId === "doc-verdict" ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-zinc-50 p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-14 items-center justify-center rounded-2xl text-xl font-black text-white",
                          docResult.plagiarismScore && docResult.plagiarismScore >= 70
                            ? "bg-rose-600"
                            : docResult.plagiarismScore && docResult.plagiarismScore >= 35
                              ? "bg-amber-500"
                              : "bg-lime-600",
                        )}
                      >
                        {docResult.plagiarismScore ?? 0}%
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-zinc-500">Índice de Duplicidad</span>
                        <span className="text-sm font-bold text-zinc-900 uppercase">
                          {docResult.verdict?.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {docResult.patternsDetected?.map((pat) => (
                        <span
                          key={pat}
                          className="rounded-md bg-white border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700"
                        >
                          {pat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Resumen Ejecutivo
                    </p>
                    <p className="mt-1 text-sm text-zinc-800 leading-relaxed">{docResult.summary}</p>
                  </div>

                  {docResult.matches && docResult.matches.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                        Coincidencias en la base de datos ({docResult.matches.length})
                      </p>
                      <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
                        {docResult.matches.map((m, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-zinc-900">
                                {m.kind} {m.id} · {m.author ?? "Supervisor"} ({m.costCenter ?? "Centro"})
                              </span>
                              <span className="rounded-md bg-zinc-200 px-2 py-0.5 font-bold text-zinc-800">
                                {m.similarityPercent ? `${m.similarityPercent}% similitud` : "Coincidencia"}
                              </span>
                            </div>
                            <p className="text-zinc-600 text-[11px]">{m.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* TAB 3: COMPARADOR DIRECTO */}
      {/* ========================================================================= */}
      {tab === "compare" ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Record A */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-900">Registro A</CardTitle>
                <CardDescription>Selecciona un reporte de la base de datos o redacta uno.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <select
                  value={selectedRecordA}
                  onChange={(e) => {
                    setSelectedRecordA(e.target.value);
                    const found = availableRecords.find((r) => r.id === e.target.value);
                    if (found) setCustomTextA(found.text);
                  }}
                  className="rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900"
                >
                  <option value="">-- Seleccionar registro existente --</option>
                  {availableRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={customTextA}
                  onChange={(e) => setCustomTextA(e.target.value)}
                  rows={6}
                  placeholder="Texto del Registro A..."
                  className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs text-zinc-900 outline-none focus:border-zinc-900"
                />
              </CardContent>
            </Card>

            {/* Record B */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-900">Registro B</CardTitle>
                <CardDescription>Selecciona otro reporte para comparar similitud.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <select
                  value={selectedRecordB}
                  onChange={(e) => {
                    setSelectedRecordB(e.target.value);
                    const found = availableRecords.find((r) => r.id === e.target.value);
                    if (found) setCustomTextB(found.text);
                  }}
                  className="rounded-xl border border-zinc-300 bg-white p-2 text-xs text-zinc-900"
                >
                  <option value="">-- Seleccionar registro existente --</option>
                  {availableRecords.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>

                <textarea
                  value={customTextB}
                  onChange={(e) => setCustomTextB(e.target.value)}
                  rows={6}
                  placeholder="Texto del Registro B..."
                  className="w-full rounded-xl border border-zinc-300 bg-white p-3 text-xs text-zinc-900 outline-none focus:border-zinc-900"
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => void runCompare()}
              disabled={comparePending || !customTextA.trim() || !customTextB.trim()}
              className="px-8 font-semibold"
            >
              {comparePending ? (
                <>
                  <RefreshCw className="size-4 animate-spin mr-2" />
                  Comparando con IA...
                </>
              ) : (
                <>
                  <Scale className="size-4 mr-2 text-lime-400" />
                  Comparar Similitud y Plagio (Groq AI)
                </>
              )}
            </Button>
          </div>

          {compareResult && !compareResult.error ? (
            <Card className="border-zinc-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardDescription>Dictamen Forense Comparativo</CardDescription>
                    <CardTitle className="text-xl font-bold text-zinc-900">
                      {compareResult.verdict}
                    </CardTitle>
                  </div>
                  <div
                    className={cn(
                      "flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white",
                      compareResult.similarityPercent && compareResult.similarityPercent >= 70
                        ? "bg-rose-600"
                        : compareResult.similarityPercent && compareResult.similarityPercent >= 40
                          ? "bg-amber-500"
                          : "bg-lime-600",
                    )}
                  >
                    {compareResult.similarityPercent ?? 0}%
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-800 leading-relaxed">
                  <p className="font-semibold text-xs text-zinc-500 uppercase mb-1">Análisis Semántico:</p>
                  {compareResult.analysis}
                </div>

                <div className="rounded-xl bg-lime-50/70 p-3 text-xs text-lime-950 border border-lime-200">
                  <span className="font-bold">Conclusión: </span>
                  {compareResult.conclusion}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
