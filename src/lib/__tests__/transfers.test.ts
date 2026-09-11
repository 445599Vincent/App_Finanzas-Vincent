import { describe, it, expect } from 'vitest'
import { emparejarTraslados, resumirGastoReal } from '../transfers'
import type { Account, Txn } from '../../types'

/**
 * El hallazgo que hace o rompe la app: casi todo el dinero que sale de la
 * cuenta operativa no se gasta, se traslada. Si no se detecta, el gasto se
 * infla por un factor de diez y cualquier presupuesto es ruido.
 */

const cuentas: Account[] = [
  { id: 'op', nombre: 'Corriente operativa', banco: 'Popular', tipo: 'corriente', ultimos4: '6220', moneda: 'DOP' },
  { id: 'pr', nombre: 'Corriente principal', banco: 'Popular', tipo: 'corriente', ultimos4: '3461', moneda: 'DOP' },
  { id: 'tc', nombre: 'Tarjeta', banco: 'Popular', tipo: 'tarjeta', ultimos4: '3208', moneda: 'DOP', limite: 138000 },
]

function t(id: string, accountId: string, fecha: string, descripcion: string, monto: number): Txn {
  return { id, accountId, fecha, descripcion, monto }
}

describe('traslados entre cuentas propias', () => {
  it('empareja los dos lados de una transferencia entre cuentas', () => {
    const txns = [
      t('s1', 'op', '2026-05-24', 'Transf. via MB a 839453461', -30),
      t('e1', 'pr', '2026-05-24', 'Transf. via MB desde 814726220', 30),
    ]
    const { enlaces, internos } = emparejarTraslados(txns, cuentas)
    expect(enlaces).toHaveLength(1)
    expect(enlaces[0].metodo).toBe('transferencia')
    expect(enlaces[0].monto).toBe(30)
    expect(enlaces[0].confianza).toBe(1)
    expect(internos.has('s1')).toBe(true)
    expect(internos.has('e1')).toBe(true)
  })

  it('empareja un pago de tarjeta con su abono, aunque se llamen distinto', () => {
    // La cuenta lo llama "PagoTC Via MB***3208"; la tarjeta lo llama "Pago Via App".
    const txns = [
      t('s1', 'op', '2026-07-30', 'PagoTC Via MB***3208', -38419.92),
      t('e1', 'tc', '2026-07-30', 'Pago Via App', 38419.92),
    ]
    const { enlaces } = emparejarTraslados(txns, cuentas)
    expect(enlaces).toHaveLength(1)
    expect(enlaces[0].metodo).toBe('pago-tarjeta')
    expect(enlaces[0].monto).toBe(38419.92)
  })

  it('tolera que la tarjeta acredite el pago un par de dias despues', () => {
    const txns = [
      t('s1', 'op', '2026-08-07', 'PagoTC Via MB***3208', -40000),
      t('e1', 'tc', '2026-08-09', 'Pago Via App', 40000),
    ]
    expect(emparejarTraslados(txns, cuentas).enlaces).toHaveLength(1)
  })

  it('NO empareja si las fechas estan demasiado lejos', () => {
    const txns = [
      t('s1', 'op', '2026-08-07', 'PagoTC Via MB***3208', -40000),
      t('e1', 'tc', '2026-08-25', 'Pago Via App', 40000),
    ]
    expect(emparejarTraslados(txns, cuentas).enlaces).toHaveLength(0)
  })

  it('NO empareja un pago real a un tercero por el mismo monto', () => {
    const txns = [
      t('s1', 'op', '2026-06-01', 'MB a 0790206593 Ana Prez', -15000),
      t('e1', 'pr', '2026-06-01', 'JIMENEZ PEREZ M', 15000),
    ]
    // La descripcion de salida no nombra ninguna cuenta tuya.
    expect(emparejarTraslados(txns, cuentas).enlaces).toHaveLength(0)
  })

  it('no usa dos veces la misma entrada cuando hay montos repetidos', () => {
    const txns = [
      t('s1', 'op', '2026-06-27', 'Transf. via MB a 839453461', -11000),
      t('s2', 'op', '2026-06-30', 'Transf. via MB a 839453461', -11000),
      t('e1', 'pr', '2026-06-27', 'Transf. via MB desde 814726220', 11000),
      t('e2', 'pr', '2026-06-30', 'Transf. via MB desde 814726220', 11000),
    ]
    const { enlaces } = emparejarTraslados(txns, cuentas)
    expect(enlaces).toHaveLength(2)
    expect(new Set(enlaces.map((e) => e.entradaId)).size).toBe(2)
  })

  it('empareja una tanda completa como la de un estado real', () => {
    const montos = [30, 22000, 15000, 100, 11000, 11000, 11000, 15000, 11000]
    const fechas = [
      '2026-05-24', '2026-05-30', '2026-06-27', '2026-06-27', '2026-06-27',
      '2026-06-30', '2026-07-26', '2026-08-07', '2026-08-17',
    ]
    const txns: Txn[] = []
    montos.forEach((m, i) => {
      txns.push(t(`s${i}`, 'op', fechas[i], 'Transf. via MB a 839453461', -m))
      txns.push(t(`e${i}`, 'pr', fechas[i], 'Transf. via MB desde 814726220', m))
    })
    const { enlaces } = emparejarTraslados(txns, cuentas)
    expect(enlaces).toHaveLength(9)
    expect(enlaces.reduce((a, e) => a + e.monto, 0)).toBe(96130)
  })
})

describe('totales limpios de traslados', () => {
  it('saca el traslado del gasto y lo reporta aparte', () => {
    const txns: Txn[] = [
      { ...t('a', 'op', '2026-08-01', 'Sueldo', 100000) },
      { ...t('b', 'op', '2026-08-05', 'Supermercado', -5000) },
      { ...t('c', 'op', '2026-08-07', 'PagoTC Via MB***3208', -40000), esInterno: true },
      { ...t('d', 'tc', '2026-08-07', 'Pago Via App', 40000), esInterno: true },
    ]
    const r = resumirGastoReal(txns)
    expect(r.entradasReales).toBe(100000)
    expect(r.gastoReal).toBe(5000)
    expect(r.trasladosInternos).toBe(40000)
    expect(r.movimientosInternos).toBe(2)
  })

  it('sin la limpieza, el gasto se inflaria nueve veces', () => {
    const txns: Txn[] = [
      { ...t('b', 'op', '2026-08-05', 'Supermercado', -5000) },
      { ...t('c', 'op', '2026-08-07', 'PagoTC Via MB***3208', -40000), esInterno: true },
    ]
    const limpio = resumirGastoReal(txns)
    const sucio = txns.reduce((a, x) => (x.monto < 0 ? a + Math.abs(x.monto) : a), 0)
    expect(limpio.gastoReal).toBe(5000)
    expect(sucio).toBe(45000)
  })
})
