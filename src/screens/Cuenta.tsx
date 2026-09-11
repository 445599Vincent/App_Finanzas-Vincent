import { useMemo } from 'react'
import type { Account, CardCycle, CardSnapshot, Txn } from '../types'
import { Fila, Monto } from '../components/Piezas'
import { pesos, pesosCorto } from '../lib/money'
import { fechaLarga, diasEntre } from '../lib/dates'

/** Una sola forma de decir la fecha de pago, para que las dos líneas concuerden. */
function vencimiento(fecha: string, faltan: number | null): string {
  if (faltan === null) return `vence ${fechaLarga(fecha)}`
  if (faltan < 0) return `venció el ${fechaLarga(fecha)}`
  if (faltan === 0) return 'vence hoy'
  return `vence el ${fechaLarga(fecha)}, en ${faltan} ${faltan === 1 ? 'día' : 'días'}`
}

/**
 * Detalle de una cuenta o tarjeta.
 *
 * En las tarjetas separa a proposito dos cosas que el estado del Popular
 * imprime juntas: el balance AL CORTE, que es lo que tienes que pagar, y el
 * balance A LA FECHA, que ya incluye consumos del ciclo en curso y que si lo
 * pagas de mas no te ahorra nada.
 */
export function Cuenta({
  cuenta,
  saldo,
  txns,
  ciclos,
  snapshot,
  hoy,
  onVolver,
}: {
  cuenta: Account
  saldo: number | undefined
  txns: Txn[]
  ciclos: CardCycle[]
  snapshot: CardSnapshot | null
  hoy: string
  onVolver: () => void
}) {
  const mios = useMemo(
    () => txns.filter((t) => t.accountId === cuenta.id).slice(0, 12),
    [txns, cuenta.id],
  )

  const ciclo = useMemo(
    () =>
      ciclos
        .filter((c) => c.accountId === cuenta.id)
        .sort((a, b) => b.fechaCorte.localeCompare(a.fechaCorte))[0] ?? null,
    [ciclos, cuenta.id],
  )

  const esTarjeta = cuenta.tipo === 'tarjeta'
  const limite = cuenta.limite ?? snapshot?.limite ?? 0
  const usado = Math.abs(snapshot?.balanceALaFecha ?? saldo ?? 0)
  const porcentaje = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0
  const faltan = ciclo ? diasEntre(hoy, ciclo.fechaVencimiento) : null

  return (
    <div className="vista">
      <button
        type="button"
        className="epigrafe"
        onClick={onVolver}
        style={{ alignSelf: 'flex-start', padding: 0 }}
      >
        ← Volver
      </button>

      <div>
        <h1 className="titulo-grande">{cuenta.nombre}</h1>
        <p className="epigrafe" style={{ marginTop: 6 }}>
          {cuenta.banco} ••••{cuenta.ultimos4}
        </p>
      </div>

      {esTarjeta && ciclo ? (
        <>
          <div className="bloque-apretado">
            <span className="rotulo">Balance al corte del {fechaLarga(ciclo.fechaCorte)}</span>
            <div className="cifra-grande" style={{ color: 'var(--neg)' }}>
              {pesos(ciclo.balanceCorte)}
            </div>
            <span className="fila-detalle">Esto es lo que tienes que pagar</span>
          </div>

          {snapshot ? (
            <div className="bloque-apretado">
              <span className="rotulo">Balance a hoy</span>
              <div className="mono" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.03em' }}>
                {pesos(snapshot.balanceALaFecha)}
              </div>
              <span className="fila-detalle" style={{ whiteSpace: 'normal' }}>
                Incluye consumos del ciclo en curso. Pagar de más aquí no te ahorra intereses.
              </span>
            </div>
          ) : null}

          {limite > 0 ? (
            <div className="bloque-apretado">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="rotulo">Límite usado</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{porcentaje}%</span>
              </div>
              <div
                style={{ height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${porcentaje}%`,
                    background: porcentaje > 70 ? 'var(--neg)' : 'var(--accent)',
                    borderRadius: 99,
                  }}
                />
              </div>
              <span className="fila-detalle">
                {pesosCorto(usado)} de {pesosCorto(limite)}
              </span>
            </div>
          ) : null}

          <div className="tarjeta">
            <Fila
              nombre={<span style={{ fontWeight: 500 }}>Pago mínimo</span>}
              detalle={vencimiento(ciclo.fechaVencimiento, faltan)}
              derecha={<span className="monto">{pesos(ciclo.pagoMinimo)}</span>}
            />
            <div className="separador" />
            <Fila
              nombre="Para no generar intereses"
              detalle={vencimiento(ciclo.fechaVencimiento, faltan)}
              derecha={
                <span className="monto" style={{ fontWeight: 600 }}>
                  {pesos(ciclo.balanceCorte)}
                </span>
              }
            />
          </div>
        </>
      ) : (
        <div className="bloque-apretado">
          <span className="rotulo">Saldo</span>
          <div className="cifra-grande">{pesos(saldo ?? 0)}</div>
          <span className="fila-detalle">Según el último estado que subiste</span>
        </div>
      )}

      {mios.length > 0 ? (
        <div className="bloque">
          <span className="rotulo">Últimos movimientos</span>
          {mios.map((t) => (
            <Fila
              key={t.id}
              nombre={t.descripcion}
              detalle={fechaLarga(t.fecha)}
              derecha={<Monto valor={t.monto} gris={t.esInterno} />}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
