import { useMemo, useState } from 'react'
import type { Account, Txn } from '../types'
import { Fila, Monto, Vacio } from '../components/Piezas'
import { POR_ID } from '../lib/categories'
import { fechaCorta } from '../lib/dates'

type Filtro = 'gasto' | 'todo' | 'interno'

export function Movimientos({
  cuentas,
  txns,
  onEditar,
}: {
  cuentas: Account[]
  txns: Txn[]
  onEditar?: (t: Txn) => void
}) {
  const [filtro, setFiltro] = useState<Filtro>('gasto')
  const [busqueda, setBusqueda] = useState('')

  const nombreCuenta = useMemo(
    () => new Map(cuentas.map((c) => [c.id, c.nombre])),
    [cuentas],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return txns.filter((t) => {
      if (filtro === 'gasto' && (t.esInterno || t.monto > 0)) return false
      if (filtro === 'interno' && !t.esInterno) return false
      if (!q) return true
      return (
        t.descripcion.toLowerCase().includes(q) ||
        Math.abs(t.monto).toFixed(2).includes(q) ||
        t.fecha.includes(q)
      )
    })
  }, [txns, filtro, busqueda])

  const porFecha = useMemo(() => {
    const m = new Map<string, Txn[]>()
    for (const t of visibles) {
      const g = m.get(t.fecha)
      if (g) g.push(t)
      else m.set(t.fecha, [t])
    }
    return [...m.entries()]
  }, [visibles])

  return (
    <div className="vista">
      <h1 className="titulo-grande">Movimientos</h1>

      <input
        id="busqueda-movimientos"
        className="tarjeta-plana"
        style={{
          border: 0,
          font: 'inherit',
          fontSize: 15,
          color: 'var(--ink)',
          padding: '13px 16px',
        }}
        type="search"
        placeholder="Buscar comercio, monto o fecha"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([
          ['gasto', 'Solo gasto real'],
          ['todo', 'Todo'],
          ['interno', 'Traslados'],
        ] as Array<[Filtro, string]>).map(([id, texto]) => (
          <button
            key={id}
            type="button"
            className={filtro === id ? 'pildora pildora-azul' : 'pildora'}
            onClick={() => setFiltro(id)}
          >
            {texto}
          </button>
        ))}
      </div>

      {porFecha.length === 0 ? (
        <Vacio
          titulo="Nada que mostrar"
          texto="Ajusta la búsqueda o cambia el filtro para ver otros movimientos."
        />
      ) : (
        porFecha.map(([fecha, lista]) => (
          <div key={fecha} className="bloque">
            <span className="rotulo">{fechaCorta(fecha)}</span>
            {lista.map((t) => (
              <Fila
                key={t.id}
                nombre={t.descripcion}
                detalle={
                  <>
                    {POR_ID.get(t.categoriaId ?? 'otros')?.nombre ?? 'Sin clasificar'}
                    {' · '}
                    {nombreCuenta.get(t.accountId)}
                  </>
                }
                derecha={<Monto valor={t.monto} gris={t.esInterno} />}
                onClick={onEditar ? () => onEditar(t) : undefined}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}
