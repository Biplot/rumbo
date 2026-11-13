-- Rumbo · 🧭 Norte, tu brújula: dos tipos nuevos en la bandeja para Norte-Desk (completar una tarea y una sesión de foco).
-- Para una base que ya tiene supabase/norte.sql (las nuevas ya los traen). Idempotente: se puede correr más de una vez.
BEGIN;
ALTER TABLE norte_pendientes DROP CONSTRAINT IF EXISTS norte_pendientes_tipo_check;
ALTER TABLE norte_pendientes ADD CONSTRAINT norte_pendientes_tipo_check
  CHECK (tipo IN ('habito', 'tarea', 'nota', 'abrir', 'cerrar', 'tarea_hecha', 'foco'));
COMMIT;
