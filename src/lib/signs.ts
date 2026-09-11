import type { StatementKind } from '../types'

/**
 * El Banco Popular exporta con DOS convenciones de signo opuestas.
 *
 *   Cuenta corriente   RD$ 30.00-        menos AL FINAL  -> salio dinero
 *                      RD$ 50,000.00     sin menos       -> entro dinero
 *
 *   Tarjeta            RD$ 1,414.99      sin menos       -> consumo (sube tu deuda)
 *                      RD$ -15,000.00    menos AL INICIO -> pago o devolucion
 *
 * Un lector que no distinga invierte TODA la tarjeta: te diria que gastaste
 * quince mil cuando en realidad abonaste quince mil.
 *
 * Aqui se normaliza todo a un solo criterio:
 *   positivo = mejora tu posicion    negativo = la empeora
 */

const LIMPIAR = /[^0-9.,-]/g

/** Quita "RD$", espacios y separadores de miles. Devuelve el numero sin signo. */
function magnitud(raw: string): number {
  const limpio = raw.replace(LIMPIAR, '').replace(/-/g, '')
  // Number('') da 0, que aqui seria un monto inventado. Sin digitos no hay monto.
  if (!/\d/.test(limpio)) return NaN
  // El Popular usa coma para miles y punto para decimales.
  const n = Number(limpio.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

export interface MontoLeido {
  monto: number
  /** Como venia escrito el signo, util para auditar la lectura. */
  signoEscrito: 'ninguno' | 'adelante' | 'atras'
}

/**
 * Lee un monto aplicando la convencion del tipo de estado.
 * Lanza si el texto no contiene un numero.
 */
export function leerMonto(raw: string, kind: StatementKind): MontoLeido {
  const s = raw.trim()
  const n = magnitud(s)
  if (Number.isNaN(n)) {
    throw new Error(`Monto ilegible: ${JSON.stringify(raw)}`)
  }

  const soloNumero = s.replace(/[^0-9.,-]/g, '')
  const atras = soloNumero.endsWith('-')
  const adelante = soloNumero.startsWith('-')
  const signoEscrito: MontoLeido['signoEscrito'] = atras
    ? 'atras'
    : adelante
      ? 'adelante'
      : 'ninguno'

  if (kind === 'cuenta') {
    // Menos al final = debito. Cualquier otra cosa = credito.
    return { monto: atras || adelante ? -n : n, signoEscrito }
  }

  // Tarjeta: menos al inicio = abono a tu favor, baja la deuda -> positivo.
  // Sin menos = consumo, sube la deuda -> negativo.
  return { monto: adelante || atras ? n : -n, signoEscrito }
}

/** Version corta cuando no te importa como venia escrito. */
export function montoDe(raw: string, kind: StatementKind): number {
  return leerMonto(raw, kind).monto
}
