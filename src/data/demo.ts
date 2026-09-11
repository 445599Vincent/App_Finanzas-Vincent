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
  { id: 'pr', nombre: 'Corriente principal', banco: 'Banco Popular', tipo: 'corriente', ultimos4: '3461', moneda: 'DOP' },
  { id: 'op', nombre: 'Corriente operativa', banco: 'Banco Popular', tipo: 'corriente', ultimos4: '6220', moneda: 'DOP' },
  { id: 'tc', nombre: 'Tarjeta de crédito', banco: 'Banco Popular', tipo: 'tarjeta', ultimos4: '3208', moneda: 'DOP', limite: 138000 },
]

export const CICLOS_DEMO: CardCycle[] = [
  { id: 'ci-06', accountId: 'tc', fechaCorte: '2026-06-10', balanceCorte: 31480.55, pagoMinimo: 874.46, fechaVencimiento: '2026-07-04' },
  { id: 'ci-07', accountId: 'tc', fechaCorte: '2026-07-10', balanceCorte: 38419.92, pagoMinimo: 1067.26, fechaVencimiento: '2026-08-04' },
  { id: 'ci-08', accountId: 'tc', fechaCorte: '2026-08-10', balanceCorte: 26031.31, pagoMinimo: 723.09, fechaVencimiento: '2026-09-04' },
]

type Crudo = [cuenta: string, fecha: string, descripcion: string, monto: number, ref?: string]

