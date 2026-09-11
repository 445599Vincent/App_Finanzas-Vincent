import type { Account, Alert, CardCycle, Txn } from '../types'
import { diasEntre, fechaLarga } from './dates'
import { pesos } from './money'
import { detectarRecurrentes, costoMensual, type Recurrente } from './recurring'
import { round2 } from './reconcile'
import { POR_ID } from './categories'

/**
 * El criterio: las cuatro familias de alertas.
 * Cada una guarda su evidencia para que puedas comprobarla, no creerla.
 */

export interface ContextoCriterio {
  hoy: string
  txns: Txn[]
  cuentas: Account[]
  ciclos: CardCycle[]
  /** Limite mensual por categoria que tu fijaste. */
  presupuestos?: Record<string, number>
}

export function calcularCriterio(ctx: ContextoCriterio): Alert[] {
  return [
    ...alertasDeCorte(ctx),
    ...alertasDeRecurrentes(ctx),
    ...alertasDePresupuesto(ctx),
    ...alertasDeAnomalias(ctx),
  ].sort(porSeveridad)
}

const ORDEN: Record<Alert['severidad'], number> = { alta: 0, media: 1, info: 2 }
function porSeveridad(a: Alert, b: Alert) {
  return ORDEN[a.severidad] - ORDEN[b.severidad]
}

// ---------------------------------------------------------------- corte y pago

function alertasDeCorte(ctx: ContextoCriterio): Alert[] {
  const out: Alert[] = []

  for (const cuenta of ctx.cuentas.filter((c) => c.tipo === 'tarjeta')) {
    const ciclos = ctx.ciclos
      .filter((c) => c.accountId === cuenta.id)
      .sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte))
    const ultimo = ciclos[0]
    if (!ultimo) continue

    const faltan = diasEntre(ctx.hoy, ultimo.fechaVencimiento)

    if (faltan >= 0 && faltan <= 7 && ultimo.balanceCorte > 0) {
      out.push({
        id: `corte-${cuenta.id}-${ultimo.fechaCorte}`,
        tipo: 'corte-pago',
        severidad: faltan <= 2 ? 'alta' : 'media',
        titulo: faltan === 0 ? 'Tu tarjeta vence hoy' : `Faltan ${faltan} días para el pago`,
        mensaje:
          `Tu ${cuenta.nombre} cortó el ${fechaLarga(ultimo.fechaCorte)} con ${pesos(ultimo.balanceCorte)}. ` +
          `Paga completo antes del ${fechaLarga(ultimo.fechaVencimiento)} y no generas intereses.`,
        evidencia: `Pago mínimo ${pesos(ultimo.pagoMinimo)} · para no generar intereses ${pesos(ultimo.balanceCorte)}`,
      })
    }

    // La racha: tres cortes seguidos pagados completos es un habito que vale la
    // pena nombrar, y avisar cuando esta a punto de romperse.
    const racha = rachaPagandoCompleto(ciclos, ctx.txns, cuenta.id)
    if (racha >= 3) {
      out.push({
        id: `racha-${cuenta.id}`,
        tipo: 'corte-pago',
        severidad: 'info',
        titulo: `${racha} cortes seguidos pagando completo`,
        mensaje: `Esa tarjeta no te está costando un peso de interés. Mantener la racha vale más que cualquier consejo de esta app.`,
      })
    }
  }

  return out
}

function rachaPagandoCompleto(ciclos: CardCycle[], txns: Txn[], accountId: string): number {
  let racha = 0
  for (const ciclo of ciclos) {
    const pagos = txns.filter(
      (t) =>
        t.accountId === accountId &&
        t.monto > 0 &&
        t.fecha > ciclo.fechaCorte &&
        t.fecha <= ciclo.fechaVencimiento,
    )
    const abonado = pagos.reduce((a, t) => a + t.monto, 0)
    if (ciclo.balanceCorte > 0 && abonado + 0.005 >= ciclo.balanceCorte) racha++
    else break
  }
  return racha
}

// ------------------------------------------------------------------ recurrentes

function alertasDeRecurrentes(ctx: ContextoCriterio): Alert[] {
  const rs = detectarRecurrentes(ctx.txns)
  if (rs.length === 0) return []

  const out: Alert[] = []
  const mensual = costoMensual(rs)

  out.push({
    id: 'recurrentes-total',
    tipo: 'recurrente',
    severidad: 'info',
    titulo: `${rs.length} cargos se repiten solos`,
    mensaje: `Entre todos te cuestan ${pesos(mensual)} al mes, ${pesos(mensual * 12)} al año.`,
    evidencia: rs
      .slice(0, 5)
      .map((r) => `${r.comercio} · ${pesos(r.monto)} cada ${r.cadaDias} días`)
      .join('\n'),
  })

  for (const r of rs.filter((x) => x.variacion > 0.05)) {
    out.push({
      id: `subio-${r.comercio}`,
      tipo: 'recurrente',
      severidad: 'media',
      titulo: `${r.comercio} subió de precio`,
      mensaje: `Pasó de ${pesos(r.monto)} a ${pesos(r.ultimoMonto)}, un ${Math.round(r.variacion * 100)}% más.`,
      evidencia: `Visto ${r.veces} veces entre ${fechaLarga(r.primerVisto)} y ${fechaLarga(r.ultimoVisto)}`,
    })
  }

  return out
}

