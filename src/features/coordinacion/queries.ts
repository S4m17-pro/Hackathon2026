/**
 * Lecturas de base de datos del coordinador.
 * Importar solo desde Server Components o Server Actions.
 * No lleva "use server": no deben exponerse como endpoints de mutación.
 */

export async function coordinacionQueriesReady(): Promise<{ ok: true }> {
  return { ok: true };
}
