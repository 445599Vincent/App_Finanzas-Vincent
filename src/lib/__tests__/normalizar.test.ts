import { describe, it, expect } from 'vitest'
import { normalizarEstado } from '../normalizar'
import type { EstadoCrudo } from '../esquemaEstado'

/**
 * La union entre lo que transcribe el modelo y las reglas probadas.
 * Los fixtures imitan la forma exacta de los dos tipos de estado del Popular,
 * con montos inventados.
 */

function cuenta(movs: EstadoCrudo['movimientos'], balanceActual: string | null = null): EstadoCrudo {
  return {
    clase: 'cuenta',
    banco: 'Banco Popular Dominicano',
    tipoCuenta: 'Cuenta Corriente',
    ultimos4: '2233',
    resumen: {
      balanceActual,
      balanceDisponible: balanceActual,
      balanceAlUltimoCorte: null,
      limiteAprobado: null,
      fechaCorte: null,
      balanceCorte: null,
      pagoMinimo: null,
      fechaVencimiento: null,
      disponible: null,
    },
    movimientos: movs,
    advertencias: [],
  }
}

function tarjeta(movs: EstadoCrudo['movimientos'], resumen: Partial<EstadoCrudo['resumen']> = {}): EstadoCrudo {
  return {
    clase: 'tarjeta',
    banco: 'Banco Popular Dominicano',
    tipoCuenta: 'Tarjeta de Crédito',
    ultimos4: '9090',
    resumen: {
      balanceActual: 'RD$ 37,840.20',
      balanceDisponible: null,
      balanceAlUltimoCorte: null,
      limiteAprobado: 'RD$ 150,000.00',
      fechaCorte: '2026-08-10',
      balanceCorte: 'RD$ 28,440.60',
      pagoMinimo: 'RD$ 795.35',
      fechaVencimiento: '2026-09-04',
      disponible: 'RD$ 112,159.80',
      ...resumen,
    },
    movimientos: movs,
    advertencias: [],
  }
}

const mov = (fecha: string, descripcion: string, monto: string, balance: string | null = null, referencia: string | null = null) =>
  ({ fecha, fechaEntrada: null, descripcion, monto, balance, referencia })

describe('normalizar un estado de cuenta corriente', () => {
  const crudo = cuenta(
    [
      mov('24/05/2026', 'Transf. via MB a 700445566', 'RD$ 30.00-', 'RD$ 12,270.00', '0000700445566'),
      mov('29/05/2026', 'Transf App Neg de 852234384', 'RD$ 50,000.00', 'RD$ 62,270.00'),
      mov('30/05/2026', 'PagoTC Via MB***9090', 'RD$ 14,275.80-', 'RD$ 47,994.20'),
    ],
    'RD$ 47,994.20',
  )

  it('aplica la convencion de signo de las cuentas', () => {
    const r = normalizarEstado(crudo, { accountId: 'op' })
    expect(r.movimientos.map((m) => m.monto)).toEqual([-30, 50000, -14275.8])
  })

  it('convierte las fechas DD/MM/AAAA a ISO', () => {
    const r = normalizarEstado(crudo, { accountId: 'op' })
    expect(r.movimientos.map((m) => m.fecha)).toEqual(['2026-05-24', '2026-05-29', '2026-05-30'])
  })

  it('deduce el rango que cubre el estado', () => {
    const r = normalizarEstado(crudo, { accountId: 'op' })
    expect(r.rango).toEqual({ desde: '2026-05-24', hasta: '2026-05-30' })
  })

  it('cuadra la cadena de saldos y la contrasta con el encabezado', () => {
    const r = normalizarEstado(crudo, { accountId: 'op' })
    expect(r.cuadre?.ok).toBe(true)
    expect(r.cuadraConEncabezado).toBe(true)
    expect(r.advertencias).toEqual([])
  })

  it('avisa cuando el modelo transcribe mal un monto', () => {
    // Un signo copiado al reves: la cadena de saldos lo delata.
    const malo = cuenta(
      [
        mov('24/05/2026', 'Transf. via MB a 700445566', 'RD$ 30.00-', 'RD$ 12,270.00'),
        mov('29/05/2026', 'Transf App Neg', 'RD$ 50,000.00-', 'RD$ 62,270.00'),
      ],
      'RD$ 62,270.00',
    )
    const r = normalizarEstado(malo, { accountId: 'op' })
    expect(r.cuadre?.ok).toBe(false)
    expect(r.advertencias.join(' ')).toMatch(/no cuadra/i)
  })

  it('avisa cuando el saldo final no coincide con el encabezado', () => {
    const r = normalizarEstado(cuenta(crudo.movimientos, 'RD$ 99,999.99'), { accountId: 'op' })
    expect(r.cuadraConEncabezado).toBe(false)
    expect(r.advertencias.join(' ')).toMatch(/Balance Actual/i)
  })

  it('une un concepto que venia partido en varias lineas', () => {
    const r = normalizarEstado(
      cuenta([mov('18/06/2026', 'LBTR 31540680015   VINCENT\n  URBANO   E000073.A32142', 'RD$ 38,000.00', 'RD$ 62,786.28')]),
      { accountId: 'op' },
    )
    expect(r.movimientos[0].descripcion).toBe('LBTR 31540680015 VINCENT URBANO E000073.A32142')
  })

  it('omite un movimiento ilegible en vez de inventarlo, y lo reporta', () => {
    const r = normalizarEstado(
      cuenta([
        mov('24/05/2026', 'Bueno', 'RD$ 30.00-', 'RD$ 12,270.00'),
        mov('24/05/2026', 'Ilegible', 'RD$', null),
      ]),
      { accountId: 'op' },
    )
    expect(r.movimientos).toHaveLength(1)
    expect(r.advertencias.join(' ')).toMatch(/ilegible/i)
  })

  it('guarda solo los ultimos cuatro digitos aunque llegue el numero completo', () => {
    const conNumeroLargo = { ...cuenta(crudo.movimientos), ultimos4: '700112233' }
    expect(normalizarEstado(conNumeroLargo, { accountId: 'op' }).ultimos4).toBe('2233')
  })

  it('le pone huella a cada movimiento para poder deduplicar despues', () => {
    const r = normalizarEstado(crudo, { accountId: 'op' })
    expect(r.movimientos.every((m) => typeof m.huella === 'string' && m.huella.length > 0)).toBe(true)
  })
})

