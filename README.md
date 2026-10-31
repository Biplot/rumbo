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
- **La pantalla, en una** (`js/amigos-tablero.js`): arriba, «Para responder» junta todo lo que espera tu respuesta (invitaciones a planes, hábitos, objetivos, listas y libros; votar una fecha; solicitudes; lo que debes de un plan; los ánimos, en una fila) y se responde ahí mismo (`amPendientes`; en el celular se ven 3 y «Ver todo»). El punto de Amigos en el menú, y el de «Más» en el celular, lleva ese número (`amigosNuevos`). Después, «Esta semana» (tus planes, los abiertos de tus amigos y sus cumpleaños de los próximos 7 días, `amSemana`) y «Juntos»: una baldosa por cada cosa (planes, hábitos, objetivos, listas, lecturas y tus amigos) con su estado, que se abre como hoja sin salir de Amigos y se pone al día sola. Arriba, «+ Nuevo» (plan, hábito, objetivo, lista o lectura) y el engranaje: invitar, tu código, lo que muestras y bloqueados. Sin amigos, «Invita a un amigo» queda en la pantalla. Lo de juntos sigue también en sus módulos.
- **Activar:** Supabase → SQL Editor: correr `supabase/amigos.sql` (se puede repetir). Crea `perfiles`, `amistades` y `animos`, sus reglas (RLS) y las funciones `amigos_*`. Mientras no se corra, la pantalla Amigos dice que todavía no está activo.
- **Avisos al celular** (ánimo, solicitud, amistad aceptada): los manda `api/push.js` (`accion: "amigos"`) después de revisar en la base que corresponden. Se apagan con el aviso «Amigos» en Notificaciones y nunca llegan de 22:00 a 8:00.

### Hábitos en conjunto
Un hábito que haces con uno o más amigos (`js/conjunto.js`). Cada uno lo tiene como un hábito suyo (id `cj-<id>`, con `conjunto: id`): lo marca como cualquier otro, le da sus estrellas y cuenta para su racha. Lo compartido es quiénes están y qué días cumplió cada uno. La racha de a dos (o del grupo) la cuenta `hmRachaConjunto` en `js/habitos-motor.js`, el mismo motor en la app y en el servidor; el día que cumplen todos, +5 ⭐ para cada uno. Si alguien sale, el hábito se queda con él, con su historial.
- **Activar:** Supabase → SQL Editor: correr `supabase/conjunto.sql` **después** de `amigos.sql` (se puede repetir). Crea `habitos_conjunto`, `habitos_conjunto_miembros` y `habitos_conjunto_marcas` (sin acceso directo: todo pasa por las funciones `conjunto_*`). Mientras no se corra, Amigos no muestra su baldosa y el formulario de hábito no ofrece hacerlo con amigos.
- **Avisos al celular** (te invitan, alguien se sumó, «ya cumplió hoy», «lo hicieron todos» con la racha): `notifier/conjunto.mjs`, desde `api/push.js`. Usan el mismo aviso «Amigos» y el mismo horario.

### Objetivos en conjunto
Una meta con avance sumado entre varios (`js/objetivos.js`): juntar para un viaje, correr 100 km en el mes, leer 12 libros entre todos. Cada uno suma sus aportes y la barra muestra lo de cada uno con su color; se ven en Objetivos (sección «Con amigos»), en Amigos y en el perfil de cada amigo. Al lograrlo, +20 ⭐ para cada uno (ledger `objetivo-juntos:<id>`) y, la primera vez, la medalla **En Equipo** (en el centro de La Medalla del cielo). Si después ya no llega (se borró un aporte o subió la meta), el +20 se anula. Si alguien sale, sus aportes siguen sumando.
- **Activar:** Supabase → SQL Editor: correr `supabase/objetivos.sql` **después** de `amigos.sql` (se puede repetir). Crea `objetivos_conjunto`, `objetivos_conjunto_miembros` y `objetivos_conjunto_aportes` (sin acceso directo: todo pasa por las funciones `objetivo_*`). Mientras no se corra, Objetivos queda como siempre.
- **Avisos al celular** (te invitan, alguien se sumó, alguien aportó —uno al día—, «¡lo lograron!»): `notifier/objetivos.mjs`, desde `api/push.js`, con el aviso «Amigos».

