import { readFile } from "node:fs/promises";

import { PhotoError, resolvePhoto } from "@/app/api/photos/storage";

export const runtime = "nodejs";

/** Sirve la foto guardada por `POST /api/photos`. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const photo = await resolvePhoto(clientId);

    if (!photo) {
      return Response.json({ error: "Foto no encontrada." }, { status: 404 });
    }

    const bytes = await readFile(photo.filePath);

    return new Response(bytes, {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof PhotoError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "No se pudo leer la foto." }, { status: 500 });
  }
}
