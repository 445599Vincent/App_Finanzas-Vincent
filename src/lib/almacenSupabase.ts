import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account, CardCycle, CardSnapshot, Txn } from '../types'
import type { Regla } from './categories'
import {
  DATOS_VACIOS,
  type Almacen,
  type Datos,
  type EstadoArchivado,
  type LecturaGuardable,
} from './almacen'

/**
 * La misma interfaz, contra Postgres.
 *
 * Cada fila lleva user_id y las politicas de Row Level Security del esquema
 * impiden que nadie lea ni escriba lo ajeno, ni siquiera con la llave publica.
 */
export class AlmacenSupabase implements Almacen {
  readonly nombre = 'supabase' as const

  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async cargar(): Promise<Datos> {
    const [cuentas, txns, ciclos, snapshots, reglas, estados] = await Promise.all([
      this.db.from('accounts').select('*'),
      this.db.from('transactions').select('*').order('fecha', { ascending: false }),
      this.db.from('card_cycles').select('*'),
      this.db.from('card_snapshots').select('*'),
      this.db.from('rules').select('*'),
      this.db.from('statements').select('*').order('subido_en', { ascending: false }),
    ])

    const primerError = [cuentas, txns, ciclos, snapshots, reglas, estados].find((r) => r.error)
    if (primerError?.error) throw primerError.error

    const saldos: Record<string, number> = {}
    for (const e of (estados.data ?? []) as Array<Record<string, unknown>>) {
      // El estado mas reciente de cada cuenta manda, y vienen ordenados.
      const id = String(e.account_id)
      if (!(id in saldos) && e.saldo_final !== null) saldos[id] = Number(e.saldo_final)
    }

    return {
      ...DATOS_VACIOS,
      cuentas: (cuentas.data ?? []).map(aCuenta),
      txns: (txns.data ?? []).map(aTxn),
      ciclos: (ciclos.data ?? []).map(aCiclo),
      snapshots: (snapshots.data ?? []).map(aSnapshot),
      reglas: (reglas.data ?? []).map(aRegla),
      estados: (estados.data ?? []).map(aEstado),
      saldos,
    }
  }

  async guardarLectura(l: LecturaGuardable): Promise<void> {
    const u = this.userId

    const { error: eCuenta } = await this.db.from('accounts').upsert(
      {
        id: l.cuenta.id,
        user_id: u,
        nombre: l.cuenta.nombre,
        banco: l.cuenta.banco,
        tipo: l.cuenta.tipo,
        ultimos4: l.cuenta.ultimos4,
        moneda: l.cuenta.moneda,
        limite: l.cuenta.limite ?? null,
      },
      { onConflict: 'id' },
    )
    if (eCuenta) throw eCuenta

    const { error: eEstado } = await this.db.from('statements').upsert(
      {
        id: l.estado.id,
        user_id: u,
        account_id: l.cuenta.id,
        clase: l.estado.clase,
        rango_desde: l.estado.desde ?? null,
        rango_hasta: l.estado.hasta ?? null,
        archivo_path: l.estado.nombreArchivo,
        saldo_final: l.saldoFinal,
        hash_archivo: l.estado.hash ?? l.estado.id,
        cuadre: l.estado.cuadre,
      },
      { onConflict: 'id' },
    )
    if (eEstado) throw eEstado

    if (l.txns.length > 0) {
      // La restriccion unique(user_id, huella) es la que impide de verdad que
      // un movimiento entre dos veces, aunque subas rangos que se solapen.
      const { error } = await this.db.from('transactions').upsert(
        l.txns.map((t) => ({
          user_id: u,
          account_id: t.accountId,
          statement_id: l.estado.id,
          fecha: t.fecha,
          fecha_entrada: t.fechaEntrada ?? null,
          descripcion: t.descripcion,
          monto: t.monto,
          balance: t.balance ?? null,
          referencia: t.referencia ?? null,
          categoria_id: t.categoriaId ?? 'otros',
          es_interno: t.esInterno ?? false,
          confirmado: true,
          huella: t.huella,
        })),
        { onConflict: 'user_id,huella', ignoreDuplicates: true },
      )
      if (error) throw error
    }

    if (l.ciclo) {
      const { error } = await this.db.from('card_cycles').upsert(
        {
          user_id: u,
          account_id: l.ciclo.accountId,
          fecha_corte: l.ciclo.fechaCorte,
          balance_corte: l.ciclo.balanceCorte,
          pago_minimo: l.ciclo.pagoMinimo,
          fecha_venc: l.ciclo.fechaVencimiento,
        },
        { onConflict: 'account_id,fecha_corte' },
      )
      if (error) throw error
    }

    if (l.snapshot) {
      const { error } = await this.db.from('card_snapshots').upsert(
        {
          account_id: l.snapshot.accountId,
          user_id: u,
          tomado_el: l.snapshot.tomadoEl,
          balance_a_la_fecha: l.snapshot.balanceALaFecha,
          disponible: l.snapshot.disponible,
          limite: l.snapshot.limite,
        },
        { onConflict: 'account_id' },
      )
      if (error) throw error
    }
  }

