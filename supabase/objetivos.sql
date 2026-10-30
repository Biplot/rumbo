-- ============================================================
-- Rumbo · Amigos (etapa 3): objetivos en conjunto.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- Una meta con avance sumado entre varios: juntar para un viaje, correr 100 km en el
-- mes, leer 12 libros entre todos. Cada uno suma sus aportes y la barra muestra lo de
-- cada uno. Tus objetivos personales siguen en tu documento (estado_usuario), solo tuyos.
--
--   1. objetivos_conjunto: la meta (nombre, unidad, cuánto, hasta cuándo) y si ya se cumplió.
--   2. objetivos_conjunto_miembros: quiénes están (activo) y a quiénes invitaron (invitado),
--      y los avisos al celular ya enviados.
--   3. objetivos_conjunto_aportes: cada aporte (quién, cuánto, una nota corta y el día).
--
-- Nadie lee ni escribe estas tablas directo: todo pasa por las funciones, que validan quién llama.
--   objetivo_crear(nombre, unidad, meta, fecha_limite, amigos, hoy)   lo crea e invita a tus amigos
--   objetivo_invitar(id, amigos)                                      invita a más amigos tuyos
--   objetivo_responder(id, acepta, hoy)                               se une o rechaza la invitación
--   objetivo_salir(id)                                                sale (sus aportes siguen sumando)
--   objetivo_editar(id, nombre, unidad, meta, fecha_limite)           cambia la meta para todos
--   objetivo_aportar(id, cantidad, nota, hoy)                         suma un aporte
--   objetivo_borrar_aporte(aporte)                                    borra un aporte tuyo
--   objetivo_lista()                                                  tus objetivos en conjunto e invitaciones
--
-- Se cumple cuando lo aportado llega a la meta (cumplido guarda el día); si después se
-- borra un aporte o sube la meta y ya no llega, vuelve a estar en curso. Bloquear a alguien
-- te saca de los objetivos que compartían. Si un objetivo se queda sin nadie, se borra.
-- Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. objetivos_conjunto ----------
CREATE TABLE IF NOT EXISTS objetivos_conjunto (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 60),
  unidad       text NOT NULL DEFAULT '' CHECK (char_length(unidad) <= 12),
  meta         numeric(16, 2) NOT NULL CHECK (meta > 0 AND meta <= 1000000000000),
  fecha_limite date,
  creador      uuid REFERENCES auth.users ON DELETE SET NULL,
  creado       date NOT NULL DEFAULT current_date,
  cumplido     date,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE objetivos_conjunto ENABLE ROW LEVEL SECURITY;

-- ---------- 2. objetivos_conjunto_miembros ----------
CREATE TABLE IF NOT EXISTS objetivos_conjunto_miembros (
  objetivo uuid NOT NULL REFERENCES objetivos_conjunto ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado   text NOT NULL CHECK (estado IN ('invitado', 'activo')),
  invita   uuid,                          -- quién lo invitó
  desde    date,                          -- cuando se unió
  avisos   jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "aporte": "2026-11-02", "cumplido": true}
  creado   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objetivo, user_id)
);
CREATE INDEX IF NOT EXISTS objetivos_conjunto_miembros_user ON objetivos_conjunto_miembros (user_id);
ALTER TABLE objetivos_conjunto_miembros ENABLE ROW LEVEL SECURITY;

-- ---------- 3. objetivos_conjunto_aportes ----------
CREATE TABLE IF NOT EXISTS objetivos_conjunto_aportes (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  objetivo uuid NOT NULL REFERENCES objetivos_conjunto ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cantidad numeric(16, 2) NOT NULL CHECK (cantidad > 0 AND cantidad <= 1000000000000),
  nota     text NOT NULL DEFAULT '' CHECK (char_length(nota) <= 80),
  fecha    date NOT NULL DEFAULT current_date,
  creado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS objetivos_conjunto_aportes_obj ON objetivos_conjunto_aportes (objetivo, creado);
ALTER TABLE objetivos_conjunto_aportes ENABLE ROW LEVEL SECURITY;

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC)
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;

-- Si un objetivo se queda sin nadie activo, se borra (también al borrar una cuenta)
CREATE OR REPLACE FUNCTION rumbo_objetivo_vacio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM objetivos_conjunto o WHERE o.id = OLD.objetivo
    AND NOT EXISTS (SELECT 1 FROM objetivos_conjunto_miembros m WHERE m.objetivo = OLD.objetivo AND m.estado = 'activo');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS objetivo_vacio ON objetivos_conjunto_miembros;
CREATE TRIGGER objetivo_vacio AFTER DELETE ON objetivos_conjunto_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_objetivo_vacio();

