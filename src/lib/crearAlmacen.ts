import { AlmacenTelefono, type Almacen } from './almacen'
import { AlmacenSupabase } from './almacenSupabase'
import { supabase, hayBackend } from './supabase'

export type { Almacen }

/**
 * Elige donde guardar. Con Supabase configurado y sesion iniciada, alla; si no,
 * en el telefono. Las pantallas no se enteran de cual esta activo.
 *
 * Ojo: sin sesion no se puede usar Supabase aunque haya credenciales, porque
 * cada fila se guarda con su user_id y las politicas de seguridad lo exigen.
 */
export function crearAlmacen(): Almacen {
  if (!hayBackend || !supabase) return new AlmacenTelefono()

  const usuario = leerUsuarioSincrono()
  return usuario ? new AlmacenSupabase(supabase, usuario) : new AlmacenTelefono()
}

/**
 * Supabase guarda la sesion en localStorage. Se lee de ahi para poder decidir
 * el almacen sin volver la creacion asincrona, que obligaria a las pantallas a
 * manejar un estado intermedio que no aporta nada.
 */
function leerUsuarioSincrono(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i)
      if (!clave?.startsWith('sb-') || !clave.endsWith('-auth-token')) continue
      const bruto = localStorage.getItem(clave)
      if (!bruto) continue
      const sesion = JSON.parse(bruto) as { user?: { id?: string } }
      if (sesion.user?.id) return sesion.user.id
    }
  } catch {
    /* sin sesion legible */
  }
  return null
}
