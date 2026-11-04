-- ============================================================
-- Rumbo · 💧 Agua, tercera entrega: el aviso «+ Un vaso», la fuente de Rumbo y el bidón con amigos.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
--   1. agua_pendientes: los vasos que tocaste en el aviso («+ Un vaso» o «+ Tu botella»)
--      sin abrir la app. Los anota api/push.js con la clave de servicio, después de revisar
--      la firma que iba en el aviso; la app los trae (y se borran) con agua_pendientes_tomar().
--      Si nadie los trae en 3 días, se borran solos.
--   2. fuente_dias: cuánto lleva cada persona hoy (hasta 4 L), para la fuente de Rumbo.
--      Nadie lee la tabla: fuente_hoy() entrega solo el total del día y cuántas personas.
--   3. bidones, bidon_miembros, bidon_aportes: el bidón de la semana con amigos. Cada uno
--      suma el agua que toma de lunes a domingo (hasta 5 L al día) y el bidón muestra lo de
--      cada uno con su color. Nadie ve nada más de tu agua: ni la hora ni los vasos.
--
-- Nadie lee ni escribe estas tablas directo: todo pasa por las funciones, que validan quién llama.
--   agua_pendientes_tomar()                              los vasos del aviso que faltan en tu Rumbo
--   fuente_sumar(fecha, ml)                              lo que llevas hoy (lo pone al día; si deshaces, baja)
--   fuente_hoy(fecha)                                    { ml, personas, yo } del día
--   bidon_crear(nombre, meta_ml, amigos, hoy)            lo arma para esta semana e invita a tus amigos
--   bidon_invitar(id, amigos)                            invita a más amigos tuyos (hasta 8 en total)
--   bidon_responder(id, acepta, hoy)                     se une o rechaza la invitación
--   bidon_salir(id)                                      sale (lo que aportó sigue en el bidón)
--   bidon_aportar(id, dias, hoy)                         { "2026-11-02": 1500, … } lo de cada día de la semana
--   bidon_lista()                                        tus bidones de esta semana y la anterior, e invitaciones
--
-- Si un bidón se queda sin nadie, se borra; los de hace más de 3 semanas, también.
-- Bloquear a alguien te saca de los bidones que compartían.
-- Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC). También en objetivos.sql.
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;
-- El lunes de esa semana
CREATE OR REPLACE FUNCTION rumbo_lunes(p_dia date) RETURNS date
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_dia - (extract(isodow FROM p_dia)::int - 1)
$$;

-- ---------- 1. agua_pendientes ----------
CREATE TABLE IF NOT EXISTS agua_pendientes (
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  id      text NOT NULL CHECK (id ~ '^[a-z0-9]{4,40}$'),
  fecha   date NOT NULL,
  ml      integer NOT NULL CHECK (ml BETWEEN 50 AND 3000),
  ts      bigint NOT NULL,
  creado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS agua_pendientes_creado ON agua_pendientes (creado);
ALTER TABLE agua_pendientes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION agua_pendientes_tomar() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM agua_pendientes WHERE creado < now() - interval '3 days';
  WITH t AS (DELETE FROM agua_pendientes WHERE user_id = yo RETURNING id, fecha, ml, ts)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha, 'ml', ml, 'ts', ts) ORDER BY ts), '[]'::jsonb) INTO r FROM t;
  RETURN r;
END $$;

-- ---------- 2. fuente_dias ----------
CREATE TABLE IF NOT EXISTS fuente_dias (
  fecha      date NOT NULL,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ml         integer NOT NULL CHECK (ml BETWEEN 0 AND 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fecha, user_id)
);
ALTER TABLE fuente_dias ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fuente_hoy(p_fecha date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('fecha', rumbo_hoy(p_fecha), 'ml', coalesce(sum(ml), 0), 'personas', count(*) FILTER (WHERE ml > 0),
    'yo', coalesce(max(ml) FILTER (WHERE user_id = auth.uid()), 0))
  FROM fuente_dias WHERE fecha = rumbo_hoy(p_fecha)
$$;

-- Cada persona suma hasta 4 L al día (la app manda lo que llevas, hasta tu meta): no se pueden inflar los números
CREATE OR REPLACE FUNCTION fuente_sumar(p_fecha date, p_ml integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_fecha);
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_fecha IS DISTINCT FROM hoy THEN RAISE EXCEPTION 'fecha'; END IF;
  INSERT INTO fuente_dias (fecha, user_id, ml) VALUES (hoy, yo, least(4000, greatest(0, coalesce(p_ml, 0))))
    ON CONFLICT (fecha, user_id) DO UPDATE SET ml = EXCLUDED.ml, updated_at = now();
  DELETE FROM fuente_dias WHERE fecha < current_date - 2;   -- lo de antes de ayer ya no se usa
  RETURN fuente_hoy(hoy);
END $$;

-- ---------- 3. bidones ----------
CREATE TABLE IF NOT EXISTS bidones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 40),
  meta_ml    integer NOT NULL CHECK (meta_ml BETWEEN 5000 AND 300000),
  lunes      date NOT NULL,                     -- la semana del bidón: de ese lunes al domingo
  creador    uuid REFERENCES auth.users ON DELETE SET NULL,
  creado     timestamptz NOT NULL DEFAULT now(),
  lleno      date,                              -- el día que llegaron a la meta
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bidones_lunes ON bidones (lunes);
ALTER TABLE bidones ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bidon_miembros (
  bidon   uuid NOT NULL REFERENCES bidones ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado  text NOT NULL CHECK (estado IN ('invitado', 'activo')),
  color   smallint NOT NULL DEFAULT 0 CHECK (color BETWEEN 0 AND 7),   -- el mismo color para todos los que miran
  invita  uuid,
  desde   date,
  avisos  jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "acepta": true, "lleno": true}
  creado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bidon, user_id)
);
CREATE INDEX IF NOT EXISTS bidon_miembros_user ON bidon_miembros (user_id);
ALTER TABLE bidon_miembros ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bidon_aportes (
  bidon   uuid NOT NULL REFERENCES bidones ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha   date NOT NULL,
  ml      integer NOT NULL CHECK (ml BETWEEN 0 AND 5000),
  PRIMARY KEY (bidon, user_id, fecha)
);
ALTER TABLE bidon_aportes ENABLE ROW LEVEL SECURITY;

