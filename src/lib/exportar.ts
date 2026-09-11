import type { Account, Txn } from '../types'
import { POR_ID } from './categories'
import { fechaLarga } from './dates'

/**
 * Exportar a hoja de calculo.
 *
 * Se genera CSV y no un .xlsx de verdad a proposito: Excel y Numbers lo abren
 * igual, no hace falta arrastrar una libreria de medio megabyte al bundle, y el
 * archivo se puede leer con cualquier cosa dentro de diez anios.
 *
 * Dos detalles que hacen que Excel lo abra bien en espanol:
 * el separador es punto y coma, y el archivo lleva BOM para que los acentos no
 * salgan rotos.
 */

const BOM = '﻿'
const SEP = ';'

function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  // Comillas, separador o salto de linea obligan a entrecomillar.
  return /["\n\r;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** Excel en espanol espera la coma como separador decimal. */
function numero(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

export function movimientosACSV(txns: Txn[], cuentas: Account[]): string {
  const nombreCuenta = new Map(cuentas.map((c) => [c.id, `${c.nombre} ••••${c.ultimos4}`]))

  const encabezado = [
    'Fecha',
    'Cuenta',
    'Descripción',
    'Categoría',
    'Monto',
    'Tipo',
    'Cuenta en gasto',
    'Referencia',
  ]

  const filas = txns.map((t) => {
    const cat = POR_ID.get(t.categoriaId ?? 'otros')
    return [
      fechaLarga(t.fecha),
      nombreCuenta.get(t.accountId) ?? t.accountId,
      t.descripcion,
      cat?.nombre ?? 'Sin clasificar',
      numero(t.monto),
      t.esInterno ? 'Traslado interno' : t.monto < 0 ? 'Gasto' : 'Entrada',
      // La columna que evita el malentendido de sumar la hoja entera.
      t.esInterno || cat?.cuentaEnGasto === false ? 'No' : 'Sí',
      t.referencia ?? '',
    ]
  })

  return (
    BOM +
    [encabezado, ...filas].map((f) => f.map(celda).join(SEP)).join('\r\n')
  )
}

/** Dispara la descarga de un archivo generado en el navegador. */
export function descargar(nombre: string, contenido: string, tipo: string): void {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Liberar despues de que el navegador haya tomado el blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function descargarMovimientos(txns: Txn[], cuentas: Account[], sufijo: string): void {
  descargar(
    `QuickView movimientos ${sufijo}.csv`,
    movimientosACSV(txns, cuentas),
    'text/csv;charset=utf-8',
  )
}
