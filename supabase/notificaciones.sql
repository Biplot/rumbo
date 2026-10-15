-- ============================================================
-- Rumbo · Notificaciones al celular, igual que en Fundos 360 (sql/avisos_push.sql).
-- Pegar completo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- Cada 5 minutos la base le pide a la app que mande los recordatorios que
-- tocan (pg_cron + pg_net: la llamada sale sola y no frena nada). La app
-- (api/push.js, en Vercel) revisa a quién le toca su hora y le manda el aviso
-- con Web Push a cada dispositivo de esa persona.
--
--   1. suscripciones_push: un dispositivo (navegador) por fila. Cada persona
--      ve y borra solo los suyos y los registra con registrar_suscripcion_push(),
--      que pasa el dispositivo a quien lo registra si antes era de otra cuenta.
--   2. configuracion_push: una sola fila que solo leen la base y la app: el
--      secreto con que la base firma sus llamadas, la dirección a la que llama
--      (la anota la app la primera vez que alguien activa las notificaciones en
--      rumbo.biplot.cl) y las claves de envío (VAPID, las genera la app la
--      primera vez).
--   3. notif_sent: un recordatorio por persona, tipo y día (ya existía).
--   4. rumbo_pedir_recordatorios(): la llamada de la base a la app.
--   5. pg_cron: cada 5 minutos.
--
-- Antes: en Vercel → Settings → Environment Variables, agrega
-- SUPABASE_SERVICE_ROLE_KEY con la clave secreta de este proyecto de Supabase
-- (Project Settings → API Keys) y vuelve a publicar.
--
-- Para apagarlo todo: SELECT cron.unschedule('rumbo-recordatorios');
-- ============================================================

BEGIN;

-- pg_net y pg_cron vienen con Supabase; si ya están activos no se tocan.
DO $$
BEGIN
  IF to_regnamespace('net') IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
  IF to_regclass('cron.job') IS NULL THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'No se pudo activar pg_cron desde aquí (%): actívalo en Integrations → Cron y vuelve a correr esto.', SQLERRM;
    END;
  END IF;
END $$;

-- 1. Dispositivos
CREATE TABLE IF NOT EXISTS public.suscripciones_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  dispositivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ultimo_envio_at timestamptz,
  ultimo_error text,
  CONSTRAINT suscripciones_push_endpoint_check CHECK (endpoint ~ '^https://' AND length(endpoint) <= 2000)
);
CREATE INDEX IF NOT EXISTS suscripciones_push_usuario ON public.suscripciones_push (user_id);

ALTER TABLE public.suscripciones_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.suscripciones_push FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.suscripciones_push TO authenticated;
GRANT ALL ON TABLE public.suscripciones_push TO service_role;

DROP POLICY IF EXISTS suscripciones_push_ver_propias ON public.suscripciones_push;
CREATE POLICY suscripciones_push_ver_propias ON public.suscripciones_push
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS suscripciones_push_borrar_propias ON public.suscripciones_push;
CREATE POLICY suscripciones_push_borrar_propias ON public.suscripciones_push
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.registrar_suscripcion_push(
  p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_usuario uuid := auth.uid();
BEGIN
  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'Necesitas una sesión activa para activar las notificaciones.';
  END IF;
  IF coalesce(p_endpoint, '') !~ '^https://' OR length(p_endpoint) > 2000
     OR coalesce(p_p256dh, '') = '' OR coalesce(p_auth, '') = ''
     OR length(p_p256dh) > 200 OR length(p_auth) > 100 THEN
    RAISE EXCEPTION 'El navegador entregó una suscripción que no es válida.';
  END IF;
  INSERT INTO suscripciones_push AS s (user_id, endpoint, p256dh, auth, dispositivo)
  VALUES (v_usuario, p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 120))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        dispositivo = EXCLUDED.dispositivo,
        ultimo_error = NULL,
        created_at = CASE WHEN s.user_id = EXCLUDED.user_id THEN s.created_at ELSE now() END;
  -- A lo más 10 dispositivos por persona: se olvidan los más antiguos.
  DELETE FROM suscripciones_push s
  WHERE s.user_id = v_usuario
    AND s.id NOT IN (
      SELECT s2.id FROM suscripciones_push s2
      WHERE s2.user_id = v_usuario
      ORDER BY s2.created_at DESC
      LIMIT 10
    );
