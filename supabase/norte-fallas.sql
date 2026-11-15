-- Rumbo · 🧭 Norte, tu brújula: «esto falló» desde Norte-Desk (acción reportar_falla de api/norte.js).
-- Lo que salió mal, con su contexto (la pregunta, la respuesta, la conversación reciente y los errores de la app), para
-- revisarlo y arreglar a Norte. No va a tu documento: solo lo escribe el servidor (clave de servicio) y nadie más lo lee.
-- Se borra solo a los 90 días. Idempotente: se puede correr más de una vez.
BEGIN;
CREATE TABLE IF NOT EXISTS norte_fallas (
  id        text PRIMARY KEY CHECK (id ~ '^[a-z0-9]{8,40}$'),
  user_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  texto     text NOT NULL DEFAULT '' CHECK (length(texto) <= 500),       -- lo que contó la persona
  pregunta  text NOT NULL DEFAULT '' CHECK (length(pregunta) <= 1000),   -- lo último que le dijo a Norte
  respuesta text NOT NULL DEFAULT '' CHECK (length(respuesta) <= 2000),  -- lo que Norte respondió
  donde     text NOT NULL DEFAULT 'otro' CHECK (donde IN ('charla', 'voz', 'ritual', 'isla', 'anotar', 'ajustes', 'otro')),
  version   text NOT NULL DEFAULT '' CHECK (length(version) <= 30),     -- la versión de Norte-Desk
  contexto  jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(contexto) = 'object' AND pg_column_size(contexto) < 16000),
  revisada  boolean NOT NULL DEFAULT false,
  creado    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS norte_fallas_user ON norte_fallas (user_id, creado);
ALTER TABLE norte_fallas ENABLE ROW LEVEL SECURITY;
-- Nadie la lee directo (RLS sin políticas); el servidor usa la clave de servicio
REVOKE ALL ON TABLE norte_fallas FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE norte_fallas TO service_role;
COMMIT;

-- Limpieza: las de más de 90 días (se puede correr cuando se quiera)
DELETE FROM norte_fallas WHERE creado < now() - interval '90 days';
