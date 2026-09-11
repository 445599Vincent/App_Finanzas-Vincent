import type { Txn } from '../types'

/**
 * Cuadre de la lectura.
 *
 * Las cuentas corrientes del Popular traen saldo corrido en cada linea. Eso es
 * un regalo: permite DEMOSTRAR que la extraccion fue correcta en vez de
 * prometerlo. Si una sola linea no cuadra, sabemos exactamente cual.
 *
 * La tarjeta no trae saldo corrido, asi que ahi el cuadre es contra el
 * "Balance al corte" del resumen.
 */

export interface Descuadre {
  indice: number
  fecha: string
  descripcion: string
  balanceEsperado: number
  balanceImpreso: number
  diferencia: number
}

export interface CuadreCuenta {
  ok: boolean
  /** Lineas que la cadena SI pudo comprobar. */
  revisadas: number
  descuadres: Descuadre[]
  /** Saldo del que se parte, deducido de la primera linea. */
  saldoInicial: number | null
  saldoFinal: number | null
  /**
   * La primera linea no se puede comprobar: no hay saldo anterior contra el
   * cual contrastarla. Si su monto se leyo mal, la cadena entera sigue
   * cuadrando y solo se corre el saldo inicial deducido. Por eso la pantalla
   * de revision siempre marca la primera linea para que la mires tu.
   */
  primeraSinVerificar: boolean
}

const CENTAVO = 0.005

/**
 * Verifica la cadena saldo[i-1] + monto[i] === saldo[i] en toda la lista.
 * Espera los movimientos en el mismo orden en que aparecen impresos.
 */
export function cuadrarCuenta(txns: Txn[]): CuadreCuenta {
  const conBalance = txns.filter((t) => typeof t.balance === 'number')
  if (conBalance.length === 0) {
    return {
      ok: false,
      revisadas: 0,
      descuadres: [],
      saldoInicial: null,
      saldoFinal: null,
      primeraSinVerificar: false,
    }
  }

  const descuadres: Descuadre[] = []
  for (let i = 1; i < conBalance.length; i++) {
    const previo = conBalance[i - 1].balance as number
    const actual = conBalance[i]
    const esperado = round2(previo + actual.monto)
    const impreso = actual.balance as number
    if (Math.abs(esperado - impreso) > CENTAVO) {
      descuadres.push({
        indice: i,
        fecha: actual.fecha,
        descripcion: actual.descripcion,
        balanceEsperado: esperado,
        balanceImpreso: impreso,
        diferencia: round2(impreso - esperado),
      })
    }
  }

  const primera = conBalance[0]
  return {
    ok: descuadres.length === 0,
    // La primera no entra: se usa como punto de partida, no se comprueba.
    revisadas: conBalance.length - 1,
    descuadres,
    saldoInicial: round2((primera.balance as number) - primera.monto),
    saldoFinal: conBalance[conBalance.length - 1].balance as number,
    primeraSinVerificar: true,
  }
}

/**
 * Comprueba que el saldo final leido coincide con el "Balance Actual" que el
 * propio estado imprime en el encabezado.
 */
export function cuadraConEncabezado(cuadre: CuadreCuenta, balanceActual: number): boolean {
  return cuadre.saldoFinal !== null && Math.abs(cuadre.saldoFinal - balanceActual) <= CENTAVO
}

export interface CuadreTarjeta {
  ok: boolean
  /** Suma de los movimientos del ciclo, en convencion de deuda (positivo = debes). */
  deudaCalculada: number
  balanceCorte: number
  diferencia: number
}

/**
 * Para la tarjeta: saldo anterior + consumos - pagos === balance al corte.
 * Los montos llegan ya normalizados (negativo = consumo, positivo = pago).
 */
export function cuadrarTarjeta(
  txnsDelCiclo: Txn[],
  balanceCorteAnterior: number,
  balanceCorte: number,
): CuadreTarjeta {
  const movimiento = txnsDelCiclo.reduce((acc, t) => acc + t.monto, 0)
  // La deuda sube cuando el monto normalizado es negativo, de ahi el menos.
  const deudaCalculada = round2(balanceCorteAnterior - movimiento)
  const diferencia = round2(deudaCalculada - balanceCorte)
  return {
    ok: Math.abs(diferencia) <= CENTAVO,
    deudaCalculada,
    balanceCorte,
    diferencia,
  }
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