END;
$function$;
REVOKE ALL ON FUNCTION public.registrar_suscripcion_push(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_suscripcion_push(text, text, text, text) TO authenticated;

-- 2. Configuración (nadie la lee desde el navegador)
CREATE TABLE IF NOT EXISTS public.configuracion_push (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  secreto text NOT NULL,
  url_envio text CHECK (url_envio IS NULL OR url_envio ~ '^https://[^/]+/api/push/$'),
  vapid_publica text,
  vapid_privada text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracion_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.configuracion_push FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.configuracion_push TO service_role;

INSERT INTO public.configuracion_push (id, secreto)
VALUES (true, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

-- 3. Un recordatorio por persona, tipo y día (la tabla ya existía; si no, se crea)
CREATE TABLE IF NOT EXISTS public.notif_sent (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  fecha date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tipo, fecha)
);
ALTER TABLE public.notif_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notif_sent FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.notif_sent TO service_role;

-- 4. Pedirle a la app que mande los recordatorios que tocan
CREATE OR REPLACE FUNCTION public.rumbo_pedir_recordatorios()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_url text;
  v_secreto text;
BEGIN
  SELECT c.url_envio, c.secreto INTO v_url, v_secreto FROM configuracion_push c WHERE c.id;
  -- Sin dirección (nadie ha activado aún en rumbo.biplot.cl) o sin dispositivos: nada que pedir.
  IF v_url IS NULL OR NOT EXISTS (SELECT 1 FROM suscripciones_push) THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('accion', 'recordatorios'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secreto', v_secreto),
    timeout_milliseconds := 20000
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.rumbo_pedir_recordatorios() FROM PUBLIC, anon, authenticated;

-- 5. Cada 5 minutos (si ya estaba programado con este nombre, se reemplaza)
DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    PERFORM cron.unschedule(j.jobid) FROM cron.job j WHERE j.jobname = 'rumbo-recordatorios';
    PERFORM cron.schedule('rumbo-recordatorios', '*/5 * * * *', 'SELECT public.rumbo_pedir_recordatorios();');
  ELSE
    RAISE NOTICE 'pg_cron no está habilitado (Integrations → Cron): los recordatorios no se programaron.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verificación (solo lectura): todo true salvo app_lee_configuracion = false.
-- url_envio queda vacía hasta que alguien active las notificaciones desde
-- rumbo.biplot.cl (y después de eso, la base empieza a llamar).
SELECT
  to_regclass('public.suscripciones_push') IS NOT NULL
    AND to_regclass('public.configuracion_push') IS NOT NULL
    AND to_regclass('public.notif_sent') IS NOT NULL AS tablas_creadas,
  to_regnamespace('net') IS NOT NULL AS pg_net_activo,
  to_regclass('cron.job') IS NOT NULL AS pg_cron_activo,
  has_function_privilege('authenticated', 'public.registrar_suscripcion_push(text,text,text,text)', 'EXECUTE') AS app_registra_dispositivos,
  has_table_privilege('authenticated', 'public.configuracion_push', 'SELECT') AS app_lee_configuracion,
  (SELECT length(secreto) = 64 FROM public.configuracion_push WHERE id) AS secreto_creado,
  coalesce((SELECT url_envio FROM public.configuracion_push WHERE id), 'se anota al activar desde la app') AS url_envio;

-- Para revisar después (no hace falta correrlo ahora):
--   Dispositivos y su último resultado:
--     SELECT dispositivo, created_at, ultimo_envio_at, ultimo_error FROM suscripciones_push ORDER BY created_at DESC;
--   Lo que respondió la app en las últimas llamadas (200 = bien):
--     SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 5;
