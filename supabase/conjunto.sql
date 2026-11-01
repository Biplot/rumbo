-- ============================================================
-- Rumbo · Amigos (etapa 2): hábitos en conjunto.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- Cada persona sigue teniendo el hábito en su documento privado (estado_usuario),
-- con su historial: ahí lo marca, le da sus estrellas y cuenta para su racha.
-- Lo que se comparte vive aquí:
--
--   1. habitos_conjunto: el hábito (nombre, ícono, frecuencia y desde cuándo).
--   2. habitos_conjunto_miembros: quiénes están (activo) y a quiénes invitaron
--      (invitado), desde qué día cuenta cada uno y los avisos al celular ya enviados.
--   3. habitos_conjunto_marcas: qué días cumplió cada uno.
--   4. habitos_conjunto_descansos (v55): qué días descansa cada uno (de sus días de descanso y
--      vacaciones). Un día que descansan TODOS no corta la racha de a dos ni suma.
--
-- Nadie lee ni escribe estas tablas directo (no tienen reglas de acceso abiertas):
-- todo pasa por las funciones, que validan quién llama.
--   conjunto_crear(nombre, icono, frecuencia, amigos, hoy)  lo crea e invita a tus amigos
--   conjunto_invitar(id, amigos)                           invita a más amigos tuyos
--   conjunto_responder(id, acepta, hoy)                    se une o rechaza la invitación
--   conjunto_salir(id)                                     sale (su historial queda en su documento)
--   conjunto_editar(id, nombre, icono, frecuencia)         cambia el nombre, el ícono o la frecuencia
--   conjunto_marcar(id, fecha, hecho)                      marca o desmarca un día
--   conjunto_descansos(id, fechas, descansa)               deja o quita tus días de descanso (desde ayer, hasta 60 por vez)
--   conjunto_lista()                                       tus hábitos en conjunto e invitaciones
--
-- Bloquear a alguien te saca de los hábitos que compartían. Si un hábito se queda
-- sin nadie, se borra. Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. habitos_conjunto ----------
CREATE TABLE IF NOT EXISTS habitos_conjunto (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 60),
  icono      text NOT NULL DEFAULT '' CHECK (char_length(icono) <= 16),
  frecuencia jsonb NOT NULL DEFAULT '{"tipo": "diario"}' CHECK (char_length(frecuencia::text) <= 200),
  creador    uuid REFERENCES auth.users ON DELETE SET NULL,
  creado     date NOT NULL DEFAULT current_date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE habitos_conjunto ENABLE ROW LEVEL SECURITY;

-- ---------- 2. habitos_conjunto_miembros ----------
CREATE TABLE IF NOT EXISTS habitos_conjunto_miembros (
  habito  uuid NOT NULL REFERENCES habitos_conjunto ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado  text NOT NULL CHECK (estado IN ('invitado', 'activo')),
  invita  uuid,                          -- quién lo invitó
  desde   date,                          -- desde qué día cuenta (cuando se unió)
  avisos  jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "marca": "2026-11-02", "todos": "2026-11-02"}
  creado  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (habito, user_id)
);
CREATE INDEX IF NOT EXISTS habitos_conjunto_miembros_user ON habitos_conjunto_miembros (user_id);
ALTER TABLE habitos_conjunto_miembros ENABLE ROW LEVEL SECURITY;

-- ---------- 3. habitos_conjunto_marcas ----------
CREATE TABLE IF NOT EXISTS habitos_conjunto_marcas (
  habito  uuid NOT NULL REFERENCES habitos_conjunto ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha   date NOT NULL,
  PRIMARY KEY (habito, user_id, fecha)
);
ALTER TABLE habitos_conjunto_marcas ENABLE ROW LEVEL SECURITY;

-- ---------- 4. habitos_conjunto_descansos (v55) ----------
CREATE TABLE IF NOT EXISTS habitos_conjunto_descansos (
  habito  uuid NOT NULL REFERENCES habitos_conjunto ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  fecha   date NOT NULL,
  PRIMARY KEY (habito, user_id, fecha)
);
ALTER TABLE habitos_conjunto_descansos ENABLE ROW LEVEL SECURITY;

-- Al salir de un hábito (o al bloquear, que también te saca), tus descansos se van contigo
CREATE OR REPLACE FUNCTION rumbo_conjunto_descansos_salir() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM habitos_conjunto_descansos WHERE habito = OLD.habito AND user_id = OLD.user_id;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS conjunto_descansos_salir ON habitos_conjunto_miembros;
CREATE TRIGGER conjunto_descansos_salir AFTER DELETE ON habitos_conjunto_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_conjunto_descansos_salir();

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC)
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;

-- Si un hábito se queda sin nadie activo, se borra (también al borrar una cuenta)
CREATE OR REPLACE FUNCTION rumbo_conjunto_vacio() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM habitos_conjunto h WHERE h.id = OLD.habito
    AND NOT EXISTS (SELECT 1 FROM habitos_conjunto_miembros m WHERE m.habito = OLD.habito AND m.estado = 'activo');
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS conjunto_vacio ON habitos_conjunto_miembros;
CREATE TRIGGER conjunto_vacio AFTER DELETE ON habitos_conjunto_miembros
  FOR EACH ROW EXECUTE FUNCTION rumbo_conjunto_vacio();

