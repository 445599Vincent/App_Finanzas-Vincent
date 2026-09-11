import type { EstadoCrudo } from './esquemaEstado'

/**
 * Cliente del navegador para /api/leer-estado.
 *
 * La llave de Claude vive solo en el servidor. Desde aqui unicamente se manda
 * el PDF y se recibe la transcripcion.
 */

export interface LecturaOk {
  estado: EstadoCrudo
  uso: { entrada: number; salida: number }
}

/** Un PDF a base64 sin saltos de linea, que es lo que espera la API. */
export async function aBase64(archivo: File): Promise<string> {
  const buffer = await archivo.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  // En trozos para no reventar la pila con archivos grandes.
  const TROZO = 0x8000
  let binario = ''
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  return btoa(binario)
}

/** SHA-256 del archivo: impide subir dos veces el mismo PDF. */
export async function hashDe(archivo: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer())
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function leerEstado(archivo: File): Promise<LecturaOk> {
  const pdfBase64 = await aBase64(archivo)

  const respuesta = await fetch('/api/leer-estado', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pdfBase64 }),
  })

  const cuerpo = (await respuesta.json().catch(() => null)) as
    | (LecturaOk & { error?: string })
    | null

  if (!respuesta.ok || !cuerpo || cuerpo.error) {
    throw new Error(cuerpo?.error ?? `La lectura falló (${respuesta.status}).`)
  }

  return { estado: cuerpo.estado, uso: cuerpo.uso }
}

/** Lo que cuesta en dólares una lectura, con los precios de Claude Opus 5. */
export function costoAproximado(uso: { entrada: number; salida: number }): number {
  return (uso.entrada / 1_000_000) * 5 + (uso.salida / 1_000_000) * 25
}
