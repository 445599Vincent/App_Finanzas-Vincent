import { AlmacenTelefono, type Almacen } from './almacen'
import { AlmacenSupabase } from './almacenSupabase'
import { supabase } from './supabase'

export type { Almacen }

/**
 * Elige donde guardar.
 *
 * El userId llega de la sesion de verdad (useSesion), no de husmear el
 * localStorage de Supabase: ese formato es un detalle interno suyo y cambiarlo
 * no tendria por que romper esta app.
 */
export function crearAlmacen(userId: string | null): Almacen {
  if (userId && supabase) return new AlmacenSupabase(supabase, userId)
  return new AlmacenTelefono()
}
