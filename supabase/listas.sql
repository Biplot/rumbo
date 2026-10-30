-- ============================================================
-- Rumbo · Listas compartidas con amigos (planes, etapa 2).
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- «Películas por ver con Ana», «Restaurantes por probar», «El viaje al sur»: todos agregan,
-- dicen «yo también» (+1), marcan lo que ya vieron (o probaron) y le ponen estrellas.
-- Tus listas personales siguen en tu documento (estado_usuario), solo tuyas.
--
--   1. listas_compartidas: el nombre y de qué es (películas, series, comida, viaje, libros u otra).
--   2. listas_compartidas_miembros: quiénes están (activo) y a quiénes invitaron (invitado),
--      y los avisos al celular ya enviados.
--   3. listas_compartidas_items: cada cosa (quién la agregó, una nota corta y si ya la vieron).
--   4. listas_compartidas_votos: los +1 y las estrellas (de 1 a 5) de cada uno.
--
-- Nadie lee ni escribe estas tablas directo: todo pasa por las funciones, que validan quién llama.
--   lista_crear(nombre, tipo, amigos)                  la crea e invita a tus amigos
--   lista_invitar(id, amigos)                          invita a más amigos tuyos
--   lista_responder(id, acepta)                        se une o rechaza la invitación
--   lista_salir(id)                                    sale (lo que agregó se queda)
--   lista_editar(id, nombre, tipo)                     cambia el nombre para todos
--   lista_agregar(id, texto, nota)                     agrega algo
--   lista_item_borrar(item)                            borra algo que agregaste tú
--   lista_item_nota(item, nota)                        dónde verla o probarla: «en Netflix»
--   lista_item_visto(item, visto, hoy)                 ya lo vieron (o no)
--   lista_item_marcar(item, mas_uno, estrellas)        tu +1 y tus estrellas
--   lista_lista()                                      tus listas compartidas e invitaciones
--
-- Bloquear a alguien te saca de las listas que compartían. Si una lista se queda sin nadie,
-- se borra. Al borrar una cuenta se borra lo suyo (lo que agregó queda, sin su nombre).
-- ============================================================

BEGIN;

-- ---------- 1. listas_compartidas ----------
CREATE TABLE IF NOT EXISTS listas_compartidas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 60),
  tipo       text NOT NULL DEFAULT 'otra' CHECK (tipo IN ('peliculas', 'series', 'comida', 'viaje', 'libros', 'otra')),
  creador    uuid REFERENCES auth.users ON DELETE SET NULL,
  creado     timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listas_compartidas ENABLE ROW LEVEL SECURITY;

-- ---------- 2. listas_compartidas_miembros ----------
CREATE TABLE IF NOT EXISTS listas_compartidas_miembros (
  lista   uuid NOT NULL REFERENCES listas_compartidas ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado  text NOT NULL CHECK (estado IN ('invitado', 'activo')),
  invita  uuid,                          -- quién lo invitó
  avisos  jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "acepta": true, "agrega": "2026-11-04"}
  creado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lista, user_id)
);
CREATE INDEX IF NOT EXISTS listas_compartidas_miembros_user ON listas_compartidas_miembros (user_id);
ALTER TABLE listas_compartidas_miembros ENABLE ROW LEVEL SECURITY;

-- ---------- 3. listas_compartidas_items ----------
CREATE TABLE IF NOT EXISTS listas_compartidas_items (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lista     uuid NOT NULL REFERENCES listas_compartidas ON DELETE CASCADE,
  user_id   uuid REFERENCES auth.users ON DELETE SET NULL,   -- quién la agregó
  texto     text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 80),
  nota      text NOT NULL DEFAULT '' CHECK (char_length(nota) <= 80),   -- «en Netflix», «en Barrio Italia»
  visto     date,                                            -- el día en que la vieron (o probaron)
  visto_por uuid REFERENCES auth.users ON DELETE SET NULL,
  creado    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listas_compartidas_items_lista ON listas_compartidas_items (lista, creado);
