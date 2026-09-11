import { useMemo } from 'react'
import type { Account, Txn } from '../types'
import type { EstadoNormalizado } from '../lib/normalizar'
import { Fila, Monto } from '../components/Piezas'
import { POR_ID, sugerirCategoria } from '../lib/categories'
import { emparejarTraslados } from '../lib/transfers'
import { deduplicar } from '../lib/fingerprint'
import { fechaLarga } from '../lib/dates'
import { pesos } from '../lib/money'

/**
 * Pantalla de revision.
 *
 * Nada entra a tus numeros sin que pases por aqui. Se muestran tres cosas que
 * el resto de la app da por sentadas despues: que el saldo cuadra, que los
 * traslados internos quedaron fuera del gasto, y que lo repetido no se va a
 * duplicar.
 */

export interface Revisado {
  nuevos: Txn[]
  repetidos: number
  internos: number
  /** Traslados reconocidos por la descripción, cuyo otro lado aún no subes. */
  sinPareja: number
}

export function Revision({
  lectura,
  cuentas,
  existentes,
  onConfirmar,
  onDescartar,
}: {
  lectura: EstadoNormalizado
  cuentas: Account[]
  existentes: Txn[]
  onConfirmar: (r: Revisado) => void
  onDescartar: () => void
}) {
  const preparado = useMemo(() => {
    // 1. Lo que ya estaba guardado no vuelve a entrar.
    const { nuevos, repetidos } = deduplicar(
      lectura.movimientos,
      existentes.map((t) => t.huella ?? ''),
    )

    // 2. Los traslados se emparejan contra TODO, no solo contra este estado:
    //    el otro lado suele venir de un estado que subiste antes.
    const todos = [...existentes, ...nuevos]
    const { internos, sinPareja } = emparejarTraslados(todos, cuentas)

    const marcados = nuevos.map((t) => {
      const esInterno = internos.has(t.id)
      return {
        ...t,
        esInterno,
        categoriaId: sugerirCategoria(t.descripcion, t.monto, esInterno).categoriaId,
      }
    })

    return {
      nuevos: marcados,
      repetidos: repetidos.length,
      internos: marcados.filter((t) => t.esInterno).length,
      sinPareja: marcados.filter((t) => sinPareja.has(t.id)).length,
      huerfanos: new Set([...sinPareja]),
    }
  }, [lectura, cuentas, existentes])

  const cuadraTodo = lectura.cuadre?.ok !== false && lectura.cuadraConEncabezado !== false
  const lineasMalas = new Set(lectura.cuadre?.descuadres.map((d) => d.descripcion) ?? [])

  return (
    <div className="vista">
      <div>
        <h1 className="titulo-grande">
          Revisa {preparado.nuevos.length}
          <br />
          {preparado.nuevos.length === 1 ? 'movimiento' : 'movimientos'}
        </h1>
        <p className="epigrafe" style={{ marginTop: 6 }}>
          {lectura.tipoCuenta} ••••{lectura.ultimos4}
          {lectura.rango
            ? ` · ${fechaLarga(lectura.rango.desde)} – ${fechaLarga(lectura.rango.hasta)}`
            : ''}
        </p>
      </div>

      {lectura.clase === 'cuenta' ? (
        <div className={cuadraTodo ? 'aviso aviso-info' : 'aviso aviso-alta'}>
          <span className="aviso-titulo">
            {cuadraTodo
              ? `El saldo cuadra en las ${lectura.cuadre?.revisadas ?? 0} líneas verificables`
              : 'El saldo no cuadra'}
          </span>
          <span className="aviso-texto">
            {cuadraTodo
              ? 'La suma de los movimientos reproduce el saldo corrido impreso y cierra en el Balance Actual del encabezado.'
              : 'Revisa las líneas marcadas en ámbar antes de confirmar.'}
          </span>
          {lectura.cuadre?.primeraSinVerificar ? (
            <span className="aviso-evidencia">
              La primera línea no se puede comprobar: no hay saldo anterior contra el cual
              contrastarla. Míratela tú.
            </span>
          ) : null}
        </div>
      ) : null}

      {lectura.advertencias.length > 0 ? (
        <div className="aviso aviso-media">
          <span className="aviso-titulo">
            {lectura.advertencias.length === 1 ? 'Una cosa que revisar' : `${lectura.advertencias.length} cosas que revisar`}
          </span>
          <span className="aviso-evidencia">{lectura.advertencias.join('\n')}</span>
        </div>
      ) : null}

      {preparado.repetidos > 0 ? (
        <div className="tarjeta-plana">
          <span className="rotulo">Ya los tenías</span>
          <span className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
            {preparado.repetidos}{' '}
            {preparado.repetidos === 1 ? 'movimiento venía repetido' : 'movimientos venían repetidos'}{' '}
            de un estado anterior. No se van a duplicar.
          </span>
        </div>
      ) : null}

      <div className="bloque">
        {preparado.nuevos.map((t, i) => (
          <Fila
            key={t.id}
            izquierda={
              <span
                className="conf"
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  flex: 'none',
                  background: lineasMalas.has(t.descripcion)
                    ? 'var(--neg)'
                    : i === 0 && lectura.cuadre?.primeraSinVerificar
                      ? 'var(--warn)'
                      : 'var(--pos)',
                }}
              />
            }
            nombre={<span style={{ whiteSpace: 'normal' }}>{t.descripcion}</span>}
            detalle={
              // En revision el detalle envuelve: una etiqueta recortada esconde
              // justo lo que la persona tiene que revisar.
              <span style={{ whiteSpace: 'normal', display: 'inline-flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                {fechaLarga(t.fecha)}
                {' · '}
                <span className={t.esInterno ? 'pildora pildora-azul' : 'pildora'}>
                  {t.esInterno
                    ? preparado.huerfanos.has(t.id)
                      ? 'Traslado · falta el otro lado'
                      : 'Traslado interno'
                    : (POR_ID.get(t.categoriaId ?? 'otros')?.nombre ?? 'Sin clasificar')}
                </span>
              </span>
            }
            derecha={<Monto valor={t.monto} gris={t.esInterno} />}
          />
        ))}
      </div>

      <div className="bloque-apretado" style={{ paddingBottom: 8 }}>
        {preparado.internos > 0 ? (
          <span
            className="fila-detalle"
            style={{ textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.5 }}
          >
            {preparado.internos}{' '}
            {preparado.internos === 1
              ? 'traslado interno excluido del gasto'
              : 'traslados internos excluidos del gasto'}
            {preparado.sinPareja > 0
              ? `. ${preparado.sinPareja === 1 ? 'Uno se reconoció' : `${preparado.sinPareja} se reconocieron`} por la descripción; el otro lado aparecerá cuando subas ese estado.`
              : ''}
          </span>
        ) : null}
        <button
          type="button"
          className="boton"
          onClick={() =>
            onConfirmar({
              nuevos: preparado.nuevos,
              repetidos: preparado.repetidos,
              internos: preparado.internos,
              sinPareja: preparado.sinPareja,
            })
          }
        >
          Confirmar y guardar {pesos(sumaGasto(preparado.nuevos))} de gasto
        </button>
        <button type="button" className="boton boton-suave" onClick={onDescartar}>
          Descartar esta lectura
        </button>
      </div>
    </div>
  )
}

function sumaGasto(txns: Txn[]): number {
  return txns.reduce((a, t) => (!t.esInterno && t.monto < 0 ? a + Math.abs(t.monto) : a), 0)
}
