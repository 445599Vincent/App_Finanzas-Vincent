/**
 * Fechas de los estados del Popular.
 *
 * En los cinco estados que sirvieron de calibracion aparecieron TRES formas,
 * dos de ellas en el mismo campo de la misma tarjeta impresa el mismo dia:
 *
 *   Cuenta corriente, transacciones : 24/05/2026        DD/MM/AAAA
 *   Tarjeta, transacciones          : 2026-07-10        AAAA-MM-DD
 *   Tarjeta, "Fecha de corte"       : 2026-07-10 y tambien 10/08/2026
 *
 * Por eso nunca se asume el formato: se detecta, y cuando la fecha es
 * ambigua (24/05 podria ser 24 de mayo o... nada, pero 05/06 si) se resuelve
 * con el rango del propio estado.
 */

export type DateStyle = 'dmy' | 'mdy' | 'ymd'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

export interface ParsedDate {
  /** ISO corto: 2026-05-24 */
  iso: string
  /** true si las dos primeras cifras eran <= 12 y hubo que decidir. */
  ambigua: boolean
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Lee una fecha suelta. `estilo` decide como interpretar DD/MM vs MM/DD
 * cuando ambas cifras son <= 12. Por defecto 'dmy', que es lo que usa el Popular.
 */
export function parseFecha(raw: string, estilo: DateStyle = 'dmy'): ParsedDate | null {
  const s = raw.trim()

  const m1 = ISO.exec(s)
  if (m1) {
    const [, y, m, d] = m1
    return { iso: iso(+y, +m, +d), ambigua: false }
  }

  const m2 = SLASH.exec(s)
  if (m2) {
    const [, a, b, y] = m2
    const na = +a
    const nb = +b
    // Si una de las dos pasa de 12, el orden queda determinado sin ambiguedad.
    if (na > 12) return { iso: iso(+y, nb, na), ambigua: false }
    if (nb > 12) return { iso: iso(+y, na, nb), ambigua: false }
    // Ambas <= 12: hay que confiar en el estilo detectado.
    const d = estilo === 'mdy' ? nb : na
    const m = estilo === 'mdy' ? na : nb
    return { iso: iso(+y, m, d), ambigua: true }
  }

  return null
}

/**
 * Mira todas las fechas de un estado y decide el estilo.
 * Basta con que UNA fecha tenga el primer numero > 12 para saber que es DD/MM.
 */
export function detectarEstilo(muestras: string[]): DateStyle {
  let hayIso = 0
  for (const s of muestras) {
    const t = s.trim()
    if (ISO.test(t)) {
      hayIso++
      continue
    }
    const m = SLASH.exec(t)
    if (!m) continue
    const a = +m[1]
    const b = +m[2]
    if (a > 12) return 'dmy'
    if (b > 12) return 'mdy'
  }
  // Todo con guiones: AAAA-MM-DD. Si no, el Popular escribe DD/MM.
  return hayIso === muestras.length && hayIso > 0 ? 'ymd' : 'dmy'
}

/**
 * Ultimo recurso para una fecha ambigua: si una de las dos lecturas cae fuera
 * del rango que cubre el estado, la otra es la correcta.
 */
export function resolverConRango(
  raw: string,
  desde: string,
  hasta: string,
): ParsedDate | null {
  const m = SLASH.exec(raw.trim())
  if (!m) return parseFecha(raw)
  const [, a, b, y] = m
  const comoDmy = iso(+y, +b, +a)
  const comoMdy = iso(+y, +a, +b)
  const dentro = (d: string) => d >= desde && d <= hasta
  const okD = dentro(comoDmy)
  const okM = dentro(comoMdy)
  if (okD && !okM) return { iso: comoDmy, ambigua: false }
  if (okM && !okD) return { iso: comoMdy, ambigua: false }
  return parseFecha(raw)
}

/** 2026-05-24 -> 24/05/2026, que es como se lee en Republica Dominicana. */
export function fechaLarga(isoDate: string): string {
  const m = ISO.exec(isoDate)
  if (!m) return isoDate
  return `${m[3]}/${m[2]}/${m[1]}`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** 2026-05-24 -> 24 de mayo */
export function fechaCorta(isoDate: string): string {
  const m = ISO.exec(isoDate)
  if (!m) return isoDate
  return `${+m[3]} de ${MESES[+m[2] - 1]}`
}

/** Dias entre dos fechas ISO. Positivo si `b` es posterior. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}
