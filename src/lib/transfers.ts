import type { Account, Txn, TransferLink } from '../types'
import { diasEntre } from './dates'
import { round2 } from './reconcile'

/**
 * Traslados entre cuentas tuyas.
 *
 * Este es el hallazgo que hace o rompe la app. En los estados de calibracion,
 * NUEVE de cada diez pesos que salian de la cuenta operativa eran traslados a
 * la otra cuenta o pagos a la propia tarjeta. Contarlos como gasto infla la
 * cifra por un factor de diez y vuelve inutil cualquier presupuesto.
 *
 * Las dos familias que aparecen en los estados del Popular:
 *
 *   Cuenta -> Cuenta    "Transf. via MB a 700445566"
 *                       "Transf. via MB desde 700112233"
 *
 *   Cuenta -> Tarjeta   "PagoTC Via MB***9090"
 *                       "Pago Via App"            (del lado de la tarjeta)
 *
 * El emparejamiento exige monto identico y fechas cercanas. La tarjeta suele
 * registrar el pago el mismo dia, pero se permite holgura por si acredita tarde.
 */

/** Dias de holgura entre los dos lados de un mismo traslado. */
const VENTANA_DIAS = 3

const RE_A_CUENTA = /\bdesde\s+(\d{6,})/i
const RE_HACIA_CUENTA = /\ba\s+(\d{6,})/i
const RE_PAGO_TC = /pago\s*tc|pagotc/i
const RE_PAGO_TARJETA = /pago\s+v[ií]a\s+app|pago\s+recibido|pago\s+en\s+l[ií]nea/i
/** "PagoTC Via MB***9090" -> 3208 */
const RE_ULTIMOS4 = /(\d{4})\s*$/

export interface OpcionesTraslado {
  ventanaDias?: number
}

/**
 * Empareja los dos lados de cada traslado. Devuelve los pares encontrados y
 * el conjunto de ids que deben quedar marcados como internos.
 */
export function emparejarTraslados(
  txns: Txn[],
  cuentas: Account[],
  opts: OpcionesTraslado = {},
): { enlaces: TransferLink[]; internos: Set<string> } {
  const ventana = opts.ventanaDias ?? VENTANA_DIAS
  const porCuenta = new Map(cuentas.map((c) => [c.id, c]))

  const salidas = txns.filter((t) => t.monto < 0)
  const entradas = txns.filter((t) => t.monto > 0)

  const enlaces: TransferLink[] = []
  const internos = new Set<string>()
  const usadas = new Set<string>()

  for (const salida of salidas) {
    const cuentaSalida = porCuenta.get(salida.accountId)
    if (!cuentaSalida) continue

    const destino = destinoDe(salida, cuentas)
    if (!destino) continue

    const candidatas = entradas.filter((e) => {
      if (usadas.has(e.id)) return false
      if (e.accountId === salida.accountId) return false
      if (e.accountId !== destino.cuenta.id) return false
      if (round2(Math.abs(e.monto)) !== round2(Math.abs(salida.monto))) return false
      const d = Math.abs(diasEntre(salida.fecha, e.fecha))
      return d <= ventana
    })

    if (candidatas.length === 0) continue

    // La mas cercana en el tiempo gana; a igualdad, la primera.
    candidatas.sort(
      (a, b) =>
        Math.abs(diasEntre(salida.fecha, a.fecha)) - Math.abs(diasEntre(salida.fecha, b.fecha)),
    )
    const entrada = candidatas[0]
    usadas.add(entrada.id)

    const mismoDia = entrada.fecha === salida.fecha
    enlaces.push({
      salidaId: salida.id,
      entradaId: entrada.id,
      metodo: destino.metodo,
      // Mismo dia y referencia explicita a la cuenta destino: certeza practica.
      confianza: mismoDia ? (destino.explicito ? 1 : 0.9) : 0.75,
      monto: Math.abs(salida.monto),
    })
    internos.add(salida.id)
    internos.add(entrada.id)
  }

  return { enlaces, internos }
}

interface Destino {
  cuenta: Account
  metodo: TransferLink['metodo']
  /** true si la descripcion nombra la cuenta destino, no solo el tipo. */
  explicito: boolean
}

/** Deduce a que cuenta tuya va dirigido un movimiento de salida. */
function destinoDe(salida: Txn, cuentas: Account[]): Destino | null {
  const d = salida.descripcion

  // "Transf. via MB a 700445566"
  const mCuenta = RE_HACIA_CUENTA.exec(d)
  if (mCuenta) {
    const num = mCuenta[1]
    const cuenta = cuentas.find(
      (c) => c.id !== salida.accountId && num.endsWith(c.ultimos4),
    )
    if (cuenta) return { cuenta, metodo: 'transferencia', explicito: true }
  }

  // "PagoTC Via MB***9090"
  if (RE_PAGO_TC.test(d)) {
    const m4 = RE_ULTIMOS4.exec(d.trim())
    if (m4) {
      const cuenta = cuentas.find((c) => c.tipo === 'tarjeta' && c.ultimos4 === m4[1])
      if (cuenta) return { cuenta, metodo: 'pago-tarjeta', explicito: true }
    }
    // Sin digitos legibles: si solo hay una tarjeta, es esa.
    const tarjetas = cuentas.filter((c) => c.tipo === 'tarjeta')
    if (tarjetas.length === 1) {
      return { cuenta: tarjetas[0], metodo: 'pago-tarjeta', explicito: false }
    }
  }

  return null
}

/** El lado de la tarjeta: "Pago Via App". Util para explicar la pantalla. */
export function pareceAbonoDeTarjeta(descripcion: string): boolean {
  return RE_PAGO_TARJETA.test(descripcion)
}

/** El lado receptor de una transferencia entre cuentas. */
export function origenDeEntrada(descripcion: string): string | null {
  const m = RE_A_CUENTA.exec(descripcion)
  return m ? m[1] : null
}

export interface ResumenReal {
  entradasReales: number
  gastoReal: number
  trasladosInternos: number
  movimientosInternos: number
}

/**
 * Los totales que importan, ya limpios de traslados.
 * Sin esto el resumen miente.
 */
export function resumirGastoReal(txns: Txn[]): ResumenReal {
  let entradasReales = 0
  let gastoReal = 0
  let trasladosInternos = 0
  let movimientosInternos = 0

  for (const t of txns) {
    if (t.esInterno) {
      movimientosInternos++
      if (t.monto < 0) trasladosInternos += Math.abs(t.monto)
      continue
    }
    if (t.monto > 0) entradasReales += t.monto
    else gastoReal += Math.abs(t.monto)
  }

  return {
    entradasReales: round2(entradasReales),
    gastoReal: round2(gastoReal),
    trasladosInternos: round2(trasladosInternos),
    movimientosInternos,
  }
}
