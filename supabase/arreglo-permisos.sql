-- Permisos, sueltos.
--
-- Es solo la parte de GRANT de schema.sql, separada para poder pegarla rapido
-- desde el telefono sin copiar el esquema entero.
--
-- Correrlo solo hace falta si `npm run revisar` dice que categories responde
-- 403 CON un mensaje de error de Supabase. Supabase concede estos permisos por
-- defecto, asi que lo normal es que no haga falta. Se puede correr las veces
-- que sea: no rompe nada.

grant usage on schema public to anon, authenticated;

-- El catalogo de categorias lo lee cualquiera, incluso sin sesion iniciada.
grant select on categories to anon, authenticated;

-- Las tablas con datos tuyos solo las toca alguien con sesion, y aun asi Row
-- Level Security lo limita a sus propias filas.
grant select, insert, update, delete on
  accounts, statements, card_cycles, card_snapshots, transactions,
  transfer_links, rules, budgets, recurring, alerts
  to authenticated;