/** Signo ya normalizado: positivo mejora tu posicion, negativo la empeora. */
const CRUDOS: Crudo[] = [
  // --- ingresos de verdad
  ['op', '2026-06-18', 'LBTR TAPIA PEREZ E000073', 38000, '0031540680015'],
  ['op', '2026-06-27', 'Transf App Neg de 843129248', 54570.33, '0000843129248'],
  ['op', '2026-07-30', 'LBTR TAPIA PEREZ E000073', 50000, '0031540680015'],
  ['op', '2026-08-07', 'LBTR TAPIA PEREZ E000073', 52000, '0031540680015'],
  ['op', '2026-08-17', 'LBTR TAPIA PEREZ E000073', 55000, '0031540680015'],
  ['pr', '2026-07-06', 'JIMENEZ PEREZ M', 22000],
  ['pr', '2026-08-18', 'JIMENEZ PEREZ M', 22000],

  // --- traslados entre cuentas propias (los dos lados)
  ['op', '2026-06-27', 'Transf. via MB a 839453461', -15000, '0000839453461'],
  ['pr', '2026-06-27', 'Transf. via MB desde 814726220', 15000, '0000814726220'],
  ['op', '2026-06-30', 'Transf. via MB a 839453461', -11000, '0000839453461'],
  ['pr', '2026-06-30', 'Transf. via MB desde 814726220', 11000, '0000814726220'],
  ['op', '2026-07-26', 'Transf. via MB a 839453461', -11000, '0000839453461'],
  ['pr', '2026-07-26', 'Transf. via MB desde 814726220', 11000, '0000814726220'],
  ['op', '2026-08-07', 'Transf. via MB a 839453461', -15000, '0000839453461'],
  ['pr', '2026-08-07', 'Transf. via MB desde 814726220', 15000, '0000814726220'],
  ['op', '2026-08-17', 'Transf. via MB a 839453461', -11000, '0000839453461'],
  ['pr', '2026-08-17', 'Transf. via MB desde 814726220', 11000, '0000814726220'],

  // --- pagos de tarjeta (los dos lados: la cuenta paga, la tarjeta abona)
  ['op', '2026-07-04', 'PagoTC Via MB***3208', -31480.55, '0000000003208'],
  ['tc', '2026-07-04', 'Pago Via App', 31480.55],
  ['op', '2026-07-30', 'PagoTC Via MB***3208', -38419.92, '0000000003208'],
  ['tc', '2026-07-30', 'Pago Via App', 38419.92],
  ['op', '2026-08-17', 'PagoTC Via MB***3208', -26031.31, '0000000003208'],
  ['tc', '2026-08-17', 'Pago Via App', 26031.31],

  // --- pagos reales a terceros desde la cuenta
  ['op', '2026-06-03', 'MB a 0781593215 Ferrecentro co', -10000, '0000781593215'],
  ['op', '2026-08-17', 'MB a 0790206593 Ana Prez', -7362, '0000790206593'],

  // --- lo que cobra el banco
  ['op', '2026-06-15', 'BANCASEGURO JUN 2026', -125, '0000000002026'],
  ['op', '2026-07-15', 'BANCASEGURO JUL 2026', -125, '0000000002026'],
  ['op', '2026-08-12', 'BANCASEGURO AGO 2026', -125, '0000000002026'],
  ['op', '2026-06-19', 'PAGO IMPUESTO 0.15 DGII 2 TRANS POR $58,416.84', -87.63, '0000000000002'],
  ['op', '2026-07-31', 'PAGO IMPUESTO 0.20 DGII 2 TRANS POR $48,419.92', -96.84, '0000000000002'],
  ['op', '2026-08-21', 'PAGO IMPUESTO 0.20 DGII 2 TRANS POR $46,602.33', -93.2, '0000000000002'],
  ['tc', '2026-07-17', 'CARGO EMISION PRORRATEADA', -900],
  ['tc', '2026-07-17', 'PROTECCION POR PERDIDA', -450],
  ['tc', '2026-08-01', 'CRED. CARGO RENOVACION PRORRATEADA MF', 900],

  // --- consumos de tarjeta: recurrentes
  ['tc', '2026-06-13', 'SPOTIFY', -549.15],
  ['tc', '2026-07-13', 'SPOTIFY', -549.15],
  ['tc', '2026-08-13', 'SPOTIFY', -549.15],
  ['tc', '2026-06-13', 'BARBER LAB', -1000],
  ['tc', '2026-06-25', 'BARBER LAB', -1000],
  ['tc', '2026-07-03', 'BARBER LAB', -1000],
  ['tc', '2026-07-17', 'BARBER LAB', -1000],
  ['tc', '2026-08-02', 'BARBER LAB', -1000],
  ['tc', '2026-08-16', 'BARBER LAB', -1000],
  ['tc', '2026-06-28', 'CONDOMINIO BODY SHOP', -150],
  ['tc', '2026-07-18', 'CONDOMINIO BODY SHOP', -150],
  ['tc', '2026-08-18', 'CONDOMINIO BODY SHOP', -150],
  // este subio de precio: la app lo tiene que cantar
  ['tc', '2026-06-16', 'MICROSOFT#G165403069', -1980],
  ['tc', '2026-07-16', 'MICROSOFT#G165403069', -2090],
  ['tc', '2026-08-16', 'MICROSOFT#G165403069', -2200.92],

  // --- consumos de tarjeta: sueltos
  ['tc', '2026-06-14', 'SM NACIONAL ARROYO HON', -6436.03],
  ['tc', '2026-06-18', 'SYKRYS GAS STATION', -2414],
  ['tc', '2026-06-19', 'LUBRISERVIS ENGOMBE', -9730],
  ['tc', '2026-06-20', 'FARM CAROL CUESTA HE', -1590],
  ['tc', '2026-06-26', "WENDY'S TIRADENTES", -1225.75],
  ['tc', '2026-07-03', 'KFC ARROYO HONDO', -1414.99],
  ['tc', '2026-07-11', 'RESTAURANT MEAT LOVERS', -1834.24],
  ['tc', '2026-07-16', 'SYKRYS GAS STATION', -3375.9],
  ['tc', '2026-07-22', 'ESTACION SHELL REYES CATO', -2362.6],
  ['tc', '2026-07-25', 'INTEC LINK DE PAGOS', -13230],
  ['tc', '2026-07-26', 'ADRIAN TROPICAL LINCOLN', -2468.56],
  ['tc', '2026-08-02', 'ATMOSFERA 19', -4390.4],
  ['tc', '2026-08-05', 'Nike.com', -11845.75],
  ['tc', '2026-08-06', 'KFC ARROYO HONDO', -2189.99],
  ['tc', '2026-08-12', 'SYKRYS GAS STATION', -3709],
  ['tc', '2026-08-16', 'BURGER KING PROCERES', -3935.02],
  ['tc', '2026-08-21', 'ESTACION SHELL REYES CATO', -3571],
  // duplicado a proposito: la alerta de anomalia lo tiene que ver
  ['tc', '2026-08-21', 'DRINK 2 GO NACO', -700],
  ['tc', '2026-08-21', 'DRINK 2 GO NACO', -700],
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
  pr: 295085.47,
  op: 4278.33,
  tc: -49991.37,
}

export const HOY_DEMO = '2026-09-01'
