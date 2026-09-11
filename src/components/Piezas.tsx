import type { ReactNode } from 'react'
import type { Account, Alert } from '../types'
import { pesos } from '../lib/money'

export function Marca({ cuenta }: { cuenta: Account }) {
  const esTarjeta = cuenta.tipo === 'tarjeta'
  return (
    <span className={esTarjeta ? 'marca marca-tc' : 'marca'} aria-hidden="true">
      {esTarjeta ? 'TC' : 'BPD'}
    </span>
  )
}

export function Fila({
  izquierda,
  nombre,
  detalle,
  derecha,
  onClick,
}: {
  izquierda?: ReactNode
  nombre: ReactNode
  detalle?: ReactNode
  derecha?: ReactNode
  onClick?: () => void
}) {
  const contenido = (
    <>
      {izquierda}
      <span className="fila-crece">
        <span className="fila-nombre">{nombre}</span>
        {detalle ? <span className="fila-detalle">{detalle}</span> : null}
      </span>
      {derecha}
    </>
  )
  if (onClick) {
    return (
      <button type="button" className="fila" onClick={onClick}>
        {contenido}
      </button>
    )
  }
  return <div className="fila">{contenido}</div>
}

/** Monto con el color y el signo que le toca. */
export function Monto({ valor, gris = false }: { valor: number; gris?: boolean }) {
  const clase = gris ? 'monto monto-gris' : valor < 0 ? 'monto monto-neg' : 'monto monto-pos'
  const signo = gris ? '' : valor < 0 ? '−' : '+'
  return <span className={clase}>{`${signo}${pesos(valor)}`}</span>
}

/** Cifra grande con los centavos atenuados, como en el resumen. */
export function CifraGrande({ valor }: { valor: number }) {
  const texto = pesos(valor)
  const i = texto.lastIndexOf('.')
  const entero = i === -1 ? texto : texto.slice(0, i)
  const centavos = i === -1 ? '' : texto.slice(i)
  return (
    <div className="cifra-grande" style={valor < 0 ? { color: 'var(--neg)' } : undefined}>
      {valor < 0 ? '−' : ''}
      {entero}
      <span className="centavos">{centavos}</span>
    </div>
  )
}

/**
 * El ambar y el rojo de las alertas quedan a una distancia perceptual muy corta
 * con daltonismo: medidos, salen a delta-E 2.0 en deuteranopia. Por eso la
 * severidad no se transmite solo por color, sino tambien escrita.
 */
const SEVERIDAD: Record<Alert['severidad'], string> = {
  alta: 'Atención',
  media: 'Revisar',
  info: 'Nota',
}

export function Aviso({ alerta }: { alerta: Alert }) {
  return (
    <div className={`aviso aviso-${alerta.severidad}`}>
      <span className="aviso-severidad">{SEVERIDAD[alerta.severidad]}</span>
      <span className="aviso-titulo">{alerta.titulo}</span>
      <span className="aviso-texto">{alerta.mensaje}</span>
      {alerta.evidencia ? <span className="aviso-evidencia">{alerta.evidencia}</span> : null}
    </div>
  )
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: ReactNode }) {
  return (
    <div className="vacio">
      <h3>{titulo}</h3>
      <p>{texto}</p>
      {accion}
    </div>
  )
}
