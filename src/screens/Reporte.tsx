import { useMemo, useState } from 'react'
import type { Account, Txn } from '../types'
import { pesos, pesosCorto, pesosEje } from '../lib/money'
import { descargarMovimientos } from '../lib/exportar'
import {
  resumirMes,
  gastoPorCategoria,
  serieMensual,
  comerciosDelMes,
  mesesConDatos,
  nombreDeMes,
  mesCorto,
} from '../lib/reporte'

/**
 * Reporte mensual.
 *
 * Los totales van como cifras, no como grafica: son tres numeros, y una dona de
 * tres porciones se lee peor que tres numeros bien puestos.
 *
 * Las dos graficas son de UNA sola serie, asi que llevan un solo tono. Pintar
 * cada categoria de un color distinto seria colorear por rango, que no dice
 * nada: la posicion y la etiqueta ya identifican cada barra.
 *
 * Los valores van escritos al lado de cada barra en vez de en un tooltip:
 * en un telefono no hay hover, y un dato que hay que perseguir no es un dato.
 */
export function Reporte({
  txns,
  cuentas,
  hoy,
  onVolver,
}: {
  txns: Txn[]
  cuentas: Account[]
  hoy: string
  onVolver: () => void
}) {
  const meses = useMemo(() => mesesConDatos(txns), [txns])
  const [mes, setMes] = useState(() => meses[meses.length - 1] ?? hoy.slice(0, 7))

  const resumen = useMemo(() => resumirMes(txns, mes), [txns, mes])
  const categorias = useMemo(() => gastoPorCategoria(txns, mes), [txns, mes])
  const serie = useMemo(() => serieMensual(txns, mes, 6), [txns, mes])
  const comercios = useMemo(() => comerciosDelMes(txns, mes, 5), [txns, mes])

  const techo = Math.max(...serie.map((p) => p.gasto), 1)
  const delMes = useMemo(() => txns.filter((t) => t.fecha.startsWith(mes)), [txns, mes])

  return (
    <div className="vista vista-reporte">
      <button
        type="button"
        className="epigrafe no-imprimir"
        onClick={onVolver}
        style={{ alignSelf: 'flex-start', padding: 0 }}
      >
        ← Volver
      </button>

      <div>
        <p className="epigrafe">Reporte de</p>
        <h1 className="titulo-grande">{nombreDeMes(mes)}</h1>
      </div>

      {meses.length > 1 ? (
        <div className="tiras no-imprimir" role="group" aria-label="Elegir mes">
          {meses.slice(-8).map((m) => (
            <button
              key={m}
              type="button"
              className={m === mes ? 'pildora pildora-azul' : 'pildora'}
              onClick={() => setMes(m)}
            >
              {mesCorto(m)}
            </button>
          ))}
        </div>
      ) : null}

      {/* Los tres numeros que resumen el mes. Cifras, no grafica. */}
      <div className="bloque">
        <div className="fila">
          <span className="fila-crece">
            <span className="fila-nombre" style={{ fontWeight: 500 }}>Entradas</span>
          </span>
          <span className="monto monto-pos">+{pesos(resumen.entradas)}</span>
        </div>
        <div className="fila">
          <span className="fila-crece">
            <span className="fila-nombre" style={{ fontWeight: 500 }}>Gasto real</span>
          </span>
          <span className="monto monto-neg">−{pesos(resumen.gasto)}</span>
        </div>
        {resumen.internos > 0 ? (
          <div className="fila">
            <span className="fila-crece">
              <span className="fila-nombre" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
                Traslados internos
              </span>
              <span className="fila-detalle">ni entrada ni gasto</span>
            </span>
            <span className="monto monto-gris">{pesos(resumen.internos)}</span>
          </div>
        ) : null}
        <div className="separador" />
        <div className="fila">
          <span className="fila-crece">
            <span className="fila-nombre">Quedó</span>
            {resumen.tasaAhorro !== null ? (
              <span className="fila-detalle">
                {Math.round(resumen.tasaAhorro * 100)}% de lo que entró
              </span>
            ) : null}
          </span>
          <span
            className={resumen.quedo >= 0 ? 'monto monto-pos' : 'monto monto-neg'}
            style={{ fontWeight: 600, fontSize: 16 }}
          >
            {pesos(resumen.quedo)}
          </span>
        </div>
      </div>

      {/* Tendencia: una serie, un tono, el mes elegido destacado. */}
      <div className="bloque">
        <span className="rotulo">Gasto real de los últimos 6 meses</span>
        <div className="barras" role="img" aria-label={descripcionSerie(serie)}>
          {serie.map((p) => (
            <div key={p.mes} className="barra-col">
              <span className="barra-valor">{p.gasto > 0 ? pesosEje(p.gasto) : ''}</span>
              <div
                className={p.mes === mes ? 'barra barra-activa' : 'barra'}
                style={{ height: `${Math.max(3, (p.gasto / techo) * 100)}%` }}
              />
              <span className={p.mes === mes ? 'barra-rotulo barra-rotulo-activo' : 'barra-rotulo'}>
                {mesCorto(p.mes)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {categorias.length > 0 ? (
        <div className="bloque">
          <span className="rotulo">En qué se fue</span>
          {categorias.map((c) => (
            <div key={c.categoriaId} className="cat">
              <div className="cat-cab">
                <span className="cat-nombre">{c.nombre}</span>
                <span className="monto">{pesosCorto(c.total)}</span>
              </div>
              <div className="cat-pista">
                <div className="cat-barra" style={{ width: `${Math.max(1, c.parte * 100)}%` }} />
              </div>
              <span className="fila-detalle">
                {porcentaje(c.parte)} · {c.movimientos}{' '}
                {c.movimientos === 1 ? 'movimiento' : 'movimientos'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {comercios.length > 0 ? (
        <div className="bloque">
          <span className="rotulo">Dónde más se fue</span>
          {comercios.map((c) => (
            <div key={c.nombre} className="fila">
              <span className="fila-crece">
                <span className="fila-nombre">{c.nombre}</span>
                <span className="fila-detalle">
                  {c.movimientos} {c.movimientos === 1 ? 'vez' : 'veces'}
                </span>
              </span>
              <span className="monto">{pesosCorto(c.total)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="bloque-apretado no-imprimir" style={{ paddingBottom: 10 }}>
        <button type="button" className="boton" onClick={() => window.print()}>
          Guardar este reporte en PDF
        </button>
        <button
          type="button"
          className="boton boton-suave"
          onClick={() => descargarMovimientos(delMes, cuentas, nombreDeMes(mes))}
        >
          Descargar los movimientos en Excel
        </button>
        <span className="fila-detalle" style={{ textAlign: 'center', whiteSpace: 'normal' }}>
          El botón de PDF abre la ventana de imprimir de tu teléfono; ahí eliges
          «Guardar en archivos» o «Guardar como PDF».
        </span>
      </div>
    </div>
  )
}

/** Redondear a 0% algo que sí gastaste es mentir por omisión. */
function porcentaje(parte: number): string {
  if (parte > 0 && parte < 0.005) return 'menos del 1%'
  return `${Math.round(parte * 100)}%`
}

/** Texto alternativo de la gráfica, para quien no la puede ver. */
function descripcionSerie(serie: Array<{ mes: string; gasto: number }>): string {
  return (
    'Gasto real por mes: ' +
    serie.map((p) => `${mesCorto(p.mes)} ${pesosCorto(p.gasto)}`).join(', ')
  )
}
