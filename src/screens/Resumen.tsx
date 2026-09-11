import type { Account, CardCycle, Txn } from '../types'
import { Marca, Fila, CifraGrande } from '../components/Piezas'
import { pesos, pesosCorto } from '../lib/money'
import { resumirGastoReal } from '../lib/transfers'
import { fechaLarga, diasEntre } from '../lib/dates'

export function Resumen({
  cuentas,
  saldos,
  txns,
  ciclos,
  hoy,
  onVerCuenta,
  onVerReporte,
}: {
  cuentas: Account[]
  saldos: Record<string, number>
  txns: Txn[]
  ciclos: CardCycle[]
  hoy: string
  onVerCuenta: (id: string) => void
  onVerReporte?: () => void
}) {
  const posicionNeta = cuentas.reduce((a, c) => a + (saldos[c.id] ?? 0), 0)
  const resumen = resumirGastoReal(txns)

  const ultimoCiclo = [...ciclos].sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte))[0]
  const faltan = ultimoCiclo ? diasEntre(hoy, ultimoCiclo.fechaVencimiento) : null

  return (
    <div className="vista">
      <div>
        <p className="epigrafe">Banco Popular · RD$</p>
        <h1 className="titulo-grande">Resumen</h1>
      </div>

      <div className="bloque-apretado">
        <span className="rotulo">Posición neta</span>
        <CifraGrande valor={posicionNeta} />
        <span className="fila-detalle">
          Gasto real del período: {pesos(resumen.gastoReal)}
        </span>
      </div>

      <div className="separador" />

      <div className="bloque">
        {cuentas.map((c) => (
          <Fila
            key={c.id}
            izquierda={<Marca cuenta={c} />}
            nombre={c.nombre}
            detalle={`Popular ••••${c.ultimos4}`}
            derecha={
              <span className={saldos[c.id] < 0 ? 'monto monto-neg' : 'monto'}>
                {saldos[c.id] < 0 ? '−' : ''}
                {pesos(saldos[c.id] ?? 0)}
              </span>
            }
            onClick={() => onVerCuenta(c.id)}
          />
        ))}
      </div>

      {ultimoCiclo && faltan !== null && faltan >= 0 ? (
        <div className={faltan <= 2 ? 'aviso aviso-alta' : 'aviso aviso-media'}>
          <span className="aviso-titulo">
            Próximo pago · vence {fechaLarga(ultimoCiclo.fechaVencimiento)}
          </span>
          <span className="aviso-texto">
            Cortaste el {fechaLarga(ultimoCiclo.fechaCorte)} con {pesos(ultimoCiclo.balanceCorte)}.
            Paga completo y no generas intereses.
          </span>
        </div>
      ) : null}

      {onVerReporte ? (
        <button type="button" className="boton boton-suave" onClick={onVerReporte}>
          Ver el reporte del mes
        </button>
      ) : null}

      {resumen.movimientosInternos > 0 ? (
        <div className="tarjeta-plana">
          <span className="rotulo">Por qué tu gasto es más bajo de lo que parece</span>
          <span className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.55 }}>
            {pesosCorto(resumen.trasladosInternos)} en {resumen.movimientosInternos} movimientos
            son traslados entre tus propias cuentas y pagos a tu tarjeta. Están guardados, pero no
            cuentan como gasto.
          </span>
        </div>
      ) : null}
    </div>
  )
}
