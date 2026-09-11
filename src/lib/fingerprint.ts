import type { Txn } from '../types'

/**
 * Tus estados no son mensuales: exportas el rango que te de la gana desde
 * Popularenlinea. Eso hace inevitable que dos exportaciones se solapen.
 * La huella permite subir rangos repetidos sin ensuciar nada.
 *
 * No se usa el saldo corrido en la huella: el mismo movimiento tiene el mismo
 * saldo siempre, pero si el banco reordena dos movimientos del mismo dia el
 * saldo cambia y no queremos que eso cree un duplicado.
 */

/** Baja a minusculas, colapsa espacios y quita lo que varia entre impresiones. */
export function normalizarDescripcion(d: string): string {
  return d
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\*+/g, '*')
    .trim()
}

export function huellaDe(t: Pick<Txn, 'accountId' | 'fecha' | 'monto' | 'descripcion' | 'referencia'>): string {
  const partes = [
    t.accountId,
    t.fecha,
    t.monto.toFixed(2),
    normalizarDescripcion(t.descripcion),
    (t.referencia ?? '').trim(),
  ]
  return partes.join('|')
}

export interface ResultadoDedup<T> {
  nuevos: T[]
  repetidos: T[]
}

/**
 * Separa lo nuevo de lo ya conocido. `existentes` son las huellas que ya
 * estan guardadas. Tambien descarta duplicados dentro del mismo lote.
 */
export function deduplicar<T extends Pick<Txn, 'accountId' | 'fecha' | 'monto' | 'descripcion' | 'referencia'>>(
  entrantes: T[],
  existentes: Iterable<string> = [],
): ResultadoDedup<T> {
  const vistas = new Set(existentes)
  const nuevos: T[] = []
  const repetidos: T[] = []

  for (const t of entrantes) {
    const h = huellaDe(t)
    if (vistas.has(h)) {
      repetidos.push(t)
      continue
    }
    vistas.add(h)
    nuevos.push(t)
  }

  return { nuevos, repetidos }
}
