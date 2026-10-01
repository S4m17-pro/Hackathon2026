import { getSession } from "@/app/(auth)/session";
import { prisma } from "@/shared/lib/prisma";

export const runtime = "nodejs";

const MODEL = "llama-3.3-70b-versatile";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || session.role !== "COORDINADOR") {
    return Response.json({ error: "Solo el coordinador puede validar documentos." }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return Response.json({ error: "Falta GROQ_API_KEY." }, { status: 500 });
  }

  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() ?? "";

  if (text.length < 20) {
    return Response.json({ error: "El documento necesita al menos 20 caracteres." }, { status: 400 });
  }

  const [novelties, visits] = await Promise.all([
    prisma.novelty.findMany({
      orderBy: { clientCreatedAt: "desc" },
      take: 40,
      select: { id: true, description: true, clientCreatedAt: true },
    }),
    prisma.visit.findMany({
      where: { OR: [{ notes: { not: null } }, { checkOutNotes: { not: null } }] },
      orderBy: { clientCreatedAt: "desc" },
      take: 20,
      select: { id: true, notes: true, checkOutNotes: true },
    }),
  ]);

  const corpus = [
    ...novelties.map(
      (row) => `NOVEDAD ${row.id} (${row.clientCreatedAt.toISOString()}): ${row.description}`,
    ),
    ...visits.flatMap((row) => {
      const parts = [row.notes, row.checkOutNotes].filter(Boolean);
      return parts.length > 0 ? [`VISITA ${row.id}: ${parts.join(" | ")}`] : [];
    }),
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un revisor de integridad documental. Comparas un texto nuevo contra registros ya guardados. Respondes solo JSON con verdict (duplicado, similar u original), summary (una frase en español) y matches (lista de hasta 5 objetos con id, kind, reason). duplicado = el mismo hecho o copia casi literal. similar = mismo incidente reformulado o datos que parecen reutilizados. original = no hay coincidencia relevante. No inventes ids.",
        },
        {
          role: "user",
          content: `DOCUMENTO NUEVO:\n${text.slice(0, 6000)}\n\nREGISTROS:\n${corpus.join("\n").slice(0, 12000) || "(no hay registros)"}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return Response.json(
      { error: "Groq no pudo revisar el documento.", detail: detail.slice(0, 300) },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? "{}";

  try {
    return Response.json(JSON.parse(content));
  } catch {
    return Response.json({ error: "La respuesta de Groq no era JSON.", raw: content.slice(0, 500) }, { status: 502 });
  }
}
