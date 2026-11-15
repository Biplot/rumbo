-- ============================================================
-- Rumbo · 🧭 Norte, tu brújula: el robot de voz del escritorio (ESP32) conectado a tu Rumbo.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/agua.sql (Norte suma vasos
-- en agua_pendientes). Se puede correr más de una vez.
--
-- Norte habla con api/norte.js (Vercel). Nada del servidor escribe tu documento (estado_usuario):
-- lo que le pides a Norte queda en una bandeja y la app lo aplica con sus propias funciones al
-- abrirse o al volver a ella (js/norte.js), igual que los vasos del aviso (agua_pendientes).
--
--   1. norte_codigos: el código de 6 dígitos para conectar un Norte. Lo crea la app (Cuenta › «Norte,
--      tu brújula»), dura 10 minutos, sirve una vez y se guarda solo su hash (sha256). Pedir otro
--      anula los anteriores. Cada intento fallido suma uno a los códigos vigentes: con 5, el código
--      ya no sirve. Los vencidos se borran al día siguiente.
--   2. norte_intentos: los intentos fallidos de conectar por IP (con hash), para frenar a quien
--      prueba códigos al azar: 10 en 15 minutos y esa IP espera. Se borran al día siguiente.
--   3. norte_aparatos: cada Norte conectado. Se guarda solo el hash de su token (el token en claro
--      lo recibe Norte una sola vez, al conectarse). «Desconectar» lo deja marcado (desconectado) y
--      su token deja de servir; a los 30 días se borra.
--   4. norte_pendientes: la bandeja. Lo que pediste por voz (marcar un hábito, anotar una tarea o una
--      nota, abrir o cerrar el día) espera aquí hasta que la app lo aplica. La app lo toma (queda
--      reservado 2 minutos para ese equipo, así otro equipo no lo aplica al mismo tiempo), lo aplica,
--      sube tu documento y recién ahí lo confirma (y se borra): si la app se cierra a mitad, el pedido
--      vuelve en 2 minutos y la app reconoce por su id lo que ya aplicó. Los de más de 14 días se borran.
--      El agua no pasa por aquí: va directo a agua_pendientes (supabase/agua.sql).
--
-- Funciones para la app (con sesión):
--   norte_crear_codigo()                 { codigo, expira }: el código en claro, una sola vez
--   norte_aparatos_listar()              tus Norte conectados
--   norte_desconectar(id)                desconecta uno (su token deja de servir)
--   norte_pendientes_tomar()             la bandeja: lo que falta aplicar (lo reserva 2 minutos)
--   norte_pendientes_confirmar(ids)      lo ya aplicado y guardado: se borra
-- Para el servidor (solo service_role, desde api/norte.js):
--   norte_conectar(codigo_hash, ip, token_hash, aparato, nombre)   canjea el código por un aparato
-- Las tablas no se leen ni se escriben directo: la app pasa por las funciones y api/norte.js usa la
-- clave de servicio. Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- ---------- 1. norte_codigos ----------
CREATE TABLE IF NOT EXISTS norte_codigos (
  hash     text PRIMARY KEY CHECK (hash ~ '^[0-9a-f]{64}$'),
  user_id  uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  expira   timestamptz NOT NULL,
  intentos smallint NOT NULL DEFAULT 0,
  usado    timestamptz,
  anulado  boolean NOT NULL DEFAULT false,
  creado   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS norte_codigos_user ON norte_codigos (user_id);
ALTER TABLE norte_codigos ENABLE ROW LEVEL SECURITY;

-- ---------- 2. norte_intentos ----------
CREATE TABLE IF NOT EXISTS norte_intentos (
  ip     text NOT NULL CHECK (char_length(ip) <= 64),
  creado timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS norte_intentos_ip ON norte_intentos (ip, creado);
ALTER TABLE norte_intentos ENABLE ROW LEVEL SECURITY;

-- ---------- 3. norte_aparatos ----------
CREATE TABLE IF NOT EXISTS norte_aparatos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nombre       text NOT NULL DEFAULT 'Norte' CHECK (char_length(nombre) BETWEEN 1 AND 40),
  aparato      text NOT NULL DEFAULT '' CHECK (char_length(aparato) <= 64),
  token_hash   text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  creado       timestamptz NOT NULL DEFAULT now(),
  ultimo_uso   timestamptz,
  desconectado timestamptz
);
CREATE INDEX IF NOT EXISTS norte_aparatos_user ON norte_aparatos (user_id);
ALTER TABLE norte_aparatos ENABLE ROW LEVEL SECURITY;

-- ---------- 4. norte_pendientes ----------
CREATE TABLE IF NOT EXISTS norte_pendientes (
  id           text PRIMARY KEY CHECK (id ~ '^[a-z0-9]{8,40}$'),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('habito', 'tarea', 'nota', 'abrir', 'cerrar', 'tarea_hecha', 'foco')),
  datos        jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(datos) = 'object' AND pg_column_size(datos) < 4000),
  creado       timestamptz NOT NULL DEFAULT now(),
  tomado_hasta timestamptz                       -- reservado para el equipo que lo está aplicando
);
CREATE INDEX IF NOT EXISTS norte_pendientes_user ON norte_pendientes (user_id, creado);
ALTER TABLE norte_pendientes ENABLE ROW LEVEL SECURITY;

