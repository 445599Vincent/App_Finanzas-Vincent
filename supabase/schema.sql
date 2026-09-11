-- QuickView - esquema de base de datos
--
-- Pegar completo en Supabase > SQL Editor > New query > Run.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- Todo esta protegido por Row Level Security: cada fila pertenece a un usuario
-- y nadie mas la puede leer ni escribir, ni siquiera con la llave publica.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- cuentas

create table if not exists accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nombre      text not null,
  banco       text not null default 'Banco Popular Dominicano',
  tipo        text not null check (tipo in ('corriente','ahorros','tarjeta')),
  -- Solo los ultimos digitos. El numero completo no se guarda nunca.
  ultimos4    text not null check (ultimos4 ~ '^[0-9]{4}$'),
  moneda      text not null default 'DOP' check (moneda in ('DOP','USD')),
  limite      numeric(14,2),
  creado_en   timestamptz not null default now(),
  unique (user_id, tipo, ultimos4)
);

-- ------------------------------------------------------------- estados (PDF)

create table if not exists statements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  -- 'cuenta' y 'tarjeta' se leen con reglas de signo y fecha OPUESTAS.
  clase         text not null check (clase in ('cuenta','tarjeta')),
  -- Los estados del Popular no son mensuales: son el rango que tu escojas.
  rango_desde   date,
  rango_hasta   date,
  archivo_path  text not null,
  saldo_final   numeric(14,2),
  -- Huella del archivo: impide subir dos veces el mismo PDF.
  hash_archivo  text not null,
  -- Resultado del cuadre: 'ok', 'con_descuadres', 'sin_verificar'
  cuadre        text not null default 'sin_verificar',
  subido_en     timestamptz not null default now(),
  unique (user_id, hash_archivo)
);

-- ---------------------------------------------- ciclos de corte de la tarjeta
-- Solo estos cuatro campos pertenecen al ciclo. "Balance a la fecha" y
-- "Disponible" son del dia de impresion y van en card_snapshots, si no los
-- cortes viejos quedan mal para siempre.

create table if not exists card_cycles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  account_id     uuid not null references accounts(id) on delete cascade,
  fecha_corte    date not null,
  balance_corte  numeric(14,2) not null,
  pago_minimo    numeric(14,2) not null default 0,
  fecha_venc     date not null,
  unique (account_id, fecha_corte)
);

create table if not exists card_snapshots (
  account_id        uuid primary key references accounts(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  tomado_el         date not null,
  balance_a_la_fecha numeric(14,2) not null,
  disponible        numeric(14,2),
  limite            numeric(14,2)
);

-- ------------------------------------------------------------- categorias

create table if not exists categories (
  id              text primary key,
  nombre          text not null,
  grupo           text not null,
  -- false para traslados internos e ingresos: existen, pero no son gasto.
  cuenta_en_gasto boolean not null default true
);

-- ------------------------------------------------------------ movimientos

create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    uuid not null references accounts(id) on delete cascade,
  statement_id  uuid references statements(id) on delete set null,
  fecha         date not null,
  fecha_entrada date,
  descripcion   text not null,
  -- Signo normalizado: positivo mejora tu posicion, negativo la empeora.
  -- Vale igual para cuentas y tarjetas, aunque el PDF las escriba al reves.
  monto         numeric(14,2) not null,
  balance       numeric(14,2),
  referencia    text,
  categoria_id  text references categories(id),
  -- true = traslado entre cuentas tuyas. Ni gasto ni ingreso.
  es_interno    boolean not null default false,
  confianza     real not null default 1,
  -- false mientras esperas confirmarlo en la pantalla de revision.
  confirmado    boolean not null default false,
  -- Huella para no duplicar cuando subes rangos que se solapan.
  huella        text not null,
  creado_en     timestamptz not null default now(),
  unique (user_id, huella)
);

create index if not exists transactions_fecha_idx on transactions (user_id, fecha desc);
create index if not exists transactions_cuenta_idx on transactions (account_id, fecha desc);
create index if not exists transactions_categoria_idx on transactions (user_id, categoria_id);

