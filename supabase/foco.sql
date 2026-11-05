-- ============================================================
-- Rumbo · ⏱️ Foco: el aviso de «¡Tiempo!» aunque cierres la app, y el foco con un amigo.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
--   foco_avisos: una fila por persona con la hora en que termina el tramo de su sesión de foco.
--     · La app la pone al empezar, al pausar o seguir y al cambiar de tramo, y la quita al terminar.
--     · api/push.js (que la base llama cada 5 minutos, supabase/notificaciones.sql) manda el aviso
--       al celular cuando ya pasó la hora, una vez (avisado). Puede llegar hasta 5 minutos tarde.
--   foco_salas: parten juntos a la misma hora, cada uno en lo suyo, y terminan al mismo tiempo.
--     · Solo entre amigos (rumbo_son_amigos). La invitación dura 15 minutos.
--     · Cada uno ve qué está haciendo el otro (su título) y si se salió antes.
--     · avisado_invita / avisado_acepta: los avisos al celular ya salieron (api/push.js).
--
-- Nadie lee ni escribe las tablas directo: todo pasa por las funciones.
--   foco_aviso(fin, titulo, tipo)          pone (o mueve) tu aviso
--   foco_aviso_quitar()                    lo quita
--   foco_sala_invitar(otro, min, titulo)   invita a un amigo a enfocarse juntos (devuelve el id)
--   foco_sala_responder(id, acepta, titulo)  acepta (parten ahora) o no
--   foco_sala_salir(id)                    cancela tu invitación o te sales de la sesión
--   foco_sala_mia()                        tu sala de ahora (la que te invitan, la tuya o la que corre)
-- Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS foco_avisos (
  user_id  uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  fin      timestamptz NOT NULL,
  titulo   text NOT NULL DEFAULT '' CHECK (char_length(titulo) <= 80),
  tipo     text NOT NULL DEFAULT 'fin' CHECK (tipo IN ('fin', 'descanso', 'foco')),
  avisado  boolean NOT NULL DEFAULT false,
  creado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS foco_avisos_pendientes ON foco_avisos (fin) WHERE NOT avisado;
ALTER TABLE foco_avisos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS foco_salas (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  anfitrion       uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invitado        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  min             integer NOT NULL CHECK (min BETWEEN 5 AND 120),
  titulo_a        text NOT NULL DEFAULT '' CHECK (char_length(titulo_a) <= 80),
  titulo_b        text NOT NULL DEFAULT '' CHECK (char_length(titulo_b) <= 80),
  estado          text NOT NULL DEFAULT 'invitada' CHECK (estado IN ('invitada', 'activa', 'rechazada', 'cancelada', 'terminada')),
  creada          timestamptz NOT NULL DEFAULT now(),
  inicio          timestamptz,
  fin             timestamptz,
  salio           uuid,
  avisado_invita  boolean NOT NULL DEFAULT false,
  avisado_acepta  boolean NOT NULL DEFAULT false,
  CHECK (anfitrion <> invitado)
);
CREATE INDEX IF NOT EXISTS foco_salas_anfitrion ON foco_salas (anfitrion, creada DESC);
CREATE INDEX IF NOT EXISTS foco_salas_invitado ON foco_salas (invitado, creada DESC);
ALTER TABLE foco_salas ENABLE ROW LEVEL SECURITY;

-- ---------- El aviso de «¡Tiempo!» ----------
CREATE OR REPLACE FUNCTION foco_aviso(p_fin timestamptz, p_titulo text, p_tipo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_fin IS NULL OR p_fin < now() - interval '1 minute' OR p_fin > now() + interval '5 hours' THEN RETURN 'no-valido'; END IF;
  INSERT INTO foco_avisos (user_id, fin, titulo, tipo, avisado)
    VALUES (yo, p_fin, left(coalesce(p_titulo, ''), 80), CASE WHEN p_tipo IN ('fin', 'descanso', 'foco') THEN p_tipo ELSE 'fin' END, false)
    ON CONFLICT (user_id) DO UPDATE SET fin = excluded.fin, titulo = excluded.titulo, tipo = excluded.tipo, avisado = false, creado = now();
  RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION foco_aviso_quitar() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM foco_avisos WHERE user_id = yo;
  RETURN 'ok';
END $$;

-- ---------- El foco con un amigo ----------
-- Una invitación vence a los 15 minutos; una sala activa sigue viva hasta su fin
CREATE OR REPLACE FUNCTION foco_sala_viva(s foco_salas) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (s.estado = 'invitada' AND s.creada > now() - interval '15 minutes') OR (s.estado = 'activa' AND s.fin > now());
$$;

CREATE OR REPLACE FUNCTION foco_sala_invitar(p_otro uuid, p_min integer, p_titulo text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nid bigint;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_otro IS NULL OR p_otro = yo OR NOT rumbo_son_amigos(p_otro) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF p_min IS NULL OR p_min < 5 OR p_min > 120 THEN RAISE EXCEPTION 'no-valido'; END IF;
  IF EXISTS (SELECT 1 FROM foco_salas s WHERE (s.anfitrion IN (yo, p_otro) OR s.invitado IN (yo, p_otro)) AND s.estado = 'activa' AND s.fin > now()) THEN RAISE EXCEPTION 'ocupado'; END IF;
  IF (SELECT count(*) FROM foco_salas WHERE anfitrion = yo AND creada > now() - interval '1 day') >= 20 THEN RAISE EXCEPTION 'limite'; END IF;
  UPDATE foco_salas SET estado = 'cancelada' WHERE anfitrion = yo AND estado = 'invitada';   -- una invitación a la vez
  INSERT INTO foco_salas (anfitrion, invitado, min, titulo_a) VALUES (yo, p_otro, p_min, left(coalesce(p_titulo, ''), 80)) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION foco_sala_responder(p_id bigint, p_acepta boolean, p_titulo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); s foco_salas%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT * INTO s FROM foco_salas WHERE id = p_id AND invitado = yo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no-existe'; END IF;
  IF s.estado <> 'invitada' OR s.creada <= now() - interval '15 minutes' THEN RETURN 'vencida'; END IF;
  IF NOT p_acepta THEN UPDATE foco_salas SET estado = 'rechazada' WHERE id = p_id; RETURN 'rechazada'; END IF;
  UPDATE foco_salas SET estado = 'activa', inicio = now(), fin = now() + make_interval(mins => s.min), titulo_b = left(coalesce(p_titulo, ''), 80) WHERE id = p_id;
  RETURN 'activa';
END $$;

CREATE OR REPLACE FUNCTION foco_sala_salir(p_id bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); s foco_salas%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT * INTO s FROM foco_salas WHERE id = p_id AND (anfitrion = yo OR invitado = yo) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no-existe'; END IF;
  IF s.estado = 'invitada' THEN UPDATE foco_salas SET estado = CASE WHEN yo = s.anfitrion THEN 'cancelada' ELSE 'rechazada' END WHERE id = p_id; RETURN 'cancelada'; END IF;
  IF s.estado = 'activa' AND s.salio IS NULL THEN UPDATE foco_salas SET salio = yo WHERE id = p_id; RETURN 'salio'; END IF;
  IF s.estado = 'activa' AND s.salio <> yo THEN UPDATE foco_salas SET estado = 'terminada' WHERE id = p_id; RETURN 'terminada'; END IF;
  RETURN 'ya';
END $$;

-- Tu sala de ahora: primero la que corre, después la que te invitan y después la tuya por responder
CREATE OR REPLACE FUNCTION foco_sala_mia() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); s foco_salas%ROWTYPE; otro uuid; p perfiles%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT * INTO s FROM foco_salas x WHERE (x.anfitrion = yo OR x.invitado = yo) AND foco_sala_viva(x)
    ORDER BY (x.estado = 'activa') DESC, (x.invitado = yo) DESC, x.creada DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  otro := CASE WHEN s.anfitrion = yo THEN s.invitado ELSE s.anfitrion END;
  SELECT * INTO p FROM perfiles WHERE user_id = otro;
  RETURN jsonb_build_object('id', s.id, 'soy', CASE WHEN s.anfitrion = yo THEN 'anfitrion' ELSE 'invitado' END,
    'otro', jsonb_build_object('id', otro, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar),
    'min', s.min, 'estado', s.estado, 'creada', s.creada, 'inicio', s.inicio, 'fin', s.fin, 'ahora', now(),
    'mi_titulo', CASE WHEN s.anfitrion = yo THEN s.titulo_a ELSE s.titulo_b END,
    'su_titulo', CASE WHEN s.anfitrion = yo THEN s.titulo_b ELSE s.titulo_a END,
    'salio', CASE WHEN s.salio IS NULL THEN NULL WHEN s.salio = yo THEN 'yo' ELSE 'otro' END);
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION foco_aviso(timestamptz, text, text), foco_aviso_quitar(), foco_sala_invitar(uuid, integer, text),
  foco_sala_responder(bigint, boolean, text), foco_sala_salir(bigint), foco_sala_mia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION foco_aviso(timestamptz, text, text), foco_aviso_quitar(), foco_sala_invitar(uuid, integer, text),
  foco_sala_responder(bigint, boolean, text), foco_sala_salir(bigint), foco_sala_mia() TO authenticated;

COMMIT;
