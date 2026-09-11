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
npm test          # 48 pruebas del motor de lectura
npm run build     # compila a dist/
npm run typecheck # revisa tipos sin compilar
```

---

## Conectar tu propia base

1. Crea un proyecto gratis en [supabase.com](https://supabase.com).
2. En **SQL Editor → New query**, pega y corre `supabase/schema.sql`, y después
   `supabase/seed.sql`.
3. Copia `.env.example` a `.env` y llena los dos valores desde
   **Settings → API** de tu proyecto:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

4. Reinicia `npm run dev`. La cinta de "modo demostración" desaparece.

Todas las tablas están protegidas con Row Level Security: cada fila pertenece a
un usuario y nadie más puede leerla ni escribirla, ni siquiera con la llave
pública. Los PDFs van a un bucket privado.

**QuickView nunca te pide las claves de tu banco.** No se conecta al Popular ni
a ningún agregador. Solo lee el PDF que tú subes.

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

---

## Estructura

```
src/lib/         el motor, sin nada de interfaz
  signs.ts         convención de signo por tipo de estado
  dates.ts         los tres formatos de fecha
  fingerprint.ts   huella para no duplicar
  reconcile.ts     cuadre del saldo corrido
  transfers.ts     emparejamiento de traslados internos
  recurring.ts     cargos que se repiten solos
  categories.ts    categorías y reglas de clasificación
  insights.ts      las cuatro familias de alertas
src/screens/     Resumen · Movimientos · Estados · Criterio
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
- [ ] **Fase 2 — Lectura por visión.** Los PDFs del Popular son imágenes puras,
      sin capa de texto: cada página se manda a la API de Claude. Pantalla de
      revisión antes de guardar.
- [ ] **Fase 3 — Traslados y categorías en vivo**, sobre datos de Supabase.
- [ ] **Fase 4 — Criterio con notificaciones** antes de cada vencimiento.
- [ ] **Fase 5 — Reporte mensual en PDF**, exportación a Excel y modo sin conexión.
