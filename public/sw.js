/*
 * Service worker de QuickView.
 *
 * Sirve para una sola cosa: que al abrir la app sin internet siga apareciendo
 * lo que ya tienes guardado, en vez del dinosaurio del navegador.
 *
 * La estrategia es "la red primero, el cache como red de seguridad". Nunca al
 * reves: en una app de finanzas, servir una version vieja del codigo por
 * ahorrarse una peticion es un mal negocio.
 *
 * Las llamadas a /api NUNCA se cachean. Leer un estado es una operacion que
 * cuesta dinero y devuelve datos distintos cada vez.
 */

const CACHE = 'quickview-v1'
const ESENCIALES = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg']

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ESENCIALES)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request

  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        // Solo se guarda lo que salio bien.
        if (respuesta.ok) {
          const copia = respuesta.clone()
          void caches.open(CACHE).then((c) => c.put(peticion, copia))
        }
        return respuesta
      })
      .catch(async () => {
        const guardada = await caches.match(peticion)
        if (guardada) return guardada
        // Navegacion sin red: devolver el armazon de la app.
        if (peticion.mode === 'navigate') {
          const inicio = await caches.match('/index.html')
          if (inicio) return inicio
        }
        return Response.error()
      }),
  )
})
