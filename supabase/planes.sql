-- ============================================================
-- Rumbo · Planes con amigos (etapa 1, y la 3: después del plan).
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- Juntarse: ver una película, ir a comer, salir a correr, un viaje. Quien propone el plan
-- elige qué, cuándo (o que voten entre 2 a 4 fechas), dónde (o a distancia, con un enlace)
-- y a qué amigos invita. Cada invitado responde: voy, tal vez o no puedo.
--
--   1. planes: qué, cuándo, dónde, quién lo propuso y si se canceló.
--   2. planes_invitados: quiénes están (quien lo propuso, siempre «voy»), su respuesta
--      y los avisos al celular ya enviados.
--   3. planes_opciones y planes_votos: las fechas para votar y quién marcó cuáles le sirven.
--   4. planes_recuerdos: después del plan, cómo estuvo para cada uno (estrellas y una frase,
--      que los demás ven solo si eliges compartirla).
--   5. planes_gastos: la cuenta del plan (quién pagó qué y entre quiénes se divide) y los
--      pagos entre amigos que la saldan. Sin pagos dentro de la app: solo la cuenta clara.
--
-- Nadie lee ni escribe estas tablas directo: todo pasa por las funciones, que validan quién llama.
--   plan_crear(titulo, tipo, fecha, hora, opciones, lugar, enlace, tz, amigos, hoy)  lo crea e invita
--   plan_editar(id, titulo, tipo, fecha, hora, lugar, enlace, hoy)                  quien lo propuso lo cambia
--   plan_invitar(id, amigos)                                                         invita a más amigos suyos
--   plan_responder(id, respuesta)                                                    voy, quizas o no
--   plan_votar(id, opciones)                                                         las fechas que te sirven
--   plan_fijar(id, opcion)                                                           quien lo propuso elige la fecha
--   plan_cancelar(id)                                                                quien lo propuso lo cancela
--   plan_recordar(id, estrellas, frase, compartir, hoy)                              cómo estuvo (desde el día del plan)
--   plan_gasto(id, monto, detalle, para, pago)                                       un gasto de la cuenta, o un pago
--   plan_gasto_borrar(gasto)                                                         borra un gasto tuyo
--   plan_lista(hoy)                                                                  tus planes (de hace un mes en adelante)
--
-- Tus amigos ven el plan, no tu agenda: lo demás sigue en tu documento (estado_usuario).
-- Bloquear a alguien lo saca de tus planes (y a ti de los suyos). Al borrar una cuenta se
-- borran sus planes y sus respuestas (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. planes ----------
CREATE TABLE IF NOT EXISTS planes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     text NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 60),
  tipo       text NOT NULL DEFAULT 'otro' CHECK (tipo IN ('pelicula', 'comer', 'cafe', 'deporte', 'viaje', 'otro')),
  fecha      date,                        -- sin fecha: la están votando (planes_opciones)
  hora       text CHECK (hora IS NULL OR hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  lugar      text NOT NULL DEFAULT '' CHECK (char_length(lugar) <= 80),
  enlace     text NOT NULL DEFAULT '' CHECK (char_length(enlace) <= 300),   -- a distancia: la videollamada, la película…
  tz         text NOT NULL DEFAULT 'America/Santiago' CHECK (char_length(tz) <= 60),   -- la hora es la de quien lo propuso
  creador    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  cancelado  boolean NOT NULL DEFAULT false,
  creado     timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planes_fecha ON planes (fecha);
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;

-- ---------- 2. planes_invitados ----------
CREATE TABLE IF NOT EXISTS planes_invitados (
  plan       uuid NOT NULL REFERENCES planes ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  respuesta  text NOT NULL DEFAULT 'pendiente' CHECK (respuesta IN ('pendiente', 'voy', 'quizas', 'no')),
  invita     uuid,                          -- quién lo invitó
  avisos     jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"invita": true, "firma": "2026-11-07|21:00|…", "responde": "voy", "recuerda": "2026-11-07|21:00"}
  creado     timestamptz NOT NULL DEFAULT now(),
  respondido timestamptz,
  PRIMARY KEY (plan, user_id)
);
CREATE INDEX IF NOT EXISTS planes_invitados_user ON planes_invitados (user_id);
ALTER TABLE planes_invitados ENABLE ROW LEVEL SECURITY;

