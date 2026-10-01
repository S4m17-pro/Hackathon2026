import { PhotoError, resolvePhotoUrl } from "@/app/api/photos/storage";

export const runtime = "nodejs";

/** Redirige a la foto pública en Vercel Blob. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const url = await resolvePhotoUrl(clientId);

    if (!url) {
      return Response.json({ error: "Foto no encontrada." }, { status: 404 });
    }

    return Response.redirect(url, 302);
  } catch (error) {
    if (error instanceof PhotoError) {
      return Response.json({ error: error.message }, { status: error.status });
    }

    return Response.json({ error: "No se pudo leer la foto." }, { status: 500 });
  }
}