  async cambiarCategoria(txnId: string, categoriaId: string, regla: Regla | null): Promise<void> {
    const { error } = await this.db
      .from('transactions')
      .update({ categoria_id: categoriaId })
      .eq('id', txnId)
    if (error) throw error

    if (!regla) return

    const { error: eRegla } = await this.db.from('rules').upsert(
      {
        user_id: this.userId,
        patron: regla.patron,
        categoria_id: regla.categoriaId,
        veces_aplicada: regla.vecesAplicada,
      },
      { onConflict: 'user_id,patron' },
    )
    if (eRegla) throw eRegla
  }

  async borrarTodo(): Promise<void> {
    // El borrado en cascada del esquema se encarga del resto.
    const { error } = await this.db.from('accounts').delete().eq('user_id', this.userId)
    if (error) throw error
  }
}

// ------------------------------------------------ traduccion de filas a objetos

type Fila = Record<string, unknown>

function aCuenta(f: Fila): Account {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    banco: String(f.banco),
    tipo: f.tipo as Account['tipo'],
    ultimos4: String(f.ultimos4),
    moneda: f.moneda as Account['moneda'],
    limite: f.limite === null ? undefined : Number(f.limite),
  }
}

function aTxn(f: Fila): Txn {
  return {
    id: String(f.id),
    accountId: String(f.account_id),
    fecha: String(f.fecha),
    fechaEntrada: f.fecha_entrada ? String(f.fecha_entrada) : undefined,
    descripcion: String(f.descripcion),
    monto: Number(f.monto),
    balance: f.balance === null ? undefined : Number(f.balance),
    referencia: f.referencia ? String(f.referencia) : undefined,
    categoriaId: f.categoria_id ? String(f.categoria_id) : undefined,
    esInterno: Boolean(f.es_interno),
    huella: String(f.huella),
  }
}

function aCiclo(f: Fila): CardCycle {
  return {
    id: String(f.id),
    accountId: String(f.account_id),
    fechaCorte: String(f.fecha_corte),
    balanceCorte: Number(f.balance_corte),
    pagoMinimo: Number(f.pago_minimo),
    fechaVencimiento: String(f.fecha_venc),
  }
}

function aSnapshot(f: Fila): CardSnapshot {
  return {
    accountId: String(f.account_id),
    tomadoEl: String(f.tomado_el),
    balanceALaFecha: Number(f.balance_a_la_fecha),
    disponible: Number(f.disponible ?? 0),
    limite: Number(f.limite ?? 0),
  }
}

function aRegla(f: Fila): Regla {
  return {
    patron: String(f.patron),
    categoriaId: String(f.categoria_id),
    vecesAplicada: Number(f.veces_aplicada ?? 0),
  }
}

function aEstado(f: Fila): EstadoArchivado {
  return {
    id: String(f.id),
    nombreArchivo: String(f.archivo_path),
    cuentaId: String(f.account_id),
    cuenta: String(f.archivo_path),
    clase: f.clase as 'cuenta' | 'tarjeta',
    desde: f.rango_desde ? String(f.rango_desde) : undefined,
    hasta: f.rango_hasta ? String(f.rango_hasta) : undefined,
    subidoEn: String(f.subido_en).slice(0, 10),
    movimientos: 0,
    cuadre: f.cuadre as EstadoArchivado['cuadre'],
    hash: f.hash_archivo ? String(f.hash_archivo) : undefined,
  }
}
