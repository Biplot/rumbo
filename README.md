# Rumbo · Tu vida en un solo lugar

App personal de gestión de vida: rituales de día, semana y mes (apertura y cierre), registro diario de tareas estilo bullet journal (posponer, delegar, soltar) con métricas de postergación, hábitos, finanzas, metas, lecturas, salud, rueda de la vida, diario, relaciones, listas, tendencias y un sistema de recompensas (rangos, insignias y cosméticos).

Hecha con la identidad de marca **BiPlot** (azul profundo · cian · coral).

## Producción
- **Repositorio:** organización **Biplot** (`Biplot/rumbo`).
- **App:** desplegada con GitHub Pages en `https://biplot.github.io/rumbo/` (dominio propio en configuración).
- **Notificaciones:** recordatorios de ritual (mañana/noche, semana, mes y trimestre) con Web Push, armados igual que en Fundos 360: Supabase (pg_cron cada 5 min + pg_net) le pide a la app que los mande y la función `api/push.js` (Vercel) los envía a cada dispositivo. Ver «Notificaciones» abajo.

## Tecnología
- **Frontend:** HTML, CSS y JavaScript sin frameworks (estático).
- **Backend:** [Supabase](https://supabase.com) (Auth + Postgres). Cada usuario guarda su estado como un documento JSON, protegido por Row Level Security.

## Desarrollo local
```bash
node serve.js
```
Luego abre `http://localhost:5178`.

Tests de lógica (sin dependencias): `node tests/merge.test.mjs`.

Pruebas en navegador (requieren Playwright, solo para desarrollo): `node tests/e2e/run.cjs`. Levantan `serve.js` solas; con `E2E_SHOTS=carpeta` guardan capturas. Ambas corren en GitHub Actions en cada push (`.github/workflows/pruebas.yml`).

## Notificaciones
- **Dispositivos:** cada navegador que activa las notificaciones queda en la tabla `suscripciones_push` (una fila por dispositivo; los que el servicio da por muertos se borran solos). Los horarios siguen en `settings.notif` del estado.
- **Envío:** `pg_cron` llama cada 5 minutos a `rumbo_pedir_recordatorios()`, que hace un `POST` con `pg_net` a `https://rumbo.biplot.cl/api/push/` firmado con el secreto de `configuracion_push`. `api/push.js` ve a quién le toca su hora (`notifier/recordatorios.mjs` y `notifier/reglas.mjs`) y envía con `web-push`. `notif_sent` evita repetir un aviso el mismo día.
- **Claves:** el secreto y las claves VAPID viven en `configuracion_push` (las claves las genera `api/push.js` la primera vez). La clave pública la pide la app a `api/push/`.
- **Puesta en marcha (una vez):**
  1. Vercel → Settings → Environment Variables: `SUPABASE_SERVICE_ROLE_KEY` con la clave secreta de Supabase. Volver a publicar.
  2. Supabase → SQL Editor: correr `supabase/notificaciones.sql` (se puede repetir).
  3. Abrir Rumbo en `rumbo.biplot.cl` y activar las notificaciones: eso anota la dirección a la que llama la base. En cada dispositivo, «Enviar una notificación de prueba» manda un push real desde el servidor.

## Configuración de Supabase
Las claves públicas van en `js/store.js` (`SUPABASE_URL`, `SUPABASE_KEY`). La `publishable key` es pública por diseño; los datos están protegidos por RLS. Esquema:

```sql
create table estado_usuario (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb,
  updated_at timestamptz default now()
);
alter table estado_usuario enable row level security;
create policy "cada quien lo suyo" on estado_usuario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

© BiPlot
