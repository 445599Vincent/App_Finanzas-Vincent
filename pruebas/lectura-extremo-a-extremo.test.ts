import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { extraerEstado } from '../api/_extraer'
import { normalizarEstado } from '../src/lib/normalizar'

/**
 * Prueba de extremo a extremo: PDF de imagen -> Claude -> movimientos.
 *
 * Se salta sola si no hay ANTHROPIC_API_KEY, asi que `npm test` sigue
 * funcionando sin llave. En cuanto pongas la tuya en .env, esta prueba corre y
 * te dice si la lectura es correcta.
 *
 * El fixture es un estado INVENTADO con la forma exacta de los del Popular:
 * imagen a ~300 dpi, cero capa de texto, menos al final en los debitos, fechas
 * DD/MM/AAAA, un concepto partido en tres lineas y el impuesto DGII agrupado.
 * Los valores esperados de abajo son la verdad conocida del documento.
 *
 * Cuesta unos centavos por corrida, porque llama a la API de verdad.
 */

const aqui = dirname(fileURLToPath(import.meta.url))
const PDF = join(aqui, 'fixtures', 'estado-cuenta-sintetico.pdf')

const hayLlave = Boolean(process.env.ANTHROPIC_API_KEY)

describe.skipIf(!hayLlave)('leer un estado de imagen de punta a punta', () => {
  it(
    'transcribe y normaliza el estado sintético correctamente',
    { timeout: 10 * 60 * 1000 },
    async () => {
      const pdfBase64 = readFileSync(PDF).toString('base64')
      const { estado } = await extraerEstado(pdfBase64)
      const r = normalizarEstado(estado, { accountId: 'prueba' })

      // Identificacion del documento
      expect(r.clase).toBe('cuenta')
      expect(r.ultimos4).toBe('2233')
      expect(r.estiloFecha).toBe('dmy')

      // Los cinco movimientos, con el signo ya resuelto por nuestras reglas
      expect(r.movimientos).toHaveLength(5)
      expect(r.movimientos.map((m) => m.monto)).toEqual([
        -30, // "RD$ 30.00-"  menos al final = debito
        50000, // sin signo = credito
        -14275.8,
        -21.46,
        38000,
      ])

      // Fechas DD/MM/AAAA convertidas a ISO
      expect(r.movimientos.map((m) => m.fecha)).toEqual([
        '2026-05-24',
        '2026-05-29',
        '2026-05-30',
        '2026-06-05',
        '2026-06-18',
      ])

      // El concepto partido en tres lineas llega en una sola
      expect(r.movimientos[4].descripcion).toMatch(/LBTR 31540680015 .*CAE2606095012/)

      // Y lo mas importante: la aritmetica cierra
      expect(r.cuadre?.ok).toBe(true)
      expect(r.cuadre?.saldoFinal).toBe(85972.74)
      expect(r.cuadraConEncabezado).toBe(true)
      expect(r.advertencias).toEqual([])
    },
  )
})

describe.skipIf(hayLlave)('sin llave de API', () => {
  it('se salta la prueba de lectura real y lo dice', () => {
    expect(hayLlave).toBe(false)
  })
})
