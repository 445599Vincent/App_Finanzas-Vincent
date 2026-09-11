-- Arreglo del 403 en categories.
--
-- Este archivo es solo la parte de permisos de schema.sql, suelta, para poder
-- pegarla rapido desde el telefono sin copiar el esquema entero.
--
-- Row Level Security decide QUE FILAS ve cada quien, pero antes que eso
-- PostgreSQL decide si el rol puede tocar la tabla siquiera. Hacen falta las
-- dos: sin el GRANT, la respuesta es 403 aunque la politica sea permisiva.
--
-- Se puede correr las veces que haga falta.

grant usage on schema public to anon, authenticated;

-- El catalogo de categorias lo lee cualquiera, incluso sin sesion iniciada.
grant select on categories to anon, authenticated;

-- Las tablas con datos tuyos solo las toca alguien con sesion, y aun asi Row
-- Level Security lo limita a sus propias filas.
grant select, insert, update, delete on
  accounts, statements, card_cycles, card_snapshots, transactions,
  transfer_links, rules, budgets, recurring, alerts
  to authenticated;
