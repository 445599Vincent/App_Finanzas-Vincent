import { useRef, useState } from 'react'
import { Vacio } from '../components/Piezas'
import { IconoSubir } from '../components/Iconos'
import { hayBackend } from '../lib/supabase'
import { fechaLarga } from '../lib/dates'

export interface EstadoGuardado {
  id: string
  nombreArchivo: string
  cuenta: string
  clase: 'cuenta' | 'tarjeta'
  desde?: string
  hasta?: string
  subidoEn: string
  paginas: number
  cuadre: 'ok' | 'con_descuadres' | 'sin_verificar'
}

/**
 * Archivo de estados.
 *
 * En esta fase el PDF se guarda y se puede volver a descargar. La lectura por
 * vision llega en la fase 2: los PDFs del Popular son imagenes puras, sin capa
 * de texto, asi que no hay nada que parsear localmente.
 */
export function Estados({ estados }: { estados: EstadoGuardado[] }) {
  const input = useRef<HTMLInputElement>(null)
  const [pendiente, setPendiente] = useState<string | null>(null)

  function alElegir(archivo: File | undefined) {
    if (!archivo) return
    setPendiente(archivo.name)
  }

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
        onChange={(e) => alElegir(e.target.files?.[0])}
      />

      <button type="button" className="boton" onClick={() => input.current?.click()}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
          <IconoSubir />
          Subir un estado
        </span>
      </button>

      {pendiente ? (
        <div className="aviso aviso-media">
          <span className="aviso-titulo">{pendiente}</span>
          <span className="aviso-texto">
            {hayBackend
              ? 'Listo para subir. La lectura automática llega en la fase 2.'
              : 'Conecta Supabase para poder guardarlo. Mientras tanto, QuickView corre en modo demostración.'}
          </span>
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
                    {e.cuenta} · {e.paginas} {e.paginas === 1 ? 'página' : 'páginas'}
                  </span>
                </span>
                <span className={e.cuadre === 'ok' ? 'pildora pildora-azul' : 'pildora pildora-ambar'}>
                  {e.cuadre === 'ok' ? 'Cuadra' : e.cuadre === 'con_descuadres' ? 'Revisar' : 'Sin leer'}
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
