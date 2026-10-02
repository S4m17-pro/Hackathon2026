import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

import { getSession } from "@/app/(auth)/session";
import { prisma } from "@/shared/lib/prisma";

export const runtime = "nodejs";

const MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
];

const MAX_BYTES = 8_000_000;

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "COORDINADOR") {
    return Response.json(
      { error: "Solo el personal de coordinación puede auditar documentos e integridad." },
      { status: 401 },
    );
  }

  // Header or environment variable
  const clientKey = request.headers.get("x-groq-api-key");
  const apiKey = (clientKey && clientKey.trim()) || (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());

  if (!apiKey) {
    return Response.json(
      {
        error: "Falta la clave API de Groq.",
        needsKey: true,
        hint: "Puedes ingresar tu API Key de GroqCloud en la parte superior o configurarla en el archivo .env como GROQ_API_KEY.",
      },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as {
      mode?: "document" | "audit" | "compare";
      textA?: string;
      textB?: string;
      labelA?: string;
      labelB?: string;
    };

    if (body.mode === "compare") {
      return handleCompareMode(
        apiKey,
        body.textA || "",
        body.textB || "",
        body.labelA || "Registro A",
        body.labelB || "Registro B",
      );
    }

    if (body.mode === "audit") {
      return handleAuditMode(apiKey);
    }
  }

  // Otherwise handle multipart/form-data for document/text submission
  return handleDocumentMode(request, apiKey);
}