-- ------------------------------------------------- los dos lados de un traslado

create table if not exists transfer_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  salida_id   uuid not null references transactions(id) on delete cascade,
  entrada_id  uuid not null references transactions(id) on delete cascade,
  metodo      text not null check (metodo in ('transferencia','pago-tarjeta')),
  confianza   real not null default 1,
  monto       numeric(14,2) not null,
  unique (salida_id, entrada_id)
);

-- ------------------------------------------- reglas aprendidas de tus correcciones

create table if not exists rules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  patron         text not null,
  categoria_id   text not null references categories(id),
  prioridad      int not null default 100,
  veces_aplicada int not null default 0,
  unique (user_id, patron)
);

-- ---------------------------------------------------------------- presupuestos

create table if not exists budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  categoria_id text not null references categories(id),
  -- Primer dia del mes al que aplica.
  mes          date not null,
  limite       numeric(14,2) not null,
  unique (user_id, categoria_id, mes)
);

-- ------------------------------------------------------------------ recurrentes

create table if not exists recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  comercio     text not null,
  monto        numeric(14,2) not null,
  cada_dias    int not null,
  veces        int not null default 0,
  primer_visto date,
  ultimo_visto date,
  ultimo_monto numeric(14,2),
  unique (user_id, comercio)
);

-- ---------------------------------------------------------------------- alertas

create table if not exists alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tipo       text not null check (tipo in ('corte-pago','recurrente','presupuesto','anomalia')),
  severidad  text not null check (severidad in ('alta','media','info')),
  titulo     text not null,
  mensaje    text not null,
  evidencia  text,
  leida      boolean not null default false,
  creada_en  timestamptz not null default now()
);

-- ------------------------------------------------------------------------- RLS

alter table accounts       enable row level security;
alter table statements     enable row level security;
alter table card_cycles    enable row level security;
alter table card_snapshots enable row level security;
alter table transactions   enable row level security;
alter table transfer_links enable row level security;
alter table rules          enable row level security;
alter table budgets        enable row level security;
alter table recurring      enable row level security;
alter table alerts         enable row level security;
alter table categories     enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'accounts','statements','card_cycles','card_snapshots','transactions',
    'transfer_links','rules','budgets','recurring','alerts'
  ] loop
    execute format('drop policy if exists "solo lo mio" on %I', t);
    execute format(
      'create policy "solo lo mio" on %I for all
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Las categorias son un catalogo compartido: todos leen, nadie escribe.
drop policy if exists "catalogo abierto" on categories;
create policy "catalogo abierto" on categories for select using (true);

-- ------------------------------------------------------------------ permisos
--
-- Row Level Security decide QUE FILAS ve cada quien, pero antes que eso
-- PostgreSQL decide si el rol puede tocar la tabla siquiera. Son dos capas
-- distintas y hacen falta las dos: sin el GRANT, PostgREST responde 403
-- "permission denied" aunque la politica de RLS sea perfectamente permisiva.
--
-- Esto se suele heredar de los privilegios por defecto del proyecto, pero
-- dejarlo escrito hace que el esquema funcione igual en cualquier proyecto,
-- nuevo o viejo, en vez de depender de como venga configurado.

grant usage on schema public to anon, authenticated;

-- El catalogo de categorias lo lee cualquiera, incluso sin sesion iniciada.
grant select on categories to anon, authenticated;

-- Las tablas con datos tuyos solo las toca alguien con sesion, y aun asi RLS
-- lo limita a sus propias filas.
grant select, insert, update, delete on
  accounts, statements, card_cycles, card_snapshots, transactions,
  transfer_links, rules, budgets, recurring, alerts
  to authenticated;

-- ------------------------------------------------------- almacenamiento de PDFs

insert into storage.buckets (id, name, public)
values ('estados', 'estados', false)
on conflict (id) do nothing;

drop policy if exists "mis estados" on storage.objects;
create policy "mis estados" on storage.objects for all
  using (bucket_id = 'estados' and owner = auth.uid())
  with check (bucket_id = 'estados' and owner = auth.uid());