-- Si un bidón se queda sin nadie activo, se borra (también al borrar una cuenta)
CREATE OR REPLACE FUNCTION rumbo_bidon_vacio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM bidones b WHERE b.id = OLD.bidon
    AND NOT EXISTS (SELECT 1 FROM bidon_miembros m WHERE m.bidon = OLD.bidon AND m.estado = 'activo');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS bidon_vacio ON bidon_miembros;
CREATE TRIGGER bidon_vacio AFTER DELETE ON bidon_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_bidon_vacio();

-- Bloquear a alguien te saca de los bidones que compartían (y de sus invitaciones)
CREATE OR REPLACE FUNCTION rumbo_bidon_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM bidon_miembros y USING bidon_miembros o
      WHERE y.user_id = NEW.bloquea AND o.bidon = y.bidon AND o.user_id = otro;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bidon_al_bloquear ON amistades;
CREATE TRIGGER bidon_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_bidon_al_bloquear();

CREATE OR REPLACE FUNCTION rumbo_en_bidon(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM bidon_miembros WHERE bidon = p_id AND user_id = auth.uid() AND estado = 'activo')
$$;

-- Lo aportado y, si llegó a la meta, desde cuándo está lleno
CREATE OR REPLACE FUNCTION rumbo_bidon_recalcular(p_id uuid, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE total bigint; antes date; ahora date;
BEGIN
  SELECT coalesce(sum(ml), 0) INTO total FROM bidon_aportes WHERE bidon = p_id;
  SELECT lleno INTO antes FROM bidones WHERE id = p_id;
  UPDATE bidones SET lleno = CASE WHEN total >= meta_ml THEN coalesce(lleno, p_hoy) ELSE NULL END, updated_at = now()
    WHERE id = p_id RETURNING lleno INTO ahora;
  RETURN jsonb_build_object('total', total, 'lleno', ahora IS NOT NULL, 'recien', antes IS NULL AND ahora IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION bidon_crear(p_nombre text, p_meta_ml integer, p_amigos uuid[], p_hoy date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); nuevo uuid; amigos uuid[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF char_length(btrim(coalesce(p_nombre, ''))) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'nombre'; END IF;
  IF p_meta_ml IS NULL OR p_meta_ml < 5000 OR p_meta_ml > 300000 THEN RAISE EXCEPTION 'meta'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 7 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM bidones WHERE creador = yo AND lunes = rumbo_lunes(hoy)) >= 3 THEN RAISE EXCEPTION 'limite'; END IF;
  DELETE FROM bidones WHERE lunes < current_date - 21;   -- los de hace más de 3 semanas
  INSERT INTO bidones (nombre, meta_ml, lunes, creador) VALUES (btrim(p_nombre), p_meta_ml, rumbo_lunes(hoy), yo) RETURNING id INTO nuevo;
  INSERT INTO bidon_miembros (bidon, user_id, estado, color, invita, desde) VALUES (nuevo, yo, 'activo', 0, NULL, hoy);
  INSERT INTO bidon_miembros (bidon, user_id, estado, color, invita)
    SELECT nuevo, x, 'invitado', o::smallint, yo FROM unnest(amigos) WITH ORDINALITY AS t(x, o);
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION bidon_invitar(p_id uuid, p_amigos uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); amigos uuid[]; n integer; usados smallint[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_bidon(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x
    WHERE x <> yo AND NOT EXISTS (SELECT 1 FROM bidon_miembros m WHERE m.bidon = p_id AND m.user_id = x);
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM bidon_miembros WHERE bidon = p_id) + cardinality(amigos) > 8 THEN RAISE EXCEPTION 'limite'; END IF;
  -- a cada uno, un color que nadie tenga en este bidón
  SELECT coalesce(array_agg(color), '{}') INTO usados FROM bidon_miembros WHERE bidon = p_id;
  INSERT INTO bidon_miembros (bidon, user_id, estado, color, invita)
    SELECT p_id, a.x, 'invitado', c.color, yo
    FROM (SELECT x, row_number() OVER () AS k FROM unnest(amigos) x) a
    JOIN (SELECT g::smallint AS color, row_number() OVER (ORDER BY g) AS k FROM generate_series(0, 7) g WHERE g <> ALL (usados)) c ON c.k = a.k;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION bidon_responder(p_id uuid, p_acepta boolean, p_hoy date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    IF (SELECT count(*) FROM bidon_miembros m JOIN bidones b ON b.id = m.bidon
        WHERE m.user_id = yo AND m.estado = 'activo' AND b.lunes >= rumbo_lunes(current_date)) >= 5 THEN RAISE EXCEPTION 'limite'; END IF;
    UPDATE bidon_miembros SET estado = 'activo', desde = rumbo_hoy(p_hoy)
      WHERE bidon = p_id AND user_id = yo AND estado = 'invitado';
    RETURN CASE WHEN FOUND THEN 'unido' ELSE 'nada' END;
  END IF;
  DELETE FROM bidon_miembros WHERE bidon = p_id AND user_id = yo AND estado = 'invitado';
  RETURN CASE WHEN FOUND THEN 'rechazado' ELSE 'nada' END;
END $$;

-- Al salir, lo que aportaste sigue en el bidón
CREATE OR REPLACE FUNCTION bidon_salir(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM bidon_miembros WHERE bidon = p_id AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'salio' ELSE 'nada' END;
END $$;

-- Lo que tomaste cada día de la semana del bidón (hasta hoy, y hasta 5 L al día). Pone al día: si deshaces, baja.
CREATE OR REPLACE FUNCTION bidon_aportar(p_id uuid, p_dias jsonb, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); l date; k text; v jsonb; d date; ml integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_bidon(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF jsonb_typeof(p_dias) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'dias'; END IF;
  SELECT lunes INTO l FROM bidones WHERE id = p_id;
  FOR k, v IN SELECT * FROM jsonb_each(p_dias) LOOP
    IF k !~ '^\d{4}-\d{2}-\d{2}$' THEN CONTINUE; END IF;
    d := k::date;
    IF d < l OR d > l + 6 OR d > hoy THEN CONTINUE; END IF;
    IF jsonb_typeof(v) <> 'number' THEN CONTINUE; END IF;
    ml := least(5000, greatest(0, round((v #>> '{}')::numeric)::integer));
    INSERT INTO bidon_aportes (bidon, user_id, fecha, ml) VALUES (p_id, yo, d, ml)
      ON CONFLICT (bidon, user_id, fecha) DO UPDATE SET ml = EXCLUDED.ml;
  END LOOP;
  RETURN rumbo_bidon_recalcular(p_id, hoy);
END $$;

-- Tus bidones de esta semana y la anterior (y las invitaciones): quiénes están, con su color, y cuánto lleva cada uno
CREATE OR REPLACE FUNCTION bidon_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'nombre', b.nombre, 'meta_ml', b.meta_ml, 'lunes', b.lunes, 'lleno', b.lleno, 'creador', b.creador,
      'estado', mio.estado, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.user_id, 'yo', m.user_id = yo, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar, 'estado', m.estado, 'color', m.color, 'desde', m.desde)
        ORDER BY m.color), '[]'::jsonb)
        FROM bidon_miembros m LEFT JOIN perfiles p ON p.user_id = m.user_id WHERE m.bidon = b.id),
      'totales', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', t.user_id, 'nombre', coalesce(p.nombre, ''), 'ml', t.ml, 'hoy', t.hoy)), '[]'::jsonb)
        FROM (SELECT user_id, sum(ml) AS ml, coalesce(sum(ml) FILTER (WHERE fecha = current_date), 0) AS hoy FROM bidon_aportes WHERE bidon = b.id GROUP BY user_id) t
        LEFT JOIN perfiles p ON p.user_id = t.user_id)
    ) ORDER BY b.lunes DESC, mio.creado), '[]'::jsonb)
  INTO r
  FROM bidon_miembros mio JOIN bidones b ON b.id = mio.bidon
  WHERE mio.user_id = yo AND b.lunes >= rumbo_lunes(current_date) - 7;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION agua_pendientes_tomar(), fuente_hoy(date), fuente_sumar(date, integer),
  bidon_crear(text, integer, uuid[], date), bidon_invitar(uuid, uuid[]), bidon_responder(uuid, boolean, date), bidon_salir(uuid),
  bidon_aportar(uuid, jsonb, date), bidon_lista(), rumbo_en_bidon(uuid), rumbo_bidon_recalcular(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION agua_pendientes_tomar(), fuente_hoy(date), fuente_sumar(date, integer),
  bidon_crear(text, integer, uuid[], date), bidon_invitar(uuid, uuid[]), bidon_responder(uuid, boolean, date), bidon_salir(uuid),
  bidon_aportar(uuid, jsonb, date), bidon_lista(), rumbo_en_bidon(uuid) TO authenticated;

COMMIT;
