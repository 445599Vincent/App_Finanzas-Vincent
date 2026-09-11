import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Mientras no haya credenciales, QuickView arranca en modo demostracion con
 * datos de ejemplo. Asi puedes ver la app entera antes de conectar nada.
 */
export const hayBackend = Boolean(url && key)

export const supabase: SupabaseClient | null = hayBackend
  ? createClient(url as string, key as string)
  : null

/** Sube el PDF original y devuelve la ruta guardada. */
export async function subirEstado(userId: string, archivo: File, hash: string): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const ruta = `${userId}/${hash}.pdf`
  const { error } = await supabase.storage
    .from('estados')
    .upload(ruta, archivo, { contentType: 'application/pdf', upsert: false })
  if (error && !/already exists/i.test(error.message)) throw error
  return ruta
}

/** Enlace temporal para volver a descargar un PDF que subiste. */
export async function enlaceDeDescarga(ruta: string, segundos = 60): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error } = await supabase.storage.from('estados').createSignedUrl(ruta, segundos)
  if (error) throw error
  return data.signedUrl
}

/** SHA-256 del archivo: impide subir dos veces el mismo PDF. */
export async function hashDeArchivo(archivo: File): Promise<string> {
  const buf = await archivo.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
