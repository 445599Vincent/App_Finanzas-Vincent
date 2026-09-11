# QuickView

Tus estados de cuenta del Banco Popular, leídos y convertidos en criterio.

Subes el PDF que imprimes desde Popularenlínea. QuickView lo lee, saca cada
movimiento, descarta el dinero que solo se mueve entre tus propias cuentas y te
dice lo que importa: cuándo cortas, qué se repite todos los meses, qué no cuadra.

Es una PWA: se instala en el iPhone y en Android desde el navegador, sin pasar
por ninguna tienda.

---

## Arrancar en local

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>. **No hace falta configurar nada para verla**: sin
credenciales de Supabase la app corre en modo demostración, con datos de ejemplo
que muestran todas las pantallas funcionando.

Otros comandos:

```bash
npm test          # 101 pruebas del motor
npm run lint      # incluye rules-of-hooks
npm run build     # compila a dist/
npm run typecheck # revisa tipos sin compilar
```

---

## Conectar Claude para que lea tus estados

1. Saca una llave en [console.anthropic.com](https://console.anthropic.com) →
   **API keys** y cárgale unos US$ 5 de crédito.
2. Ponla en `.env` como `ANTHROPIC_API_KEY` — **sin el prefijo `VITE_`**.

   Ese detalle importa: Vite mete en el bundle del navegador cualquier variable
   que empiece por `VITE_`. Una llave con ese prefijo quedaría a la vista de
   cualquiera que abra la página. Sin prefijo, solo la lee el servidor.

3. Reinicia `npm run dev` y sube un PDF desde la pestaña **Estados**.

Para comprobar que la lectura funciona antes de gastar en tus propios estados:

```bash
npm test
```

Con la llave puesta, `npm test` deja de saltarse la prueba de extremo a extremo:
toma un estado sintético de `pruebas/fixtures/` —imagen pura a 300 dpi, con la
forma exacta de los del Popular— lo manda a Claude y verifica que los cinco
movimientos salgan con el signo, la fecha y el saldo correctos. Cuesta unos
centavos.

### Cómo está repartido el trabajo

Claude **transcribe**: devuelve el texto tal cual está impreso, con el menos en
la misma posición en que aparece y la fecha sin reformatear.

El código **decide**: `signs.ts` y `dates.ts` aplican las reglas del Popular, y
`reconcile.ts` comprueba la aritmética.

No es un reparto arbitrario. Si el modelo también resolviera los signos habría
dos fuentes de verdad y ninguna verificable; así el modelo hace lo que sabe
hacer, que es ver, y si transcribe mal, la cadena de saldo corrido lo delata
antes de que llegue a tus números.

---

## Conectar tu propia base

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).

2. En **SQL Editor → New query**, pega y corre `supabase/schema.sql`, y después
   `supabase/seed.sql`.

3. En **Authentication → URL Configuration**, añade las direcciones desde las
   que vas a abrir la app:

   - **Site URL**: la de Vercel, por ejemplo `https://quickview.vercel.app`
   - **Redirect URLs**: esa misma y `http://localhost:5173`

   Este paso es el que más tiempo hace perder si se salta. El enlace que llega
   por correo apunta a una de estas direcciones; si la tuya no está en la lista,
   Supabase lo rechaza y el enlace no entra a ningún lado.

4. Copia `.env.example` a `.env` y llena los dos valores desde
   **Settings → API** de tu proyecto:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

5. Reinicia `npm run dev`. La app pasa a pedirte el correo.

**Cómo funciona el login.** Sin contraseña: escribes tu correo, te llega un
enlace y lo abres **en el mismo dispositivo**. No hay contraseña que recordar,
que guardar ni que se pueda filtrar.

Mientras no configures Supabase, la app no pide correo y guarda en tu teléfono.
Obligar a crear una cuenta para usar algo que guarda en tu propio dispositivo no
tendría sentido.

Todas las tablas están protegidas con Row Level Security: cada fila pertenece a
un usuario y nadie más puede leerla ni escribirla, ni siquiera con la llave
pública. Los PDFs van a un bucket privado.

**QuickView nunca te pide las claves de tu banco.** No se conecta al Popular ni
a ningún agregador. Solo lee el PDF que tú subes.

### Desplegar en Vercel

