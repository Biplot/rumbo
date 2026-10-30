-- ============================================================
-- Rumbo · Amigos (etapa 1): perfiles, amistades y ánimos.
-- Pegar completo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Tu documento privado (estado_usuario) no cambia: nadie más lo lee.
-- Lo compartido vive aquí, en tablas con reglas de acceso (RLS):
--
--   1. perfiles: lo que tus amigos ven de ti. Tu nombre, tu avatar, tu código para
--      invitar y, si lo eliges, cómo va tu día (estado: abriste o cerraste el día,
--      tu racha y tu rango). La escribe solo su dueño (la app publica ahí solo lo
--      que elegiste mostrar); la leen su dueño y sus amigos.
--   2. amistades: una fila por par de personas (a < b): pendiente, aceptada o
--      bloqueada. Nadie la escribe directo: se cambia solo con las funciones.
--   3. animos: los toques entre amigos, con un mensaje corto opcional (máximo 3
--      al día de una persona a otra). Los ven quien manda y quien recibe.
--
-- Funciones (security definer: validan quién llama y hacen solo lo que dicen):
--   amigos_buscar(codigo)          quién tiene ese código (nombre y avatar)
--   amigos_pedir(codigo)           manda la solicitud (o la acepta si el otro ya la pidió)
--   amigos_responder(otro, acepta) acepta, rechaza o cancela una solicitud
--   amigos_quitar(otro)            deja de ser amigos (o desbloquea)
--   amigos_bloquear(otro)          bloquea: no puede volver a pedirte amistad
--   amigos_lista()                 tus amigos, solicitudes, bloqueados y ánimos sin ver
--   amigos_animo(para, mensaje)    manda ánimo a un amigo
--   amigos_animos_vistos()         marca como vistos los ánimos que te llegaron
--
-- Los avisos al celular (ánimo, solicitud, aceptada) los manda la app con
-- api/push.js, que revisa aquí que de verdad correspondan (avisos / avisado).
-- Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

-- Código para invitar: 6 letras y números sin los que se confunden (I, L, O, 0, 1)
CREATE OR REPLACE FUNCTION rumbo_codigo_amigo() RETURNS text
LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 6)
$$;

-- ---------- 1. perfiles ----------
CREATE TABLE IF NOT EXISTS perfiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nombre     text NOT NULL DEFAULT '' CHECK (char_length(nombre) <= 60),
  avatar     jsonb,
  codigo     text NOT NULL UNIQUE DEFAULT rumbo_codigo_amigo(),
  muestra    jsonb NOT NULL DEFAULT '{"dia": true, "racha": true, "rango": true}',
  estado     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- ---------- 2. amistades ----------
