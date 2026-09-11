import { useEffect, useState } from 'react'
import { supabase, hayBackend } from './supabase'

/**
 * La sesion de Supabase.
 *
 * Sin Supabase configurado no hay sesion que valga: la app corre en modo
 * telefono y nunca pide correo. Eso es a proposito — obligar a crear una cuenta
 * para usar algo que guarda en tu propio dispositivo no tiene sentido.
 */

export type EstadoSesion =
  | { tipo: 'sin-backend' }
  | { tipo: 'cargando' }
  | { tipo: 'fuera' }
  | { tipo: 'dentro'; userId: string; correo: string | null }

export function useSesion(): EstadoSesion {
  const [estado, setEstado] = useState<EstadoSesion>(() =>
    hayBackend ? { tipo: 'cargando' } : { tipo: 'sin-backend' },
  )

  useEffect(() => {
    if (!hayBackend || !supabase) return
    let vivo = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setEstado(deSesion(data.session))
    })

    // Cubre el regreso del enlace mágico, el cierre de sesión y la renovación
    // del token, sin que ninguna pantalla tenga que enterarse.
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      if (vivo) setEstado(deSesion(sesion))
    })

    return () => {
      vivo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return estado
}

type SesionMinima = { user: { id: string; email?: string | null } } | null

function deSesion(sesion: SesionMinima): EstadoSesion {
  if (!sesion?.user) return { tipo: 'fuera' }
  return { tipo: 'dentro', userId: sesion.user.id, correo: sesion.user.email ?? null }
}

export async function salir(): Promise<void> {
  await supabase?.auth.signOut()
}
