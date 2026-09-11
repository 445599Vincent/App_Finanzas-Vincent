import { extraerEstado } from './_extraer'

/**
 * POST /api/leer-estado
 *
 * Recibe un PDF en base64 y devuelve el estado transcrito.
 *
 * Esto corre en el servidor por una sola razon: la llave de la API de Claude
 * no puede vivir en el navegador. Cualquier variable con prefijo VITE_ termina
 * dentro del bundle y queda a la vista de quien abra la pagina.
 */

/** 32 MB es el tope de la API; en base64 el PDF crece un tercio. */
const TOPE_BASE64 = 30 * 1024 * 1024

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Solo POST' }, 405)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(
      {
        error:
          'Falta ANTHROPIC_API_KEY en el servidor. Añádela a .env (sin el prefijo VITE_) o a las variables de entorno de Vercel.',
      },
      500,
    )
  }

  let cuerpo: { pdfBase64?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'El cuerpo no es JSON válido' }, 400)
  }

  const pdfBase64 = cuerpo.pdfBase64
  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    return json({ error: 'Falta pdfBase64' }, 400)
  }

  if (pdfBase64.length > TOPE_BASE64) {
    return json(
      { error: 'El PDF pesa demasiado. Exporta un rango de fechas más corto y vuelve a intentarlo.' },
      413,
    )
  }

  try {
    const { estado, uso } = await extraerEstado(pdfBase64)
    return json({ estado, uso })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Error leyendo el estado'
    // El detalle va al log del servidor; al navegador solo el mensaje.
    console.error('[leer-estado]', e)
    return json({ error: mensaje }, 502)
  }
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
