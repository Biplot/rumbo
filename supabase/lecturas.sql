-- ============================================================
-- Rumbo · Leer el mismo libro con amigos (planes, etapa 4).
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- Leen el mismo libro, cada uno a su ritmo: cada uno lo tiene en sus Lecturas (su
-- documento, solo suyo) y aquí se comparte solo en qué página va cada uno.
--
--   1. lecturas_conjunto: el libro (título, autor y páginas).
--   2. lecturas_conjunto_miembros: quiénes lo leen (activo) y a quiénes invitaron (invitado),
--      en qué página va cada uno, cuándo lo terminó y los avisos al celular ya enviados.
--
-- Nadie lee ni escribe estas tablas directo: todo pasa por las funciones, que validan quién llama.
--   lectura_crear(titulo, autor, paginas, amigos)   lo crea e invita a tus amigos
--   lectura_responder(id, acepta)                   se une o rechaza la invitación
--   lectura_salir(id)                               deja de leerlo con ellos
--   lectura_avance(id, pagina, hoy)                 en qué página vas (al llegar al final, lo terminaste)
--   lectura_lista()                                 tus lecturas con amigos e invitaciones
--
-- Bloquear a alguien te saca de las lecturas que compartían. Si una lectura se queda sin
-- nadie, se borra. Al borrar una cuenta se borra lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. lecturas_conjunto ----------
CREATE TABLE IF NOT EXISTS lecturas_conjunto (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo  text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 80),
  autor   text NOT NULL DEFAULT '' CHECK (char_length(autor) <= 60),
  paginas integer NOT NULL CHECK (paginas BETWEEN 1 AND 10000),
  creador uuid REFERENCES auth.users ON DELETE SET NULL,
  creado  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lecturas_conjunto ENABLE ROW LEVEL SECURITY;

-- ---------- 2. lecturas_conjunto_miembros ----------
CREATE TABLE IF NOT EXISTS lecturas_conjunto_miembros (
  lectura    uuid NOT NULL REFERENCES lecturas_conjunto ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado     text NOT NULL CHECK (estado IN ('invitado', 'activo')),
  invita     uuid,                          -- quién lo invitó
  pagina     integer NOT NULL DEFAULT 0 CHECK (pagina >= 0),
  terminado  date,                          -- el día en que llegó al final
  avisos     jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "acepta": true, "termina": true}
  actualizado timestamptz,
  creado     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lectura, user_id)
);
CREATE INDEX IF NOT EXISTS lecturas_conjunto_miembros_user ON lecturas_conjunto_miembros (user_id);
ALTER TABLE lecturas_conjunto_miembros ENABLE ROW LEVEL SECURITY;

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC)
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;

-- Si una lectura se queda sin nadie activo, se borra (también al borrar una cuenta)
CREATE OR REPLACE FUNCTION rumbo_lectura_vacia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM lecturas_conjunto l WHERE l.id = OLD.lectura
    AND NOT EXISTS (SELECT 1 FROM lecturas_conjunto_miembros m WHERE m.lectura = OLD.lectura AND m.estado = 'activo');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS lectura_vacia ON lecturas_conjunto_miembros;
CREATE TRIGGER lectura_vacia AFTER DELETE ON lecturas_conjunto_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_lectura_vacia();

-- Bloquear a alguien te saca de las lecturas que compartían (y de sus invitaciones)
CREATE OR REPLACE FUNCTION rumbo_lectura_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM lecturas_conjunto_miembros y USING lecturas_conjunto_miembros o
      WHERE y.user_id = NEW.bloquea AND o.lectura = y.lectura AND o.user_id = otro;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lectura_al_bloquear ON amistades;
CREATE TRIGGER lectura_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_lectura_al_bloquear();

