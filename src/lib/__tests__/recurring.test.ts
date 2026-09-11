import { describe, it, expect } from 'vitest'
import { detectarRecurrentes, costoMensual } from '../recurring'
import type { Txn } from '../../types'

function t(id: string, fecha: string, descripcion: string, monto: number): Txn {
  return { id, accountId: 'tc', fecha, descripcion, monto }
}

describe('cargos que se repiten solos', () => {
  it('detecta un cargo mensual', () => {
    const txns = [
      t('1', '2026-06-13', 'SPOTIFY', -549.15),
      t('2', '2026-07-13', 'SPOTIFY', -549.15),
      t('3', '2026-08-13', 'SPOTIFY', -549.15),
    ]
    const rs = detectarRecurrentes(txns)
    expect(rs).toHaveLength(1)
    expect(rs[0].veces).toBe(3)
    expect(rs[0].cadaDias).toBeGreaterThanOrEqual(28)
  })

  it('detecta tambien un ritmo quincenal, que un filtro mensual se perderia', () => {
    // En los estados reales el cargo mas regular caia cada 10-14 dias.
    const txns = [
      t('1', '2026-06-13', 'BARBERIA CENTRAL', -1000),
      t('2', '2026-06-25', 'BARBERIA CENTRAL', -1000),
      t('3', '2026-07-03', 'BARBERIA CENTRAL', -1000),
      t('4', '2026-07-17', 'BARBERIA CENTRAL', -1000),
    ]
    const rs = detectarRecurrentes(txns)
    expect(rs).toHaveLength(1)
    expect(rs[0].cadaDias).toBeLessThan(20)
    expect(rs[0].veces).toBe(4)
  })

  it('no llama recurrente a algo que solo aparecio dos veces', () => {
    const txns = [t('1', '2026-06-13', 'KFC', -1414), t('2', '2026-07-13', 'KFC', -1414)]
    expect(detectarRecurrentes(txns)).toHaveLength(0)
  })

  it('no llama recurrente a un comercio con montos muy distintos', () => {
    const txns = [
      t('1', '2026-06-13', 'ESTACION SHELL', -580),
      t('2', '2026-07-13', 'ESTACION SHELL', -3406),
      t('3', '2026-08-13', 'ESTACION SHELL', -600),
    ]
    expect(detectarRecurrentes(txns)).toHaveLength(0)
  })

  it('no confunde varias compras del mismo dia con una suscripcion', () => {
    const txns = [
      t('1', '2026-06-13', 'CAFE X', -200),
      t('2', '2026-06-13', 'CAFE X', -200),
      t('3', '2026-06-13', 'CAFE X', -200),
    ]
    expect(detectarRecurrentes(txns)).toHaveLength(0)
  })

  it('mide el aumento de precio', () => {
    const txns = [
      t('1', '2026-06-13', 'STREAMING', -500),
      t('2', '2026-07-13', 'STREAMING', -520),
      t('3', '2026-08-13', 'STREAMING', -560),
    ]
    const r = detectarRecurrentes(txns)[0]
    expect(r.variacion).toBeCloseTo(0.12, 2)
  })

  it('suma lo que cuestan al mes, normalizando el ritmo', () => {
    const quincenal = [
      t('1', '2026-06-01', 'BARBERIA CENTRAL', -1000),
      t('2', '2026-06-15', 'BARBERIA CENTRAL', -1000),
      t('3', '2026-06-29', 'BARBERIA CENTRAL', -1000),
    ]
    // Cada 14 dias a RD$1,000 son unos RD$2,143 al mes, no RD$1,000.
    expect(costoMensual(detectarRecurrentes(quincenal))).toBeGreaterThan(2000)
  })

  it('ignora los traslados internos', () => {
    const txns: Txn[] = [
      { ...t('1', '2026-06-01', 'PagoTC Via MB***9090', -10000), esInterno: true },
      { ...t('2', '2026-07-01', 'PagoTC Via MB***9090', -10000), esInterno: true },
      { ...t('3', '2026-08-01', 'PagoTC Via MB***9090', -10000), esInterno: true },
    ]
    expect(detectarRecurrentes(txns)).toHaveLength(0)
  })
})
