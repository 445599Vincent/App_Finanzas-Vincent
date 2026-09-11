import type { Txn } from '../types'
import { POR_ID } from './categories'
import { round2 } from './reconcile'
import { resumirGastoReal } from './transfers'

/**
 * Los numeros del reporte mensual.
 *
 * Todo se calcula sobre GASTO REAL: los traslados entre cuentas propias se
 * reportan aparte, nunca sumados. Un reporte que los mezclara diria que gastas
 * diez veces lo que gastas.
 */

export interface ResumenMes {
  mes: string
  entradas: number
  gasto: number
  internos: number
  /** Lo que quedo: entradas menos gasto. */
  quedo: number
  /** Porcentaje de lo que entro que no se gasto. Null si no entro nada. */
  tasaAhorro: number | null
  movimientos: number
}

export interface GastoCategoria {
  categoriaId: string
  nombre: string
  total: number
  /** Fraccion del gasto del mes, de 0 a 1. */
  parte: number
  movimientos: number
}

export interface PuntoMes {
  mes: string
  gasto: number
}

/** AAAA-MM de todos los meses con movimientos, del mas viejo al mas nuevo. */
export function mesesConDatos(txns: Txn[]): string[] {
  const meses = new Set<string>()
  for (const t of txns) meses.add(t.fecha.slice(0, 7))
  return [...meses].sort()
}

export function resumirMes(txns: Txn[], mes: string): ResumenMes {
  const delMes = txns.filter((t) => t.fecha.startsWith(mes))
  const r = resumirGastoReal(delMes)
  const quedo = round2(r.entradasReales - r.gastoReal)
  return {
    mes,
    entradas: r.entradasReales,
    gasto: r.gastoReal,
    internos: r.trasladosInternos,
    quedo,
    tasaAhorro: r.entradasReales > 0 ? quedo / r.entradasReales : null,
    movimientos: delMes.length,
  }
}

export function gastoPorCategoria(txns: Txn[], mes: string): GastoCategoria[] {
  const acumulado = new Map<string, { total: number; n: number }>()

  for (const t of txns) {
    if (!t.fecha.startsWith(mes)) continue
    if (t.esInterno || t.monto >= 0) continue
    const id = t.categoriaId ?? 'otros'
    if (POR_ID.get(id)?.cuentaEnGasto === false) continue
    const previo = acumulado.get(id) ?? { total: 0, n: 0 }
    acumulado.set(id, { total: previo.total + Math.abs(t.monto), n: previo.n + 1 })
  }

  const total = [...acumulado.values()].reduce((a, v) => a + v.total, 0)

  return [...acumulado.entries()]
    .map(([categoriaId, v]) => ({
      categoriaId,
      nombre: POR_ID.get(categoriaId)?.nombre ?? categoriaId,
      total: round2(v.total),
      parte: total > 0 ? v.total / total : 0,
      movimientos: v.n,
    }))
    .sort((a, b) => b.total - a.total)
}

/** Los ultimos `cuantos` meses hasta `mes`, incluido, aunque alguno este vacio. */
export function serieMensual(txns: Txn[], mes: string, cuantos = 6): PuntoMes[] {
  const puntos: PuntoMes[] = []
  const [anio, m] = mes.split('-').map(Number)

  for (let i = cuantos - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(anio, m - 1 - i, 1))
    const clave = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    puntos.push({ mes: clave, gasto: resumirMes(txns, clave).gasto })
  }
  return puntos
}

/** Los comercios donde mas se fue el dinero en el mes. */
export function comerciosDelMes(txns: Txn[], mes: string, cuantos = 5): GastoCategoria[] {
  const acumulado = new Map<string, { total: number; n: number }>()
  for (const t of txns) {
    if (!t.fecha.startsWith(mes) || t.esInterno || t.monto >= 0) continue
    const previo = acumulado.get(t.descripcion) ?? { total: 0, n: 0 }
    acumulado.set(t.descripcion, { total: previo.total + Math.abs(t.monto), n: previo.n + 1 })
  }
  const total = [...acumulado.values()].reduce((a, v) => a + v.total, 0)
  return [...acumulado.entries()]
    .map(([nombre, v]) => ({
      categoriaId: nombre,
      nombre,
      total: round2(v.total),
      parte: total > 0 ? v.total / total : 0,
      movimientos: v.n,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, cuantos)
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** 2026-08 -> "agosto de 2026" */
export function nombreDeMes(mes: string): string {
  const [anio, m] = mes.split('-')
  return `${MESES[Number(m) - 1] ?? mes} de ${anio}`
}

/** 2026-08 -> "AGO" */
export function mesCorto(mes: string): string {
  return (MESES[Number(mes.split('-')[1]) - 1] ?? '').slice(0, 3).toUpperCase()
}
