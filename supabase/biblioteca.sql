-- ============================================================
-- Rumbo · 📚 La biblioteca con amigos: tu repisa en las visitas y recomendar libros.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql (y de visitas.sql).
-- Se puede correr más de una vez.
--
--   1. perfiles.biblioteca: tus libros terminados como se ven en tu repisa (título, autor, color,
--      páginas, formato y ★; nunca tus notas, tus frases ni a quién prestaste), si eliges mostrar
--      «Tu biblioteca» en Amigos › Lo que muestras. La leen solo tus amigos (las reglas de perfiles).
--   2. libro_recomendaciones: un libro que le recomiendas a un amigo. Le llega a su «Por leer».
--
-- Nadie lee ni escribe la tabla de recomendaciones directo: todo pasa por las funciones.
--   libro_recomendar(para, titulo, autor, paginas, color)   recomienda un libro a un amigo (hasta 20 al día)
--   libro_recomendaciones()                                 las que te llegaron y todavía no están en tu Rumbo
--   libro_recomendaciones_vistas(ids)                       ya quedaron en tu «Por leer»
-- Las vistas se borran a los 30 días. Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. perfiles.biblioteca ----------
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS biblioteca jsonb;
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_biblioteca_tam;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_biblioteca_tam CHECK (biblioteca IS NULL OR char_length(biblioteca::text) <= 40000);

-- ---------- 2. libro_recomendaciones ----------
CREATE TABLE IF NOT EXISTS libro_recomendaciones (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  de      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  para    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  titulo  text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 80),
  autor   text NOT NULL DEFAULT '' CHECK (char_length(autor) <= 60),
  paginas integer NOT NULL DEFAULT 0 CHECK (paginas BETWEEN 0 AND 3000),
  color   text NOT NULL DEFAULT '' CHECK (color = '' OR color ~ '^#[0-9A-Fa-f]{6}$'),
  visto   boolean NOT NULL DEFAULT false,
  avisado boolean NOT NULL DEFAULT false,   -- el aviso al celular ya salió (api/push.js)
  creado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS libro_recomendaciones_para ON libro_recomendaciones (para, visto);
CREATE INDEX IF NOT EXISTS libro_recomendaciones_de ON libro_recomendaciones (de, creado);
ALTER TABLE libro_recomendaciones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION libro_recomendar(p_para uuid, p_titulo text, p_autor text, p_paginas integer, p_color text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nuevo bigint; t text := btrim(coalesce(p_titulo, ''));
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_para IS NULL OR p_para = yo OR NOT rumbo_son_amigos(p_para) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF char_length(t) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'titulo'; END IF;
  IF (SELECT count(*) FROM libro_recomendaciones WHERE de = yo AND creado > now() - interval '1 day') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  DELETE FROM libro_recomendaciones WHERE visto AND creado < now() - interval '30 days';
  INSERT INTO libro_recomendaciones (de, para, titulo, autor, paginas, color)
    VALUES (yo, p_para, t, left(btrim(coalesce(p_autor, '')), 60), least(3000, greatest(0, coalesce(p_paginas, 0))),
      CASE WHEN coalesce(p_color, '') ~ '^#[0-9A-Fa-f]{6}$' THEN p_color ELSE '' END)
    RETURNING id INTO nuevo;
  RETURN nuevo;
END $$;

-- Las que te llegaron (de amigos que siguen siéndolo), con el nombre de quien te lo recomendó
CREATE OR REPLACE FUNCTION libro_recomendaciones() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'titulo', x.titulo, 'autor', x.autor, 'paginas', x.paginas, 'color', x.color,
      'nombre', coalesce(p.nombre, '')) ORDER BY x.creado), '[]'::jsonb)
  INTO r
  FROM libro_recomendaciones x LEFT JOIN perfiles p ON p.user_id = x.de
  WHERE x.para = yo AND NOT x.visto AND rumbo_son_amigos(x.de);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION libro_recomendaciones_vistas(p_ids bigint[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  UPDATE libro_recomendaciones SET visto = true WHERE para = auth.uid() AND id = ANY (coalesce(p_ids, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION libro_recomendar(uuid, text, text, integer, text), libro_recomendaciones(), libro_recomendaciones_vistas(bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION libro_recomendar(uuid, text, text, integer, text), libro_recomendaciones(), libro_recomendaciones_vistas(bigint[]) TO authenticated;

COMMIT;

-- Que la API vea la columna nueva de inmediato
NOTIFY pgrst, 'reload schema';
