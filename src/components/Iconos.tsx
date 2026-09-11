/** Iconos de la barra de pestañas. Trazo fino, sin relleno, estilo iOS. */

const comun = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconoResumen() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...comun} d="M4 19V10M9.5 19V5M15 19v-6M20.5 19v-9" />
    </svg>
  )
}

export function IconoMovimientos() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...comun} d="M4 8h13M4 8l3-3M4 8l3 3M20 16H7M20 16l-3-3M20 16l-3 3" />
    </svg>
  )
}

export function IconoEstados() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...comun} d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4" />
    </svg>
  )
}

export function IconoCriterio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...comun} d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM10 20h4" />
    </svg>
  )
}

export function IconoSubir() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 20, height: 20 }}>
      <path {...comun} d="M12 16V4M12 4 8 8M12 4l4 4M5 18v2h14v-2" />
    </svg>
  )
}
