import { z } from 'zod'

/**
 * Lo que Claude devuelve al leer un estado de cuenta.
 *
 * Regla de oro de este esquema: **todo viene como cadena, tal cual esta
 * impreso**. Ni el signo ni la fecha se normalizan del lado del modelo.
 *
 * Esto es a proposito. Las reglas del Popular (el menos al final en las
 * cuentas y al inicio en las tarjetas, los tres formatos de fecha) viven en
 * src/lib/signs.ts y src/lib/dates.ts, que estan cubiertas por pruebas. Si el
 * modelo tambien decidiera signos, tendriamos dos fuentes de verdad y ninguna
 * verificable. Asi el modelo hace lo que sabe hacer, que es ver, y el codigo
 * hace lo que sabe hacer, que es decidir; y el cuadre del saldo corrido
 * delata al modelo si transcribio mal.
 */

const Texto = z.string().nullable()

export const MovimientoCrudo = z.object({
  fecha: z.string().describe('La fecha tal cual aparece impresa, sin reformatear'),
  fechaEntrada: Texto.describe('Segunda fecha, solo en tarjetas. null si no hay'),
  descripcion: z.string().describe('El concepto completo, en una sola linea'),
  monto: z
    .string()
    .describe('El monto tal cual aparece, CON el signo en la misma posicion que en el PDF'),
  balance: Texto.describe('El saldo corrido de esa linea. null si la tabla no lo trae'),
  referencia: Texto.describe('Columna Cheque o numero de referencia. null si no hay'),
})

export const ResumenCrudo = z.object({
  balanceActual: Texto,
  balanceDisponible: Texto,
  balanceAlUltimoCorte: Texto,
  limiteAprobado: Texto,
  fechaCorte: Texto,
  balanceCorte: Texto,
  pagoMinimo: Texto,
  fechaVencimiento: Texto,
  disponible: Texto,
})

export const EstadoCrudo = z.object({
  clase: z
    .enum(['cuenta', 'tarjeta'])
    .describe('cuenta = corriente o ahorros; tarjeta = tarjeta de credito'),
  banco: z.string(),
  tipoCuenta: z.string().describe('Como lo llama el estado: Cuenta Corriente, Tarjeta de Credito...'),
  ultimos4: z
    .string()
    .describe('SOLO los ultimos cuatro digitos de la cuenta. Nunca el numero completo'),
  resumen: ResumenCrudo,
  movimientos: z.array(MovimientoCrudo),
  /** Lo que el modelo no pudo leer con seguridad. Se le muestra a la persona. */
  advertencias: z.array(z.string()),
})

export type EstadoCrudo = z.infer<typeof EstadoCrudo>
export type MovimientoCrudo = z.infer<typeof MovimientoCrudo>
export type ResumenCrudo = z.infer<typeof ResumenCrudo>
