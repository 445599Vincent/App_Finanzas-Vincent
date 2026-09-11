import { describe, it, expect } from 'vitest'
import { resumirMes, gastoPorCategoria, serieMensual, comerciosDelMes, mesesConDatos, nombreDeMes, mesCorto } from '../reporte'
import { movimientosACSV } from '../exportar'
import type { Account, Txn } from '../../types'

const cuentas: Account[] = [
  { id: 'op', nombre: 'Corriente', banco: 'Popular', tipo: 'corriente', ultimos4: '2233', moneda: 'DOP' },
]

function t(fecha: string, descripcion: string, monto: number, extra: Partial<Txn> = {}): Txn {
  return { id: fecha + descripcion + monto, accountId: 'op', fecha, descripcion, monto, ...extra }
}

const txns: Txn[] = [
  t('2026-08-01', 'Sueldo', 100000, { categoriaId: 'ingreso' }),
  t('2026-08-05', 'SUPERMERCADO NACIONAL', -6000, { categoriaId: 'supermercado' }),
  t('2026-08-09', 'SUPERMERCADO NACIONAL', -4000, { categoriaId: 'supermercado' }),
  t('2026-08-12', 'ESTACION SHELL', -3000, { categoriaId: 'combustible' }),
  t('2026-08-17', 'PagoTC Via MB***9090', -40000, { esInterno: true, categoriaId: 'interno' }),
  t('2026-08-21', 'PAGO IMPUESTO DGII', -100, { categoriaId: 'impuestos' }),
  t('2026-07-10', 'SUPERMERCADO NACIONAL', -5000, { categoriaId: 'supermercado' }),
]

describe('resumen del mes', () => {
  const r = resumirMes(txns, '2026-08')

  it('separa entradas, gasto real y traslados', () => {
    expect(r.entradas).toBe(100000)
    expect(r.gasto).toBe(13100) // 6000 + 4000 + 3000 + 100
    expect(r.internos).toBe(40000)
  })

  it('el traslado interno NO entra ni como gasto ni como entrada', () => {
    expect(r.gasto).not.toContain(40000)
    expect(r.entradas + r.gasto).toBeLessThan(r.internos + r.entradas + r.gasto)
  })

  it('calcula lo que quedó y la tasa de ahorro', () => {
    expect(r.quedo).toBe(86900)
    expect(r.tasaAhorro).toBeCloseTo(0.869, 3)
  })

  it('devuelve tasa nula si no entró nada, en vez de dividir por cero', () => {
    expect(resumirMes([t('2026-09-01', 'Gasto', -100)], '2026-09').tasaAhorro).toBeNull()
  })

  it('un mes sin movimientos da ceros, no falla', () => {
    const vacio = resumirMes(txns, '2026-01')
    expect(vacio.gasto).toBe(0)
    expect(vacio.movimientos).toBe(0)
  })
})

describe('gasto por categoría', () => {
  const cats = gastoPorCategoria(txns, '2026-08')

  it('agrupa y ordena de mayor a menor', () => {
    expect(cats.map((c) => c.categoriaId)).toEqual(['supermercado', 'combustible', 'impuestos'])
    expect(cats[0].total).toBe(10000)
    expect(cats[0].movimientos).toBe(2)
  })

  it('las partes suman 1', () => {
    expect(cats.reduce((a, c) => a + c.parte, 0)).toBeCloseTo(1, 6)
  })

  it('deja fuera los traslados internos y los ingresos', () => {
    expect(cats.some((c) => c.categoriaId === 'interno')).toBe(false)
    expect(cats.some((c) => c.categoriaId === 'ingreso')).toBe(false)
  })
})

describe('serie mensual', () => {
  it('devuelve los meses pedidos, incluidos los vacíos', () => {
    const s = serieMensual(txns, '2026-08', 3)
    expect(s.map((p) => p.mes)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(s.map((p) => p.gasto)).toEqual([0, 5000, 13100])
  })

  it('cruza bien el cambio de año', () => {
    const s = serieMensual([], '2026-02', 4)
    expect(s.map((p) => p.mes)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('comercios del mes', () => {
  it('suma las visitas al mismo comercio', () => {
    const c = comerciosDelMes(txns, '2026-08', 3)
    expect(c[0].nombre).toBe('SUPERMERCADO NACIONAL')
    expect(c[0].total).toBe(10000)
    expect(c[0].movimientos).toBe(2)
  })
})

describe('utilidades de mes', () => {
  it('lista los meses con datos, del más viejo al más nuevo', () => {
    expect(mesesConDatos(txns)).toEqual(['2026-07', '2026-08'])
  })
  it('nombra el mes en español', () => {
    expect(nombreDeMes('2026-08')).toBe('agosto de 2026')
    expect(mesCorto('2026-08')).toBe('AGO')
  })
})

describe('exportar a hoja de cálculo', () => {
  const csv = movimientosACSV(txns, cuentas)
  const lineas = csv.split('\r\n')

  it('lleva BOM para que Excel no rompa los acentos', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(lineas[0]).toContain('Descripción')
  })

  it('usa punto y coma y coma decimal, como espera Excel en español', () => {
    expect(lineas[0].split(';')).toHaveLength(8)
    expect(lineas[1]).toContain('100000,00')
  })

  it('marca qué filas cuentan como gasto, para que sumar la hoja no engañe', () => {
    const interno = lineas.find((l) => l.includes('PagoTC'))
    expect(interno).toContain('Traslado interno')
    expect(interno?.endsWith('No;')).toBe(true)
  })

  it('entrecomilla lo que lleve el separador dentro', () => {
    const conPuntoYComa = movimientosACSV([t('2026-08-01', 'PAGO; RARO', -1)], cuentas)
    expect(conPuntoYComa).toContain('"PAGO; RARO"')
  })

  it('saca una fila por movimiento más el encabezado', () => {
    expect(lineas).toHaveLength(txns.length + 1)
  })
})