### Visitas
La casa y la vitrina de un amigo (`js/visitas.js`), desde su perfil: «Visitar su casa» y «Ver su vitrina». Se ven a pantalla completa, en 3D como las tuyas (rutas `#visita-casa` y `#visita-cielo`), pero de visita: se mira y se toca al elefante, nada más. Tu perfil público lleva una foto de tu casa (tu elefante, lo puesto, la pared, la repisa y los libros) y tus medallas con su fecha, solo si eliges mostrarlas en Amigos › engranaje › Lo que muestras («Tu casa», «Tu vitrina»). El motor 3D lee los datos con los mismos ganchos (`cielo.js`): de visita le llegan los de tu amigo, sin tocar los tuyos.
- **Activar:** Supabase → SQL Editor: correr `supabase/visitas.sql` **después** de `amigos.sql` (se puede repetir). Agrega las columnas `casa` y `vitrina` a `perfiles` (las mismas reglas: las leen su dueño y sus amigos). Mientras no se corra, el perfil se publica sin ellas y las visitas dicen que todavía no están activas.

### Planes con amigos
Juntarse (`js/planes.js`): ver una película, ir a comer, salir a correr, un viaje. Quien lo propone elige qué, cuándo (o que voten entre 2 a 4 fechas, y después elige la que queda), dónde (o a distancia, con un enlace) y a qué amigos invita; cada uno responde voy, tal vez o no puedo. Se ven en Amigos › Planes y en el perfil de cada amigo; si vas (o tal vez vas), el plan aparece en tu Semana, tu Calendario, al abrir tu día y en Inicio el día que toca. Tus amigos ven el plan, no tu agenda. Solo quien lo propuso lo cambia, invita a más o lo cancela (los invitados lo ven cancelado por 7 días).
- **Activar:** Supabase → SQL Editor: correr `supabase/planes.sql` **después** de `amigos.sql` (se puede repetir). Crea `planes`, `planes_invitados`, `planes_opciones` y `planes_votos` (sin acceso directo: todo pasa por las funciones `plan_*`). Mientras no se corra, Amigos no muestra la baldosa Planes.
- **Avisos al celular** (te invitan, alguien respondió, ya hay fecha, cambió cuándo o dónde, se canceló): `notifier/planes.mjs`, desde `api/push.js`. El recordatorio del día («Hoy: …», unas 3 horas antes, o en la mañana si no tiene hora) sale junto con los demás recordatorios, cada 5 minutos. Todos con el aviso «Amigos» y el mismo horario.
- **Después del plan** (`js/planes-despues.js`): desde la hora del plan, «¿Cómo estuvo?» con estrellas y una frase. Queda en tu diario (una entrada con `fromPlan`), da +10 ⭐ la primera vez (ledger `plan-recuerdo:<id>`) y, si eliges compartirla, la ven los que fueron; al día siguiente, Inicio y un aviso lo preguntan. La cuenta del plan: quién pagó qué (en partes iguales entre los que elige), quién le debe a quién y «Ya le pagué» (un pago que salda la deuda). Sin pagos dentro de la app. Tu parte se suma, si quieres, al gasto de ese mes en Finanzas (`finanzas.planes` guarda cuánto, así no se suma dos veces). Los planes de hasta un mes atrás siguen en la lista («Ya pasaron»). Viven en `planes_recuerdos` y `planes_gastos` (`supabase/planes.sql`: volver a correrlo completo).

- **«¿Quién se suma?»**: al proponer un plan se puede abrir a todos tus amigos (con fecha, sin invitar a nadie en particular). Lo ven en Amigos › Planes y se suman solos («Me sumo»). Un aviso a todos tus amigos, una vez (`planes.avisos.abierto`). Columnas `abierto` y `avisos` en `planes`, funciones `plan_abierto_crear` y `plan_sumarme` (`supabase/planes.sql`: volver a correrlo completo).

### Cumpleaños de tus amigos
Si lo eliges en Amigos › engranaje › Lo que muestras («Tu cumpleaños», viene apagado), tus amigos ven el día y el mes de tu fecha de nacimiento (nunca el año): en «Esta semana» de Amigos, «¡Hoy está de cumpleaños!» junto a tu nombre, una tarjeta para saludar en Inicio (el ánimo trae «¡Feliz cumpleaños!») y el día en su Calendario. Va en el estado público del perfil (`perfiles.estado.cumple`, sin SQL nuevo). El aviso del día lo manda `recordatoriosCumples` (`notifier/amigos.mjs`) con los demás recordatorios, una vez en el día (`notif_sent`).

### Leer el mismo libro
Desde un libro de Lecturas, «Leerlo con un amigo» (`js/lecturas-amigos.js`): cada uno lo tiene en sus Lecturas (el libro queda con `juntos: <id>`) y avanza a su ritmo; lo compartido es solo en qué página va cada uno, que se ve en «Leyendo ahora». Avisos: te invitan, alguien se sumó y alguien lo terminó (`notifier/lecturas.mjs`).
- **Activar:** Supabase → SQL Editor: correr `supabase/lecturas.sql` **después** de `amigos.sql` (se puede repetir). Crea `lecturas_conjunto` y `lecturas_conjunto_miembros` (sin acceso directo: todo pasa por las funciones `lectura_*`).

