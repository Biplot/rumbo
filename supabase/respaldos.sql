-- ============================================================
-- Rumbo · La copia de 30 días antes de reiniciar o importar (Cuenta › Zona sensible, js/zona.js).
-- Pegar completo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Al reiniciar tus datos o importar un respaldo, Rumbo guarda primero una copia de lo que tenías.
-- Durante 30 días se puede recuperar desde Cuenta («Recuperar mis datos» / «Deshacer la importación»).
-- Cada persona ve, guarda y borra solo sus copias; se guardan las 3 más nuevas y las vencidas se
-- borran solas al guardar una nueva. Al eliminar la cuenta se borran todas (on delete cascade).
--
-- Mientras esta tabla no exista, la app guarda la copia en el equipo donde reiniciaste.
--
-- El código al correo (para confirmar que eres tú si entras solo con Google) usa el correo
-- «Magic Link» de Supabase: en Authentication → Email Templates → Magic Link, el mensaje tiene
-- que incluir {{ .Token }} (el código de 6 números). Por ejemplo:
--   <h2>Tu código de Rumbo</h2>
--   <p>Para confirmar que eres tú, escribe este código en Rumbo: <b>{{ .Token }}</b></p>
--   <p>Si no lo pediste, ignora este correo.</p>
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS respaldos (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  motivo  text NOT NULL CHECK (motivo IN ('reinicio', 'importacion')),
  data    jsonb NOT NULL,
  creado  timestamptz NOT NULL DEFAULT now(),
  vence   timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS respaldos_user_idx ON respaldos (user_id, creado DESC);
ALTER TABLE respaldos ENABLE ROW LEVEL SECURITY;

-- Cada persona, solo lo suyo. Una copia no se edita: se guarda, se lee o se borra.
DROP POLICY IF EXISTS respaldos_ver ON respaldos;
CREATE POLICY respaldos_ver ON respaldos FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS respaldos_guardar ON respaldos;
CREATE POLICY respaldos_guardar ON respaldos FOR INSERT
  WITH CHECK (user_id = auth.uid() AND vence <= now() + interval '31 days');
DROP POLICY IF EXISTS respaldos_borrar ON respaldos;
CREATE POLICY respaldos_borrar ON respaldos FOR DELETE USING (user_id = auth.uid());

-- Al guardar una copia: se borran las vencidas y quedan solo las 3 más nuevas de esa persona
CREATE OR REPLACE FUNCTION respaldos_limpiar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM respaldos WHERE user_id = NEW.user_id AND vence < now();
  DELETE FROM respaldos WHERE user_id = NEW.user_id AND id NOT IN (
    SELECT id FROM respaldos WHERE user_id = NEW.user_id ORDER BY creado DESC LIMIT 3);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS respaldos_limpiar ON respaldos;
CREATE TRIGGER respaldos_limpiar AFTER INSERT ON respaldos FOR EACH ROW EXECUTE FUNCTION respaldos_limpiar();

COMMIT;