CREATE TABLE IF NOT EXISTS amistades (
  a           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  b           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  estado      text NOT NULL CHECK (estado IN ('pendiente', 'aceptada', 'bloqueada')),
  pide        uuid NOT NULL,            -- quién mandó la solicitud
  bloquea     uuid,                     -- quién bloqueó (si estado = bloqueada)
  avisos      jsonb NOT NULL DEFAULT '{}',   -- avisos al celular ya enviados: {"solicitud": true, "aceptada": true}
  creada      timestamptz NOT NULL DEFAULT now(),
  aceptada_at timestamptz,
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
CREATE INDEX IF NOT EXISTS amistades_b ON amistades (b);
ALTER TABLE amistades ENABLE ROW LEVEL SECURITY;

-- ---------- 3. animos ----------
CREATE TABLE IF NOT EXISTS animos (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  de      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  para    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mensaje text NOT NULL DEFAULT '' CHECK (char_length(mensaje) <= 120),
  creado  timestamptz NOT NULL DEFAULT now(),
  visto   boolean NOT NULL DEFAULT false,
  avisado boolean NOT NULL DEFAULT false    -- ya se mandó el aviso al celular
);
CREATE INDEX IF NOT EXISTS animos_para ON animos (para, visto);
CREATE INDEX IF NOT EXISTS animos_de ON animos (de, para, creado);
ALTER TABLE animos ENABLE ROW LEVEL SECURITY;

-- ¿Quien llama y `otro` son amigos?
CREATE OR REPLACE FUNCTION rumbo_son_amigos(otro uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM amistades
    WHERE a = least(auth.uid(), otro) AND b = greatest(auth.uid(), otro) AND estado = 'aceptada')
$$;

-- ---------- Reglas de acceso ----------
DROP POLICY IF EXISTS "perfil: lo ven su dueño y sus amigos" ON perfiles;
CREATE POLICY "perfil: lo ven su dueño y sus amigos" ON perfiles FOR SELECT
  USING (user_id = auth.uid() OR rumbo_son_amigos(user_id));
DROP POLICY IF EXISTS "perfil: lo crea su dueño" ON perfiles;
CREATE POLICY "perfil: lo crea su dueño" ON perfiles FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "perfil: lo cambia su dueño" ON perfiles;
CREATE POLICY "perfil: lo cambia su dueño" ON perfiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "perfil: lo borra su dueño" ON perfiles;
CREATE POLICY "perfil: lo borra su dueño" ON perfiles FOR DELETE USING (user_id = auth.uid());

-- amistades y animos: solo lectura para sus participantes; los cambios, con las funciones
DROP POLICY IF EXISTS "amistades: las ven sus dos personas" ON amistades;
CREATE POLICY "amistades: las ven sus dos personas" ON amistades FOR SELECT USING (auth.uid() IN (a, b));
DROP POLICY IF EXISTS "animos: los ven quien manda y quien recibe" ON animos;
CREATE POLICY "animos: los ven quien manda y quien recibe" ON animos FOR SELECT USING (auth.uid() IN (de, para));

-- ---------- Funciones ----------
CREATE OR REPLACE FUNCTION amigos_buscar(p_codigo text)
RETURNS TABLE (user_id uuid, nombre text, avatar jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.nombre, p.avatar FROM perfiles p
  WHERE auth.uid() IS NOT NULL AND p.codigo = upper(btrim(p_codigo)) AND p.user_id <> auth.uid()
    AND NOT EXISTS (SELECT 1 FROM amistades x
      WHERE x.a = least(auth.uid(), p.user_id) AND x.b = greatest(auth.uid(), p.user_id) AND x.estado = 'bloqueada')
$$;

CREATE OR REPLACE FUNCTION amigos_pedir(p_codigo text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); otro uuid; fila amistades%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT user_id INTO otro FROM perfiles WHERE codigo = upper(btrim(p_codigo));
  IF otro IS NULL THEN RETURN jsonb_build_object('estado', 'no-existe'); END IF;
  IF otro = yo THEN RETURN jsonb_build_object('estado', 'tu-codigo'); END IF;
  SELECT * INTO fila FROM amistades WHERE a = least(yo, otro) AND b = greatest(yo, otro);
  IF FOUND THEN
    IF fila.estado = 'bloqueada' THEN RETURN jsonb_build_object('estado', 'no-existe'); END IF;
    IF fila.estado = 'aceptada' THEN RETURN jsonb_build_object('estado', 'ya', 'otro', otro); END IF;
    IF fila.pide = otro THEN   -- el otro ya te la había pedido: quedan como amigos
      UPDATE amistades SET estado = 'aceptada', aceptada_at = now() WHERE a = fila.a AND b = fila.b;
      RETURN jsonb_build_object('estado', 'aceptada', 'otro', otro);
    END IF;
    RETURN jsonb_build_object('estado', 'pedida', 'otro', otro);
  END IF;
  IF (SELECT count(*) FROM amistades WHERE pide = yo AND estado = 'pendiente') >= 20 THEN
    RETURN jsonb_build_object('estado', 'limite');
  END IF;
  INSERT INTO amistades (a, b, estado, pide) VALUES (least(yo, otro), greatest(yo, otro), 'pendiente', yo);
  RETURN jsonb_build_object('estado', 'pedida', 'otro', otro);
END $$;

CREATE OR REPLACE FUNCTION amigos_responder(p_otro uuid, p_acepta boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_acepta THEN
    UPDATE amistades SET estado = 'aceptada', aceptada_at = now()
      WHERE a = least(yo, p_otro) AND b = greatest(yo, p_otro) AND estado = 'pendiente' AND pide = p_otro;
    IF FOUND THEN RETURN 'aceptada'; END IF;
  ELSE   -- rechazar la que te llegó o cancelar la que mandaste
    DELETE FROM amistades WHERE a = least(yo, p_otro) AND b = greatest(yo, p_otro) AND estado = 'pendiente';
    IF FOUND THEN RETURN 'rechazada'; END IF;
  END IF;
  RETURN 'nada';
END $$;

CREATE OR REPLACE FUNCTION amigos_quitar(p_otro uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  -- Si el otro te bloqueó, la fila queda (así no puedes volver a pedirle amistad)
  DELETE FROM amistades WHERE a = least(yo, p_otro) AND b = greatest(yo, p_otro)
    AND (estado <> 'bloqueada' OR bloquea = yo);
  RETURN CASE WHEN FOUND THEN 'quitada' ELSE 'nada' END;
END $$;

CREATE OR REPLACE FUNCTION amigos_bloquear(p_otro uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid();
BEGIN
  IF yo IS NULL OR p_otro IS NULL OR p_otro = yo THEN RAISE EXCEPTION 'no-valido'; END IF;
  INSERT INTO amistades (a, b, estado, pide, bloquea) VALUES (least(yo, p_otro), greatest(yo, p_otro), 'bloqueada', yo, yo)
  ON CONFLICT (a, b) DO UPDATE SET estado = 'bloqueada', bloquea = yo, aceptada_at = NULL
    WHERE amistades.estado <> 'bloqueada' OR amistades.bloquea = yo;
  RETURN 'bloqueada';
END $$;

CREATE OR REPLACE FUNCTION amigos_lista() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  WITH mis AS (
    SELECT CASE WHEN a = yo THEN b ELSE a END AS otro, estado, pide, bloquea, aceptada_at FROM amistades WHERE yo IN (a, b)
  )
  SELECT jsonb_build_object(
    'codigo', (SELECT codigo FROM perfiles WHERE user_id = yo),
    'amigos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.otro, 'nombre', p.nombre, 'avatar', p.avatar, 'estado', p.estado, 'desde', m.aceptada_at) ORDER BY lower(p.nombre))
      FROM mis m JOIN perfiles p ON p.user_id = m.otro WHERE m.estado = 'aceptada'), '[]'::jsonb),
    'recibidas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.otro, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar))
      FROM mis m LEFT JOIN perfiles p ON p.user_id = m.otro WHERE m.estado = 'pendiente' AND m.pide = m.otro), '[]'::jsonb),
    'enviadas', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.otro, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar))
      FROM mis m LEFT JOIN perfiles p ON p.user_id = m.otro WHERE m.estado = 'pendiente' AND m.pide = yo), '[]'::jsonb),
    'bloqueados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.otro, 'nombre', coalesce(p.nombre, '')))
      FROM mis m LEFT JOIN perfiles p ON p.user_id = m.otro WHERE m.estado = 'bloqueada' AND m.bloquea = yo), '[]'::jsonb),
    'animos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', x.id, 'de', x.de, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar, 'mensaje', x.mensaje, 'creado', x.creado) ORDER BY x.creado DESC)
      FROM animos x LEFT JOIN perfiles p ON p.user_id = x.de WHERE x.para = yo AND NOT x.visto), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION amigos_animo(p_para uuid, p_mensaje text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); nuevo bigint;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF NOT rumbo_son_amigos(p_para) THEN RAISE EXCEPTION 'no-amigos'; END IF;
  IF (SELECT count(*) FROM animos WHERE de = yo AND para = p_para AND creado > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'limite';
  END IF;
  INSERT INTO animos (de, para, mensaje) VALUES (yo, p_para, left(coalesce(btrim(p_mensaje), ''), 120)) RETURNING id INTO nuevo;
  RETURN nuevo;
END $$;

CREATE OR REPLACE FUNCTION amigos_animos_vistos() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE animos SET visto = true WHERE para = auth.uid() AND NOT visto;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION amigos_buscar(text), amigos_pedir(text), amigos_responder(uuid, boolean), amigos_quitar(uuid),
  amigos_bloquear(uuid), amigos_lista(), amigos_animo(uuid, text), amigos_animos_vistos(), rumbo_son_amigos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION amigos_buscar(text), amigos_pedir(text), amigos_responder(uuid, boolean), amigos_quitar(uuid),
  amigos_bloquear(uuid), amigos_lista(), amigos_animo(uuid, text), amigos_animos_vistos(), rumbo_son_amigos(uuid) TO authenticated;

COMMIT;
