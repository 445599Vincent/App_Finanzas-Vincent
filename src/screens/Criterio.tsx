import { useMemo } from 'react'
import type { Account, CardCycle, Txn } from '../types'
import { Aviso, Vacio } from '../components/Piezas'
import { calcularCriterio } from '../lib/insights'
import { detectarRecurrentes, costoMensual } from '../lib/recurring'
import { pesos } from '../lib/money'

export function Criterio({
  cuentas,
  txns,
  ciclos,
  hoy,
  presupuestos,
}: {
  cuentas: Account[]
  txns: Txn[]
  ciclos: CardCycle[]
  hoy: string
  presupuestos?: Record<string, number>
}) {
  const alertas = useMemo(
    () => calcularCriterio({ hoy, txns, cuentas, ciclos, presupuestos }),
    [hoy, txns, cuentas, ciclos, presupuestos],
  )

  const recurrentes = useMemo(() => detectarRecurrentes(txns), [txns])

  return (
    <div className="vista">
      <div>
        <p className="epigrafe">Lo que la app te dice sin que preguntes</p>
        <h1 className="titulo-grande">Criterio</h1>
      </div>

      {alertas.length === 0 ? (
        <Vacio
          titulo="Nada que reportar"
          texto="Cuando haya un pago por vencer, un cargo que suba de precio o algo que no cuadre, aparece aquí."
        />
      ) : (
        <div className="bloque">
          {alertas.map((a) => (
            <Aviso key={a.id} alerta={a} />
          ))}
        </div>
      )}

      {recurrentes.length > 0 ? (
        <div className="bloque">
          <span className="rotulo">
            Cargos recurrentes · {pesos(costoMensual(recurrentes))} al mes
          </span>
          {recurrentes.map((r) => (
            <div key={r.comercio} className="fila">
              <span className="fila-crece">
                <span className="fila-nombre">{r.comercio}</span>
                <span className="fila-detalle">
                  cada {r.cadaDias} días · visto {r.veces} veces
                  {r.variacion > 0.05 ? ` · subió ${Math.round(r.variacion * 100)}%` : ''}
                </span>
              </span>
              <span className="monto monto-neg">−{pesos(r.monto)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
