import { describe, it, expect } from 'vitest'
import { leerMonto, montoDe } from '../signs'

/**
 * El hallazgo mas peligroso de la calibracion: el Popular escribe el signo al
 * reves entre la cuenta corriente y la tarjeta. Estos casos vienen calcados
 * del formato real (con montos de ejemplo).
 */
describe('convencion de signo del Banco Popular', () => {
  describe('cuenta corriente: el menos va AL FINAL y significa debito', () => {
    it('lee un debito escrito con menos al final', () => {
      expect(montoDe('RD$ 30.00-', 'cuenta')).toBe(-30)
      expect(montoDe('RD$ 14,275.80-', 'cuenta')).toBe(-14275.80)
      expect(montoDe('RD$ 61,330.15-', 'cuenta')).toBe(-61330.15)
    })

    it('lee un credito cuando no hay menos', () => {
      expect(montoDe('RD$ 50,000.00', 'cuenta')).toBe(50000)
      expect(montoDe('RD$ 3,000.00', 'cuenta')).toBe(3000)
    })

    it('anota donde venia escrito el signo, para poder auditar', () => {
      expect(leerMonto('RD$ 30.00-', 'cuenta').signoEscrito).toBe('atras')
      expect(leerMonto('RD$ 50,000.00', 'cuenta').signoEscrito).toBe('ninguno')
    })
  })

  describe('tarjeta: el menos va AL INICIO y significa abono a tu favor', () => {
    it('trata un consumo sin menos como aumento de deuda', () => {
      expect(montoDe('RD$ 1,414.99', 'tarjeta')).toBe(-1414.99)
      expect(montoDe('RD$ 5,218.40', 'tarjeta')).toBe(-5218.4)
    })

    it('trata el menos delantero como pago o devolucion', () => {
      expect(montoDe('RD$ -15,000.00', 'tarjeta')).toBe(15000)
      expect(montoDe('RD$ -1,375.00', 'tarjeta')).toBe(1375)
      expect(montoDe('RD$ -42,150.75', 'tarjeta')).toBe(42150.75)
    })
  })

  it('NO confunde las dos convenciones: el mismo texto da signos opuestos', () => {
    // Este es exactamente el error que invertiria toda la tarjeta.
    expect(montoDe('RD$ 1,000.00', 'cuenta')).toBe(1000)
    expect(montoDe('RD$ 1,000.00', 'tarjeta')).toBe(-1000)
  })

  it('rechaza texto sin numero en vez de inventarse un cero', () => {
    expect(() => montoDe('RD$', 'cuenta')).toThrow(/ilegible/i)
  })
})