### Listas compartidas
«Películas por ver con Ana», «Restaurantes por probar», «El viaje al sur» (`js/listas-amigos.js`): una lista que arman entre varios, en el módulo Listas (sección «Con amigos», arriba de tus listas personales) y en Amigos. Cada uno agrega, le da +1 a lo que también quiere (lo que más quieren queda arriba), marca lo que ya vieron (o probaron) y le pone de 1 a 5 estrellas; cualquiera le pone una nota («en Netflix»). El boleto junto a cada cosa la elige para un plan: abre un plan nuevo con eso, el tipo que corresponde y la gente de la lista. Si alguien sale, lo que agregó se queda.
- **Activar:** Supabase → SQL Editor: correr `supabase/listas.sql` **después** de `amigos.sql` (se puede repetir). Crea `listas_compartidas`, `listas_compartidas_miembros`, `listas_compartidas_items` y `listas_compartidas_votos` (sin acceso directo: todo pasa por las funciones `lista_*`). Mientras no se corra, Listas queda como siempre.
- **Avisos al celular** (te invitan, alguien se sumó, alguien agregó algo —uno al día por lista—): `notifier/listas.mjs`, desde `api/push.js`, con el aviso «Amigos».

## Álbum del mes
Como en un bullet journal (`js/album.js`): al cerrar el mes, un paso «Álbum del mes» con hasta 9 fotos de los mejores momentos, cada una con una línea (hasta 140 letras) y una de portada. La fecha sale de la foto (EXIF); si es de otro mes, pregunta. Mientras eliges, «Ideas para tus fotos» recuerda lo que pasó: lo mejor del mes, el plan con amigos que mejor evaluaste, el hábito que más cumpliste, el libro que terminaste, un objetivo cumplido y tu mejor día. La primera vez que el álbum del mes en curso (o del que se está cerrando) tiene 3 fotos comentadas: +30 ⭐ (ledger `album:<YYYY-MM>`). El álbum se ve en el Diario (bajo el mapa del ánimo del mes) y en «Tus álbumes», la estantería del año; en Ritual › Mes, cada mes lleva la miniatura de su portada. Los meses anteriores también se pueden armar, sin ⭐. Cada foto se encuadra en su marco (pellizcar o la rueda para el zoom, arrastrar para mover): se guarda como `encuadre: { x, y, z }` y se dibuja con `object-position` y un `scale` desde ese punto, así la foto no se toca.
- **Las fotos:** se achican en el teléfono (1600 px y una miniatura de 480 px, JPEG), quedan en el equipo (IndexedDB `rumbo_fotos`) y se suben a la carpeta privada de cada uno en Supabase Storage: `album/<user_id>/<YYYY-MM>/<foto>.jpg` (y `-m.jpg`). Sin conexión, se suben solas después. En tu documento (`album.meses`) van solo el estilo, la portada y cada foto con su comentario, su fecha y su ruta; entre equipos se fusiona con `albumMerge` (`js/store.js`): las fotos por id, y lo borrado no revive. Al borrar la cuenta, se borran también las fotos.
- **Activar:** Supabase → SQL Editor: correr `supabase/album.sql` (se puede repetir). Crea el bucket privado `album` (hasta 3 MB por archivo, JPEG o WebP) y 4 reglas: cada cuenta solo ve, sube, cambia y borra lo de su carpeta. Mientras no se corra, las fotos quedan en el equipo y la app lo dice.
- **Estilos** (Tienda › Para tu estilo › «Tu álbum», `COSMETICOS` con `grupo: "album"`): Clásico viene incluido; Bullet journal y Polaroid (300 ⭐), Película, Scrapbook y Postales (400 ⭐), Revista (500 ⭐) y Noche estrellada (600 ⭐, animado) se compran una vez, y cada mes elige el suyo. Las páginas se dibujan con CSS que escala con su ancho (container queries, `cqw`): miden al menos 3:4 y crecen lo que pidan las notas, así cada comentario se lee completo (Noche estrellada, con sus fotos en una constelación, queda en 3:4 y sus notas caben igual).
- **Compartir** (`js/album-compartir.js`): «Compartir» en el álbum vuelve cada página una imagen tal como se ve en la app (`html2canvas-pro`, en `js/vendor`, que se baja la primera vez que compartes) y la enmarca con el fondo de su estilo: publicación (1080 × 1350, el carrusel de Instagram) o historia (1080 × 1920), en JPEG. Se elige qué páginas van y se mandan con el menú de compartir del teléfono; en el computador se descargan. Las imágenes se arman en el equipo y solo salen si la persona las comparte; cuenta para la insignia Embajador.

