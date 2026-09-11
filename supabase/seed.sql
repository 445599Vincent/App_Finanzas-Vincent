-- Catalogo de categorias. Correr despues de schema.sql.
-- "Impuestos bancarios" y "Comisiones y seguros" van aparte a proposito:
-- sumados al ano no son poca cosa y se pierden entre el ruido si se mezclan.

insert into categories (id, nombre, grupo, cuenta_en_gasto) values
  ('ingreso',       'Ingresos',             'Ingreso',        false),
  ('interno',       'Traslado interno',     'Interno',        false),
  ('supermercado',  'Supermercado',         'Esencial',       true),
  ('combustible',   'Combustible',          'Esencial',       true),
  ('servicios',     'Servicios',            'Esencial',       true),
  ('salud',         'Salud y farmacia',     'Esencial',       true),
  ('vivienda',      'Vivienda',             'Esencial',       true),
  ('educacion',     'Educación',            'Esencial',       true),
  ('vehiculo',      'Vehículo',             'Esencial',       true),
  ('restaurantes',  'Restaurantes',         'Estilo de vida', true),
  ('compras',       'Compras',              'Estilo de vida', true),
  ('suscripciones', 'Suscripciones',        'Estilo de vida', true),
  ('cuidado',       'Cuidado personal',     'Estilo de vida', true),
  ('viajes',        'Viajes y hoteles',     'Estilo de vida', true),
  ('transporte',    'Transporte',           'Estilo de vida', true),
  ('impuestos',     'Impuestos bancarios',  'Banco',          true),
  ('comisiones',    'Comisiones y seguros', 'Banco',          true),
  ('otros',         'Sin clasificar',       'Estilo de vida', true)
on conflict (id) do update
  set nombre = excluded.nombre,
      grupo = excluded.grupo,
      cuenta_en_gasto = excluded.cuenta_en_gasto;
