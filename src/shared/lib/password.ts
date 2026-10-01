/**
 * Hash de contrasenas con scrypt (RNF-07).
 *
 * scrypt viene en el modulo `crypto` de Node: no agrega dependencias ni
 * binarios nativos, que es lo que menos conviene en un proyecto donde tres
 * personas instalan en paralelo.
 *
 * Formato: `scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>`
 *
 * Este archivo es de Juan. Samuel solo lo usa para el login, nunca lo edita.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

interface ScryptOptions {
  N: number;
  r: number;
  p: number;
  maxmem: number;
}

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Parametros segun OWASP para scrypt: N=2^16, r=8, p=1. */
const N = 65_536;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * scrypt necesita ~128 * N * r bytes: con estos parametros, 64 MB. El limite
 * por defecto de Node es 32 MB y falla con ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
 * Por eso se sube `maxmem` explicito en vez de bajar N.
 */
const MAX_MEMORY = 128 * N * R * 2;

/** Genera el hash de una contrasena en texto plano. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(plain.normalize("NFKC"), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEMORY,
  });

  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verifica una contrasena contra un hash guardado.
 * Devuelve `false` ante cualquier formato raro, sin tirar excepcion: un hash
 * invalido es un login fallido, no un error del servidor.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");

  // Formato esperado: scrypt, N, r, p, salt, hash
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  if (n > N || r > R || p > P) {
    // Un hash con parametros mas caros de los que emite esta version obliga a
    // un CPU DoS. Se rechaza en vez de aceptarlo.
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");

  if (expected.length !== KEY_LENGTH) {
    return false;
  }

  const derived = await scrypt(
    plain.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    KEY_LENGTH,
    { N: n, r, p, maxmem: MAX_MEMORY },
  );

  return timingSafeEqual(derived, expected);
}