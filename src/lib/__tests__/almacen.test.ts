import { describe, it, expect } from 'vitest'
import { fusionarLectura, aplicarCategoria, DATOS_VACIOS, type Datos, type LecturaGuardable } from '../almacen'
import { reglaDesde, sugerirCategoria } from '../categories'
import type { Account, Txn } from '../../types'

const cuenta: Account = {
  id: 'op', nombre: 'Corriente operativa', banco: 'Popular',
  tipo: 'corriente', ultimos4: '2233', moneda: 'DOP',
}

function t(id: string, descripcion: string, monto: number, huella = id): Txn {
  return { id, accountId: 'op', fecha: '2026-08-01', descripcion, monto, huella }
}

function lectura(txns: Txn[], saldoFinal: number | null = 1000): LecturaGuardable {
  return {
    cuenta, txns, ciclo: null, snapshot: null, saldoFinal,
    estado: {
      id: 'e1', nombreArchivo: 'estado.pdf', cuentaId: 'op', cuenta: 'Corriente ••••2233',
      clase: 'cuenta', subidoEn: '2026-08-23', movimientos: txns.length, cuadre: 'ok',
    },
  }
}

describe('guardar una lectura', () => {
  it('agrega la cuenta, los movimientos y el saldo', () => {
    const d = fusionarLectura(DATOS_VACIOS, lectura([t('1', 'SUPERMERCADO', -5000)], 42000))
    expect(d.cuentas).toHaveLength(1)
    expect(d.txns).toHaveLength(1)
    expect(d.saldos.op).toBe(42000)
    expect(d.estados).toHaveLength(1)
  })

  it('no duplica la cuenta al subir un segundo estado', () => {
    let d = fusionarLectura(DATOS_VACIOS, lectura([t('1', 'A', -1)]))
    d = fusionarLectura(d, lectura([t('2', 'B', -2)]))
    expect(d.cuentas).toHaveLength(1)
  })

  it('no duplica movimientos cuando los rangos se solapan', () => {
    let d = fusionarLectura(DATOS_VACIOS, lectura([t('1', 'A', -1, 'h1'), t('2', 'B', -2, 'h2')]))
    // Segundo export con un movimiento repetido y uno nuevo.
    d = fusionarLectura(d, lectura([t('3', 'B', -2, 'h2'), t('4', 'C', -3, 'h3')]))
    expect(d.txns).toHaveLength(3)
    expect(d.txns.map((x) => x.huella).sort()).toEqual(['h1', 'h2', 'h3'])
  })

  it('el saldo lo manda el estado mas reciente que se guarde', () => {
    let d = fusionarLectura(DATOS_VACIOS, lectura([t('1', 'A', -1)], 100))
    d = fusionarLectura(d, lectura([t('2', 'B', -2)], 250))
    expect(d.saldos.op).toBe(250)
  })

  it('no borra el saldo si el estado no trae encabezado', () => {
    let d = fusionarLectura(DATOS_VACIOS, lectura([t('1', 'A', -1)], 100))
    d = fusionarLectura(d, lectura([t('2', 'B', -2)], null))
    expect(d.saldos.op).toBe(100)
  })

  it('deja los movimientos ordenados del mas reciente al mas viejo', () => {
    const d = fusionarLectura(DATOS_VACIOS, {
      ...lectura([]),
      txns: [
        { ...t('1', 'vieja', -1), fecha: '2026-05-01' },
        { ...t('2', 'nueva', -2), fecha: '2026-08-01' },
      ],
    })
    expect(d.txns.map((x) => x.fecha)).toEqual(['2026-08-01', '2026-05-01'])
  })
})

describe('corregir una categoría', () => {
  const base: Datos = fusionarLectura(
    DATOS_VACIOS,
    lectura([
      t('1', 'TALLER LUBRICENTRO', -5000, 'h1'),
      t('2', 'TALLER LUBRICENTRO', -3000, 'h2'),
      t('3', 'OTRA COSA', -100, 'h3'),
    ]),
  )

  it('cambia solo ese movimiento si no creas regla', () => {
    const d = aplicarCategoria(base, '1', 'vehiculo', null)
    expect(d.txns.find((x) => x.id === '1')?.categoriaId).toBe('vehiculo')
    expect(d.txns.find((x) => x.id === '2')?.categoriaId).toBeUndefined()
    expect(d.reglas).toHaveLength(0)
  })

  it('con regla, arregla también el pasado del mismo comercio', () => {
    // Corregir una vez tiene que arreglar lo de antes, no solo lo que venga.
    const d = aplicarCategoria(base, '1', 'vehiculo', reglaDesde('TALLER LUBRICENTRO', 'vehiculo'))
    expect(d.txns.find((x) => x.id === '1')?.categoriaId).toBe('vehiculo')
    expect(d.txns.find((x) => x.id === '2')?.categoriaId).toBe('vehiculo')
    expect(d.txns.find((x) => x.id === '3')?.categoriaId).toBeUndefined()
  })

  it('no toca los traslados internos', () => {
    const conInterno: Datos = {
      ...base,
      txns: base.txns.map((x) => (x.id === '2' ? { ...x, esInterno: true } : x)),
    }
    const d = aplicarCategoria(conInterno, '1', 'vehiculo', reglaDesde('TALLER LUBRICENTRO', 'vehiculo'))
    expect(d.txns.find((x) => x.id === '2')?.categoriaId).toBeUndefined()
  })

  it('reemplaza la regla vieja del mismo comercio en vez de acumular', () => {
    let d = aplicarCategoria(base, '1', 'vehiculo', reglaDesde('TALLER LUBRICENTRO', 'vehiculo'))
    d = aplicarCategoria(d, '1', 'compras', reglaDesde('TALLER LUBRICENTRO', 'compras'))
    expect(d.reglas).toHaveLength(1)
    expect(d.reglas[0].categoriaId).toBe('compras')
  })

  it('la regla aprendida gana sobre la regla de fábrica', () => {
    // De fabrica, "TALLER LUBRICENTRO" cae en Vehículo.
    expect(sugerirCategoria('TALLER LUBRICENTRO', -5000).categoriaId).toBe('vehiculo')
    // Si tu dices que es otra cosa, la app deja de discutir.
    const mia = reglaDesde('TALLER LUBRICENTRO', 'compras')
    expect(sugerirCategoria('TALLER LUBRICENTRO', -5000, false, [mia]).categoriaId).toBe('compras')
  })

  it('la regla aprendida ignora mayúsculas y espacios de más', () => {
    const mia = reglaDesde('TALLER LUBRICENTRO', 'compras')
    expect(sugerirCategoria('  taller   lubricentro ', -5000, false, [mia]).categoriaId).toBe('compras')
  })
})