## Agua para todos
Todas las cuentas tienen «Agua de hoy» en Inicio (`js/agua.js`): cada vaso se registra con un toque («+ Vaso», del tamaño que elijas, o «+ Botella», 500 ml) y se puede deshacer. La meta es la que eliges o, si no, 35 ml por kilo de tu último peso en Salud (entre 1,5 y 3,5 L; sin peso, 2 L). Al cumplirla se marca solo el hábito «Agua» (si lo tienes: «Agua», «Tomar 2 litros de agua», «Hidratarme»…) y ganas +10 ⭐ una vez al día (ledger `agua:<YYYY-MM-DD>`); si deshaces y quedas bajo la meta, ambos se devuelven. «Tu agua» muestra los vasos de hoy (con su hora, para quitar uno), los últimos 7 días y los ajustes (meta, tamaño del vaso, estilo, sabor y si se ve en Inicio).
- **Datos:** `STATE.agua = { meta, vaso, inicio, ts, dias: { "YYYY-MM-DD": { r: [{ id, ml, ts }], b: [borrados], p, h } } }`. Pasados 14 días, cada día queda solo con su total (`{ ml }`). Entre equipos se fusiona con `aguaMerge` (`js/store.js`): los vasos de cada día por id, lo borrado no vuelve y los ajustes son del más nuevo.
- **Estilos** (Tienda › Para tu estilo › «Tu agua», `COSMETICOS` con `key: "agua"`; se usan al comprarlos y se cambian en «Tu agua» o en Cuenta › Apariencia): la botella viene incluida; la burbuja (se llena por volumen, como una esfera), la cantimplora (cuatro tramos que se rellenan en cada parada) y la bombilla (el vaso con lo que te queda; mantener apretado es tomar a sorbos, ~100 ml por segundo) cuestan 300 ⭐, y el reloj de agua (se vacía hasta tu próximo vaso: un vaso cada 14 h / vasos de la meta, y se da vuelta al registrarlo), 400 ⭐. Los sabores (`key: "sabor"`, 100 ⭐ c/u: pepino, frutilla, té y arándano) cambian el color del agua en cualquier estilo.
- **El dibujo:** canvas en un cuadro de 140 × 200: la superficie es una fila de resortes (un vaso hace una ola que se esparce), el nivel sube con un rebote, y hay burbujas, chorros y gotas. Cada lienzo se monta solo (`canvas[data-agua]`), anima solo mientras se ve (a 60 cuadros por segundo después de un vaso y a 20 en calma) y respeta «reducir movimiento».
- **El botón de agua (la portilla):** abajo a la derecha en todas las pantallas (sobre la barra en el celular), con tu estilo en chico. Al tocarlo se abre una ventana redonda con tu estilo, cuánto llevas y un anillo; tocar tu estilo es tomar un vaso (en la bombilla, mantener apretado es tomar a sorbos). Se esconde con el teclado abierto, en hojas y ventanas, en Tu casa y Tu vitrina, y en Inicio mientras se ve «Agua de hoy». Se apaga en «Tu agua» (`STATE.agua.fab`). Cerrada no se dibuja, y el botón en chico se mueve solo después de un vaso.
- **Los días de calor:** en «Tu agua» eliges tu ciudad (geocodificación de Open-Meteo); cada día se pide la máxima a Open-Meteo (`api.open-meteo.com`, gratis y sin cuenta) con las coordenadas de la ciudad, nunca la ubicación. La temperatura queda en `dias[fecha].c` y la meta sube medio litro sobre 28 °C y un litro sobre 32 °C (`aguaMeta(S, fecha)`). Si ya cumpliste antes de que llegue el clima, la meta de ese día no cambia; sin conexión queda la de siempre. Ajuste: `STATE.agua.clima = { on, ciudad, lat, lon }`.
- **Estilos de la segunda entrega:** el día de calor (400 ⭐: el cielo se calienta con tu temperatura y la botella transpira), la esclusa (500 ⭐: el barquito sube con cada vaso y zarpa al lago en la meta) y tu elefante riega (600 ⭐: el elefante 3D de Tu casa riega su planta, que crece hoja por hoja y florece en la meta; en chico o sin WebGL, la planta en 2D; con este estilo, al tomar agua el elefante va a regar la planta de su cuarto). El acuario del mes (400 ⭐, `key: "acuario"`) suma un pez por cada día que cumpliste la meta y uno dorado por cada 7 seguidos; se ve en Salud y en el paso «Números» del cierre de mes.

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