Importa el repositorio en [vercel.com](https://vercel.com) y añade en
**Settings → Environment Variables** las tres variables: las dos de Supabase y
`ANTHROPIC_API_KEY`. Vercel detecta Vite solo y convierte cada archivo de `api/`
en una función.

**Nunca subas el `.env` al repositorio.** Ya está en `.gitignore`; si alguna vez
una llave llega a un commit, dala por quemada y génerala de nuevo — borrarla
después no la borra del historial.

---

## Lo que el motor ya sabe de los estados del Popular

Estas reglas no son suposiciones sobre "los bancos dominicanos": salieron de
leer cinco estados reales, y cada una está fijada con pruebas en
`src/lib/__tests__/`.

| Aspecto | Cuenta corriente | Tarjeta de crédito |
|---|---|---|
| Columnas | Fecha · Comentarios · Monto · Balance · Cheque | Fecha de transacción · Fecha de entrada · Descripción · Monto |
| Fecha | `24/05/2026` (DD/MM/AAAA) | `2026-07-10` (AAAA-MM-DD), salvo el resumen, que varía |
| Signo | Menos **al final** = débito | Menos **al inicio** = abono a tu favor |
| Orden | Cronológico | Desordenado |
| Descripción | Puede ocupar 3 líneas | Una sola línea |
| Cuadre | Cadena de saldo corrido | Contra el Balance al corte |
| Período | El rango que tú escojas, no es mensual | Por ciclo de corte |

Cuatro consecuencias que están metidas en el código:

- **Los signos van al revés entre una y otra.** Un lector que no distinga
  invierte toda la tarjeta: diría que gastaste cuando abonaste.
  Ver `src/lib/signs.ts`.
- **Casi todo lo que parece gasto no lo es.** Las transferencias entre tus
  cuentas y los pagos a tu propia tarjeta hay que emparejarlos por los dos lados
  y sacarlos del gasto. Ver `src/lib/transfers.ts`.
- **Los estados no son mensuales,** así que dos exportaciones se van a solapar.
  Cada movimiento lleva una huella para no duplicarse. Ver `src/lib/fingerprint.ts`.
- **El resumen de la tarjeta mezcla el ciclo con el día de impresión.**
  `Balance al corte`, `Pago mínimo` y las dos fechas son del ciclo; `Balance a la
  fecha` y `Disponible` son del día en que imprimiste. Van en tablas distintas
  (`card_cycles` y `card_snapshots`) o los cortes viejos quedan mal para siempre.

Una limitación que la app declara en vez de esconder: **la primera línea de un
estado no se puede verificar**, porque no hay saldo anterior contra el cual
contrastarla. La pantalla de revisión siempre la marca.

Tres decisiones del reporte, por si te preguntas por qué se ve así:

- **Los totales del mes van como cifras, no como gráfica.** Son tres números;
  una dona de tres porciones se lee peor que tres números bien puestos.
- **Las gráficas usan un solo tono.** Son de una sola serie: la posición y la
  etiqueta ya identifican cada barra, así que pintarlas de colores distintos
  sería colorear por rango, que no añade información.
- **Los valores van escritos al lado de cada barra, no en un tooltip.** En un
  teléfono no hay hover, y un dato que hay que perseguir no es un dato.

La severidad de las alertas va **escrita además de en color**: medidos, el ámbar
y el rojo quedan a una distancia perceptual de 2.0 en deuteranopia —
indistinguibles. El color solo nunca debe cargar el significado.

Las categorías **aprenden**: cuando corriges una, la corrección se guarda como
regla y se aplica también a lo que ya tenías guardado de ese mismo comercio.
Arreglar el pasado, no solo el futuro — y de ahí en adelante tu criterio le gana
a la regla de fábrica.

Y una consecuencia que costó ver: un pago a tu tarjeta debe salir del gasto
**aunque todavía no hayas subido el estado de la tarjeta**. Si solo contaran los
traslados con los dos lados visibles, tu cifra de gasto cambiaría según el orden
en que subes los PDF. Cuando la descripción nombra una cuenta tuya, basta;
la etiqueta dice "falta el otro lado" hasta que aparezca.

---

## Estructura

```
api/             la llamada a Claude, del lado del servidor
  leer-estado.ts   el endpoint HTTP
  _extraer.ts      el prompt de transcripción y la llamada a la API
pruebas/         prueba de extremo a extremo y su estado sintético
src/lib/         el motor, sin nada de interfaz
  signs.ts         convención de signo por tipo de estado
  dates.ts         los tres formatos de fecha
  fingerprint.ts   huella para no duplicar
  reconcile.ts     cuadre del saldo corrido
  transfers.ts     emparejamiento de traslados internos
  recurring.ts     cargos que se repiten solos
  categories.ts    categorías y reglas de clasificación
  insights.ts      las cuatro familias de alertas
  esquemaEstado.ts la forma de lo que devuelve Claude
  normalizar.ts    de la transcripción a movimientos con signo resuelto
  leer.ts          cliente del navegador para /api/leer-estado
  reporte.ts       los números del reporte mensual
  exportar.ts      hoja de cálculo y descargas
  almacen.ts       la interfaz de datos y la versión que guarda en el teléfono
  almacenSupabase.ts la misma interfaz contra Postgres
  crearAlmacen.ts  elige cuál usar según haya sesión o no
  sesion.ts        la sesión de Supabase, leída de su API
src/screens/     Resumen · Movimientos · Estados · Criterio · Revisión · Cuenta · Reporte · Entrar
public/sw.js     service worker: la app abre sin internet
src/data/demo.ts datos de ejemplo (inventados, no son estados reales)
supabase/        schema.sql y seed.sql
```

Los estados de cuenta reales **nunca entran al repositorio**: `.gitignore`
excluye `*.pdf` y la carpeta `estados/`.

---

## En qué va

- [x] **Fase 1 — Base y archivo.** Esqueleto de la app, las cuatro pantallas,
      esquema de base de datos con RLS, subida de PDF, PWA instalable.
- [x] **Motor de lectura.** Signos, fechas, cuadre, traslados, recurrentes,
      categorías y alertas, con 48 pruebas.
- [x] **Fase 2 — Lectura por visión.** La API de Claude recibe el PDF completo y
      rasteriza cada página por su cuenta, así que no hay que convertir nada.
      Incluye la pantalla de revisión, el cuadre automático y la detección de
      traslados internos aunque solo hayas subido uno de los dos lados.
- [x] **Fase 3 — Persistencia, categorías que aprenden y detalle de cuenta.**
      Una sola interfaz de almacenamiento con dos implementaciones detrás: el
      teléfono y Supabase. Las pantallas no saben cuál está activa, así que
      conectar Supabase después no obliga a tocar interfaz.
- [ ] **Fase 4 — Criterio con notificaciones** antes de cada vencimiento.
- [x] **Fase 5 — Reporte mensual, exportación y sin conexión.** Reporte por mes
      con gráficas, guardado en PDF por la ventana de imprimir del teléfono,
      exportación a hoja de cálculo, descarga del PDF original y un service
      worker para que la app abra sin internet.
