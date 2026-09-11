import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Entrar con un enlace por correo.
 *
 * Sin contrasena a proposito: una contrasena mas que recordar, que guardar y
 * que se pueda filtrar no aporta nada aqui. Supabase manda un enlace, lo abres
 * en el telefono y ya estas dentro.
 */
export function Entrar() {
  const [correo, setCorreo] = useState('')
  const [fase, setFase] = useState<'listo' | 'enviando' | 'enviado' | 'error'>('listo')
  const [mensaje, setMensaje] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase || !correo.trim()) return

    setFase('enviando')
    const { error } = await supabase.auth.signInWithOtp({
      email: correo.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setFase('error')
      setMensaje(error.message)
      return
    }
    setFase('enviado')
  }

  if (fase === 'enviado') {
    return (
      <div className="vista">
        <div>
          <p className="epigrafe">Revisa tu correo</p>
          <h1 className="titulo-grande">Te mandé un enlace</h1>
        </div>
        <p className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.6, fontSize: 15 }}>
          Ábrelo en <b>este mismo teléfono</b> y entras directo. El enlace vence en una hora y
          solo sirve una vez.
        </p>
        <button type="button" className="boton boton-suave" onClick={() => setFase('listo')}>
          Usar otro correo
        </button>
      </div>
    )
  }

  return (
    <div className="vista">
      <div>
        <p className="epigrafe">QuickView</p>
        <h1 className="titulo-grande">Entra con tu correo</h1>
      </div>

      <p className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.6, fontSize: 15 }}>
        Sin contraseña. Te llega un enlace, lo abres y ya. Tus datos quedan guardados en tu
        cuenta, con respaldo y disponibles desde cualquier dispositivo.
      </p>

      <form onSubmit={(e) => void enviar(e)} className="bloque-apretado">
        <input
          id="correo"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="tarjeta-plana"
          style={{ border: 0, font: 'inherit', fontSize: 16, color: 'var(--ink)', padding: '15px 16px' }}
        />
        <button type="submit" className="boton" disabled={fase === 'enviando'}>
          {fase === 'enviando' ? 'Enviando…' : 'Mandarme el enlace'}
        </button>
      </form>

      {fase === 'error' ? (
        <div className="aviso aviso-alta">
          <span className="aviso-severidad">Atención</span>
          <span className="aviso-titulo">No se pudo enviar</span>
          <span className="aviso-texto">{mensaje}</span>
        </div>
      ) : null}

      <p className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.55 }}>
        QuickView nunca te pide las claves de tu banco. Solo lee los PDF que tú subes.
      </p>
    </div>
  )
}
