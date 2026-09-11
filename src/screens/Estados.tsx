import { useRef } from 'react'
import { Vacio } from '../components/Piezas'
import { IconoSubir } from '../components/Iconos'
import { fechaLarga } from '../lib/dates'

export interface EstadoGuardado {
  id: string
  nombreArchivo: string
  cuenta: string
  clase: 'cuenta' | 'tarjeta'
  desde?: string
  hasta?: string
  subidoEn: string
  movimientos: number
  cuadre: 'ok' | 'con_descuadres' | 'sin_verificar'
}

export type FaseLectura =
  | { tipo: 'listo' }
  | { tipo: 'leyendo'; archivo: string }
  | { tipo: 'error'; mensaje: string }

export function Estados({
  estados,
  fase,
  onElegirArchivo,
}: {
  estados: EstadoGuardado[]
  fase: FaseLectura
  onElegirArchivo: (archivo: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const leyendo = fase.tipo === 'leyendo'

  return (
    <div className="vista">
      <div>
        <p className="epigrafe">Tus PDF originales, siempre descargables</p>
        <h1 className="titulo-grande">Estados</h1>
      </div>

      <input
        ref={input}
        id="archivo-estado"
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) onElegirArchivo(archivo)
          e.target.value = ''
        }}
      />

      <button
        type="button"
        className="boton"
        disabled={leyendo}
        onClick={() => input.current?.click()}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <IconoSubir />
          {leyendo ? 'Leyendo…' : 'Subir un estado'}
        </span>
      </button>

      {leyendo ? (
        <div className="tarjeta">
          <span className="fila-nombre">{fase.archivo}</span>
          <div className="progress" style={{ height: 4, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
            <i
              style={{
                display: 'block',
                height: '100%',
                width: '45%',
                background: 'var(--accent)',
                borderRadius: 99,
              }}
            />
          </div>
          <span className="fila-detalle" style={{ whiteSpace: 'normal', lineHeight: 1.5 }}>
            Tus PDF son imágenes, sin capa de texto, así que hay que leerlos página por página.
            Tarda entre medio minuto y dos minutos.
          </span>
        </div>
      ) : null}

      {fase.tipo === 'error' ? (
        <div className="aviso aviso-alta">
          <span className="aviso-titulo">No se pudo leer</span>
          <span className="aviso-texto">{fase.mensaje}</span>
        </div>
      ) : null}

      {estados.length === 0 ? (
        <Vacio
          titulo="Todavía no has subido ningún estado"
          texto="Exporta el rango que quieras desde Popularenlínea, imprímelo a PDF y súbelo aquí. El archivo original se guarda completo."
        />
      ) : (
        <div className="bloque">
          {estados.map((e) => (
            <div key={e.id} className="tarjeta">
              <div className="fila">
                <span className="fila-crece">
                  <span className="fila-nombre">{e.nombreArchivo}</span>
                  <span className="fila-detalle">
                    {e.cuenta} · {e.movimientos}{' '}
                    {e.movimientos === 1 ? 'movimiento' : 'movimientos'}
                  </span>
                </span>
                <span
                  className={e.cuadre === 'ok' ? 'pildora pildora-azul' : 'pildora pildora-ambar'}
                >
                  {e.cuadre === 'ok' ? 'Cuadra' : e.cuadre === 'con_descuadres' ? 'Revisar' : 'Sin verificar'}
                </span>
              </div>
              {e.desde && e.hasta ? (
                <span className="fila-detalle">
                  {fechaLarga(e.desde)} – {fechaLarga(e.hasta)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
