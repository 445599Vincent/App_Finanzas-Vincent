#!/usr/bin/env node
/*
 * Diagnóstico de la conexión con Supabase.
 *
 *   npm run revisar
 *
 * Comprueba en orden todo lo que tiene que estar bien para que QuickView
 * guarde de verdad, y cuando algo falla dice qué hacer, no solo que falló.
 */

import { readFileSync, existsSync } from 'node:fs'

/** Tablas con datos tuyos: sin sesión iniciada deben estar cerradas. */
const TABLAS_PRIVADAS = [
  'accounts', 'statements', 'card_cycles', 'card_snapshots',
  'transactions', 'transfer_links', 'rules', 'budgets', 'recurring', 'alerts',
]

const verde = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const rojo = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`)
const gris = (m) => console.log(`    \x1b[2m${m}\x1b[0m`)

let problemas = 0
const fallo = (m, ...pistas) => {
  problemas++
  rojo(m)
  pistas.forEach(gris)
}

/** Una respuesta que no es JSON (un HTML de error, un proxy) no debe tumbar la revisión. */
function comoJson(texto) {
  try {
    return JSON.parse(texto || 'null')
  } catch {
    return null
  }
}

function leerEnv() {
  const env = { ...process.env }
  if (existsSync('.env')) {
    for (const linea of readFileSync('.env', 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea)
      if (m && !env[m[1]]) env[m[1]] = m[2].trim()
    }
  }
  return env
}

async function main() {
  console.log('\nQuickView · revisión de Supabase\n')

  const env = leerEnv()
  const url = env.VITE_SUPABASE_URL
  const llave = env.VITE_SUPABASE_ANON_KEY

  if (!url || !llave) {
    fallo(
      'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY',
      'Cópialas de Settings → API de tu proyecto a tu archivo .env',
    )
    return final()
  }
  verde(`Credenciales encontradas (${new URL(url).hostname})`)

  const cabeceras = { apikey: llave, Authorization: `Bearer ${llave}` }

  /** Devuelve {estado} o {error} — nunca lanza, para no cortar la revisión. */
  async function pedir(ruta) {
    try {
      const r = await fetch(`${url}${ruta}`, { headers: cabeceras })
      return { estado: r.status, cuerpo: await r.text().catch(() => '') }
    } catch (e) {
      return { error: e.message }
    }
  }

  // 1. ¿Responde el proyecto?
  const raiz = await pedir('/rest/v1/')
  if (raiz.error) {
    fallo(
      `No se pudo conectar: ${raiz.error}`,
      'Revisa la URL y tu conexión. Nada de lo de abajo se pudo comprobar.',
    )
    return final()
  }
  if (raiz.estado === 401) {
    fallo(
      'El proyecto responde pero rechaza la llave (401)',
      'Copia de nuevo la llave publicable desde Settings → API.',
    )
    return final()
  }
  verde('El proyecto responde y acepta la llave')

  // 2. El catálogo de categorías: es el único que se lee SIN sesión, así que
  //    es el mejor termómetro de si los permisos quedaron bien.
  const cat = await pedir('/rest/v1/categories?select=id')
  if (cat.estado === 404 || cat.estado === 400) {
    fallo(
      'No existe la tabla categories: falta correr el esquema',
      'SQL Editor → New query → pega supabase/schema.sql → Run',
    )
  } else if (cat.estado === 401 || cat.estado === 403) {
    fallo(
      'categories existe pero está bloqueada (403)',
      'Le faltan los permisos de lectura para el rol anónimo.',
      'Vuelve a correr supabase/schema.sql completo: es idempotente y',
      'ahora incluye los GRANT que faltaban.',
    )
  } else if (cat.estado === 200) {
    const filas = comoJson(cat.cuerpo) ?? []
    if (filas.length === 0) {
      fallo(
        'La tabla categories está vacía: falta el catálogo',
        'SQL Editor → New query → pega supabase/seed.sql → Run',
      )
    } else {
      verde(`Catálogo de categorías cargado (${filas.length} categorías)`)
    }
  } else {
    fallo(`categories respondió HTTP ${cat.estado}, que no esperaba`)
  }

  // 3. Las tablas privadas. Sin sesión, lo correcto es que estén cerradas;
  //    lo que se comprueba aquí es que EXISTAN.
  const inexistentes = []
  for (const tabla of TABLAS_PRIVADAS) {
    const r = await pedir(`/rest/v1/${tabla}?select=*&limit=1`)
    if (r.error) continue
    if (r.estado === 404 || r.estado === 400) inexistentes.push(tabla)
  }
  if (inexistentes.length > 0) {
    fallo(
      `Faltan ${inexistentes.length} tablas: ${inexistentes.join(', ')}`,
      'Vuelve a correr supabase/schema.sql completo.',
    )
  } else {
    verde(`Las ${TABLAS_PRIVADAS.length} tablas de datos existen y están cerradas sin sesión`)
  }

  // 4. El bucket de los PDF originales.
  const bucket = await pedir('/storage/v1/bucket/estados')
  if (bucket.error) {
    gris('No se pudo comprobar el bucket de PDFs.')
  } else if (bucket.estado === 404) {
    fallo(
      'No existe el bucket "estados": no se podrán guardar los PDF originales',
      'Lo crea supabase/schema.sql al final; vuelve a correrlo.',
    )
  } else {
    verde('El bucket "estados" existe')
  }

  // 5. El acceso por correo, que es como se entra.
  const ajustes = await pedir('/auth/v1/settings')
  if (ajustes.error || !ajustes.cuerpo) {
    gris('No se pudieron leer los ajustes de autenticación.')
  } else {
    const s = comoJson(ajustes.cuerpo)
    if (s === null) {
      gris('La respuesta de autenticación no vino en JSON; puede ser un proxy de por medio.')
    } else if (s.external?.email === false) {
      fallo('El acceso por correo está desactivado', 'Authentication → Providers → activa Email.')
    } else {
      verde('El acceso por correo está activo')
    }
  }

  final()
}

function final() {
  if (problemas === 0) {
    console.log('\n  \x1b[32mTodo listo.\x1b[0m Arranca con: npm run dev')
    console.log('  \x1b[2mSi el enlace del correo no te deja entrar, su dirección tiene que\x1b[0m')
    console.log('  \x1b[2mestar en Authentication → URL Configuration → Redirect URLs\x1b[0m\n')
  } else {
    console.log(
      `\n  \x1b[31m${problemas} ${problemas === 1 ? 'cosa' : 'cosas'} por arreglar.\x1b[0m Corre esto otra vez cuando lo hagas.\n`,
    )
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error('\n  Falló la revisión:', e.message, '\n')
  process.exit(1)
})
