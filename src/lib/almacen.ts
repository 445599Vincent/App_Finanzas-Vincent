import type { Account, CardCycle, CardSnapshot, Txn } from '../types'
import type { Regla } from './categories'
import { claveComercio } from './recurring'

/**
 * Donde viven tus datos.
 *
 * Una sola interfaz con dos implementaciones detras: el telefono y Supabase.
 * Las pantallas no saben cual esta activa, asi que conectar Supabase mas
 * adelante no obliga a tocar ni una linea de interfaz.
 */

export interface EstadoArchivado {
  id: string
  nombreArchivo: string
  cuentaId: string
  cuenta: string
  clase: 'cuenta' | 'tarjeta'
  desde?: string
  hasta?: string
  subidoEn: string
  movimientos: number
  cuadre: 'ok' | 'con_descuadres' | 'sin_verificar'
  /** Huella del PDF: impide subir dos veces el mismo archivo. */
  hash?: string
}

export interface Datos {
  cuentas: Account[]
  txns: Txn[]
  ciclos: CardCycle[]
  snapshots: CardSnapshot[]
  reglas: Regla[]
  estados: EstadoArchivado[]
  /** Saldo que declara el encabezado del ultimo estado de cada cuenta. */
  saldos: Record<string, number>
}

export const DATOS_VACIOS: Datos = {
  cuentas: [],
  txns: [],
  ciclos: [],
  snapshots: [],
  reglas: [],
  estados: [],
  saldos: {},
}

export interface LecturaGuardable {
  cuenta: Account
  txns: Txn[]
  ciclo: CardCycle | null
  snapshot: CardSnapshot | null
  estado: EstadoArchivado
  saldoFinal: number | null
}

export interface Almacen {
  readonly nombre: 'telefono' | 'supabase'
  cargar(): Promise<Datos>
  guardarLectura(l: LecturaGuardable): Promise<void>
  cambiarCategoria(txnId: string, categoriaId: string, regla: Regla | null): Promise<void>
  /** Para empezar de cero sin tener que borrar el navegador a mano. */
  borrarTodo(): Promise<void>
}

// --------------------------------------------------------------- en el telefono

const CLAVE = 'quickview.datos.v1'

/**
 * Guarda en el navegador. No sale nada del telefono, pero tampoco hay respaldo
 * ni multi-dispositivo: por eso existe la implementacion de Supabase.
 *
 * localStorage puede fallar o venir vacio (ventana privada, datos borrados,
 * cuota llena), asi que toda lectura y escritura va envuelta.
 */
export class AlmacenTelefono implements Almacen {
  readonly nombre = 'telefono' as const

  async cargar(): Promise<Datos> {
    try {
      const crudo = localStorage.getItem(CLAVE)
      if (!crudo) return { ...DATOS_VACIOS }
      return { ...DATOS_VACIOS, ...(JSON.parse(crudo) as Partial<Datos>) }
    } catch {
      return { ...DATOS_VACIOS }
    }
  }

  private async escribir(datos: Datos): Promise<void> {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(datos))
    } catch {
      // Sin espacio o sin permiso: la app sigue funcionando en memoria.
      // Peor seria perder la sesion entera por no poder guardar.
    }
  }

  async guardarLectura(l: LecturaGuardable): Promise<void> {
    const datos = await this.cargar()
    await this.escribir(fusionarLectura(datos, l))
  }

  async cambiarCategoria(txnId: string, categoriaId: string, regla: Regla | null): Promise<void> {
    const datos = await this.cargar()
    await this.escribir(aplicarCategoria(datos, txnId, categoriaId, regla))
  }

  async borrarTodo(): Promise<void> {
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      /* nada que borrar */
    }
  }
}

// ------------------------------------------------- logica compartida, sin estado

/** Suma una lectura confirmada a lo que ya habia, sin duplicar nada. */
export function fusionarLectura(datos: Datos, l: LecturaGuardable): Datos {
  const cuentas = datos.cuentas.some((c) => c.id === l.cuenta.id)
    ? datos.cuentas
    : [...datos.cuentas, l.cuenta]

  const huellas = new Set(datos.txns.map((t) => t.huella))
  const nuevos = l.txns.filter((t) => !huellas.has(t.huella))

  const ciclos = l.ciclo
    ? [...datos.ciclos.filter((c) => c.id !== l.ciclo!.id), l.ciclo]
    : datos.ciclos

  const snapshots = l.snapshot
    ? [...datos.snapshots.filter((s) => s.accountId !== l.snapshot!.accountId), l.snapshot]
    : datos.snapshots

  return {
    ...datos,
    cuentas,
    txns: [...nuevos, ...datos.txns].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    ciclos,
    snapshots,
    estados: [l.estado, ...datos.estados.filter((e) => e.id !== l.estado.id)],
    saldos:
      l.saldoFinal === null
        ? datos.saldos
        : { ...datos.saldos, [l.cuenta.id]: l.saldoFinal },
  }
}

/**
 * Cambia la categoria de un movimiento y, si viene una regla, la aplica
 * ademas a todo lo demas del mismo comercio: corregir una vez tiene que
 * arreglar el pasado, no solo el futuro.
 */
export function aplicarCategoria(
  datos: Datos,
  txnId: string,
  categoriaId: string,
  regla: Regla | null,
): Datos {
  const reglas = regla
    ? [...datos.reglas.filter((r) => r.patron !== regla.patron), regla]
    : datos.reglas

  const txns = datos.txns.map((t) => {
    if (t.id === txnId) return { ...t, categoriaId }
    if (regla && !t.esInterno && coincide(t.descripcion, regla.patron)) {
      return { ...t, categoriaId }
    }
    return t
  })

  return { ...datos, reglas, txns }
}

function coincide(descripcion: string, patron: string): boolean {
  return claveComercio(descripcion) === patron
}