ALTER TABLE listas_compartidas_items ENABLE ROW LEVEL SECURITY;

-- ---------- 4. listas_compartidas_votos ----------
CREATE TABLE IF NOT EXISTS listas_compartidas_votos (
  item      bigint NOT NULL REFERENCES listas_compartidas_items ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mas_uno   boolean NOT NULL DEFAULT false,
  estrellas smallint CHECK (estrellas IS NULL OR estrellas BETWEEN 1 AND 5),
  PRIMARY KEY (item, user_id)
);
ALTER TABLE listas_compartidas_votos ENABLE ROW LEVEL SECURITY;

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC)
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;

-- Si una lista se queda sin nadie activo, se borra (también al borrar una cuenta)
CREATE OR REPLACE FUNCTION rumbo_lista_vacia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM listas_compartidas l WHERE l.id = OLD.lista
    AND NOT EXISTS (SELECT 1 FROM listas_compartidas_miembros m WHERE m.lista = OLD.lista AND m.estado = 'activo');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS lista_vacia ON listas_compartidas_miembros;
CREATE TRIGGER lista_vacia AFTER DELETE ON listas_compartidas_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_lista_vacia();

-- Bloquear a alguien te saca de las listas que compartían (y de sus invitaciones)
CREATE OR REPLACE FUNCTION rumbo_lista_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM listas_compartidas_miembros y USING listas_compartidas_miembros o
      WHERE y.user_id = NEW.bloquea AND o.lista = y.lista AND o.user_id = otro;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lista_al_bloquear ON amistades;
CREATE TRIGGER lista_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_lista_al_bloquear();

-- ¿Quien llama está activo en esa lista?
CREATE OR REPLACE FUNCTION rumbo_en_lista(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM listas_compartidas_miembros WHERE lista = p_id AND user_id = auth.uid() AND estado = 'activo')
$$;
-- La lista de un ítem, si quien llama está activo en ella
CREATE OR REPLACE FUNCTION rumbo_lista_de_item(p_item bigint) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.lista FROM listas_compartidas_items i WHERE i.id = p_item AND rumbo_en_lista(i.lista)
$$;