-- ---------- 3. planes_opciones y planes_votos ----------
CREATE TABLE IF NOT EXISTS planes_opciones (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan  uuid NOT NULL REFERENCES planes ON DELETE CASCADE,
  fecha date NOT NULL,
  hora  text CHECK (hora IS NULL OR hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE INDEX IF NOT EXISTS planes_opciones_plan ON planes_opciones (plan);
ALTER TABLE planes_opciones ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS planes_votos (
  opcion  bigint NOT NULL REFERENCES planes_opciones ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  PRIMARY KEY (opcion, user_id)
);
ALTER TABLE planes_votos ENABLE ROW LEVEL SECURITY;

-- ---------- 4. planes_recuerdos ----------
CREATE TABLE IF NOT EXISTS planes_recuerdos (
  plan      uuid NOT NULL REFERENCES planes ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estrellas smallint NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  frase     text NOT NULL DEFAULT '' CHECK (char_length(frase) <= 140),
  compartir boolean NOT NULL DEFAULT false,   -- los que fueron ven tus estrellas y tu frase
  creado    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (plan, user_id)
);
ALTER TABLE planes_recuerdos ENABLE ROW LEVEL SECURITY;

-- ---------- 5. planes_gastos ----------
CREATE TABLE IF NOT EXISTS planes_gastos (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plan    uuid NOT NULL REFERENCES planes ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,   -- quién pagó
  monto   numeric(14, 2) NOT NULL CHECK (monto > 0 AND monto <= 100000000),
  detalle text NOT NULL DEFAULT '' CHECK (char_length(detalle) <= 60),
  para    uuid[] NOT NULL CHECK (cardinality(para) BETWEEN 1 AND 13),   -- entre quiénes se divide, en partes iguales
  pago    boolean NOT NULL DEFAULT false,                               -- un pago a un amigo: salda lo que le debías
  creado  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planes_gastos_plan ON planes_gastos (plan, creado);
ALTER TABLE planes_gastos ENABLE ROW LEVEL SECURITY;

-- El día de quien llama: el de su teléfono, si no se aleja más de un día del servidor (UTC)
CREATE OR REPLACE FUNCTION rumbo_hoy(p_hoy date) RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_hoy BETWEEN current_date - 1 AND current_date + 1 THEN p_hoy ELSE current_date END
$$;

-- Bloquear a alguien lo saca de tus planes, y a ti de los suyos (de los de otros, sale quien bloquea)
CREATE OR REPLACE FUNCTION rumbo_plan_al_bloquear() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE otro uuid;
BEGIN
  IF NEW.estado = 'bloqueada' AND NEW.bloquea IS NOT NULL THEN
    otro := CASE WHEN NEW.a = NEW.bloquea THEN NEW.b ELSE NEW.a END;
    DELETE FROM planes_invitados i USING planes p
      WHERE i.plan = p.id
        AND EXISTS (SELECT 1 FROM planes_invitados x WHERE x.plan = p.id AND x.user_id = NEW.bloquea)
        AND EXISTS (SELECT 1 FROM planes_invitados x WHERE x.plan = p.id AND x.user_id = otro)
        AND i.user_id = CASE WHEN p.creador = NEW.bloquea THEN otro ELSE NEW.bloquea END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS plan_al_bloquear ON amistades;
CREATE TRIGGER plan_al_bloquear AFTER INSERT OR UPDATE OF estado ON amistades
  FOR EACH ROW EXECUTE FUNCTION rumbo_plan_al_bloquear();

-- ¿Quien llama está en ese plan? ¿Lo propuso?
CREATE OR REPLACE FUNCTION rumbo_en_plan(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM planes_invitados WHERE plan = p_id AND user_id = auth.uid())
$$;
CREATE OR REPLACE FUNCTION rumbo_plan_mio(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM planes WHERE id = p_id AND creador = auth.uid() AND NOT cancelado)
$$;

-- ¿Quien llama va (o fue) a ese plan? Voy o tal vez, y no se canceló
CREATE OR REPLACE FUNCTION rumbo_plan_va(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM planes_invitados i JOIN planes p ON p.id = i.plan
    WHERE i.plan = p_id AND i.user_id = auth.uid() AND i.respuesta IN ('voy', 'quizas') AND NOT p.cancelado)
$$;

CREATE OR REPLACE FUNCTION rumbo_plan_validar(p_titulo text, p_tipo text, p_hora text, p_lugar text, p_enlace text) RETURNS void
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF char_length(btrim(coalesce(p_titulo, ''))) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'titulo'; END IF;
  IF coalesce(p_tipo, '') NOT IN ('pelicula', 'comer', 'cafe', 'deporte', 'viaje', 'otro') THEN RAISE EXCEPTION 'tipo'; END IF;
  IF p_hora IS NOT NULL AND p_hora !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'hora'; END IF;
  IF char_length(btrim(coalesce(p_lugar, ''))) > 80 THEN RAISE EXCEPTION 'lugar'; END IF;
  IF char_length(btrim(coalesce(p_enlace, ''))) > 300 OR (btrim(coalesce(p_enlace, '')) <> '' AND btrim(p_enlace) !~* '^https?://[^\s]+$') THEN RAISE EXCEPTION 'enlace'; END IF;
END $$;

-- Una fecha de plan: de hoy a un año más
CREATE OR REPLACE FUNCTION rumbo_plan_fecha_ok(p_fecha date, p_hoy date) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT p_fecha IS NOT NULL AND p_fecha BETWEEN p_hoy AND p_hoy + 366
$$;

-- ---------- Funciones ----------
-- p_fecha null: que voten entre las p_opciones ([{"fecha": "2026-11-07", "hora": "21:00"}, …], de 2 a 4)
CREATE OR REPLACE FUNCTION plan_crear(p_titulo text, p_tipo text, p_fecha date, p_hora text, p_opciones jsonb, p_lugar text, p_enlace text,
  p_tz text, p_amigos uuid[], p_hoy date) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); nuevo uuid; amigos uuid[]; op jsonb; n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  PERFORM rumbo_plan_validar(p_titulo, p_tipo, p_hora, p_lugar, p_enlace);
  IF p_fecha IS NOT NULL THEN
    IF NOT rumbo_plan_fecha_ok(p_fecha, hoy) THEN RAISE EXCEPTION 'fecha'; END IF;
  ELSE
    IF jsonb_typeof(p_opciones) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'opciones'; END IF;
    n := jsonb_array_length(p_opciones);
    IF n < 2 OR n > 4 THEN RAISE EXCEPTION 'opciones'; END IF;
    FOR op IN SELECT * FROM jsonb_array_elements(p_opciones) LOOP
      IF jsonb_typeof(op) IS DISTINCT FROM 'object' OR (op->>'fecha') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'opciones'; END IF;
      IF NOT rumbo_plan_fecha_ok((op->>'fecha')::date, hoy) THEN RAISE EXCEPTION 'fecha'; END IF;
      IF nullif(op->>'hora', '') IS NOT NULL AND (op->>'hora') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'hora'; END IF;
    END LOOP;
  END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x WHERE x <> yo;
  IF cardinality(amigos) = 0 OR cardinality(amigos) > 12 THEN RAISE EXCEPTION 'amigos'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM planes WHERE creador = yo AND creado > now() - interval '1 day') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO planes (titulo, tipo, fecha, hora, lugar, enlace, tz, creador)
    VALUES (btrim(p_titulo), p_tipo, p_fecha, CASE WHEN p_fecha IS NULL THEN NULL ELSE p_hora END, btrim(coalesce(p_lugar, '')), btrim(coalesce(p_enlace, '')),
      left(coalesce(nullif(btrim(p_tz), ''), 'America/Santiago'), 60), yo)
    RETURNING id INTO nuevo;
  INSERT INTO planes_invitados (plan, user_id, respuesta, invita, respondido) VALUES (nuevo, yo, 'voy', NULL, now());
  INSERT INTO planes_invitados (plan, user_id, respuesta, invita) SELECT nuevo, x, 'pendiente', yo FROM unnest(amigos) x;
  IF p_fecha IS NULL THEN
    INSERT INTO planes_opciones (plan, fecha, hora)
      SELECT DISTINCT nuevo, (o->>'fecha')::date, nullif(o->>'hora', '') FROM jsonb_array_elements(p_opciones) o;
  END IF;
  RETURN nuevo;
END $$;

-- Quien lo propuso lo cambia. Con fecha, el plan queda con esa fecha (si se votaba, se cierra la votación).
-- Devuelve si cambió cuándo o dónde (para avisar a los invitados)
CREATE OR REPLACE FUNCTION plan_editar(p_id uuid, p_titulo text, p_tipo text, p_fecha date, p_hora text, p_lugar text, p_enlace text, p_hoy date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE antes planes; despues planes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_plan_mio(p_id) THEN RAISE EXCEPTION 'no-creador'; END IF;
  PERFORM rumbo_plan_validar(p_titulo, p_tipo, p_hora, p_lugar, p_enlace);
  SELECT * INTO antes FROM planes WHERE id = p_id;
  IF p_fecha IS NOT NULL AND p_fecha IS DISTINCT FROM antes.fecha AND NOT rumbo_plan_fecha_ok(p_fecha, rumbo_hoy(p_hoy)) THEN RAISE EXCEPTION 'fecha'; END IF;
  UPDATE planes SET titulo = btrim(p_titulo), tipo = p_tipo, lugar = btrim(coalesce(p_lugar, '')), enlace = btrim(coalesce(p_enlace, '')),
      fecha = coalesce(p_fecha, fecha), hora = CASE WHEN coalesce(p_fecha, fecha) IS NULL THEN NULL ELSE p_hora END, updated_at = now()
    WHERE id = p_id RETURNING * INTO despues;
  RETURN jsonb_build_object('cambio', (antes.fecha, antes.hora, antes.lugar, antes.enlace) IS DISTINCT FROM (despues.fecha, despues.hora, despues.lugar, despues.enlace));
END $$;

CREATE OR REPLACE FUNCTION plan_invitar(p_id uuid, p_amigos uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); amigos uuid[]; n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_plan_mio(p_id) THEN RAISE EXCEPTION 'no-creador'; END IF;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO amigos FROM unnest(coalesce(p_amigos, '{}')) x
    WHERE x <> yo AND NOT EXISTS (SELECT 1 FROM planes_invitados i WHERE i.plan = p_id AND i.user_id = x);
  IF EXISTS (SELECT 1 FROM unnest(amigos) x WHERE NOT rumbo_son_amigos(x)) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM planes_invitados WHERE plan = p_id) + cardinality(amigos) > 13 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO planes_invitados (plan, user_id, respuesta, invita) SELECT p_id, x, 'pendiente', yo FROM unnest(amigos) x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Voy, tal vez o no puedo (quien lo propuso siempre va: si no puede, lo cancela)
CREATE OR REPLACE FUNCTION plan_responder(p_id uuid, p_respuesta text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF coalesce(p_respuesta, '') NOT IN ('voy', 'quizas', 'no') THEN RAISE EXCEPTION 'respuesta'; END IF;
  IF EXISTS (SELECT 1 FROM planes WHERE id = p_id AND cancelado) THEN RAISE EXCEPTION 'cancelado'; END IF;
  UPDATE planes_invitados i SET respuesta = p_respuesta, respondido = now()
    FROM planes p WHERE p.id = i.plan AND i.plan = p_id AND i.user_id = auth.uid() AND p.creador <> auth.uid();
  RETURN CASE WHEN FOUND THEN p_respuesta ELSE 'nada' END;
END $$;

-- Las fechas que te sirven (reemplaza lo que habías marcado), mientras se vota
CREATE OR REPLACE FUNCTION plan_votar(p_id uuid, p_opciones bigint[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); n integer;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_en_plan(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM planes WHERE id = p_id AND fecha IS NULL AND NOT cancelado) THEN RAISE EXCEPTION 'votacion'; END IF;
  DELETE FROM planes_votos v USING planes_opciones o WHERE v.opcion = o.id AND o.plan = p_id AND v.user_id = yo;
  INSERT INTO planes_votos (opcion, user_id)
    SELECT DISTINCT o.id, yo FROM planes_opciones o WHERE o.plan = p_id AND o.id = ANY (coalesce(p_opciones, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Quien lo propuso elige la fecha entre las opciones: el plan queda con esa fecha
CREATE OR REPLACE FUNCTION plan_fijar(p_id uuid, p_opcion bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE op planes_opciones;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_plan_mio(p_id) THEN RAISE EXCEPTION 'no-creador'; END IF;
  SELECT * INTO op FROM planes_opciones WHERE id = p_opcion AND plan = p_id;
  IF op.id IS NULL THEN RAISE EXCEPTION 'opciones'; END IF;
  UPDATE planes SET fecha = op.fecha, hora = op.hora, updated_at = now() WHERE id = p_id;
  RETURN 'fijado';
END $$;

-- Cancelar: queda a la vista (cancelado) unos días para que los invitados se enteren
CREATE OR REPLACE FUNCTION plan_cancelar(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  UPDATE planes SET cancelado = true, updated_at = now() WHERE id = p_id AND creador = auth.uid() AND NOT cancelado;
  RETURN CASE WHEN FOUND THEN 'cancelado' ELSE 'nada' END;
END $$;

-- Después del plan: cómo estuvo (de 1 a 5 estrellas y una frase). Se puede cambiar.
-- Devuelve 'nuevo' la primera vez (la app da +10 ⭐) y 'cambiado' después.
CREATE OR REPLACE FUNCTION plan_recordar(p_id uuid, p_estrellas integer, p_frase text, p_compartir boolean, p_hoy date) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nuevo boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_plan_va(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF NOT EXISTS (SELECT 1 FROM planes WHERE id = p_id AND fecha IS NOT NULL AND fecha <= rumbo_hoy(p_hoy)) THEN RAISE EXCEPTION 'fecha'; END IF;
  IF p_estrellas IS NULL OR p_estrellas NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'estrellas'; END IF;
  INSERT INTO planes_recuerdos (plan, user_id, estrellas, frase, compartir)
    VALUES (p_id, auth.uid(), p_estrellas, left(btrim(coalesce(p_frase, '')), 140), coalesce(p_compartir, false))
    ON CONFLICT (plan, user_id) DO UPDATE SET estrellas = EXCLUDED.estrellas, frase = EXCLUDED.frase, compartir = EXCLUDED.compartir
    RETURNING (xmax = 0) INTO nuevo;
  RETURN CASE WHEN nuevo THEN 'nuevo' ELSE 'cambiado' END;
END $$;

-- La cuenta: un gasto que pagaste, dividido en partes iguales entre quienes van (para),
-- o un pago a un amigo (pago, para = él) que salda lo que le debías. Hasta 100 por plan.
CREATE OR REPLACE FUNCTION plan_gasto(p_id uuid, p_monto numeric, p_detalle text, p_para uuid[], p_pago boolean) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); para uuid[]; pedidos integer; nuevo bigint;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_plan_va(p_id) THEN RAISE EXCEPTION 'no-miembro'; END IF;
  IF p_monto IS NULL OR round(p_monto, 2) <= 0 OR p_monto > 100000000 THEN RAISE EXCEPTION 'monto'; END IF;
  SELECT count(DISTINCT x) INTO pedidos FROM unnest(coalesce(p_para, '{}')) x;
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO para FROM unnest(coalesce(p_para, '{}')) x
    WHERE EXISTS (SELECT 1 FROM planes_invitados i WHERE i.plan = p_id AND i.user_id = x AND i.respuesta IN ('voy', 'quizas'));
  IF cardinality(para) = 0 OR cardinality(para) <> pedidos THEN RAISE EXCEPTION 'para'; END IF;
  IF coalesce(p_pago, false) AND (cardinality(para) <> 1 OR para[1] = yo) THEN RAISE EXCEPTION 'para'; END IF;
  IF (SELECT count(*) FROM planes_gastos WHERE plan = p_id) >= 100 THEN RAISE EXCEPTION 'limite'; END IF;
  INSERT INTO planes_gastos (plan, user_id, monto, detalle, para, pago)
    VALUES (p_id, yo, round(p_monto, 2), left(btrim(coalesce(p_detalle, '')), 60), para, coalesce(p_pago, false)) RETURNING id INTO nuevo;
  RETURN nuevo;
END $$;

-- Borrar un gasto (o un pago) que anotaste tú
CREATE OR REPLACE FUNCTION plan_gasto_borrar(p_gasto bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM planes_gastos WHERE id = p_gasto AND user_id = auth.uid();
  RETURN CASE WHEN FOUND THEN 'borrado' ELSE 'nada' END;
END $$;

-- Tus planes: los de hace un mes en adelante y los que se están votando (los cancelados, solo por 7 días),
-- con quiénes van, las fechas para votar, cómo estuvo (lo tuyo y lo que compartieron) y la cuenta
CREATE OR REPLACE FUNCTION plan_lista(p_hoy date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); hoy date := rumbo_hoy(p_hoy); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'titulo', p.titulo, 'tipo', p.tipo, 'fecha', p.fecha, 'hora', p.hora, 'lugar', p.lugar, 'enlace', p.enlace,
      'creador', p.creador, 'cancelado', p.cancelado, 'respuesta', mio.respuesta, 'invita', mio.invita,
      'miembros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', i.user_id, 'yo', i.user_id = yo, 'nombre', coalesce(f.nombre, ''), 'avatar', f.avatar, 'respuesta', i.respuesta)
        ORDER BY i.creado), '[]'::jsonb)
        FROM planes_invitados i LEFT JOIN perfiles f ON f.user_id = i.user_id WHERE i.plan = p.id),
      'opciones', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'fecha', o.fecha, 'hora', o.hora,
          'votos', (SELECT coalesce(jsonb_agg(v.user_id), '[]'::jsonb) FROM planes_votos v
            WHERE v.opcion = o.id AND EXISTS (SELECT 1 FROM planes_invitados i WHERE i.plan = p.id AND i.user_id = v.user_id)))
        ORDER BY o.fecha, o.hora NULLS FIRST, o.id), '[]'::jsonb)
        FROM planes_opciones o WHERE o.plan = p.id AND p.fecha IS NULL),
      'recuerdos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.user_id, 'estrellas', r.estrellas, 'frase', r.frase, 'compartir', r.compartir)
        ORDER BY r.creado), '[]'::jsonb)
        FROM planes_recuerdos r WHERE r.plan = p.id AND (r.user_id = yo OR r.compartir)),
      'gastos', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'user_id', g.user_id, 'monto', g.monto, 'detalle', g.detalle, 'para', g.para, 'pago', g.pago)
        ORDER BY g.creado, g.id), '[]'::jsonb)
        FROM planes_gastos g WHERE g.plan = p.id)
    ) ORDER BY p.fecha NULLS LAST, p.hora NULLS FIRST, p.creado), '[]'::jsonb)
  INTO r
  FROM (SELECT * FROM planes_invitados WHERE user_id = yo) mio JOIN planes p ON p.id = mio.plan
  WHERE (p.fecha IS NULL OR p.fecha >= hoy - 30) AND (NOT p.cancelado OR p.updated_at > now() - interval '7 days');
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION plan_crear(text, text, date, text, jsonb, text, text, text, uuid[], date), plan_editar(uuid, text, text, date, text, text, text, date),
  plan_invitar(uuid, uuid[]), plan_responder(uuid, text), plan_votar(uuid, bigint[]), plan_fijar(uuid, bigint), plan_cancelar(uuid), plan_lista(date),
  plan_recordar(uuid, integer, text, boolean, date), plan_gasto(uuid, numeric, text, uuid[], boolean), plan_gasto_borrar(bigint),
  rumbo_en_plan(uuid), rumbo_plan_mio(uuid), rumbo_plan_va(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION plan_crear(text, text, date, text, jsonb, text, text, text, uuid[], date), plan_editar(uuid, text, text, date, text, text, text, date),
  plan_invitar(uuid, uuid[]), plan_responder(uuid, text), plan_votar(uuid, bigint[]), plan_fijar(uuid, bigint), plan_cancelar(uuid), plan_lista(date),
  plan_recordar(uuid, integer, text, boolean, date), plan_gasto(uuid, numeric, text, uuid[], boolean), plan_gasto_borrar(bigint),
  rumbo_en_plan(uuid), rumbo_plan_mio(uuid), rumbo_plan_va(uuid) TO authenticated;

COMMIT;
