import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, Txn } from './types'
import { Resumen } from './screens/Resumen'
import { Movimientos } from './screens/Movimientos'
import { Estados, type FaseLectura } from './screens/Estados'
import { Criterio } from './screens/Criterio'
import { Revision, type Revisado } from './screens/Revision'
import { Cuenta } from './screens/Cuenta'
import { Reporte } from './screens/Reporte'
import { EditorCategoria } from './components/EditorCategoria'
import { IconoResumen, IconoMovimientos, IconoEstados, IconoCriterio } from './components/Iconos'
import { leerEstado, hashDe } from './lib/leer'
import { subirEstado, enlaceDeDescarga, hayBackend, supabase } from './lib/supabase'
import { normalizarEstado, type EstadoNormalizado } from './lib/normalizar'
import { reglaDesde } from './lib/categories'
import { emparejarTraslados } from './lib/transfers'
import { crearAlmacen, type Almacen } from './lib/crearAlmacen'
import { DATOS_VACIOS, type Datos, type EstadoArchivado } from './lib/almacen'
import { CUENTAS_DEMO, CICLOS_DEMO, TXNS_DEMO, SALDOS_DEMO, HOY_DEMO } from './data/demo'

type Pestana = 'resumen' | 'movimientos' | 'estados' | 'criterio'

const PESTANAS: Array<[Pestana, string, () => JSX.Element]> = [
  ['resumen', 'Resumen', IconoResumen],
  ['movimientos', 'Movimientos', IconoMovimientos],
  ['estados', 'Estados', IconoEstados],
  ['criterio', 'Criterio', IconoCriterio],
]

const PRESUPUESTOS_DEMO = { restaurantes: 8000, combustible: 9000 }

/** Los datos de ejemplo solo se muestran mientras no hayas guardado nada tuyo. */
const DEMO: Datos = {
  ...DATOS_VACIOS,
  cuentas: CUENTAS_DEMO,
  txns: TXNS_DEMO,
  ciclos: CICLOS_DEMO,
  saldos: SALDOS_DEMO,
}