-- ---------- Funciones ----------
CREATE OR REPLACE FUNCTION lectura_crear(p_titulo text, p_autor text, p_paginas integer, p_amigos uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nuevo uuid; amigos uuid[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF char_length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'titulo'; END IF;
  IF char_length(btrim(coalesce(p_autor, ''))) > 60 THEN RAISE EXCEPTION 'autor'; END IF;
  IF p_paginas IS NULL OR p_paginas NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'paginas'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 7 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM lecturas_conjunto_miembros WHERE user_id = yo) >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO lecturas_conjunto (titulo, autor, paginas, creador) VALUES (btrim(p_titulo), btrim(coalesce(p_autor, '')), p_paginas, yo) RETURNING id INTO nuevo;
  INSERT INTO lecturas_conjunto_miembros (lectura, user_id, estado, invita) VALUES (nuevo, yo, 'activo', NULL);
  INSERT INTO lecturas_conjunto_miembros (lectura, user_id, estado, invita) SELECT nuevo, x, 'invitado', yo FROM unnest(amigos) x;
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION lectura_responder(p_id uuid, p_acepta boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    IF (SELECT count(*) FROM lecturas_conjunto_miembros WHERE user_id = yo AND estado = 'activo') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
    UPDATE lecturas_conjunto_miembros SET estado = 'activo' WHERE lectura = p_id AND user_id = yo AND estado = 'invitado';
    RETURN CASE WHEN FOUND THEN 'unido' ELSE 'nada' END;
  END IF;
  DELETE FROM lecturas_conjunto_miembros WHERE lectura = p_id AND user_id = yo AND estado = 'invitado';
  RETURN CASE WHEN FOUND THEN 'rechazado' ELSE 'nada' END;
END $$;

CREATE OR REPLACE FUNCTION lectura_salir(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM lecturas_conjunto_miembros WHERE lectura = p_id AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'salio' ELSE 'nada' END;
END $$;

-- En qué página vas. Al llegar a la última, lo terminaste (recien = recién ahora: avisa a los demás)
CREATE OR REPLACE FUNCTION lectura_avance(p_id uuid, p_pagina integer, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); total integer; antes date; ahora date;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT l.paginas, m.terminado INTO total, antes FROM lecturas_conjunto l JOIN lecturas_conjunto_miembros m ON m.lectura = l.id
    WHERE l.id = p_id AND m.user_id = yo AND m.estado = 'activo';
  IF total IS NULL THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF p_pagina IS NULL OR p_pagina < 0 THEN RAISE EXCEPTION 'pagina'; END IF;
  UPDATE lecturas_conjunto_miembros SET pagina = least(p_pagina, total), actualizado = now(),
      terminado = CASE WHEN p_pagina >= total THEN coalesce(terminado, rumbo_hoy(p_hoy)) END
    WHERE lectura = p_id AND user_id = yo RETURNING terminado INTO ahora;
  RETURN jsonb_build_object('pagina', least(p_pagina, total), 'terminado', ahora IS NOT NULL, 'recien', antes IS NULL AND ahora IS NOT NULL);
END $$;

-- Tus lecturas con amigos y las invitaciones: el libro y en qué página va cada uno
CREATE OR REPLACE FUNCTION lectura_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'titulo', l.titulo, 'autor', l.autor, 'paginas', l.paginas, 'estado', mio.estado, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.user_id, 'yo', m.user_id = yo, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar, 'estado', m.estado,
          'pagina', m.pagina, 'terminado', m.terminado, 'actualizado', m.actualizado)
        ORDER BY m.estado, m.creado), '[]'::jsonb)
        FROM lecturas_conjunto_miembros m LEFT JOIN perfiles p ON p.user_id = m.user_id WHERE m.lectura = l.id)
    ) ORDER BY mio.creado), '[]'::jsonb)
  INTO r
  FROM lecturas_conjunto_miembros mio JOIN lecturas_conjunto l ON l.id = mio.lectura
  WHERE mio.user_id = yo;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION lectura_crear(text, text, integer, uuid[]), lectura_responder(uuid, boolean), lectura_salir(uuid),
  lectura_avance(uuid, integer, date), lectura_lista() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lectura_crear(text, text, integer, uuid[]), lectura_responder(uuid, boolean), lectura_salir(uuid),
  lectura_avance(uuid, integer, date), lectura_lista() TO authenticated;

COMMIT;
