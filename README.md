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

### Objetivos en conjunto
Una meta con avance sumado entre varios (`js/objetivos.js`): juntar para un viaje, correr 100 km en el mes, leer 12 libros entre todos. Cada uno suma sus aportes y la barra muestra lo de cada uno con su color; se ven en Objetivos (sección «Con amigos»), en Amigos y en el perfil de cada amigo. Al lograrlo, +20 ⭐ para cada uno (ledger `objetivo-juntos:<id>`) y, la primera vez, la medalla **En Equipo** (en el centro de La Medalla del cielo). Si después ya no llega (se borró un aporte o subió la meta), el +20 se anula. Si alguien sale, sus aportes siguen sumando.
- **Activar:** Supabase → SQL Editor: correr `supabase/objetivos.sql` **después** de `amigos.sql` (se puede repetir). Crea `objetivos_conjunto`, `objetivos_conjunto_miembros` y `objetivos_conjunto_aportes` (sin acceso directo: todo pasa por las funciones `objetivo_*`). Mientras no se corra, Objetivos queda como siempre.
- **Avisos al celular** (te invitan, alguien se sumó, alguien aportó —uno al día—, «¡lo lograron!»): `notifier/objetivos.mjs`, desde `api/push.js`, con el aviso «Amigos».

### Visitas
La casa y la vitrina de un amigo (`js/visitas.js`), desde su perfil: «Visitar su casa» y «Ver su vitrina». Se ven a pantalla completa, en 3D como las tuyas (rutas `#visita-casa` y `#visita-cielo`), pero de visita: se mira y se toca al elefante, nada más. Tu perfil público lleva una foto de tu casa (tu elefante, lo puesto, la pared, la repisa y los libros) y tus medallas con su fecha, solo si eliges mostrarlas en Amigos › Lo que muestras («Tu casa», «Tu vitrina»). El motor 3D lee los datos con los mismos ganchos (`cielo.js`): de visita le llegan los de tu amigo, sin tocar los tuyos.
- **Activar:** Supabase → SQL Editor: correr `supabase/visitas.sql` **después** de `amigos.sql` (se puede repetir). Agrega las columnas `casa` y `vitrina` a `perfiles` (las mismas reglas: las leen su dueño y sus amigos). Mientras no se corra, el perfil se publica sin ellas y las visitas dicen que todavía no están activas.

### Planes con amigos
Juntarse (`js/planes.js`): ver una película, ir a comer, salir a correr, un viaje. Quien lo propone elige qué, cuándo (o que voten entre 2 a 4 fechas, y después elige la que queda), dónde (o a distancia, con un enlace) y a qué amigos invita; cada uno responde voy, tal vez o no puedo. Se ven en Amigos › Planes y en el perfil de cada amigo; si vas (o tal vez vas), el plan aparece en tu Semana, tu Calendario, al abrir tu día y en Inicio el día que toca. Tus amigos ven el plan, no tu agenda. Solo quien lo propuso lo cambia, invita a más o lo cancela (los invitados lo ven cancelado por 7 días).
- **Activar:** Supabase → SQL Editor: correr `supabase/planes.sql` **después** de `amigos.sql` (se puede repetir). Crea `planes`, `planes_invitados`, `planes_opciones` y `planes_votos` (sin acceso directo: todo pasa por las funciones `plan_*`). Mientras no se corra, Amigos no muestra los planes.
- **Avisos al celular** (te invitan, alguien respondió, ya hay fecha, cambió cuándo o dónde, se canceló): `notifier/planes.mjs`, desde `api/push.js`. El recordatorio del día («Hoy: …», unas 3 horas antes, o en la mañana si no tiene hora) sale junto con los demás recordatorios, cada 5 minutos. Todos con el aviso «Amigos» y el mismo horario.
- **Después del plan** (`js/planes-despues.js`): desde la hora del plan, «¿Cómo estuvo?» con estrellas y una frase. Queda en tu diario (una entrada con `fromPlan`), da +10 ⭐ la primera vez (ledger `plan-recuerdo:<id>`) y, si eliges compartirla, la ven los que fueron; al día siguiente, Inicio y un aviso lo preguntan. La cuenta del plan: quién pagó qué (en partes iguales entre los que elige), quién le debe a quién y «Ya le pagué» (un pago que salda la deuda). Sin pagos dentro de la app. Tu parte se suma, si quieres, al gasto de ese mes en Finanzas (`finanzas.planes` guarda cuánto, así no se suma dos veces). Los planes de hasta un mes atrás siguen en la lista («Ya pasaron»). Viven en `planes_recuerdos` y `planes_gastos` (`supabase/planes.sql`: volver a correrlo completo).

### Listas compartidas
«Películas por ver con Ana», «Restaurantes por probar», «El viaje al sur» (`js/listas-amigos.js`): una lista que arman entre varios, en el módulo Listas (sección «Con amigos», arriba de tus listas personales) y en Amigos. Cada uno agrega, le da +1 a lo que también quiere (lo que más quieren queda arriba), marca lo que ya vieron (o probaron) y le pone de 1 a 5 estrellas; cualquiera le pone una nota («en Netflix»). El boleto junto a cada cosa la elige para un plan: abre un plan nuevo con eso, el tipo que corresponde y la gente de la lista. Si alguien sale, lo que agregó se queda.
- **Activar:** Supabase → SQL Editor: correr `supabase/listas.sql` **después** de `amigos.sql` (se puede repetir). Crea `listas_compartidas`, `listas_compartidas_miembros`, `listas_compartidas_items` y `listas_compartidas_votos` (sin acceso directo: todo pasa por las funciones `lista_*`). Mientras no se corra, Listas queda como siempre.
- **Avisos al celular** (te invitan, alguien se sumó, alguien agregó algo —uno al día por lista—): `notifier/listas.mjs`, desde `api/push.js`, con el aviso «Amigos».

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