export default function App() {
  const [almacen] = useState<Almacen>(() => crearAlmacen())
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS)
  const [cargando, setCargando] = useState(true)

  const [pestana, setPestana] = useState<Pestana>('resumen')
  const [cuentaAbierta, setCuentaAbierta] = useState<string | null>(null)
  const [verReporte, setVerReporte] = useState(false)
  const [editando, setEditando] = useState<Txn | null>(null)

  const [fase, setFase] = useState<FaseLectura>({ tipo: 'listo' })
  const [lectura, setLectura] = useState<EstadoNormalizado | null>(null)
  // El File se conserva para poder subir el PDF original al confirmar: el
  // archivo se guarda entero, no solo lo que la IA saco de el.
  const [archivoLeido, setArchivoLeido] = useState<{ nombre: string; hash: string; archivo: File | null }>({
    nombre: '',
    hash: '',
    archivo: null,
  })

  useEffect(() => {
    let vivo = true
    void almacen
      .cargar()
      .then((d) => {
        if (vivo) setDatos(d)
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [almacen])

  // Mientras no hayas guardado nada tuyo, la app se muestra con datos de
  // ejemplo: una pantalla vacía no enseña lo que hace.
  const esDemo = datos.txns.length === 0
  const vista = esDemo ? DEMO : datos
  const hoy = esDemo ? HOY_DEMO : new Date().toISOString().slice(0, 10)

  const alElegirArchivo = useCallback(
    async (archivo: File) => {
      setFase({ tipo: 'leyendo', archivo: archivo.name })
      try {
        const hash = await hashDe(archivo)
        if (datos.estados.some((e) => e.hash === hash)) {
          setFase({ tipo: 'error', mensaje: 'Ese PDF exacto ya lo habías subido.' })
          return
        }
        setArchivoLeido({ nombre: archivo.name, hash, archivo })

        const { estado } = await leerEstado(archivo)
        const cuenta = resolverCuenta(datos.cuentas, estado.ultimos4, estado.clase, estado.tipoCuenta)
        setLectura(normalizarEstado(estado, { accountId: cuenta.id, hoy }))
        setFase({ tipo: 'listo' })
      } catch (e) {
        setFase({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' })
      }
    },
    [datos.cuentas, datos.estados, hoy],
  )

  const confirmar = useCallback(
    async (r: Revisado) => {
      if (!lectura) return
      const cuenta = resolverCuenta(datos.cuentas, lectura.ultimos4, lectura.clase, lectura.tipoCuenta)

      // El PDF original se guarda tal cual llegó, para que puedas volver a
      // bajarlo. Sin Supabase no hay dónde: el navegador no aguanta guardar
      // archivos de medio mega por estado.
      let archivoPath: string | undefined
      if (hayBackend && supabase && archivoLeido.archivo) {
        try {
          const { data } = await supabase.auth.getUser()
          if (data.user) {
            archivoPath = await subirEstado(data.user.id, archivoLeido.archivo, archivoLeido.hash)
          }
        } catch {
          // Que falle la copia del PDF no puede costarte los movimientos ya
          // leídos: se guardan igual y el original queda sin subir.
        }
      }

      const archivado: EstadoArchivado = {
        id: archivoLeido.hash || `${Date.now()}`,
        nombreArchivo: archivoLeido.nombre,
        cuentaId: cuenta.id,
        cuenta: `${lectura.tipoCuenta} ••••${lectura.ultimos4}`,
        clase: lectura.clase,
        desde: lectura.rango?.desde,
        hasta: lectura.rango?.hasta,
        subidoEn: new Date().toISOString().slice(0, 10),
        movimientos: r.nuevos.length,
        cuadre:
          lectura.clase === 'tarjeta' ? 'sin_verificar' : lectura.cuadre?.ok ? 'ok' : 'con_descuadres',
        hash: archivoLeido.hash,
        archivoPath,
      }

      await almacen.guardarLectura({
        cuenta,
        txns: r.nuevos,
        ciclo: lectura.ciclo,
        snapshot: lectura.snapshot,
        estado: archivado,
        saldoFinal: lectura.cuadre?.saldoFinal ?? lectura.snapshot?.balanceALaFecha ?? null,
      })

      setDatos(await almacen.cargar())
      setLectura(null)
      setPestana('movimientos')
    },
    [lectura, datos.cuentas, archivoLeido, almacen],
  )

  const guardarCategoria = useCallback(
    async (categoriaId: string, crearRegla: boolean) => {
      if (!editando) return
      const regla = crearRegla ? reglaDesde(editando.descripcion, categoriaId) : null
      await almacen.cambiarCategoria(editando.id, categoriaId, regla)
      setDatos(await almacen.cargar())
      setEditando(null)
    },
    [editando, almacen],
  )

  const descargarOriginal = useCallback(async (e: { archivoPath?: string }) => {
    if (!e.archivoPath) return
    try {
      window.open(await enlaceDeDescarga(e.archivoPath, 120), '_blank')
    } catch {
      /* el enlace caduca o el archivo ya no está */
    }
  }, [])

  // Los traslados se reevalúan contra TODO lo guardado: el otro lado de un
  // pago puede llegar en un estado que subas meses después.
  const conInternos = useMemo(() => {
    const { internos } = emparejarTraslados(vista.txns, vista.cuentas)
    if (internos.size === 0) return vista.txns
    return vista.txns.map((t) => (internos.has(t.id) ? { ...t, esInterno: true } : t))
  }, [vista.txns, vista.cuentas])

  if (cargando) {
    return (
      <div className="app">
        <div className="vista">
          <span className="epigrafe">Cargando tus datos…</span>
        </div>
      </div>
    )
  }

  if (lectura) {
    return (
      <div className="app">
        <Revision
          lectura={lectura}
          cuentas={vista.cuentas}
          existentes={conInternos}
          onConfirmar={(r) => void confirmar(r)}
          onDescartar={() => setLectura(null)}
        />
      </div>
    )
  }

  if (verReporte) {
    return (
      <div className="app">
        <Reporte
          txns={conInternos}
          cuentas={vista.cuentas}
          hoy={hoy}
          onVolver={() => setVerReporte(false)}
        />
      </div>
    )
  }

  const abierta = vista.cuentas.find((c) => c.id === cuentaAbierta) ?? null

  return (
    <div className="app">
      {esDemo ? (
        <div className="cinta-demo">
          Datos de ejemplo · desaparecen cuando subas tu primer estado
        </div>
      ) : null}

      {abierta ? (
        <Cuenta
          cuenta={abierta}
          saldo={vista.saldos[abierta.id]}
          txns={conInternos}
          ciclos={vista.ciclos}
          snapshot={vista.snapshots.find((s) => s.accountId === abierta.id) ?? null}
          hoy={hoy}
          onVolver={() => setCuentaAbierta(null)}
        />
      ) : (
        <>
          {pestana === 'resumen' ? (
            <Resumen
              cuentas={vista.cuentas}
              saldos={vista.saldos}
              txns={conInternos}
              ciclos={vista.ciclos}
              hoy={hoy}
              onVerCuenta={setCuentaAbierta}
              onVerReporte={() => setVerReporte(true)}
            />
          ) : null}

          {pestana === 'movimientos' ? (
            <Movimientos
              cuentas={vista.cuentas}
              txns={conInternos}
              onEditar={esDemo ? undefined : setEditando}
            />
          ) : null}

          {pestana === 'estados' ? (
            <Estados
              estados={vista.estados}
              fase={fase}
              onElegirArchivo={(a) => void alElegirArchivo(a)}
              onDescargarOriginal={(e) => void descargarOriginal(e)}
            />
          ) : null}

          {pestana === 'criterio' ? (
            <Criterio
              cuentas={vista.cuentas}
              txns={conInternos}
              ciclos={vista.ciclos}
              hoy={hoy}
              presupuestos={esDemo ? PRESUPUESTOS_DEMO : undefined}
            />
          ) : null}
        </>
      )}

      {editando ? (
        <EditorCategoria
          txn={editando}
          onGuardar={(c, r) => void guardarCategoria(c, r)}
          onCerrar={() => setEditando(null)}
        />
      ) : null}

      {!abierta ? (
        <nav className="pestanas" aria-label="Secciones">
          {PESTANAS.map(([id, texto, Icono]) => (
            <button
              key={id}
              type="button"
              className={pestana === id ? 'pestana pestana-activa' : 'pestana'}
              aria-current={pestana === id ? 'page' : undefined}
              onClick={() => setPestana(id)}
            >
              <Icono />
              {texto}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

/** Busca la cuenta por sus últimos cuatro dígitos; si no existe, la crea. */
function resolverCuenta(
  cuentas: Account[],
  ultimos4: string,
  clase: 'cuenta' | 'tarjeta',
  tipoCuenta: string,
): Account {
  const tipo = clase === 'tarjeta' ? 'tarjeta' : 'corriente'
  const existente = cuentas.find((c) => c.ultimos4 === ultimos4 && c.tipo === tipo)
  if (existente) return existente
  return { id: `${tipo}-${ultimos4}`, nombre: tipoCuenta, banco: 'Banco Popular', tipo, ultimos4, moneda: 'DOP' }
}
