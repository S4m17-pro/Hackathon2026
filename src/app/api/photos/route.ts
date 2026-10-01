import { PhotoError, assertClientId, savePhoto } from "@/app/api/photos/storage";

export const runtime = "nodejs";

/**
 * Recibe la foto comprimida del supervisor y devuelve la `url`
 * que luego entra en `evidence.upsert`.
 *
 * multipart: `clientId` (texto) + `file` (imagen).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const clientIdField = form.get("clientId");
    const file = form.get("file");

    if (typeof clientIdField !== "string") {
      throw new PhotoError("Falta clientId.");
    }

    if (!(file instanceof File)) {
      throw new PhotoError("Falta el archivo en el campo file.");
    }

    const clientId = assertClientId(clientIdField);
    const bytes = Buffer.from(await file.arrayBuffer());
    const url = await savePhoto(clientId, bytes, file.type);

    return Response.json({ url, clientId });
  } catch (error) {
    return photoErrorResponse(error);
  }
}

function photoErrorResponse(error: unknown): Response {
  if (error instanceof PhotoError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  return Response.json({ error: "No se pudo guardar la foto." }, { status: 500 });
}
