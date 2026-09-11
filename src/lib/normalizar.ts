import type { CardCycle, CardSnapshot, StatementKind, Txn } from '../types'
import type { EstadoCrudo } from './esquemaEstado'
import { detectarEstilo, parseFecha, resolverConRango, type DateStyle } from './dates'
import { leerMonto } from './signs'
import { huellaDe } from './fingerprint'
import { cuadrarCuenta, cuadraConEncabezado, type CuadreCuenta } from './reconcile'

/**
 * Convierte lo que transcribio Claude en movimientos con signo y fecha ya
 * resueltos.
 *
 * Aqui es donde se aplican las reglas del Popular, que viven en modulos con
 * pruebas. El modelo nunca decide un signo ni interpreta una fecha: solo copia.
 * Si copio mal, el cuadre del saldo corrido lo delata al final de esta funcion.
 */

export interface EstadoNormalizado {
  clase: StatementKind
  banco: string
  tipoCuenta: string
  ultimos4: string
  estiloFecha: DateStyle
  rango: { desde: string; hasta: string } | null
  movimientos: Txn[]
  ciclo: CardCycle | null
  snapshot: CardSnapshot | null
  cuadre: CuadreCuenta | null
  /** true si el saldo final leido coincide con el Balance Actual del encabezado. */
  cuadraConEncabezado: boolean | null
  advertencias: string[]
}

export interface OpcionesNormalizar {
  accountId: string
  /** Fecha de hoy en ISO, para el snapshot de la tarjeta. */
  hoy?: string
}

export function normalizarEstado(
  crudo: EstadoCrudo,
  opts: OpcionesNormalizar,
): EstadoNormalizado {
  const advertencias = [...crudo.advertencias]
  const clase: StatementKind = crudo.clase

  // 1. Decidir el estilo de fecha mirando TODAS las fechas del documento.
  //    Basta con que una sola tenga el dia por encima de 12 para salir de dudas.
  const muestras = crudo.movimientos.flatMap((m) =>
    m.fechaEntrada ? [m.fecha, m.fechaEntrada] : [m.fecha],
  )
  const estiloFecha = detectarEstilo(muestras)

  // 2. Primera pasada: fechas, para conocer el rango que cubre el estado.
  const fechas: Array<string | null> = crudo.movimientos.map(
    (m) => parseFecha(m.fecha, estiloFecha)?.iso ?? null,
  )
  const validas = fechas.filter((f): f is string => f !== null).sort()
  const rango = validas.length ? { desde: validas[0], hasta: validas[validas.length - 1] } : null

  // 3. Segunda pasada: resolver ambiguas con el rango y leer los montos.
  const movimientos: Txn[] = []

  crudo.movimientos.forEach((m, i) => {
    let fecha = fechas[i]
    const leida = parseFecha(m.fecha, estiloFecha)

    if (leida?.ambigua && rango) {
      // Si una de las dos lecturas cae fuera del estado, la otra es la buena.
      fecha = resolverConRango(m.fecha, rango.desde, rango.hasta)?.iso ?? fecha
    }

    if (!fecha) {
      advertencias.push(`No se pudo leer la fecha "${m.fecha}" de "${m.descripcion}". Se omitió.`)
      return
    }

    let monto: number
    try {
      monto = leerMonto(m.monto, clase).monto
    } catch {
      advertencias.push(`Monto ilegible "${m.monto}" en "${m.descripcion}". Se omitió.`)
      return
    }

    // El balance vive en la misma columna que los montos de cuenta, con la
    // misma convencion de signo, aunque casi siempre venga positivo.
    let balance: number | undefined
    if (m.balance) {
      try {
        balance = leerMonto(m.balance, 'cuenta').monto
      } catch {
        advertencias.push(`Saldo ilegible "${m.balance}" en "${m.descripcion}".`)
      }
    }

    const base = {
      accountId: opts.accountId,
      fecha,
      descripcion: limpiar(m.descripcion),
      monto,
      referencia: m.referencia?.trim() || undefined,
    }

    movimientos.push({
      id: `${opts.accountId}-${i}-${fecha}`,
      ...base,
      fechaEntrada: m.fechaEntrada
        ? (parseFecha(m.fechaEntrada, estiloFecha)?.iso ?? undefined)
        : undefined,
      balance,
      huella: huellaDe(base),
    })
  })

  // 4. El cuadre. Solo las cuentas traen saldo corrido.
  let cuadre: CuadreCuenta | null = null
  let conEncabezado: boolean | null = null

  if (clase === 'cuenta') {
    cuadre = cuadrarCuenta(movimientos)
    const balanceActual = numeroDe(crudo.resumen.balanceActual)
    if (balanceActual !== null) {
      conEncabezado = cuadraConEncabezado(cuadre, balanceActual)
      if (!conEncabezado) {
        advertencias.push(
          'El último saldo leído no coincide con el Balance Actual del encabezado. Revisa los movimientos marcados.',
        )
      }
    }
    if (!cuadre.ok && cuadre.descuadres.length > 0) {
      advertencias.push(
        `${cuadre.descuadres.length} ${cuadre.descuadres.length === 1 ? 'línea no cuadra' : 'líneas no cuadran'} con el saldo corrido.`,
      )
    }
  }

  // 5. Tarjeta: separar lo del ciclo de lo del dia de impresion.
  //    Mezclarlos deja mal los cortes viejos para siempre.
  let ciclo: CardCycle | null = null
  let snapshot: CardSnapshot | null = null

  if (clase === 'tarjeta') {
    const fechaCorte = fechaDe(crudo.resumen.fechaCorte, estiloFecha)
    const balanceCorte = numeroDe(crudo.resumen.balanceCorte)
    const fechaVenc = fechaDe(crudo.resumen.fechaVencimiento, estiloFecha)

    if (fechaCorte && balanceCorte !== null && fechaVenc) {
      ciclo = {
        id: `${opts.accountId}-${fechaCorte}`,
        accountId: opts.accountId,
        fechaCorte,
        balanceCorte,
        pagoMinimo: numeroDe(crudo.resumen.pagoMinimo) ?? 0,
        fechaVencimiento: fechaVenc,
      }
    } else {
      advertencias.push('No se pudo leer el ciclo de corte completo de esta tarjeta.')
    }

    const aLaFecha = numeroDe(crudo.resumen.balanceActual)
    if (aLaFecha !== null) {
      snapshot = {
        accountId: opts.accountId,
        tomadoEl: opts.hoy ?? new Date().toISOString().slice(0, 10),
        balanceALaFecha: aLaFecha,
        disponible: numeroDe(crudo.resumen.disponible) ?? 0,
        limite: numeroDe(crudo.resumen.limiteAprobado) ?? 0,
      }
    }
  }

  return {
    clase,
    banco: crudo.banco,
    tipoCuenta: crudo.tipoCuenta,
    ultimos4: crudo.ultimos4.slice(-4),
    estiloFecha,
    rango,
    movimientos,
    ciclo,
    snapshot,
    cuadre,
    cuadraConEncabezado: conEncabezado,
    advertencias,
  }
}

/** Une las lineas de un concepto partido y colapsa espacios. */
function limpiar(d: string): string {
  return d.replace(/\s+/g, ' ').trim()
}

function numeroDe(raw: string | null): number | null {
  if (!raw) return null
  try {
    // Los campos del resumen se imprimen sin trucos de signo.
    return leerMonto(raw, 'cuenta').monto
  } catch {
    return null
  }
}

function fechaDe(raw: string | null, estilo: DateStyle): string | null {
  if (!raw) return null
  return parseFecha(raw, estilo)?.iso ?? null
}
