import { useState } from 'react'
import type { Txn } from '../types'
import { CATEGORIAS, POR_ID } from '../lib/categories'
import { pesos } from '../lib/money'
import { fechaLarga } from '../lib/dates'

/**
 * Corregir la categoria de un movimiento.
 *
 * La casilla de "aplicar a todo este comercio" esta marcada por defecto porque
 * es lo que casi siempre se quiere: si te tomaste el trabajo de corregir algo,
 * lo normal es que valga para todas las veces, no solo para esta.
 */
export function EditorCategoria({
  txn,
  onGuardar,
  onCerrar,
}: {
  txn: Txn
  onGuardar: (categoriaId: string, crearRegla: boolean) => void
  onCerrar: () => void
}) {
  const [elegida, setElegida] = useState(txn.categoriaId ?? 'otros')
  const [conRegla, setConRegla] = useState(true)

  return (
    <div className="hoja" role="dialog" aria-label="Cambiar categoría">
      <div className="hoja-panel">
        <div className="hoja-cab">
          <span className="fila-nombre" style={{ whiteSpace: 'normal' }}>
            {txn.descripcion}
          </span>
          <span className="fila-detalle">
            {fechaLarga(txn.fecha)} · {pesos(txn.monto)}
          </span>
        </div>

        <div className="hoja-lista">
          {CATEGORIAS.filter((c) => c.grupo !== 'Interno').map((c) => (
            <button
              key={c.id}
              type="button"
              className={elegida === c.id ? 'opcion opcion-elegida' : 'opcion'}
              onClick={() => setElegida(c.id)}
            >
              <span>{c.nombre}</span>
              <span className="opcion-grupo">{c.grupo}</span>
            </button>
          ))}
        </div>

        <div className="hoja-pie">
          <label className="casilla" htmlFor="aplicar-a-todos">
            <input
              id="aplicar-a-todos"
              type="checkbox"
              checked={conRegla}
              onChange={(e) => setConRegla(e.target.checked)}
            />
            <span>
              Aplicar a todos los movimientos de este comercio, incluidos los que ya
              tenías guardados
            </span>
          </label>
          <button type="button" className="boton" onClick={() => onGuardar(elegida, conRegla)}>
            Guardar como {POR_ID.get(elegida)?.nombre ?? 'categoría'}
          </button>
          <button type="button" className="boton boton-suave" onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
