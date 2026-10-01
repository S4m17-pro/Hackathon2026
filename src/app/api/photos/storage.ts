import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Fotos persistidas en disco. La URL pública las sirve `GET /api/photos/:clientId`. */
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 1_500_000;

export class PhotoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PhotoError";
  }
}

export function assertClientId(clientId: string): string {
  const trimmed = clientId.trim();

  if (!/^[A-Za-z0-9_-]{8,80}$/.test(trimmed)) {
    throw new PhotoError("clientId inválido.");
  }

  return trimmed;
}

/**
 * Guarda (o reemplaza) la foto de un `clientId`.
 * Reenviar la misma evidencia no deja archivos viejos de otra extensión.
 */
export async function savePhoto(
  clientId: string,
  bytes: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = MIME_EXT[mimeType];

  if (!ext) {
    throw new PhotoError("Formato no soportado. Usa JPEG, PNG o WebP.");
  }

  if (bytes.byteLength === 0) {
    throw new PhotoError("El archivo está vacío.");
  }

  if (bytes.byteLength > MAX_BYTES) {
    throw new PhotoError("La foto supera el tamaño máximo (1.5 MB).");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  await removeOtherExtensions(clientId, ext);
  await writeFile(path.join(UPLOAD_DIR, `${clientId}.${ext}`), bytes);

  return `/api/photos/${clientId}`;
}

export async function resolvePhoto(
  clientId: string,
): Promise<{ filePath: string; mimeType: string } | null> {
  const safeId = assertClientId(clientId);
  let names: string[];

  try {
    names = await readdir(UPLOAD_DIR);
  } catch {
    return null;
  }

  const name = names.find((entry) => entry.startsWith(`${safeId}.`));

  if (!name) {
    return null;
  }

  const ext = path.extname(name).slice(1);
  const mimeType = Object.entries(MIME_EXT).find(([, value]) => value === ext)?.[0];

  if (!mimeType) {
    return null;
  }

  return { filePath: path.join(UPLOAD_DIR, name), mimeType };
}

async function removeOtherExtensions(clientId: string, keepExt: string): Promise<void> {
  let names: string[];

  try {
    names = await readdir(UPLOAD_DIR);
  } catch {
    return;
  }

  await Promise.all(
    names
      .filter((name) => name.startsWith(`${clientId}.`) && path.extname(name) !== `.${keepExt}`)
      .map((name) => unlink(path.join(UPLOAD_DIR, name))),
  );
}