CREATE OR REPLACE FUNCTION rumbo_lista_validar(p_nombre text, p_tipo text) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF char_length(btrim(coalesce(p_nombre, ''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'nombre'; END IF;
  IF coalesce(p_tipo, '') NOT IN ('peliculas', 'series', 'comida', 'viaje', 'libros', 'otra') THEN RAISE EXCEPTION 'tipo'; END IF;
END $$;

-- ---------- Funciones ----------
CREATE OR REPLACE FUNCTION lista_crear(p_nombre text, p_tipo text, p_amigos uuid[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nuevo uuid; amigos uuid[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  PERFORM rumbo_lista_validar(p_nombre, p_tipo);
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 7 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM listas_compartidas_miembros WHERE user_id = yo) >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO listas_compartidas (nombre, tipo, creador) VALUES (btrim(p_nombre), p_tipo, yo) RETURNING id INTO nuevo;
  INSERT INTO listas_compartidas_miembros (lista, user_id, estado, invita) VALUES (nuevo, yo, 'activo', NULL);
  INSERT INTO listas_compartidas_miembros (lista, user_id, estado, invita) SELECT nuevo, x, 'invitado', yo FROM unnest(amigos) x;
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION lista_invitar(p_id uuid, p_amigos uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); amigos uuid[]; n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_lista(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x
    WHERE x <> yo AND NOT EXISTS (SELECT 1 FROM listas_compartidas_miembros m WHERE m.lista = p_id AND m.user_id = x);
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM listas_compartidas_miembros WHERE lista = p_id) + cardinality(amigos) > 8 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO listas_compartidas_miembros (lista, user_id, estado, invita) SELECT p_id, x, 'invitado', yo FROM unnest(amigos) x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION lista_responder(p_id uuid, p_acepta boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    IF (SELECT count(*) FROM listas_compartidas_miembros WHERE user_id = yo AND estado = 'activo') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
    UPDATE listas_compartidas_miembros SET estado = 'activo' WHERE lista = p_id AND user_id = yo AND estado = 'invitado';
    RETURN CASE WHEN FOUND THEN 'unido' ELSE 'nada' END;
  END IF;
  DELETE FROM listas_compartidas_miembros WHERE lista = p_id AND user_id = yo AND estado = 'invitado';
  RETURN CASE WHEN FOUND THEN 'rechazado' ELSE 'nada' END;
END $$;

-- Al salir, lo que agregaste se queda en la lista
CREATE OR REPLACE FUNCTION lista_salir(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM listas_compartidas_miembros WHERE lista = p_id AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'salio' ELSE 'nada' END;
END $$;

CREATE OR REPLACE FUNCTION lista_editar(p_id uuid, p_nombre text, p_tipo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_lista(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  PERFORM rumbo_lista_validar(p_nombre, p_tipo);
  UPDATE listas_compartidas SET nombre = btrim(p_nombre), tipo = p_tipo, updated_at = now() WHERE id = p_id;
  RETURN 'ok';
END $$;

-- Agregar algo: hasta 200 por lista y 50 al día por persona
CREATE OR REPLACE FUNCTION lista_agregar(p_id uuid, p_texto text, p_nota text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nuevo bigint;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_lista(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF char_length(btrim(coalesce(p_texto, ''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'texto'; END IF;
  IF (SELECT count(*) FROM listas_compartidas_items WHERE lista = p_id) >= 200
    OR (SELECT count(*) FROM listas_compartidas_items WHERE user_id = yo AND creado > now() - interval '1 day') >= 50 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO listas_compartidas_items (lista, user_id, texto, nota)
    VALUES (p_id, yo, btrim(p_texto), left(btrim(coalesce(p_nota, '')), 80)) RETURNING id INTO nuevo;
  UPDATE listas_compartidas SET updated_at = now() WHERE id = p_id;
  RETURN nuevo;
END $$;

-- Borrar algo: lo que agregaste tú (o, si quien lo agregó ya no tiene cuenta, cualquiera de la lista)
CREATE OR REPLACE FUNCTION lista_item_borrar(p_item bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM listas_compartidas_items WHERE id = p_item AND rumbo_en_lista(lista) AND (user_id = auth.uid() OR user_id IS NULL);
  RETURN CASE WHEN FOUND THEN 'borrado' ELSE 'nada' END;
END $$;

-- La nota (dónde verla, dónde queda): cualquiera de la lista la cambia
CREATE OR REPLACE FUNCTION lista_item_nota(p_item bigint, p_nota text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF rumbo_lista_de_item(p_item) IS NULL THEN RAISE EXCEPTION 'no-miembro'; END IF;
  UPDATE listas_compartidas_items SET nota = left(btrim(coalesce(p_nota, '')), 80) WHERE id = p_item;
  RETURN 'ok';
END $$;

-- Ya lo vieron (o lo probaron): cualquiera de la lista lo marca o lo desmarca
CREATE OR REPLACE FUNCTION lista_item_visto(p_item bigint, p_visto boolean, p_hoy date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF rumbo_lista_de_item(p_item) IS NULL THEN RAISE EXCEPTION 'no-miembro'; END IF;
  UPDATE listas_compartidas_items SET visto = CASE WHEN p_visto THEN coalesce(visto, rumbo_hoy(p_hoy)) END,
      visto_por = CASE WHEN p_visto THEN coalesce(visto_por, auth.uid()) END
    WHERE id = p_item;
  IF NOT p_visto THEN   -- sin ver, no hay estrellas
    UPDATE listas_compartidas_votos SET estrellas = NULL WHERE item = p_item;
    DELETE FROM listas_compartidas_votos WHERE item = p_item AND NOT mas_uno;
  END IF;
  RETURN CASE WHEN p_visto THEN 'visto' ELSE 'por-ver' END;
END $$;

-- Tu +1 (también quieres) y tus estrellas (de 1 a 5, solo si ya lo vieron)
CREATE OR REPLACE FUNCTION lista_item_marcar(p_item bigint, p_mas_uno boolean, p_estrellas integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); visto date;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF rumbo_lista_de_item(p_item) IS NULL THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF p_estrellas IS NOT NULL AND p_estrellas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'estrellas'; END IF;
  SELECT i.visto INTO visto FROM listas_compartidas_items i WHERE i.id = p_item;
  INSERT INTO listas_compartidas_votos (item, user_id, mas_uno, estrellas)
    VALUES (p_item, yo, coalesce(p_mas_uno, false), CASE WHEN visto IS NULL THEN NULL ELSE p_estrellas END)
    ON CONFLICT (item, user_id) DO UPDATE SET mas_uno = EXCLUDED.mas_uno, estrellas = EXCLUDED.estrellas;
  DELETE FROM listas_compartidas_votos WHERE item = p_item AND user_id = yo AND NOT mas_uno AND estrellas IS NULL;
  RETURN 'ok';
END $$;

-- Tus listas compartidas y las invitaciones: quiénes están, y cada cosa con sus +1 y sus estrellas
CREATE OR REPLACE FUNCTION lista_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'nombre', l.nombre, 'tipo', l.tipo, 'estado', mio.estado, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.user_id, 'yo', m.user_id = yo, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar, 'estado', m.estado)
        ORDER BY m.estado, m.creado), '[]'::jsonb)
        FROM listas_compartidas_miembros m LEFT JOIN perfiles p ON p.user_id = m.user_id WHERE m.lista = l.id),
      'items', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'user_id', i.user_id, 'nombre', coalesce(p.nombre, ''), 'texto', i.texto, 'nota', i.nota, 'visto', i.visto, 'visto_por', i.visto_por,
          'mas_uno', (SELECT coalesce(jsonb_agg(v.user_id), '[]'::jsonb) FROM listas_compartidas_votos v WHERE v.item = i.id AND v.mas_uno),
          'estrellas', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', v.user_id, 'n', v.estrellas)), '[]'::jsonb)
            FROM listas_compartidas_votos v WHERE v.item = i.id AND v.estrellas IS NOT NULL))
        ORDER BY i.creado, i.id), '[]'::jsonb)
        FROM listas_compartidas_items i LEFT JOIN perfiles p ON p.user_id = i.user_id WHERE i.lista = l.id)
    ) ORDER BY mio.creado), '[]'::jsonb)
  INTO r
  FROM listas_compartidas_miembros mio JOIN listas_compartidas l ON l.id = mio.lista
  WHERE mio.user_id = yo;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION lista_crear(text, text, uuid[]), lista_invitar(uuid, uuid[]), lista_responder(uuid, boolean), lista_salir(uuid),
  lista_editar(uuid, text, text), lista_agregar(uuid, text, text), lista_item_borrar(bigint), lista_item_nota(bigint, text), lista_item_visto(bigint, boolean, date),
  lista_item_marcar(bigint, boolean, integer), lista_lista(), rumbo_en_lista(uuid), rumbo_lista_de_item(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lista_crear(text, text, uuid[]), lista_invitar(uuid, uuid[]), lista_responder(uuid, boolean), lista_salir(uuid),
  lista_editar(uuid, text, text), lista_agregar(uuid, text, text), lista_item_borrar(bigint), lista_item_nota(bigint, text), lista_item_visto(bigint, boolean, date),
  lista_item_marcar(bigint, boolean, integer), lista_lista(), rumbo_en_lista(uuid), rumbo_lista_de_item(bigint) TO authenticated;

COMMIT;
