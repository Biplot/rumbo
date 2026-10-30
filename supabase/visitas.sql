-- ============================================================
-- Rumbo · Amigos (etapa 4): visitar la casa y la vitrina de un amigo.
-- Pegar completo en Supabase → SQL Editor → Run, DESPUÉS de supabase/amigos.sql.
-- Se puede correr más de una vez.
--
-- Agrega dos columnas al perfil público (perfiles), que ya leen solo su dueño y sus amigos:
--   casa:    el cuarto de tu elefante como se ve (tu elefante, las cosas puestas, la pared,
--            la repisa y cuántos libros tiene la biblioteca), si eliges mostrar tu casa.
--   vitrina: tus medallas y el día en que ganaste cada una, si eliges mostrar tu vitrina.
-- Si apagas «Tu casa» o «Tu vitrina» en Amigos › Lo que muestras, la app las deja vacías.
-- Las escribe solo su dueño (las reglas de perfiles no cambian).
-- ============================================================

BEGIN;

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS casa jsonb;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS vitrina jsonb;

-- Tamaño acotado (lo que publica la app ocupa mucho menos)
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_casa_tam;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_casa_tam CHECK (casa IS NULL OR char_length(casa::text) <= 4000);
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_vitrina_tam;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_vitrina_tam CHECK (vitrina IS NULL OR char_length(vitrina::text) <= 8000);

COMMIT;

-- Que la API vea las columnas nuevas de inmediato
NOTIFY pgrst, 'reload schema';
