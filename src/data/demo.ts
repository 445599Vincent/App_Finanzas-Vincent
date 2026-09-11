import type { Account, CardCycle, Txn } from '../types'
import { emparejarTraslados } from '../lib/transfers'
import { sugerirCategoria } from '../lib/categories'
import { huellaDe } from '../lib/fingerprint'

/**
 * Datos de demostracion.
 *
 * Son inventados, pero calcados del formato y del comportamiento reales: dos
 * cuentas corrientes que se pasan dinero entre si, una tarjeta que se paga
 * completa cada corte, impuesto DGII agrupado, Bancaseguro mensual y un cargo
 * recurrente cada dos semanas.
 *
 * Sirven para que la app abra mostrando algo util antes de que conectes
 * Supabase, y para que se vea de inmediato por que los traslados internos
 * cambian por completo la cifra de gasto.
 */

export const CUENTAS_DEMO: Account[] = [
  { id: 'pr', nombre: 'Corriente principal', banco: 'Banco Popular', tipo: 'corriente', ultimos4: '5566', moneda: 'DOP' },
  { id: 'op', nombre: 'Corriente operativa', banco: 'Banco Popular', tipo: 'corriente', ultimos4: '2233', moneda: 'DOP' },
  { id: 'tc', nombre: 'Tarjeta de crédito', banco: 'Banco Popular', tipo: 'tarjeta', ultimos4: '9090', moneda: 'DOP', limite: 150000 },
]

export const CICLOS_DEMO: CardCycle[] = [
  { id: 'ci-06', accountId: 'tc', fechaCorte: '2026-06-10', balanceCorte: 33905.20, pagoMinimo: 874.46, fechaVencimiento: '2026-07-04' },
  { id: 'ci-07', accountId: 'tc', fechaCorte: '2026-07-10', balanceCorte: 42150.75, pagoMinimo: 1185.40, fechaVencimiento: '2026-08-04' },
  { id: 'ci-08', accountId: 'tc', fechaCorte: '2026-08-10', balanceCorte: 28440.60, pagoMinimo: 795.35, fechaVencimiento: '2026-09-04' },
]

type Crudo = [cuenta: string, fecha: string, descripcion: string, monto: number, ref?: string]

