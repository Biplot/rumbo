-- ============================================================
-- Rumbo · 🎁 Invita y gana: quién llegó con tu enlace (o tu código) y cuándo se cuenta.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
--   invitaciones: una fila por cuenta nueva que llegó invitada (invitado → quien la invitó).
--     · Se anota cuando una cuenta de 14 días o menos le manda su solicitud de amistad a quien
--       le pasó el enlace o el código (la primera vez; después ya no cambia).
--     · Se activa cuando ya son amigos y el invitado cerró su primer día en Rumbo (la app lo
--       revisa en su documento antes de pedirlo). Ahí cada uno gana +100 ⭐ en su Rumbo; al
--       tercer amigo activo, quien invita gana «el pañuelo de la manada» para su elefante.
--     · avisado: el aviso al celular de quien invitó ya salió (api/push.js).
--
-- Nadie lee ni escribe la tabla directo: todo pasa por las funciones.
--   invitacion_registrar(otro)   la anota (si tu cuenta es nueva y le pediste amistad a `otro`)
--   invitacion_activar()         la activa (si ya son amigos)
--   invitaciones_mias()          a quiénes invitaste (y si ya cuentan) y quién te invitó a ti
-- Al borrar una cuenta se borra todo lo suyo (on delete cascade).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS invitaciones (
  invitado  uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  invita    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  creada    timestamptz NOT NULL DEFAULT now(),
  activa_at timestamptz,                      -- ya son amigos y el invitado cerró su primer día
  avisado   boolean NOT NULL DEFAULT false,   -- el aviso al celular de quien invitó ya salió
  CHECK (invitado <> invita)
);
CREATE INDEX IF NOT EXISTS invitaciones_invita ON invitaciones (invita);
ALTER TABLE invitaciones ENABLE ROW LEVEL SECURITY;

-- La anota quien llega: solo una cuenta nueva (14 días o menos), una vez, y si le pidió amistad a `otro`
CREATE OR REPLACE FUNCTION invitacion_registrar(p_otro uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); alta timestamptz;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  IF p_otro IS NULL OR p_otro = yo THEN RETURN 'no-valido'; END IF;
  IF EXISTS (SELECT 1 FROM invitaciones WHERE invitado = yo) THEN RETURN 'ya'; END IF;
  SELECT created_at INTO alta FROM auth.users WHERE id = yo;
  IF alta IS NULL OR alta < now() - interval '14 days' THEN RETURN 'cuenta-antigua'; END IF;
  IF NOT EXISTS (SELECT 1 FROM amistades WHERE a = least(yo, p_otro) AND b = greatest(yo, p_otro)
      AND pide = yo AND estado IN ('pendiente', 'aceptada')) THEN RETURN 'no-valido'; END IF;
  INSERT INTO invitaciones (invitado, invita) VALUES (yo, p_otro) ON CONFLICT (invitado) DO NOTHING;
  RETURN 'registrada';
END $$;

-- La activa quien llegó, cuando ya cerró su primer día (lo revisa la app) y ya son amigos
CREATE OR REPLACE FUNCTION invitacion_activar() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); f invitaciones%ROWTYPE;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT * INTO f FROM invitaciones WHERE invitado = yo;
  IF NOT FOUND THEN RETURN 'nada'; END IF;
  IF f.activa_at IS NOT NULL THEN RETURN 'ya'; END IF;
  IF NOT EXISTS (SELECT 1 FROM amistades WHERE a = least(yo, f.invita) AND b = greatest(yo, f.invita) AND estado = 'aceptada') THEN
    RETURN 'falta-amistad';
  END IF;
  UPDATE invitaciones SET activa_at = now() WHERE invitado = yo AND activa_at IS NULL;
  RETURN 'activa';
END $$;

-- Lo tuyo: a quiénes invitaste (con nombre y si ya cuentan) y quién te invitó
CREATE OR REPLACE FUNCTION invitaciones_mias() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE yo uuid := auth.uid(); r jsonb;
BEGIN
  IF yo IS NULL THEN RAISE EXCEPTION 'sin-sesion'; END IF;
  SELECT jsonb_build_object(
    'invitados', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.invitado, 'nombre', coalesce(p.nombre, ''), 'avatar', p.avatar,
        'activa', i.activa_at IS NOT NULL, 'activa_at', i.activa_at,
        'amigos', EXISTS (SELECT 1 FROM amistades x WHERE x.a = least(yo, i.invitado) AND x.b = greatest(yo, i.invitado) AND x.estado = 'aceptada'))
        ORDER BY i.activa_at NULLS LAST, i.creada)
      FROM invitaciones i LEFT JOIN perfiles p ON p.user_id = i.invitado WHERE i.invita = yo), '[]'::jsonb),
    'invito', (SELECT jsonb_build_object('id', i.invita, 'nombre', coalesce(p.nombre, ''), 'activa', i.activa_at IS NOT NULL)
      FROM invitaciones i LEFT JOIN perfiles p ON p.user_id = i.invita WHERE i.invitado = yo)
  ) INTO r;
  RETURN r;
END $$;

-- Solo las personas con sesión usan estas funciones
REVOKE ALL ON FUNCTION invitacion_registrar(uuid), invitacion_activar(), invitaciones_mias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION invitacion_registrar(uuid), invitacion_activar(), invitaciones_mias() TO authenticated;

COMMIT;
