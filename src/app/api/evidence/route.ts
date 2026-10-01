import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 1_500_000;

/**
 * Sube la foto de una evidencia y devuelve la `url` que luego entra en
 * `evidence.upsert`. El archivo queda en `public/uploads`.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el archivo en el campo file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "El archivo tiene que ser una imagen." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return Response.json(
      { error: "La foto tiene que pesar entre 1 byte y 1.5 MB." },
      { status: 400 },
    );
  }

  const extension = extensionFor(file.type);
  const filename = `${randomUUID()}${extension}`;
  const directory = path.join(process.cwd(), "public", "uploads");

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);

  return Response.json({ url: `/uploads/${filename}` });
}

function extensionFor(mime: string): string {
  if (mime === "image/png") {
    return ".png";
  }

  if (mime === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}