-- Nadie las lee directo (RLS sin políticas); el servidor usa la clave de servicio
REVOKE ALL ON TABLE norte_codigos, norte_intentos, norte_aparatos, norte_pendientes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE norte_codigos, norte_intentos, norte_aparatos, norte_pendientes TO service_role;

-- ---------- Para la app ----------
-- Un código nuevo de 6 dígitos (aleatorio fuerte: gen_random_uuid) que anula los anteriores tuyos.
-- Se devuelve en claro solo aquí; en la tabla queda su sha256.
CREATE OR REPLACE FUNCTION norte_crear_codigo() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); c text; h text; n integer := 0; vence timestamptz := now() + interval '10 minutes';
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF (SELECT count(*) FROM norte_codigos WHERE user_id = yo AND creado > now() - interval '1 hour') >= 10 THEN RAISE EXCEPTION 'limite'; END IF;
  DELETE FROM norte_codigos WHERE expira < now() - interval '1 day';
  UPDATE norte_codigos SET anulado = true WHERE user_id = yo AND usado IS NULL AND NOT anulado;
  LOOP
    c := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
    h := encode(sha256(convert_to(c, 'UTF8')), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM norte_codigos WHERE hash = h);
    n := n + 1;
    IF n > 20 THEN RAISE EXCEPTION 'codigo'; END IF;
  END LOOP;
  INSERT INTO norte_codigos (hash, user_id, expira) VALUES (h, yo, vence);
  RETURN jsonb_build_object('codigo', c, 'expira', vence);
END $$;

-- Tus Norte conectados (los desconectados hace más de 30 días se borran)
CREATE OR REPLACE FUNCTION norte_aparatos_listar() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM norte_aparatos WHERE desconectado < now() - interval '30 days';
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'aparato', aparato, 'creado', creado, 'ultimo_uso', ultimo_uso)
    ORDER BY creado), '[]'::jsonb) INTO r
  FROM norte_aparatos WHERE user_id = yo AND desconectado IS NULL;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION norte_desconectar(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  UPDATE norte_aparatos SET desconectado = now() WHERE id = p_id AND user_id = auth.uid() AND desconectado IS NULL;
  RETURN CASE WHEN FOUND THEN 'desconectado' ELSE 'nada' END;
END $$;

-- La bandeja: lo que falta aplicar, en orden. Queda reservado 2 minutos para este equipo
-- (SKIP LOCKED: dos equipos que abren a la vez no toman lo mismo). No se borra hasta confirmar.
CREATE OR REPLACE FUNCTION norte_pendientes_tomar() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM norte_pendientes WHERE creado < now() - interval '14 days';
  WITH libres AS (
    SELECT id FROM norte_pendientes
    WHERE user_id = yo AND (tomado_hasta IS NULL OR tomado_hasta < now())
    ORDER BY creado LIMIT 50 FOR UPDATE SKIP LOCKED
  ), t AS (
    UPDATE norte_pendientes p SET tomado_hasta = now() + interval '2 minutes'
    FROM libres WHERE p.id = libres.id
    RETURNING p.id, p.tipo, p.datos, p.creado
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'datos', datos, 'creado', creado) ORDER BY creado), '[]'::jsonb) INTO r FROM t;
  RETURN r;
