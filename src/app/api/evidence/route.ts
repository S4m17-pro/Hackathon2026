import { randomUUID } from "node:crypto";

import { PhotoError, savePhoto } from "@/app/api/photos/storage";

export const runtime = "nodejs";

/**
 * Sube la foto de una evidencia a Vercel Blob y devuelve la `url`
 * que luego entra en `evidence.upsert`.
 *
 * multipart: `file` (imagen). `clientId` es opcional.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const clientIdField = form.get("clientId");

    if (!(file instanceof File)) {
      throw new PhotoError("Falta el archivo en el campo file.");
    }

    const clientId =
      typeof clientIdField === "string" && clientIdField.trim() !== ""
        ? clientIdField
        : randomUUID();

    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await savePhoto(clientId, bytes, file.type);

    return Response.json({ url });
  } catch (error) {
    if (error instanceof PhotoError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "No se pudo guardar la foto." }, { status: 500 });
  }
}
