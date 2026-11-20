-- ============================================================
-- Rumbo · 🧭 Norte, tu brújula · fase 2 (2026-11-20): los tipos nuevos de la bandeja.
-- Para una base que ya tiene supabase/norte.sql (las nuevas ya los traen). Idempotente: se puede correr más de una vez.
-- Pegar completo en Supabase → SQL Editor → Run.
--
--   alarmas        tus alarmas cambiadas en el robot (la app las pone si son más nuevas que las de Rumbo)
--   recordatorio   crear, ya avisado o borrar un recordatorio con hora (iguales en Norte-Desk y el robot)
--   tarea_mover    pasar a mañana, delegar o soltar una tarea de hoy
--   alcancia       guardar un monto en una alcancía
--   diario         una entrada del diario, tal cual la dictaste
--   lectura        la página del libro que lees y, con minutos, un foco de lectura
--
-- Además, si existen los hábitos en conjunto (supabase/conjunto.sql): cada marca guarda cuándo se hizo (creado), así
-- Norte avisa «Ana cumplió Meditar» solo con las marcas nuevas. Las marcas que ya estaban quedan con la hora de hoy.
-- ============================================================
BEGIN;
ALTER TABLE norte_pendientes DROP CONSTRAINT IF EXISTS norte_pendientes_tipo_check;
ALTER TABLE norte_pendientes ADD CONSTRAINT norte_pendientes_tipo_check
  CHECK (tipo IN ('habito', 'tarea', 'nota', 'abrir', 'cerrar', 'tarea_hecha', 'foco',
                  'alarmas', 'recordatorio', 'tarea_mover', 'alcancia', 'diario', 'lectura'));

DO $$
BEGIN
  IF to_regclass('public.habitos_conjunto_marcas') IS NOT NULL THEN
    ALTER TABLE habitos_conjunto_marcas ADD COLUMN IF NOT EXISTS creado timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
COMMIT;