// ------------------------------------------------------------------ presupuesto

function alertasDePresupuesto(ctx: ContextoCriterio): Alert[] {
  const presupuestos = ctx.presupuestos ?? {}
  if (Object.keys(presupuestos).length === 0) return []

  // Comparar siempre contra el mes corriente deja la alerta muda hasta que
  // subas el estado del mes. Se usa el ultimo mes que tenga movimientos.
  const mes = ultimoMesConDatos(ctx.txns) ?? ctx.hoy.slice(0, 7)
  const gastoPorCat = new Map<string, number>()

  for (const t of ctx.txns) {
    if (t.esInterno || t.monto >= 0) continue
    if (!t.fecha.startsWith(mes)) continue
    const cat = t.categoriaId ?? 'otros'
    if (POR_ID.get(cat)?.cuentaEnGasto === false) continue
    gastoPorCat.set(cat, (gastoPorCat.get(cat) ?? 0) + Math.abs(t.monto))
  }

  const out: Alert[] = []
  for (const [catId, limite] of Object.entries(presupuestos)) {
    const gastado = round2(gastoPorCat.get(catId) ?? 0)
    if (limite <= 0) continue
    const uso = gastado / limite
    if (uso < 0.8) continue

    const nombre = POR_ID.get(catId)?.nombre ?? catId
    const excedido = uso > 1
    out.push({
      id: `presupuesto-${catId}-${mes}`,
      tipo: 'presupuesto',
      severidad: excedido ? 'alta' : 'media',
      titulo: excedido
        ? `${nombre} por encima del límite en ${nombreMes(mes)}`
        : `${nombre} va al ${Math.round(uso * 100)}% en ${nombreMes(mes)}`,
      mensaje: excedido
        ? `Llevas ${pesos(gastado)} de los ${pesos(limite)} que fijaste. Te pasaste por ${pesos(gastado - limite)}.`
        : `Llevas ${pesos(gastado)} de ${pesos(limite)}. Te quedan ${pesos(limite - gastado)}.`,
    })
  }
  return out
}

/** El mes mas reciente con movimientos, en formato AAAA-MM. */
function ultimoMesConDatos(txns: Txn[]): string | null {
  let max: string | null = null
  for (const t of txns) {
    if (t.esInterno || t.monto >= 0) continue
    const m = t.fecha.slice(0, 7)
    if (max === null || m > max) max = m
  }
  return max
}

const NOMBRE_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function nombreMes(mes: string): string {
  const i = Number(mes.slice(5, 7)) - 1
  return NOMBRE_MES[i] ?? mes
}

// -------------------------------------------------------------------- anomalias

function alertasDeAnomalias(ctx: ContextoCriterio): Alert[] {
  const out: Alert[] = []

  // Cargos identicos el mismo dia en la misma cuenta.
  const vistos = new Map<string, Txn[]>()
  for (const t of ctx.txns) {
    if (t.esInterno || t.monto >= 0) continue
    const k = `${t.accountId}|${t.fecha}|${t.monto.toFixed(2)}`
    const g = vistos.get(k)
    if (g) g.push(t)
    else vistos.set(k, [t])
  }
  for (const [, grupo] of vistos) {
    if (grupo.length < 2) continue
    const t = grupo[0]
    out.push({
      id: `duplicado-${t.id}`,
      tipo: 'anomalia',
      severidad: 'media',
      titulo: 'Posible cargo duplicado',
      mensaje: `${t.descripcion} por ${pesos(t.monto)} aparece ${grupo.length} veces el ${fechaLarga(t.fecha)}.`,
      evidencia: 'Puede ser legítimo (dos compras iguales el mismo día), pero vale la pena mirarlo.',
    })
  }

  // Lo que te cobra el banco, sumado aparte.
  const delBanco = ctx.txns.filter(
    (t) => !t.esInterno && t.monto < 0 && (t.categoriaId === 'impuestos' || t.categoriaId === 'comisiones'),
  )
  if (delBanco.length > 0) {
    const total = round2(delBanco.reduce((a, t) => a + Math.abs(t.monto), 0))
    out.push({
      id: 'cargos-banco',
      tipo: 'anomalia',
      severidad: 'info',
      titulo: 'Lo que te cobra el banco',
      mensaje: `${pesos(total)} en ${delBanco.length} cargos entre impuesto DGII, seguros y comisiones.`,
      evidencia: 'El impuesto del 0.15% viene agrupado por varias transacciones, no por cada una.',
    })
  }

  return out
}

export type { Recurrente }
