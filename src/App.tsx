import { useState } from 'react'
import { Resumen } from './screens/Resumen'
import { Movimientos } from './screens/Movimientos'
import { Estados, type EstadoGuardado } from './screens/Estados'
import { Criterio } from './screens/Criterio'
import { IconoResumen, IconoMovimientos, IconoEstados, IconoCriterio } from './components/Iconos'
import { hayBackend } from './lib/supabase'
import { CUENTAS_DEMO, CICLOS_DEMO, TXNS_DEMO, SALDOS_DEMO, HOY_DEMO } from './data/demo'

type Pestana = 'resumen' | 'movimientos' | 'estados' | 'criterio'

const PESTANAS: Array<[Pestana, string, () => JSX.Element]> = [
  ['resumen', 'Resumen', IconoResumen],
  ['movimientos', 'Movimientos', IconoMovimientos],
  ['estados', 'Estados', IconoEstados],
  ['criterio', 'Criterio', IconoCriterio],
]

/** Presupuestos de ejemplo, para que la alerta correspondiente tenga contra qué comparar. */
const PRESUPUESTOS_DEMO = { restaurantes: 8000, combustible: 9000 }

const ESTADOS_DEMO: EstadoGuardado[] = [
  {
    id: 'e1',
    nombreArchivo: 'Estado de Cuenta ••••6220.pdf',
    cuenta: 'Corriente operativa',
    clase: 'cuenta',
    desde: '2026-05-24',
    hasta: '2026-08-21',
    subidoEn: '2026-08-23',
    paginas: 3,
    cuadre: 'ok',
  },
  {
    id: 'e2',
    nombreArchivo: 'Estado de Cuenta ••••3461.pdf',
    cuenta: 'Corriente principal',
    clase: 'cuenta',
    desde: '2026-05-24',
    hasta: '2026-08-18',
    subidoEn: '2026-08-23',
    paginas: 2,
    cuadre: 'ok',
  },
  {
    id: 'e3',
    nombreArchivo: 'Tarjeta ••••3208 · corte 10/08.pdf',
    cuenta: 'Tarjeta de crédito',
    clase: 'tarjeta',
    desde: '2026-07-10',
    hasta: '2026-08-10',
    subidoEn: '2026-08-23',
    paginas: 2,
    cuadre: 'ok',
  },
]

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('resumen')

  // Fase 1: la app corre con datos de demostración. La fase 2 los reemplaza
  // por lo que salga de Supabase, sin tocar ninguna de las pantallas.
  const cuentas = CUENTAS_DEMO
  const txns = TXNS_DEMO
  const ciclos = CICLOS_DEMO
  const saldos = SALDOS_DEMO
  const hoy = HOY_DEMO

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
          saldos={saldos}
          txns={txns}
          ciclos={ciclos}
          hoy={hoy}
          onVerCuenta={() => setPestana('movimientos')}
        />
      ) : null}

      {pestana === 'movimientos' ? <Movimientos cuentas={cuentas} txns={txns} /> : null}

      {pestana === 'estados' ? <Estados estados={ESTADOS_DEMO} /> : null}

      {pestana === 'criterio' ? (
        <Criterio
          cuentas={cuentas}
          txns={txns}
          ciclos={ciclos}
          hoy={hoy}
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
