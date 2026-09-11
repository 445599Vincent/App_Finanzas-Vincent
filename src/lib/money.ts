const fmt = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const fmtCorto = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** RD$ 28,440.60 */
export function pesos(n: number): string {
  return `RD$ ${fmt.format(Math.abs(n))}`
}

/** Con el signo delante: +RD$ 50,000.00 / -RD$ 30.00 */
export function pesosConSigno(n: number): string {
  const s = n < 0 ? '−' : '+'
  return `${s}${pesos(n)}`
}

/** RD$ 26,031 - para titulares donde los centavos estorban. */
export function pesosCorto(n: number): string {
  return `RD$ ${fmtCorto.format(Math.abs(n))}`
}

/** 41.2k - para ejes de graficas. */
export function pesosEje(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(a / 1_000_000).toFixed(1)}M`
  if (a >= 1_000) return `${(a / 1_000).toFixed(1)}k`
  return fmtCorto.format(a)
}
