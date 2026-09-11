import type { Txn } from '../types'
import { diasEntre } from './dates'
import { normalizarDescripcion } from './fingerprint'
import { round2 } from './reconcile'

/**
 * Cargos que se repiten solos.
 *
 * Ojo con asumir que "recurrente" es lo mismo que "mensual": en los estados de
 * calibracion el cargo mas regular era una barberia cada 10-14 dias. Un filtro
 * que solo mire periodos de 28-31 dias se lo pierde entero.
 */

export interface Recurrente {
  comercio: string
  /** Monto tipico (mediana). */
  monto: number
  /** Cada cuantos dias, en promedio. */
  cadaDias: number
  veces: number
  primerVisto: string
  ultimoVisto: string
  ultimoMonto: number
  /** Cambio relativo entre el primer monto y el ultimo. 0.18 = subio 18%. */
  variacion: number
}

/** Tolerancia de monto para considerar dos cargos "el mismo". */
const TOLERANCIA_MONTO = 0.15
/** Cuanto puede variar el espaciado y seguir siendo regular. */
const TOLERANCIA_RITMO = 0.45
const MINIMO_APARICIONES = 3

/** Quita numeros de referencia y sucursal para agrupar el mismo comercio. */
export function claveComercio(descripcion: string): string {
  return normalizarDescripcion(descripcion)
    .replace(/#\w+/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function mediana(ns: number[]): number {
  const s = [...ns].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function detectarRecurrentes(txns: Txn[]): Recurrente[] {
  const gastos = txns.filter((t) => !t.esInterno && t.monto < 0)

  const grupos = new Map<string, Txn[]>()
  for (const t of gastos) {
    const k = claveComercio(t.descripcion)
    if (!k) continue
    const g = grupos.get(k)
    if (g) g.push(t)
    else grupos.set(k, [t])
  }

  const salida: Recurrente[] = []

  for (const [clave, lista] of grupos) {
    if (lista.length < MINIMO_APARICIONES) continue

    const ordenados = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const montos = ordenados.map((t) => Math.abs(t.monto))
    const tipico = mediana(montos)
    if (tipico <= 0) continue

    // Todos los cargos deben parecerse en monto.
    const parecidos = montos.every((m) => Math.abs(m - tipico) / tipico <= TOLERANCIA_MONTO)
    if (!parecidos) continue

    const huecos: number[] = []
    for (let i = 1; i < ordenados.length; i++) {
      huecos.push(diasEntre(ordenados[i - 1].fecha, ordenados[i].fecha))
    }
    const ritmo = mediana(huecos)
    if (ritmo < 5) continue // varias compras del mismo dia no son una suscripcion

    // El espaciado tiene que ser regular, sea quincenal, mensual o lo que sea.
    const regular = huecos.every((h) => Math.abs(h - ritmo) / ritmo <= TOLERANCIA_RITMO)
    if (!regular) continue

    const primero = montos[0]
    const ultimo = montos[montos.length - 1]

    salida.push({
      comercio: ordenados[ordenados.length - 1].descripcion,
      monto: round2(tipico),
      cadaDias: Math.round(ritmo),
      veces: ordenados.length,
      primerVisto: ordenados[0].fecha,
      ultimoVisto: ordenados[ordenados.length - 1].fecha,
      ultimoMonto: round2(ultimo),
      variacion: primero > 0 ? round2((ultimo - primero) / primero) : 0,
    })
    void clave
  }

  return salida.sort((a, b) => b.monto * (30 / b.cadaDias) - a.monto * (30 / a.cadaDias))
}

/** Lo que te cuestan al mes todos los recurrentes juntos. */
export function costoMensual(rs: Recurrente[]): number {
  return round2(rs.reduce((acc, r) => acc + r.monto * (30 / r.cadaDias), 0))
}
