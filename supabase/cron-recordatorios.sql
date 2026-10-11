-- ============================================================
-- Rumbo · Recordatorios a la hora (Supabase Cron → GitHub Actions)
--
-- Por qué: el horario de GitHub ("cada 15 min" en .github/workflows/rituales.yml)
-- en la práctica corre cada 3 a 7 horas, y el aviso solo sale si una pasada cae
-- dentro de los 30 minutos siguientes a tu hora. Por eso casi nunca llegaban.
-- Supabase Cron sí es puntual: cada 5 minutos le pide a GitHub que corra el
-- flujo "Recordatorios de ritual" (el mismo notificador de siempre).
--
-- Antes de correr esto:
--   1. En GitHub crea un token "fine-grained" (Settings → Developer settings →
--      Personal access tokens → Fine-grained tokens → Generate new token):
--        · Resource owner: Biplot · Repository access: Only select → rumbo
--        · Permissions → Repository → Actions: Read and write
--        · Expiration: la más larga que permita la organización (anótala:
--          cuando venza, los avisos vuelven a fallar)
--   2. Reemplaza PEGA_AQUI_EL_TOKEN (abajo) por ese token.
--   3. Pega todo en Supabase → SQL Editor → Run.
--
-- Revisar que funciona: en GitHub → Actions → "Recordatorios de ritual" aparecen
-- corridas "workflow_dispatch" cada 5 minutos. Las respuestas de GitHub quedan en:
--   select status_code, content, created from net._http_response order by created desc limit 5;
--   (204 = bien · 401 = token malo o vencido · 403/404 = al token le falta el permiso Actions)
--
-- Cambiar el token cuando venza:
--   select vault.update_secret((select id from vault.secrets where name = 'rumbo_github_token'), 'TOKEN_NUEVO');
-- Apagarlo:
--   select cron.unschedule('rumbo-recordatorios');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- El token queda cifrado en Vault (no en la tabla del cron)
select vault.create_secret('PEGA_AQUI_EL_TOKEN', 'rumbo_github_token', 'Token de GitHub para disparar los recordatorios de Rumbo');

-- Cada 5 minutos (si ya existía con este nombre, se reemplaza)
select cron.schedule(
  'rumbo-recordatorios',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/Biplot/rumbo/actions/workflows/rituales.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'rumbo_github_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'rumbo-supabase-cron',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main')
  );
  $$
);
