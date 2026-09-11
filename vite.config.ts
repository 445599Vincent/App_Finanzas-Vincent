import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * En produccion Vercel convierte cada archivo de /api en una funcion.
 * En desarrollo Vite solo sirve archivos estaticos, asi que montamos el mismo
 * handler como middleware. Es el mismo codigo en los dos lados: no hay una
 * version de desarrollo que se desincronice de la de produccion.
 */
function apiEnDesarrollo(): Plugin {
  return {
    name: 'quickview-api-dev',
    configureServer(server: ViteDevServer) {
      // Se monta en /api completo, no solo en la ruta. Si se dejara pasar al
      // siguiente middleware, Vite serviria /api/*.ts como modulo y publicaria
      // el codigo del servidor con su sourcemap, incluido el prompt.
      server.middlewares.use('/api', (req, res, next) => {
        const ruta = (req.url ?? '/').split('?')[0]

        if (ruta !== '/leer-estado') {
          return responder(res, 404, { error: 'No existe esa ruta' })
        }
        if (req.method !== 'POST') {
          return responder(res, 405, { error: 'Solo POST' })
        }
        void next

        const trozos: Buffer[] = []
        req.on('data', (t: Buffer) => trozos.push(t))
        req.on('end', () => {
          void (async () => {
            try {
              const modulo = await server.ssrLoadModule('/api/leer-estado.ts')
              const handler = modulo.default as (r: Request) => Promise<Response>
              const peticion = new Request('http://localhost/api/leer-estado', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: Buffer.concat(trozos).toString('utf8'),
              })
              const respuesta = await handler(peticion)
              res.statusCode = respuesta.status
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(await respuesta.text())
            } catch (e) {
              server.config.logger.error(`[api dev] ${String(e)}`)
              responder(res, 500, { error: 'Error interno del servidor de desarrollo' })
            }
          })()
        })
      })
    },
  }
}

function responder(res: ServerResponse, status: number, cuerpo: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(cuerpo))
}

export default defineConfig(({ mode }) => {
  // Vite solo expone al navegador las variables VITE_*. La llave de Claude no
  // lleva ese prefijo justamente para que no llegue al bundle, asi que hay que
  // pasarla a mano al proceso del servidor de desarrollo.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

  return {
    plugins: [react(), apiEnDesarrollo()],
    server: { port: 5173 },
  }
})