describe('normalizar un estado de tarjeta', () => {
  const crudo = tarjeta([
    { fecha: '2026-08-09', fechaEntrada: '2026-08-10', descripcion: 'KFC', monto: 'RD$ 2,189.99', balance: null, referencia: null },
    { fecha: '2026-08-07', fechaEntrada: '2026-08-08', descripcion: 'Pago Via App', monto: 'RD$ -40,000.00', balance: null, referencia: null },
    { fecha: '2026-08-10', fechaEntrada: '2026-08-10', descripcion: 'Rebate VISA ISI', monto: 'RD$ -1,340.00', balance: null, referencia: null },
  ])

  it('invierte la convencion: consumo negativo, pago positivo', () => {
    const r = normalizarEstado(crudo, { accountId: 'tc' })
    expect(r.movimientos.map((m) => m.monto)).toEqual([-2189.99, 40000, 1340])
  })

  it('lee las fechas AAAA-MM-DD de la tarjeta', () => {
    const r = normalizarEstado(crudo, { accountId: 'tc' })
    expect(r.movimientos[0].fecha).toBe('2026-08-09')
    expect(r.movimientos[0].fechaEntrada).toBe('2026-08-10')
  })

  it('no intenta cuadrar saldo corrido, porque la tarjeta no lo trae', () => {
    const r = normalizarEstado(crudo, { accountId: 'tc' })
    expect(r.cuadre).toBeNull()
  })

  it('separa lo del ciclo de lo del dia de impresion', () => {
    const r = normalizarEstado(crudo, { accountId: 'tc', hoy: '2026-08-23' })
    expect(r.ciclo).toEqual({
      id: 'tc-2026-08-10',
      accountId: 'tc',
      fechaCorte: '2026-08-10',
      balanceCorte: 28440.6,
      pagoMinimo: 795.35,
      fechaVencimiento: '2026-09-04',
    })
    // "Balance a la fecha" NO entra al ciclo: es del dia en que se imprimio.
    expect(r.snapshot?.balanceALaFecha).toBe(37840.2)
    expect(r.snapshot?.tomadoEl).toBe('2026-08-23')
  })

  it('lee la fecha de corte tambien cuando viene en DD/MM/AAAA', () => {
    // El mismo campo salio en los dos formatos en tarjetas impresas el mismo dia.
    const otro = tarjeta(crudo.movimientos, { fechaCorte: '10/08/2026', fechaVencimiento: '04/09/2026' })
    const r = normalizarEstado(otro, { accountId: 'tc' })
    expect(r.ciclo?.fechaCorte).toBe('2026-08-10')
    expect(r.ciclo?.fechaVencimiento).toBe('2026-09-04')
  })

  it('avisa si el ciclo viene incompleto en vez de inventarlo', () => {
    const sinCorte = tarjeta(crudo.movimientos, { fechaCorte: null, balanceCorte: null })
    const r = normalizarEstado(sinCorte, { accountId: 'tc' })
    expect(r.ciclo).toBeNull()
    expect(r.advertencias.join(' ')).toMatch(/ciclo de corte/i)
  })

  it('conserva las advertencias que reporto el modelo', () => {
    const conDuda = { ...crudo, advertencias: ['El monto del 09/08 está borroso'] }
    expect(normalizarEstado(conDuda, { accountId: 'tc' }).advertencias).toContain(
      'El monto del 09/08 está borroso',
    )
  })
})
