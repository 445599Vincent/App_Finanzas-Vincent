import { describe, it, expect } from 'vitest'
import { parseFecha, detectarEstilo, resolverConRango, fechaLarga, diasEntre } from '../dates'

/**
 * Aparecieron tres formas de escribir fecha en cinco PDFs, dos de ellas en el
 * mismo campo de la misma tarjeta impresa el mismo dia.
 */
describe('fechas de los estados del Popular', () => {
  it('lee DD/MM/AAAA, que es lo que usan las cuentas corrientes', () => {
    expect(parseFecha('24/05/2026')?.iso).toBe('2026-05-24')
    expect(parseFecha('21/08/2026')?.iso).toBe('2026-08-21')
  })

  it('lee AAAA-MM-DD, que es lo que usa la tarjeta', () => {
    expect(parseFecha('2026-07-10')?.iso).toBe('2026-07-10')
    expect(parseFecha('2026-08-10')?.iso).toBe('2026-08-10')
  })

  it('lee el mismo campo escrito de las dos maneras y llega al mismo dia', () => {
    // "Fecha de corte" salio como 2026-08-10 en un PDF y 10/08/2026 en otro.
    expect(parseFecha('2026-08-10')?.iso).toBe('2026-08-10')
    expect(parseFecha('10/08/2026')?.iso).toBe('2026-08-10')
  })

  it('marca como ambigua una fecha donde ambas cifras caben en un mes', () => {
    const r = parseFecha('05/06/2026')
    expect(r?.iso).toBe('2026-06-05')
    expect(r?.ambigua).toBe(true)
  })

  it('no marca ambigua cuando el dia pasa de 12', () => {
    expect(parseFecha('24/05/2026')?.ambigua).toBe(false)
  })

  it('detecta el estilo con que una sola fecha pase de 12', () => {
    expect(detectarEstilo(['05/06/2026', '24/05/2026'])).toBe('dmy')
    expect(detectarEstilo(['2026-07-10', '2026-08-10'])).toBe('ymd')
  })

  it('resuelve una ambigua descartando la lectura que cae fuera del estado', () => {
    // Rango del estado: mayo a agosto. "05/06" solo puede ser 5 de junio.
    const r = resolverConRango('05/06/2026', '2026-05-24', '2026-08-21')
    expect(r?.iso).toBe('2026-06-05')
    expect(r?.ambigua).toBe(false)
  })

  it('devuelve null en vez de una fecha inventada si el texto no sirve', () => {
    expect(parseFecha('no es fecha')).toBeNull()
  })

  it('formatea de vuelta como se lee en Republica Dominicana', () => {
    expect(fechaLarga('2026-08-10')).toBe('10/08/2026')
  })

  it('cuenta dias entre fechas', () => {
    expect(diasEntre('2026-08-10', '2026-09-04')).toBe(25)
    expect(diasEntre('2026-09-04', '2026-08-10')).toBe(-25)
  })
})
