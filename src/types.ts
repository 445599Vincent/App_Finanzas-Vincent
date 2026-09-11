/** Un estado de cuenta corriente y uno de tarjeta se leen con reglas opuestas. */
export type StatementKind = 'cuenta' | 'tarjeta'

export type AccountKind = 'corriente' | 'ahorros' | 'tarjeta'

export interface Account {
  id: string
  /** Nombre que tu le pones: "Corriente principal". */
  nombre: string
  banco: string
  tipo: AccountKind
  /** Ultimos digitos visibles. Nunca guardamos el numero completo. */
  ultimos4: string
  moneda: 'DOP' | 'USD'
  /** Solo para tarjetas. */
  limite?: number
}

/**
 * Signo normalizado en toda la app:
 *   monto > 0  -> mejora tu posicion (entra dinero, o baja la deuda de la tarjeta)
 *   monto < 0  -> empeora tu posicion (sale dinero, o sube la deuda)
 * Esto vale igual para cuentas y para tarjetas, aunque el PDF las escriba al reves.
 */
export interface Txn {
  id: string
  accountId: string
  /** ISO corto: 2026-05-24 */
  fecha: string
  /** Solo la tarjeta trae dos fechas. */
  fechaEntrada?: string
  descripcion: string
  monto: number
  /** Saldo corrido impreso. Solo las cuentas lo traen. */
  balance?: number
  /** Columna "Cheque" en las cuentas: referencia del movimiento. */
  referencia?: string
  categoriaId?: string
  /** true = traslado entre cuentas tuyas, no cuenta como gasto ni ingreso. */
  esInterno?: boolean
  /** Huella para no duplicar al subir rangos solapados. */
  huella?: string
}

/** Los cuatro campos del resumen de tarjeta que SI pertenecen al ciclo. */
export interface CardCycle {
  id: string
  accountId: string
  fechaCorte: string
  balanceCorte: number
  pagoMinimo: number
  fechaVencimiento: string
}

/** Lo que es del dia de impresion, no del ciclo. Se sobrescribe con el PDF mas reciente. */
export interface CardSnapshot {
  accountId: string
  tomadoEl: string
  balanceALaFecha: number
  disponible: number
  limite: number
}

export interface Category {
  id: string
  nombre: string
  grupo: 'Esencial' | 'Estilo de vida' | 'Banco' | 'Ingreso' | 'Interno'
  /** false para traslados internos: existen, pero no suman al gasto. */
  cuentaEnGasto: boolean
}

export interface TransferLink {
  salidaId: string
  entradaId: string
  metodo: 'transferencia' | 'pago-tarjeta'
  confianza: number
  monto: number
}

export type AlertKind = 'corte-pago' | 'recurrente' | 'presupuesto' | 'anomalia'
export type AlertSeverity = 'alta' | 'media' | 'info'

export interface Alert {
  id: string
  tipo: AlertKind
  severidad: AlertSeverity
  titulo: string
  mensaje: string
  /** De donde salio, para que puedas comprobarla. */
  evidencia?: string
}