END $$;

-- Lo ya aplicado (y guardado en tu documento): se borra de la bandeja
CREATE OR REPLACE FUNCTION norte_pendientes_confirmar(p_ids text[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  DELETE FROM norte_pendientes WHERE user_id = auth.uid() AND id = ANY (coalesce(p_ids, '{}'));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------- Para el servidor (api/norte.js, con la clave de servicio) ----------
-- Canjea el código (su sha256) por un aparato nuevo. Todo en una transacción: el código sirve una vez.
-- Devuelve { ok, user_id, id } o { error: codigo-invalido | codigo-vencido | demasiados-intentos }.
CREATE OR REPLACE FUNCTION norte_conectar(p_codigo_hash text, p_ip text, p_token_hash text, p_aparato text, p_nombre text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f norte_codigos%ROWTYPE; hay boolean; nuevo uuid; v_ip text := left(coalesce(p_ip, ''), 64);
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'token'; END IF;
  DELETE FROM norte_intentos WHERE creado < now() - interval '1 day';
  IF (SELECT count(*) FROM norte_intentos i WHERE i.ip = v_ip AND i.creado > now() - interval '15 minutes') >= 10 THEN
    RETURN jsonb_build_object('error', 'demasiados-intentos');
  END IF;
  SELECT * INTO f FROM norte_codigos WHERE hash = coalesce(p_codigo_hash, '') FOR UPDATE;
  hay := FOUND;
  IF NOT hay THEN
    INSERT INTO norte_intentos (ip) VALUES (v_ip);
    -- nadie sabe a qué código apuntaba: el intento cuenta para todos los vigentes
    UPDATE norte_codigos SET intentos = intentos + 1 WHERE usado IS NULL AND NOT anulado AND expira > now();
    RETURN jsonb_build_object('error', 'codigo-invalido');
  END IF;
  IF f.intentos >= 5 THEN
    INSERT INTO norte_intentos (ip) VALUES (v_ip);
    RETURN jsonb_build_object('error', 'demasiados-intentos');
  END IF;
  IF f.usado IS NOT NULL OR f.anulado OR f.expira <= now() THEN
    INSERT INTO norte_intentos (ip) VALUES (v_ip);
    RETURN jsonb_build_object('error', 'codigo-vencido');
  END IF;
  UPDATE norte_codigos SET usado = now() WHERE hash = f.hash;
  -- el mismo aparato conectado de nuevo: el token anterior deja de servir
  IF coalesce(p_aparato, '') <> '' THEN
    UPDATE norte_aparatos SET desconectado = now() WHERE user_id = f.user_id AND aparato = left(p_aparato, 64) AND desconectado IS NULL;
  END IF;
  INSERT INTO norte_aparatos (user_id, nombre, aparato, token_hash)
    VALUES (f.user_id, coalesce(nullif(left(btrim(coalesce(p_nombre, '')), 40), ''), 'Norte'), left(coalesce(p_aparato, ''), 64), p_token_hash)
    RETURNING id INTO nuevo;
  RETURN jsonb_build_object('ok', true, 'user_id', f.user_id, 'id', nuevo);
END $$;

-- La app (con sesión) usa sus funciones; norte_conectar es solo del servidor
REVOKE ALL ON FUNCTION norte_crear_codigo(), norte_aparatos_listar(), norte_desconectar(uuid),
  norte_pendientes_tomar(), norte_pendientes_confirmar(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION norte_crear_codigo(), norte_aparatos_listar(), norte_desconectar(uuid),
  norte_pendientes_tomar(), norte_pendientes_confirmar(text[]) TO authenticated;
REVOKE ALL ON FUNCTION norte_conectar(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION norte_conectar(text, text, text, text, text) TO service_role;

COMMIT;