-- Bloquear a alguien te saca de los objetivos que compartían (y de sus invitaciones)
CREATE OR REPLACE FUNCTION rumbo_objetivo_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM objetivos_conjunto_miembros y USING objetivos_conjunto_miembros o
      WHERE y.user_id = NEW.bloquea AND o.objetivo = y.objetivo AND o.user_id = otro;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS objetivo_al_bloquear ON amistades;
CREATE TRIGGER objetivo_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_objetivo_al_bloquear();

-- ¿Quien llama está activo en ese objetivo?
CREATE OR REPLACE FUNCTION rumbo_en_objetivo(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM objetivos_conjunto_miembros WHERE objetivo = p_id AND user_id = auth.uid() AND estado = 'activo')
$$;

CREATE OR REPLACE FUNCTION rumbo_objetivo_validar(p_nombre text, p_unidad text, p_meta numeric) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF char_length(btrim(coalesce(p_nombre, ''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'nombre'; END IF;
  IF char_length(btrim(coalesce(p_unidad, ''))) > 12 THEN RAISE EXCEPTION 'unidad'; END IF;
  IF p_meta IS NULL OR p_meta <= 0 OR p_meta > 1000000000000 THEN RAISE EXCEPTION 'meta'; END IF;
END $$;

-- Lo aportado hasta ahora y, si llegó a la meta, desde cuándo está cumplido
CREATE OR REPLACE FUNCTION rumbo_objetivo_recalcular(p_id uuid, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total numeric; antes date; ahora date;
BEGIN
  SELECT coalesce(sum(cantidad), 0) INTO total FROM objetivos_conjunto_aportes WHERE objetivo = p_id;
  SELECT cumplido INTO antes FROM objetivos_conjunto WHERE id = p_id;
  UPDATE objetivos_conjunto SET cumplido = CASE WHEN total >= meta THEN coalesce(cumplido, p_hoy) ELSE NULL END, updated_at = now()
    WHERE id = p_id RETURNING cumplido INTO ahora;
  RETURN jsonb_build_object('total', total, 'cumplido', ahora IS NOT NULL, 'recien', antes IS NULL AND ahora IS NOT NULL);
END $$;

-- ---------- Funciones ----------
CREATE OR REPLACE FUNCTION objetivo_crear(p_nombre text, p_unidad text, p_meta numeric, p_fecha_limite date, p_amigos uuid[], p_hoy date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); nuevo uuid; amigos uuid[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  PERFORM rumbo_objetivo_validar(p_nombre, p_unidad, p_meta);
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 7 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM objetivos_conjunto_miembros WHERE user_id = yo) >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO objetivos_conjunto (nombre, unidad, meta, fecha_limite, creador, creado)
    VALUES (btrim(p_nombre), btrim(coalesce(p_unidad, '')), round(p_meta, 2), p_fecha_limite, yo, hoy) RETURNING id INTO nuevo;
  INSERT INTO objetivos_conjunto_miembros (objetivo, user_id, estado, invita, desde) VALUES (nuevo, yo, 'activo', NULL, hoy);
  INSERT INTO objetivos_conjunto_miembros (objetivo, user_id, estado, invita) SELECT nuevo, x, 'invitado', yo FROM unnest(amigos) x;
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION objetivo_invitar(p_id uuid, p_amigos uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); amigos uuid[]; n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_objetivo(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x
    WHERE x <> yo AND NOT EXISTS (SELECT 1 FROM objetivos_conjunto_miembros m WHERE m.objetivo = p_id AND m.user_id = x);
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM objetivos_conjunto_miembros WHERE objetivo = p_id) + cardinality(amigos) > 8 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO objetivos_conjunto_miembros (objetivo, user_id, estado, invita) SELECT p_id, x, 'invitado', yo FROM unnest(amigos) x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION objetivo_responder(p_id uuid, p_acepta boolean, p_hoy date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    IF (SELECT count(*) FROM objetivos_conjunto_miembros WHERE user_id = yo AND estado = 'activo') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
    UPDATE objetivos_conjunto_miembros SET estado = 'activo', desde = rumbo_hoy(p_hoy)
      WHERE objetivo = p_id AND user_id = yo AND estado = 'invitado';
    RETURN CASE WHEN FOUND THEN 'unido' ELSE 'nada' END;
  END IF;
  DELETE FROM objetivos_conjunto_miembros WHERE objetivo = p_id AND user_id = yo AND estado = 'invitado';
  RETURN CASE WHEN FOUND THEN 'rechazado' ELSE 'nada' END;
END $$;

-- Al salir, tus aportes siguen sumando (lo que pusiste en común, ahí queda)
CREATE OR REPLACE FUNCTION objetivo_salir(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM objetivos_conjunto_miembros WHERE objetivo = p_id AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'salio' ELSE 'nada' END;
END $$;

CREATE OR REPLACE FUNCTION objetivo_editar(p_id uuid, p_nombre text, p_unidad text, p_meta numeric, p_fecha_limite date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_objetivo(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  PERFORM rumbo_objetivo_validar(p_nombre, p_unidad, p_meta);
  UPDATE objetivos_conjunto SET nombre = btrim(p_nombre), unidad = btrim(coalesce(p_unidad, '')), meta = round(p_meta, 2), fecha_limite = p_fecha_limite
    WHERE id = p_id;
  RETURN rumbo_objetivo_recalcular(p_id, current_date);
END $$;

-- Un aporte: hasta 30 al día por persona en un mismo objetivo
CREATE OR REPLACE FUNCTION objetivo_aportar(p_id uuid, p_cantidad numeric, p_nota text, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); nuevo bigint; r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_objetivo(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF p_cantidad IS NULL OR round(p_cantidad, 2) <= 0 OR p_cantidad > 1000000000000 THEN RAISE EXCEPTION 'cantidad'; END IF;
  IF (SELECT count(*) FROM objetivos_conjunto_aportes WHERE objetivo = p_id AND user_id = yo AND creado > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'limite';
  END IF;
  INSERT INTO objetivos_conjunto_aportes (objetivo, user_id, cantidad, nota, fecha)
    VALUES (p_id, yo, round(p_cantidad, 2), left(btrim(coalesce(p_nota, '')), 80), hoy) RETURNING id INTO nuevo;
  r := rumbo_objetivo_recalcular(p_id, hoy);
  RETURN r || jsonb_build_object('id', nuevo);
END $$;

-- Borrar un aporte tuyo (si te equivocaste); el objetivo puede volver a estar en curso
CREATE OR REPLACE FUNCTION objetivo_borrar_aporte(p_aporte bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); obj uuid;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM objetivos_conjunto_aportes WHERE id = p_aporte AND user_id = yo RETURNING objetivo INTO obj;
  IF obj IS NULL THEN RETURN NULL; END IF;
  RETURN rumbo_objetivo_recalcular(obj, current_date);
END $$;

-- Tus objetivos en conjunto y las invitaciones: quiénes están, cuánto lleva cada uno
-- (también quienes salieron) y los últimos 30 aportes
CREATE OR REPLACE FUNCTION objetivo_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'nombre', o.nombre, 'unidad', o.unidad, 'meta', o.meta, 'fecha_limite', o.fecha_limite,
      'creado', o.creado, 'cumplido', o.cumplido, 'estado', mio.estado, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.user_id, 'yo', m.user_id = yo, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar, 'estado', m.estado, 'desde', m.desde)
        ORDER BY m.estado, m.creado), '[]'::jsonb)
        FROM objetivos_conjunto_miembros m LEFT JOIN perfiles p ON p.user_id = m.user_id WHERE m.objetivo = o.id),
      'totales', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.user_id, 'nombre', coalesce(p.nombre, ''), 'total', t.total)), '[]'::jsonb)
        FROM (SELECT user_id, sum(cantidad) total FROM objetivos_conjunto_aportes WHERE objetivo = o.id GROUP BY user_id) t
        LEFT JOIN perfiles p ON p.user_id = t.user_id),
      'aportes', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id, 'cantidad', a.cantidad, 'nota', a.nota, 'fecha', a.fecha) ORDER BY a.creado DESC), '[]'::jsonb)
        FROM (SELECT * FROM objetivos_conjunto_aportes WHERE objetivo = o.id ORDER BY creado DESC LIMIT 30) a)
    ) ORDER BY mio.creado), '[]'::jsonb)
  INTO r
  FROM objetivos_conjunto_miembros mio JOIN objetivos_conjunto o ON o.id = mio.objetivo
  WHERE mio.user_id = yo;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION objetivo_crear(text, text, numeric, date, uuid[], date), objetivo_invitar(uuid, uuid[]), objetivo_responder(uuid, boolean, date),
  objetivo_salir(uuid), objetivo_editar(uuid, text, text, numeric, date), objetivo_aportar(uuid, numeric, text, date),
  objetivo_borrar_aporte(bigint), objetivo_lista(), rumbo_en_objetivo(uuid), rumbo_objetivo_recalcular(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION objetivo_crear(text, text, numeric, date, uuid[], date), objetivo_invitar(uuid, uuid[]), objetivo_responder(uuid, boolean, date),
  objetivo_salir(uuid), objetivo_editar(uuid, text, text, numeric, date), objetivo_aportar(uuid, numeric, text, date),
  objetivo_borrar_aporte(bigint), objetivo_lista(), rumbo_en_objetivo(uuid) TO authenticated;

COMMIT;