-- Bloquear a alguien te saca de los hábitos que compartían (y de sus invitaciones)
CREATE OR REPLACE FUNCTION rumbo_conjunto_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM habitos_conjunto_marcas m USING habitos_conjunto_miembros o
      WHERE m.user_id = NEW.bloquea AND o.habito = m.habito AND o.user_id = otro;
    DELETE FROM habitos_conjunto_miembros y USING habitos_conjunto_miembros o
      WHERE y.user_id = NEW.bloquea AND o.habito = y.habito AND o.user_id = otro;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS conjunto_al_bloquear ON amistades;
CREATE TRIGGER conjunto_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_conjunto_al_bloquear();

-- ¿Quien llama está activo en ese hábito?
CREATE OR REPLACE FUNCTION rumbo_en_conjunto(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM habitos_conjunto_miembros WHERE habito = p_id AND user_id = auth.uid() AND estado = 'activo')
$$;

-- Nombre, ícono y frecuencia válidos (la app los vuelve a revisar al leerlos)
CREATE OR REPLACE FUNCTION rumbo_conjunto_validar(p_nombre text, p_icono text, p_frecuencia jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF char_length(btrim(coalesce(p_nombre, ''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'nombre'; END IF;
  IF char_length(coalesce(p_icono, '')) > 16 THEN RAISE EXCEPTION 'icono'; END IF;
  IF p_frecuencia IS NULL OR jsonb_typeof(p_frecuencia) <> 'object' OR char_length(p_frecuencia::text) > 200 THEN RAISE EXCEPTION 'frecuencia'; END IF;
END $$;

-- ---------- Funciones ----------
CREATE OR REPLACE FUNCTION conjunto_crear(p_nombre text, p_icono text, p_frecuencia jsonb, p_amigos uuid[], p_hoy date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); nuevo uuid; amigos uuid[];
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  PERFORM rumbo_conjunto_validar(p_nombre, p_icono, p_frecuencia);
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 7 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM habitos_conjunto_miembros WHERE user_id = yo) >= 30 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO habitos_conjunto (nombre, icono, frecuencia, creador, creado)
    VALUES (btrim(p_nombre), coalesce(p_icono, ''), p_frecuencia, yo, hoy) RETURNING id INTO nuevo;
  INSERT INTO habitos_conjunto_miembros (habito, user_id, estado, invita, desde) VALUES (nuevo, yo, 'activo', NULL, hoy);
  INSERT INTO habitos_conjunto_miembros (habito, user_id, estado, invita) SELECT nuevo, x, 'invitado', yo FROM unnest(amigos) x;
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION conjunto_invitar(p_id uuid, p_amigos uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); amigos uuid[]; n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_conjunto(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x
    WHERE x <> yo AND NOT EXISTS (SELECT 1 FROM habitos_conjunto_miembros m WHERE m.habito = p_id AND m.user_id = x);
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM habitos_conjunto_miembros WHERE habito = p_id) + cardinality(amigos) > 8 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO habitos_conjunto_miembros (habito, user_id, estado, invita) SELECT p_id, x, 'invitado', yo FROM unnest(amigos) x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Al aceptar devuelve el hábito, para crear tu copia; al rechazar, null
CREATE OR REPLACE FUNCTION conjunto_responder(p_id uuid, p_acepta boolean, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); h habitos_conjunto%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    IF (SELECT count(*) FROM habitos_conjunto_miembros WHERE user_id = yo AND estado = 'activo') >= 30 THEN RAISE EXCEPTION 'limite'; END IF;
    UPDATE habitos_conjunto_miembros SET estado = 'activo', desde = rumbo_hoy(p_hoy)
      WHERE habito = p_id AND user_id = yo AND estado = 'invitado';
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT * INTO h FROM habitos_conjunto WHERE id = p_id;
    RETURN jsonb_build_object('id', h.id, 'nombre', h.nombre, 'icono', h.icono, 'frecuencia', h.frecuencia, 'creado', h.creado, 'desde', rumbo_hoy(p_hoy));
  END IF;
  DELETE FROM habitos_conjunto_miembros WHERE habito = p_id AND user_id = yo AND estado = 'invitado';
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION conjunto_salir(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM habitos_conjunto_marcas WHERE habito = p_id AND user_id = yo;
  DELETE FROM habitos_conjunto_miembros WHERE habito = p_id AND user_id = yo;
  RETURN CASE WHEN FOUND THEN 'salio' ELSE 'nada' END;
END $$;

CREATE OR REPLACE FUNCTION conjunto_editar(p_id uuid, p_nombre text, p_icono text, p_frecuencia jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_conjunto(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  PERFORM rumbo_conjunto_validar(p_nombre, p_icono, p_frecuencia);
  UPDATE habitos_conjunto SET nombre = btrim(p_nombre), icono = coalesce(p_icono, ''), frecuencia = p_frecuencia, updated_at = now()
    WHERE id = p_id;
  RETURN 'editado';
END $$;

-- Marca o desmarca un día (de la última semana, desde que te uniste).
-- Devuelve si ese día ya cumplieron todos (al menos dos personas).
CREATE OR REPLACE FUNCTION conjunto_marcar(p_id uuid, p_fecha date, p_hecho boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); mi date; faltan integer; total integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT desde INTO mi FROM habitos_conjunto_miembros WHERE habito = p_id AND user_id = yo AND estado = 'activo';
  IF NOT FOUND THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF p_fecha IS NULL OR p_fecha < current_date - 8 OR p_fecha > current_date + 1 OR p_fecha < mi THEN RAISE EXCEPTION 'fecha'; END IF;
  IF p_hecho THEN
    INSERT INTO habitos_conjunto_marcas (habito, user_id, fecha) VALUES (p_id, yo, p_fecha) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM habitos_conjunto_marcas WHERE habito = p_id AND user_id = yo AND fecha = p_fecha;
  END IF;
  SELECT count(*), count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM habitos_conjunto_marcas x
      WHERE x.habito = p_id AND x.user_id = m.user_id AND x.fecha = p_fecha))
    INTO total, faltan
    FROM habitos_conjunto_miembros m WHERE m.habito = p_id AND m.estado = 'activo' AND m.desde <= p_fecha;
  RETURN jsonb_build_object('todos', total >= 2 AND faltan = 0);
END $$;

-- Deja (o quita) tus días de descanso. Solo de ayer en adelante (el descanso se decide antes;
-- ayer, por la diferencia de hora con el servidor) y a lo más un año.
CREATE OR REPLACE FUNCTION conjunto_descansos(p_id uuid, p_fechas date[], p_descansa boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); n integer := coalesce(array_length(p_fechas, 1), 0);
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT EXISTS (SELECT 1 FROM habitos_conjunto_miembros WHERE habito = p_id AND user_id = yo AND estado = 'activo') THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF n = 0 THEN RETURN jsonb_build_object('ok', true); END IF;
  IF n > 60 OR EXISTS (SELECT 1 FROM unnest(p_fechas) f WHERE f IS NULL OR f < current_date - 1 OR f > current_date + 400) THEN RAISE EXCEPTION 'fecha'; END IF;
  IF p_descansa THEN
    INSERT INTO habitos_conjunto_descansos (habito, user_id, fecha)
      SELECT p_id, yo, f FROM unnest(p_fechas) f ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM habitos_conjunto_descansos WHERE habito = p_id AND user_id = yo AND fecha = ANY (p_fechas);
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Tus hábitos en conjunto y las invitaciones, con quiénes están, sus marcas y sus descansos (de los últimos 400 días en adelante)
CREATE OR REPLACE FUNCTION conjunto_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'nombre', h.nombre, 'icono', h.icono, 'frecuencia', h.frecuencia, 'creado', h.creado,
      'estado', mio.estado, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', m.user_id, 'yo', m.user_id = yo, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar,
          'estado', m.estado, 'desde', m.desde,
          'marcas', (SELECT coalesce(jsonb_agg(x.fecha ORDER BY x.fecha), '[]'::jsonb) FROM habitos_conjunto_marcas x
            WHERE x.habito = h.id AND x.user_id = m.user_id AND x.fecha >= greatest(h.creado, current_date - 400)),
          'descansos', (SELECT coalesce(jsonb_agg(z.fecha ORDER BY z.fecha), '[]'::jsonb) FROM habitos_conjunto_descansos z
            WHERE z.habito = h.id AND z.user_id = m.user_id AND z.fecha >= greatest(h.creado, current_date - 400)))
        ORDER BY m.estado, m.creado), '[]'::jsonb)
        FROM habitos_conjunto_miembros m LEFT JOIN perfiles p ON p.user_id = m.user_id WHERE m.habito = h.id)
    ) ORDER BY mio.creado), '[]'::jsonb)
  INTO r
  FROM habitos_conjunto_miembros mio JOIN habitos_conjunto h ON h.id = mio.habito
  WHERE mio.user_id = yo;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION conjunto_crear(text, text, jsonb, uuid[], date), conjunto_invitar(uuid, uuid[]), conjunto_responder(uuid, boolean, date),
  conjunto_salir(uuid), conjunto_editar(uuid, text, text, jsonb), conjunto_marcar(uuid, date, boolean), conjunto_lista(),
  conjunto_descansos(uuid, date[], boolean), rumbo_en_conjunto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION conjunto_crear(text, text, jsonb, uuid[], date), conjunto_invitar(uuid, uuid[]), conjunto_responder(uuid, boolean, date),
  conjunto_salir(uuid), conjunto_editar(uuid, text, text, jsonb), conjunto_marcar(uuid, date, boolean), conjunto_lista(),
  conjunto_descansos(uuid, date[], boolean), rumbo_en_conjunto(uuid) TO authenticated;

COMMIT;
