import { describe, it, expect } from 'vitest'
import { cuadrarCuenta, cuadraConEncabezado, cuadrarTarjeta } from '../reconcile'
import type { Txn } from '../../types'

/**
 * Las cuentas del Popular traen saldo corrido en cada linea. Eso deja
 * DEMOSTRAR que la lectura fue correcta, en vez de prometerlo.
 */

function t(p: Partial<Txn> & { monto: number; balance?: number }): Txn {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    accountId: p.accountId ?? 'c1',
    fecha: p.fecha ?? '2026-05-24',
    descripcion: p.descripcion ?? 'movimiento',
    monto: p.monto,
    balance: p.balance,
  }
}

describe('cuadre de una cuenta corriente', () => {
  const cadenaBuena: Txn[] = [
    t({ fecha: '2026-05-24', descripcion: 'Transf. via MB a 839453461', monto: -30, balance: 10430.44 }),
    t({ fecha: '2026-05-29', descripcion: 'Transf App Neg', monto: 50000, balance: 60430.44 }),
    t({ fecha: '2026-05-30', descripcion: 'PagoTC Via MB***3208', monto: -12932.26, balance: 47498.18 }),
    t({ fecha: '2026-05-30', descripcion: 'PagoTC Via MB***3208', monto: -20000, balance: 27498.18 }),
    t({ fecha: '2026-05-30', descripcion: 'Transf. via MB a 839453461', monto: -22000, balance: 5498.18 }),
  ]

  it('acepta una cadena de saldos que cuadra al centavo', () => {
    const r = cuadrarCuenta(cadenaBuena)
    expect(r.ok).toBe(true)
    expect(r.descuadres).toEqual([])
    expect(r.revisadas).toBe(4) // la primera se usa de punto de partida
  })

  it('deduce el saldo del que se parte', () => {
    // 10,430.44 es el saldo DESPUES del primer movimiento de -30.
    expect(cuadrarCuenta(cadenaBuena).saldoInicial).toBe(10460.44)
  })

  it('senala exactamente cual linea no cuadra', () => {
    const mala = [...cadenaBuena]
    mala[2] = t({ fecha: '2026-05-30', descripcion: 'PagoTC Via MB***3208', monto: -12932.26, balance: 47498.99 })
    const r = cuadrarCuenta(mala)
    expect(r.ok).toBe(false)
    expect(r.descuadres).toHaveLength(2) // la mala, y la siguiente que arrastra
    expect(r.descuadres[0].indice).toBe(2)
    expect(r.descuadres[0].descripcion).toContain('PagoTC')
    expect(r.descuadres[0].balanceEsperado).toBe(47498.18)
  })

  it('detecta un signo invertido, que es el error mas probable', () => {
    const invertida = [...cadenaBuena]
    // Un debito leido como credito: 50,000 en vez de -50,000.
    invertida[1] = t({ fecha: '2026-05-29', monto: -50000, balance: 60430.44 })
    const r = cuadrarCuenta(invertida)
    expect(r.ok).toBe(false)
    expect(r.descuadres[0].indice).toBe(1)
  })

  it('avisa que la primera linea no se puede comprobar', () => {
    // Sin saldo anterior no hay contra que contrastarla: si su monto se leyo
    // mal, la cadena sigue cuadrando y solo se corre el saldo inicial deducido.
    const conPrimeraMala = [...cadenaBuena]
    conPrimeraMala[0] = t({ fecha: '2026-05-24', monto: 30, balance: 10430.44 })
    const r = cuadrarCuenta(conPrimeraMala)
    expect(r.ok).toBe(true)
    expect(r.primeraSinVerificar).toBe(true)
    expect(r.saldoInicial).toBe(10400.44) // corrido, justamente por eso se marca
  })

  it('compara el saldo final contra el Balance Actual del encabezado', () => {
    const r = cuadrarCuenta(cadenaBuena)
    expect(cuadraConEncabezado(r, 5498.18)).toBe(true)
    expect(cuadraConEncabezado(r, 5498.19)).toBe(false)
  })

  it('avisa cuando no hay columna de saldo, en vez de fingir que cuadro', () => {
    const r = cuadrarCuenta([t({ monto: -100 })])
    expect(r.ok).toBe(false)
    expect(r.revisadas).toBe(0)
  })
})

describe('cuadre de una tarjeta, que no trae saldo corrido', () => {
  it('cuadra saldo anterior + consumos - pagos contra el balance al corte', () => {
    const ciclo: Txn[] = [
      t({ monto: -1414.99 }), // consumo
      t({ monto: -2000 }), // consumo
      t({ monto: 15000 }), // pago a favor
    ]
    // Debia 38,419.92; consumio 3,414.99 y abono 15,000.
    const r = cuadrarTarjeta(ciclo, 38419.92, 26834.91)
    expect(r.ok).toBe(true)
    expect(r.deudaCalculada).toBe(26834.91)
  })

  it('reporta la diferencia cuando falta un movimiento', () => {
    const r = cuadrarTarjeta([t({ monto: -1414.99 })], 38419.92, 26834.91)
    expect(r.ok).toBe(false)
    expect(Math.abs(r.diferencia)).toBeGreaterThan(0)
  })
})
