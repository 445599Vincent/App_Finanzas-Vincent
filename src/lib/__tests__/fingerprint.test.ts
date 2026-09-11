import { describe, it, expect } from 'vitest'
import { deduplicar, huellaDe, normalizarDescripcion } from '../fingerprint'
import type { Txn } from '../../types'

/**
 * Los estados no son mensuales: se exporta el rango que uno quiera desde
 * Popularenlinea, asi que dos exportaciones se van a solapar tarde o temprano.
 */

function t(fecha: string, descripcion: string, monto: number, referencia?: string): Txn {
  return { id: `${fecha}-${monto}`, accountId: 'op', fecha, descripcion, monto, referencia }
}

describe('deduplicacion al subir rangos solapados', () => {
  it('reconoce el mismo movimiento leido dos veces', () => {
    const a = t('2026-05-24', 'Transf. via MB a 700445566', -30, '0000700445566')
    const b = t('2026-05-24', 'Transf. via MB a 700445566', -30, '0000700445566')
    expect(huellaDe(a)).toBe(huellaDe(b))
  })

  it('distingue dos cargos iguales del mismo dia con referencia distinta', () => {
    const a = t('2026-05-30', 'PagoTC Via MB***9090', -20000, '0000000003208')
    const b = t('2026-05-30', 'PagoTC Via MB***9090', -20000, '0000000009999')
    expect(huellaDe(a)).not.toBe(huellaDe(b))
  })

  it('separa lo nuevo de lo ya guardado', () => {
    const yaGuardado = [t('2026-05-24', 'Transf. via MB a 700445566', -30)]
    const nuevoLote = [
      t('2026-05-24', 'Transf. via MB a 700445566', -30), // repetido
      t('2026-05-29', 'Transf App Neg de 852234384', 50000), // nuevo
    ]
    const r = deduplicar(nuevoLote, yaGuardado.map(huellaDe))
    expect(r.nuevos).toHaveLength(1)
    expect(r.repetidos).toHaveLength(1)
    expect(r.nuevos[0].monto).toBe(50000)
  })

  it('tambien limpia duplicados dentro del mismo lote', () => {
    const lote = [
      t('2026-05-24', 'Transf. via MB a 700445566', -30),
      t('2026-05-24', 'Transf. via MB a 700445566', -30),
    ]
    expect(deduplicar(lote).nuevos).toHaveLength(1)
  })

  it('ignora acentos, mayusculas y espacios de mas al comparar', () => {
    expect(normalizarDescripcion('  PAGO  IMPÚESTO 0.15  ')).toBe('pago impuesto 0.15')
  })
})
