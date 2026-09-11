import type { Category } from '../types'

/**
 * Categorias de arranque, pensadas para Republica Dominicana.
 * "Banco" existe aparte a proposito: el impuesto DGII 0.15%, el Bancaseguro y
 * los cargos de emision de la tarjeta se pierden entre el ruido si no se
 * separan, y sumados al ano no son poca cosa.
 */
export const CATEGORIAS: Category[] = [
  { id: 'ingreso', nombre: 'Ingresos', grupo: 'Ingreso', cuentaEnGasto: false },
  { id: 'interno', nombre: 'Traslado interno', grupo: 'Interno', cuentaEnGasto: false },

  { id: 'supermercado', nombre: 'Supermercado', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'combustible', nombre: 'Combustible', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'servicios', nombre: 'Servicios', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'salud', nombre: 'Salud y farmacia', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'vivienda', nombre: 'Vivienda', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'educacion', nombre: 'Educación', grupo: 'Esencial', cuentaEnGasto: true },
  { id: 'vehiculo', nombre: 'Vehículo', grupo: 'Esencial', cuentaEnGasto: true },

  { id: 'restaurantes', nombre: 'Restaurantes', grupo: 'Estilo de vida', cuentaEnGasto: true },
  { id: 'compras', nombre: 'Compras', grupo: 'Estilo de vida', cuentaEnGasto: true },
  { id: 'suscripciones', nombre: 'Suscripciones', grupo: 'Estilo de vida', cuentaEnGasto: true },
  { id: 'cuidado', nombre: 'Cuidado personal', grupo: 'Estilo de vida', cuentaEnGasto: true },
  { id: 'viajes', nombre: 'Viajes y hoteles', grupo: 'Estilo de vida', cuentaEnGasto: true },
  { id: 'transporte', nombre: 'Transporte', grupo: 'Estilo de vida', cuentaEnGasto: true },

  { id: 'impuestos', nombre: 'Impuestos bancarios', grupo: 'Banco', cuentaEnGasto: true },
  { id: 'comisiones', nombre: 'Comisiones y seguros', grupo: 'Banco', cuentaEnGasto: true },

  { id: 'otros', nombre: 'Sin clasificar', grupo: 'Estilo de vida', cuentaEnGasto: true },
]

export const POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]))

/**
 * Reglas de arranque. La app aprende de tus correcciones y las va ganando en
 * prioridad, pero conviene no empezar desde cero.
 * Cada patron se prueba contra la descripcion en minusculas.
 */
export const REGLAS: Array<{ patron: RegExp; categoriaId: string }> = [
  { patron: /pago\s+impuesto|dgii/i, categoriaId: 'impuestos' },
  { patron: /bancaseguro|proteccion por perdida|cargo emision|renovacion prorrateada|comision/i, categoriaId: 'comisiones' },

  { patron: /supermercado|sm nacional|jumbo|sirena|bravo|city market|pricesmart/i, categoriaId: 'supermercado' },
  { patron: /shell|texaco|sunix|total|petrolera|gas station|estacion/i, categoriaId: 'combustible' },
  { patron: /edesur|edenorte|edeeste|caasd|inapa|claro|altice|viva|wind telecom/i, categoriaId: 'servicios' },
  { patron: /farmacia|fcia|farm |medicar|carol|gbc/i, categoriaId: 'salud' },
  { patron: /condominio|alquiler|inmobiliaria/i, categoriaId: 'vivienda' },
  { patron: /intec|pucmm|unibe|unphu|utesa|universidad|colegio/i, categoriaId: 'educacion' },
  { patron: /lubriservis|repuesto|goodyear|taller|auto\s|body shop/i, categoriaId: 'vehiculo' },

  { patron: /restaurant|kfc|wendy|burger|pizza|teriyaki|grill|food hall|food truck|cafe|adrian tropical|helados/i, categoriaId: 'restaurantes' },
  { patron: /spotify|netflix|microsoft|apple\.com|google|openai|anthropic|hbo|disney|amazon prime/i, categoriaId: 'suscripciones' },
  { patron: /barber|salon|spa|peluqueria/i, categoriaId: 'cuidado' },
  { patron: /hotel|hyatt|marriott|resort|airbnb|despegar|copa air|arajet/i, categoriaId: 'viajes' },
  { patron: /uber|taxi|parqueo|peaje/i, categoriaId: 'transporte' },
  { patron: /nike|ikea|zara|tienda|store|atmosfera|sport/i, categoriaId: 'compras' },
]

/** Devuelve la categoria sugerida y que tan seguro esta. */
export function sugerirCategoria(
  descripcion: string,
  monto: number,
  esInterno = false,
): { categoriaId: string; confianza: number } {
  if (esInterno) return { categoriaId: 'interno', confianza: 1 }
  if (monto > 0) return { categoriaId: 'ingreso', confianza: 0.8 }

  for (const r of REGLAS) {
    if (r.patron.test(descripcion)) {
      return { categoriaId: r.categoriaId, confianza: 0.92 }
    }
  }
  return { categoriaId: 'otros', confianza: 0.3 }
}
