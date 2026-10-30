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

## Amigos
Invitar con enlace o código, la lista de hoy, ánimos y lo que cada uno muestra (`js/amigos.js`). Tu documento privado (`estado_usuario`) no cambia: lo compartido vive en tablas aparte, con reglas de acceso.
- **Activar:** Supabase → SQL Editor: correr `supabase/amigos.sql` (se puede repetir). Crea `perfiles`, `amistades` y `animos`, sus reglas (RLS) y las funciones `amigos_*`. Mientras no se corra, la pantalla Amigos dice que todavía no está activo.
- **Avisos al celular** (ánimo, solicitud, amistad aceptada): los manda `api/push.js` (`accion: "amigos"`) después de revisar en la base que corresponden. Se apagan con el aviso «Amigos» en Notificaciones y nunca llegan de 22:00 a 8:00.

### Hábitos en conjunto
Un hábito que haces con uno o más amigos (`js/conjunto.js`). Cada uno lo tiene como un hábito suyo (id `cj-<id>`, con `conjunto: id`): lo marca como cualquier otro, le da sus estrellas y cuenta para su racha. Lo compartido es quiénes están y qué días cumplió cada uno. La racha de a dos (o del grupo) la cuenta `hmRachaConjunto` en `js/habitos-motor.js`, el mismo motor en la app y en el servidor; el día que cumplen todos, +5 ⭐ para cada uno. Si alguien sale, el hábito se queda con él, con su historial.
- **Activar:** Supabase → SQL Editor: correr `supabase/conjunto.sql` **después** de `amigos.sql` (se puede repetir). Crea `habitos_conjunto`, `habitos_conjunto_miembros` y `habitos_conjunto_marcas` (sin acceso directo: todo pasa por las funciones `conjunto_*`). Mientras no se corra, Amigos dice que todavía no están activos y el formulario de hábito no ofrece hacerlo con amigos.
- **Avisos al celular** (te invitan, alguien se sumó, «ya cumplió hoy», «lo hicieron todos» con la racha): `notifier/conjunto.mjs`, desde `api/push.js`. Usan el mismo aviso «Amigos» y el mismo horario.

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