/** Signo ya normalizado: positivo mejora tu posicion, negativo la empeora. */
const CRUDOS: Crudo[] = [
  // --- ingresos de verdad
  ['op', '2026-06-18', 'LBTR NOMINA EMPRESA E000073', 38000, '0031540680015'],
  ['op', '2026-06-27', 'Transf App Neg de 843129248', 47820.10, '0000843129248'],
  ['op', '2026-07-30', 'LBTR NOMINA EMPRESA E000073', 50000, '0031540680015'],
  ['op', '2026-08-07', 'LBTR NOMINA EMPRESA E000073', 52000, '0031540680015'],
  ['op', '2026-08-17', 'LBTR NOMINA EMPRESA E000073', 55000, '0031540680015'],
  ['pr', '2026-07-06', 'RENTA LOCAL COMERCIAL', 22000],
  ['pr', '2026-08-18', 'RENTA LOCAL COMERCIAL', 22000],

  // --- traslados entre cuentas propias (los dos lados)
  ['op', '2026-06-27', 'Transf. via MB a 700445566', -15000, '0000700445566'],
  ['pr', '2026-06-27', 'Transf. via MB desde 700112233', 15000, '0000700112233'],
  ['op', '2026-06-30', 'Transf. via MB a 700445566', -11000, '0000700445566'],
  ['pr', '2026-06-30', 'Transf. via MB desde 700112233', 11000, '0000700112233'],
  ['op', '2026-07-26', 'Transf. via MB a 700445566', -11000, '0000700445566'],
  ['pr', '2026-07-26', 'Transf. via MB desde 700112233', 11000, '0000700112233'],
  ['op', '2026-08-07', 'Transf. via MB a 700445566', -15000, '0000700445566'],
  ['pr', '2026-08-07', 'Transf. via MB desde 700112233', 15000, '0000700112233'],
  ['op', '2026-08-17', 'Transf. via MB a 700445566', -11000, '0000700445566'],
  ['pr', '2026-08-17', 'Transf. via MB desde 700112233', 11000, '0000700112233'],

  // --- pagos de tarjeta (los dos lados: la cuenta paga, la tarjeta abona)
  ['op', '2026-07-04', 'PagoTC Via MB***9090', -33905.20, '0000000003208'],
  ['tc', '2026-07-04', 'Pago Via App', 33905.20],
  ['op', '2026-07-30', 'PagoTC Via MB***9090', -42150.75, '0000000003208'],
  ['tc', '2026-07-30', 'Pago Via App', 42150.75],
  ['op', '2026-08-17', 'PagoTC Via MB***9090', -28440.60, '0000000003208'],
  ['tc', '2026-08-17', 'Pago Via App', 28440.60],

  // --- pagos reales a terceros desde la cuenta
  ['op', '2026-06-03', 'MB a 0781593215 Ferretera del Este', -10000, '0000781593215'],
  ['op', '2026-08-17', 'MB a 0790206593 J RODRIGUEZ', -6540, '0000790206593'],

  // --- lo que cobra el banco
  ['op', '2026-06-15', 'BANCASEGURO JUN 2026', -125, '0000000002026'],
  ['op', '2026-07-15', 'BANCASEGURO JUL 2026', -125, '0000000002026'],
  ['op', '2026-08-12', 'BANCASEGURO AGO 2026', -125, '0000000002026'],
  ['op', '2026-06-19', 'PAGO IMPUESTO 0.15 DGII 2 TRANS POR $52,110.40', -104.22, '0000000000002'],
  ['op', '2026-07-31', 'PAGO IMPUESTO 0.20 DGII 2 TRANS POR $44,205.60', -88.41, '0000000000002'],
  ['op', '2026-08-21', 'PAGO IMPUESTO 0.20 DGII 2 TRANS POR $39,880.20', -79.76, '0000000000002'],
  ['tc', '2026-07-17', 'CARGO EMISION PRORRATEADA', -900],
  ['tc', '2026-07-17', 'PROTECCION POR PERDIDA', -450],
  ['tc', '2026-08-01', 'CRED. CARGO RENOVACION PRORRATEADA MF', 900],

  // --- consumos de tarjeta: recurrentes
  ['tc', '2026-06-13', 'SPOTIFY', -549.15],
  ['tc', '2026-07-13', 'SPOTIFY', -549.15],
  ['tc', '2026-08-13', 'SPOTIFY', -549.15],
  ['tc', '2026-06-13', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-06-25', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-07-03', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-07-17', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-08-02', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-08-16', 'BARBERIA CENTRAL', -1000],
  ['tc', '2026-06-28', 'CONDOMINIO TORRE 4', -150],
  ['tc', '2026-07-18', 'CONDOMINIO TORRE 4', -150],
  ['tc', '2026-08-18', 'CONDOMINIO TORRE 4', -150],
  // este subio de precio: la app lo tiene que cantar
  ['tc', '2026-06-16', 'MICROSOFT', -1980],
  ['tc', '2026-07-16', 'MICROSOFT', -2090],
  ['tc', '2026-08-16', 'MICROSOFT', -2410.55],

  // --- consumos de tarjeta: sueltos
  ['tc', '2026-06-14', 'SUPERMERCADO NACIONAL', -5218.40],
  ['tc', '2026-06-18', 'ESTACION SUNIX', -2414],
  ['tc', '2026-06-19', 'TALLER LUBRICENTRO', -8115],
  ['tc', '2026-06-20', 'FARMACIA CAROL', -1590],
  ['tc', '2026-06-26', "WENDY'S", -1225.75],
  ['tc', '2026-07-03', 'KFC', -1414.99],
  ['tc', '2026-07-11', 'RESTAURANT PARRILLA', -1834.24],
  ['tc', '2026-07-16', 'ESTACION SUNIX', -3375.9],
  ['tc', '2026-07-22', 'ESTACION SHELL', -2362.6],
  ['tc', '2026-07-25', 'UNIVERSIDAD LINK DE PAGOS', -11700],
  ['tc', '2026-07-26', 'RESTAURANT TROPICAL', -2468.56],
  ['tc', '2026-08-02', 'TIENDA ATMOSFERA', -4390.4],
  ['tc', '2026-08-05', 'Nike.com', -9430.60],
  ['tc', '2026-08-06', 'KFC', -2189.99],
  ['tc', '2026-08-12', 'ESTACION SUNIX', -3709],
  ['tc', '2026-08-16', 'BURGER KING', -3935.02],
  ['tc', '2026-08-21', 'ESTACION SHELL', -3571],
  // duplicado a proposito: la alerta de anomalia lo tiene que ver
  ['tc', '2026-08-21', 'DRINKS EXPRESS', -700],
  ['tc', '2026-08-21', 'DRINKS EXPRESS', -700],
]

function construir(): Txn[] {
  const txns: Txn[] = CRUDOS.map((c, i) => {
    const [accountId, fecha, descripcion, monto, referencia] = c
    const base = { id: `d${i}`, accountId, fecha, descripcion, monto, referencia }
    return { ...base, huella: huellaDe(base) }
  })

  const { internos } = emparejarTraslados(txns, CUENTAS_DEMO)

  for (const t of txns) {
    t.esInterno = internos.has(t.id)
    t.categoriaId = sugerirCategoria(t.descripcion, t.monto, t.esInterno).categoriaId
  }

  return txns.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export const TXNS_DEMO: Txn[] = construir()

/** Saldos de cierre que mostraria el encabezado de cada estado. */
export const SALDOS_DEMO: Record<string, number> = {
  pr: 182450.90,
  op: 6120.55,
  tc: -37840.20,
}

export const HOY_DEMO = '2026-09-01'
