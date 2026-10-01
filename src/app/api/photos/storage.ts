import { head, put } from "@vercel/blob";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSIONS = ["jpg", "png", "webp"] as const;

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
 * Sube (o reemplaza) la foto en Vercel Blob.
 * La `url` devuelta es pública y es la que entra en la evidencia.
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new PhotoError("Falta BLOB_READ_WRITE_TOKEN.", 500);
  }

  const blob = await put(`photos/${clientId}.${ext}`, bytes, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mimeType,
  });

  return blob.url;
}

/** URL pública del objeto, si existe con alguna extensión admitida. */
export async function resolvePhotoUrl(clientId: string): Promise<string | null> {
  const safeId = assertClientId(clientId);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new PhotoError("Falta BLOB_READ_WRITE_TOKEN.", 500);
  }

  for (const ext of EXTENSIONS) {
    try {
      const blob = await head(`photos/${safeId}.${ext}`);
      return blob.url;
    } catch {
      // Esa extensión no está en el store. Se prueba la siguiente.
    }
  }

  return null;
}