async function callGroqWithFallback(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  temperature = 0.1,
) {
  let lastError = "";

  for (const model of MODELS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: "json_object" },
          messages,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = payload.choices?.[0]?.message?.content ?? "{}";
        return JSON.parse(content);
      } else {
        const errorText = await response.text();
        lastError = `Modelo ${model} retornó ${response.status}: ${errorText.slice(0, 200)}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(`Groq no pudo procesar la solicitud: ${lastError}`);
}

async function handleAuditMode(apiKey: string) {
  const [novelties, visits] = await Promise.all([
    prisma.novelty.findMany({
      orderBy: { clientCreatedAt: "desc" },
      take: 35,
      include: {
        visit: {
          select: {
            supervisor: { select: { id: true, name: true } },
            costCenter: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.visit.findMany({
      where: { OR: [{ notes: { not: null } }, { checkOutNotes: { not: null } }] },
      orderBy: { clientCreatedAt: "desc" },
      take: 35,
      include: {
        supervisor: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true } },
      },
    }),
  ]);

  const items = [
    ...novelties.map((n) => ({
      id: `NOV-${n.id}`,
      type: "NOVEDAD",
      author: n.visit.supervisor.name,
      center: n.visit.costCenter.name,
      date: n.clientCreatedAt.toISOString().split("T")[0],
      text: n.description,
    })),
    ...visits.flatMap((v) => {
      const parts = [v.notes, v.checkOutNotes].filter(Boolean);
      return parts.length > 0
        ? [
            {
              id: `VIS-${v.id}`,
              type: "VISITA",
              author: v.supervisor.name,
              center: v.costCenter.name,
              date: v.clientCreatedAt.toISOString().split("T")[0],
              text: parts.join(" | "),
            },
          ]
        : [];
    }),
  ];

  const systemPrompt = `Eres un auditor forense de inteligencia artificial para operaciones de supervisión y seguridad de campo.
Tu misión principal es IDENTIFICAR Y AGRUPAR REGISTROS DE LA BASE DE DATOS QUE TENGAN EL MISMO CONTENIDO, TEXTOS COPIADOS O REPORTES RECICLADOS.

Debes detectar:
1. Parejas de registros que comparten exactamente el mismo texto o una paráfrasis muy cercana (ej: dos supervisores distintos con la misma nota).
2. Reportes reciclados por un mismo supervisor en diferentes días o centros de costo.
3. Novedades idénticas reportadas como si fueran eventos separados.
4. Textos genéricos o frases 'plantilla' repetidas.

Responde ESTRICTAMENTE en formato JSON con la siguiente estructura:
{
  "overallIntegrityScore": number (0 a 100),
  "executiveSummary": "Resumen ejecutivo explicando los hallazgos de duplicidad en la base de datos",
  "duplicatePairs": [
    {
      "id": "par-1",
      "matchScore": number (0 a 100, si es decimal conviértelo a porcentaje 0-100),
      "category": "Copia literal entre supervisores" | "Paráfrasis de contenido" | "Reporte reciclado" | "Texto genérico repetido",
      "risk": "ALTO" | "MEDIO" | "BAJO",
      "reason": "Explicación detallada en español de por qué la IA concluye que tienen el mismo contenido",
      "recordA": {
        "id": "id",
        "type": "Visita" | "Novedad",
        "author": "Nombre supervisor A",
        "center": "Centro A",
        "date": "Fecha A",
        "excerpt": "Texto"
      },
      "recordB": {
        "id": "id",
        "type": "Visita" | "Novedad",
        "author": "Nombre supervisor B",
        "center": "Centro B",
        "date": "Fecha B",
        "excerpt": "Texto"
      },
      "recommendation": "Acción recomendada al coordinador para este caso de duplicidad"
    }
  ],
  "repetitivePatterns": [
    {
      "patternText": "Texto o frase que se repite",
      "occurrencesCount": number,
      "supervisors": ["Nombre 1", "Nombre 2"],
      "comment": "Por qué este patrón degrada la calidad de los reportes"
    }
  ],
  "bestPracticesNotes": "Consejo para mejorar la autenticidad y el registro en campo"
}`;

  try {
    const parsed = await callGroqWithFallback(apiKey, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `REGISTROS DE LA BASE DE DATOS A ANALIZAR (${items.length} registros):\n${JSON.stringify(items, null, 2)}`,
      },
    ]);

    // Normalize matchScore to 0-100 if LLM gave 0.0 - 1.0
    if (Array.isArray(parsed.duplicatePairs)) {
      parsed.duplicatePairs = parsed.duplicatePairs.map((p: any, idx: number) => ({
        ...p,
        id: p.id || `par-${idx + 1}`,
        matchScore: p.matchScore <= 1 ? Math.round(p.matchScore * 100) : Math.round(p.matchScore),
      }));
    }

    return Response.json({ ...parsed, mode: "audit", totalRecordsAudited: items.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error comunicándose con Groq.";
    return Response.json({ error: msg }, { status: 502 });
  }
}

async function handleDocumentMode(request: Request, apiKey: string) {
  let text = "";

  try {
    text = await readSubmission(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer el archivo.";
    return Response.json({ error: message }, { status: 400 });
  }

  if (text.length < 15) {
    return Response.json(
      { error: "El texto ingresado es demasiado corto. Pega al menos una frase o sube un documento PDF, DOCX o TXT." },
      { status: 400 },
    );
  }

  const [novelties, visits] = await Promise.all([
    prisma.novelty.findMany({
      orderBy: { clientCreatedAt: "desc" },
      take: 35,
      include: {
        visit: {
          select: {
            supervisor: { select: { name: true } },
            costCenter: { select: { name: true } },
          },
        },
      },
    }),
    prisma.visit.findMany({
      where: { OR: [{ notes: { not: null } }, { checkOutNotes: { not: null } }] },
      orderBy: { clientCreatedAt: "desc" },
      take: 25,
      include: {
        supervisor: { select: { name: true } },
        costCenter: { select: { name: true } },
      },
    }),
  ]);

  const corpus = [
    ...novelties.map(
      (row) =>
        `[NOVEDAD #${row.id.slice(-6)}] (Fecha: ${row.clientCreatedAt.toISOString().split("T")[0]}, Supervisor: ${row.visit.supervisor.name}, Centro: ${row.visit.costCenter.name}, Prioridad: ${row.priority}): ${row.description}`,
    ),
    ...visits.flatMap((row) => {
      const parts = [row.notes, row.checkOutNotes].filter(Boolean);
      return parts.length > 0
        ? [
            `[VISITA #${row.id.slice(-6)}] (Fecha: ${row.clientCreatedAt.toISOString().split("T")[0]}, Supervisor: ${row.supervisor.name}, Centro: ${row.costCenter.name}): ${parts.join(" | ")}`,
          ]
        : [];
    }),
  ];

  const systemPrompt = `Eres un auditor forense de integridad documental e IA anti-plagio para empresas de servicios y supervisión de campo.
Compara el texto o documento presentado contra la base histórica de reportes de supervisores.
Debes responder ESTRICTAMENTE en formato JSON con la siguiente estructura:
{
  "verdict": "original" | "similar" | "duplicado" | "plagio_critico",
  "plagiarismScore": number (0 a 100),
  "summary": "Resumen ejecutivo del dictamen en una o dos frases claras",
  "recommendation": "Acción recomendada al coordinador",
  "patternsDetected": ["Lista de etiquetas descriptivas como 'Copia literal', 'Paráfrasis de novedad', 'Texto genérico repetitivo']",
  "matches": [
    {
      "id": "identificador del registro coincidente",
      "kind": "VISITA" o "NOVEDAD",
      "similarityPercent": number (0 a 100),
      "author": "Nombre del supervisor",
      "costCenter": "Centro de costo",
      "submittedExcerpt": "Fragmento del documento analizado donde se detecta la similitud",
      "databaseExcerpt": "Fragmento coincidente en la base de datos",
      "reason": "Explicación clara de por qué coincide"
    }
  ]
}`;

  try {
    const parsed = await callGroqWithFallback(apiKey, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `DOCUMENTO / INFORME A EVALUAR:\n${text.slice(0, 6000)}\n\nBASE HISTÓRICA DE REGISTROS (${corpus.length} registros):\n${corpus.join("\n\n").slice(0, 14000) || "(sin registros previos)"}`,
      },
    ]);

    if (parsed.plagiarismScore && parsed.plagiarismScore <= 1) {
      parsed.plagiarismScore = Math.round(parsed.plagiarismScore * 100);
    }

    return Response.json({ ...parsed, mode: "document", examinedChars: text.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error comunicándose con Groq.";
    return Response.json({ error: msg }, { status: 502 });
  }
}

