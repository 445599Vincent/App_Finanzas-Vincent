import { useCallback, useState } from 'react'
import type { Account, CardCycle, Txn } from './types'
import { Resumen } from './screens/Resumen'
import { Movimientos } from './screens/Movimientos'
import { Estados, type EstadoGuardado, type FaseLectura } from './screens/Estados'
import { Criterio } from './screens/Criterio'
import { Revision, type Revisado } from './screens/Revision'
import { IconoResumen, IconoMovimientos, IconoEstados, IconoCriterio } from './components/Iconos'
import { hayBackend } from './lib/supabase'
import { leerEstado } from './lib/leer'
import { normalizarEstado, type EstadoNormalizado } from './lib/normalizar'
import { CUENTAS_DEMO, CICLOS_DEMO, TXNS_DEMO, SALDOS_DEMO, HOY_DEMO } from './data/demo'

type Pestana = 'resumen' | 'movimientos' | 'estados' | 'criterio'

const PESTANAS: Array<[Pestana, string, () => JSX.Element]> = [
  ['resumen', 'Resumen', IconoResumen],
  ['movimientos', 'Movimientos', IconoMovimientos],
  ['estados', 'Estados', IconoEstados],
  ['criterio', 'Criterio', IconoCriterio],
]

const PRESUPUESTOS_DEMO = { restaurantes: 8000, combustible: 9000 }

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('resumen')

  const [cuentas, setCuentas] = useState<Account[]>(CUENTAS_DEMO)
  const [txns, setTxns] = useState<Txn[]>(TXNS_DEMO)
  const [ciclos, setCiclos] = useState<CardCycle[]>(CICLOS_DEMO)
  const [estados, setEstados] = useState<EstadoGuardado[]>([])

  const [fase, setFase] = useState<FaseLectura>({ tipo: 'listo' })
  const [lectura, setLectura] = useState<EstadoNormalizado | null>(null)
  const [archivoLeido, setArchivoLeido] = useState<string>('')

  const alElegirArchivo = useCallback(
    async (archivo: File) => {
      setFase({ tipo: 'leyendo', archivo: archivo.name })
      setArchivoLeido(archivo.name)
      try {
        const { estado } = await leerEstado(archivo)

        // Emparejar con una cuenta ya conocida, o crearla al vuelo.
        const cuenta = resolverCuenta(cuentas, estado.ultimos4, estado.clase, estado.tipoCuenta)
        if (!cuentas.some((c) => c.id === cuenta.id)) {
          setCuentas((previas) => [...previas, cuenta])
        }

        const normalizado = normalizarEstado(estado, { accountId: cuenta.id })
        setLectura(normalizado)
        setFase({ tipo: 'listo' })
      } catch (e) {
        setFase({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' })
      }
    },
    [cuentas],
  )

  const confirmar = useCallback(
    (r: Revisado) => {
      if (!lectura) return

      setTxns((previos) => [...r.nuevos, ...previos].sort((a, b) => b.fecha.localeCompare(a.fecha)))

      if (lectura.ciclo) {
        const ciclo = lectura.ciclo
        setCiclos((previos) => [...previos.filter((c) => c.id !== ciclo.id), ciclo])
      }

      setEstados((previos) => [
        {
          id: `${Date.now()}`,
          nombreArchivo: archivoLeido,
          cuenta: `${lectura.tipoCuenta} ••••${lectura.ultimos4}`,
          clase: lectura.clase,
          desde: lectura.rango?.desde,
          hasta: lectura.rango?.hasta,
          subidoEn: new Date().toISOString().slice(0, 10),
          movimientos: r.nuevos.length,
          cuadre:
            lectura.clase === 'tarjeta'
              ? 'sin_verificar'
              : lectura.cuadre?.ok
                ? 'ok'
                : 'con_descuadres',
        },
        ...previos,
      ])

      setLectura(null)
      setPestana('movimientos')
    },
    [lectura, archivoLeido],
  )

  // Mientras haya una lectura sin confirmar, ocupa la pantalla entera:
  // nada entra a tus números sin que pases por ahí.
  if (lectura) {
    return (
      <div className="app">
        <Revision
          lectura={lectura}
          cuentas={cuentas}
          existentes={txns}
          onConfirmar={confirmar}
          onDescartar={() => setLectura(null)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      {!hayBackend ? (
        <div className="cinta-demo">
          Modo demostración · datos de ejemplo hasta que conectes Supabase
        </div>
      ) : null}

      {pestana === 'resumen' ? (
        <Resumen
          cuentas={cuentas}
          saldos={SALDOS_DEMO}
          txns={txns}
          ciclos={ciclos}
          hoy={HOY_DEMO}
          onVerCuenta={() => setPestana('movimientos')}
        />
      ) : null}

      {pestana === 'movimientos' ? <Movimientos cuentas={cuentas} txns={txns} /> : null}

      {pestana === 'estados' ? (
        <Estados estados={estados} fase={fase} onElegirArchivo={alElegirArchivo} />
      ) : null}

      {pestana === 'criterio' ? (
        <Criterio
          cuentas={cuentas}
          txns={txns}
          ciclos={ciclos}
          hoy={HOY_DEMO}
          presupuestos={PRESUPUESTOS_DEMO}
        />
      ) : null}

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

  return {
    id: `${tipo}-${ultimos4}`,
    nombre: tipoCuenta,
    banco: 'Banco Popular',
    tipo,
    ultimos4,
    moneda: 'DOP',
  }
}