async function handleCompareMode(
  apiKey: string,
  textA: string,
  textB: string,
  labelA: string,
  labelB: string,
) {
  if (!textA.trim() || !textB.trim()) {
    return Response.json(
      { error: "Debes proporcionar ambos textos para comparar." },
      { status: 400 },
    );
  }

  const systemPrompt = `Eres un perito informático forense especializado en análisis comparativo de textos y detección de plagio / fraude documental.
Compara los dos registros siguientes (Registro A vs Registro B).
Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "similarityPercent": number (0 a 100),
  "verdict": "Idénticos / Copia directa" | "Paráfrasis evidente" | "Similitud temática natural" | "Totalmente independientes",
  "verbatimMatchesCount": number,
  "analysis": "Explicación detallada del grado de relación entre ambos textos",
  "matchingFragments": [
    {
      "textAFragment": "Fragmento del Registro A",
      "textBFragment": "Fragmento equivalente del Registro B",
      "nature": "Copia literal" | "Paráfrasis" | "Estructura idéntica"
    }
  ],
  "conclusion": "Dictamen final sobre si hubo copia intencional o coincidencia fortuita"
}`;

  try {
    const parsed = await callGroqWithFallback(apiKey, [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `--- REGISTRO A (${labelA}) ---\n${textA}\n\n--- REGISTRO B (${labelB}) ---\n${textB}`,
      },
    ]);

    if (parsed.similarityPercent && parsed.similarityPercent <= 1) {
      parsed.similarityPercent = Math.round(parsed.similarityPercent * 100);
    }

    return Response.json({ ...parsed, mode: "compare" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error comunicándose con Groq.";
    return Response.json({ error: msg }, { status: 502 });
  }
}

async function readSubmission(request: Request): Promise<string> {
  const form = await request.formData();
  const pasted = form.get("text");
  const file = form.get("file");
  const parts: string[] = [];

  if (typeof pasted === "string" && pasted.trim()) {
    parts.push(pasted.trim());
  }

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      throw new Error("El archivo supera 8 MB.");
    }
    parts.push(await textFromFile(file));
  }

  return parts.join("\n\n").trim();
}

async function textFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return bytes.toString("utf8");
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value;
  }

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    return Array.isArray(extracted.text) ? extracted.text.join("\n") : extracted.text;
  }

  throw new Error("Formato no admitido. Usa PDF, DOCX o TXT.");
}
