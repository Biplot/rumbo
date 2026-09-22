# Teaser de Rumbo

Producción del teaser de la app, de punta a punta y reproducible: el video se
**renderiza desde la app real**, no desde una maqueta. Lo que aparece en la
pantalla del teléfono es Rumbo corriendo en Chromium, con datos de demostración,
y cada toque del guion es un clic de verdad sobre la interfaz.

El descubrimiento que se ve en el video —*"Tu ánimo es 31% mejor los días que
haces Deporte"*— no está escrito en ninguna parte: lo calcula `computeInsights()`
a partir de los datos sembrados.

## Qué produce

| Archivo | Qué es |
|---|---|
| `video/rumbo-teaser-vertical-completo.mp4` | 1080×1920 · 40 s · Reels, TikTok, Stories |
| `video/rumbo-teaser-vertical-corto.mp4` | 1080×1920 · 15 s · corte rápido |
| `video/rumbo-teaser-wide-completo.mp4` | 1920×1080 · 40 s · web y YouTube |
| `out/rumbo-teaser-musica-*.wav` | pista instrumental sintetizada (directorio de trabajo) |

## Cómo se genera

```bash
python3 teaser/music.py --cut=completo        # música de 40 s
python3 teaser/music.py --cut=corto           # música de 15 s

node teaser/render.js --format=vertical --cut=completo
node teaser/render.js --format=vertical --cut=corto
node teaser/render.js --format=wide     --cut=completo
```

Cada render tarda unos 10–12 minutos (1200 fotogramas PNG sin pérdida a
1080×1920). La música se mezcla en la misma pasada; `--musica=no` deja el video
mudo para montarlo en un editor.

Los videos terminados quedan en `teaser/video/` y se versionan. `teaser/out/` es
el directorio de trabajo —música, fotogramas de revisión— y no se versiona.

Para revisar la composición sin renderizar los 40 s completos:

```bash
node teaser/stills.js --at=5600,18600,30400 --dir=teaser/out/stills
```

## Las piezas

| Archivo | Rol |
|---|---|
| `timeline.js` | El guion de 40 s: cielo, cámara, textos y los clics sobre la app |
| `timeline-corto.js` | El corte de 15 s, con la misma estructura comprimida |
| `studio.html` / `studio.js` | El escenario y el motor que convierte tiempo en fotograma |
| `seed.js` | Los datos de demostración, sembrados sobre el `STATE` real |
| `music.py` | La pista instrumental, sintetizada desde cero |
| `render.js` | Recorre el timeline y canaliza los fotogramas a ffmpeg |
| `stills.js` | Fotogramas sueltos para revisar composición |
| `lib/server.js` | Sirve la app real con tres parches mínimos |
| `lib/session.js` | Navegador, cuenta de demostración y datos |
| `lib/setup.js` | Reloj virtual y congelado de animaciones |

## Por qué cada fotograma sale igual

Un render no puede depender de cuánto tarde la captura. Tres decisiones lo
garantizan:

- **Reloj virtual.** El saludo de la app (*"Buenos días"* / *"Buenas noches"*) y
  la fecha del ritual salen de `new Date()`. En el render ese reloj es una
  variable que mueve el timeline, así que el amanecer y la noche ocurren cuando
  el guion lo dice. Sólo el frame de la app lo usa: la página del estudio
  conserva la hora real, que necesita para sus propias esperas.
- **Sin animaciones propias.** Se inyecta `transition: none` en la app. Todo el
  movimiento —incluido el de sus avisos— lo dicta el timeline, que es función
  pura del tiempo.
- **Nada de red.** Tipografía, backend y service worker quedan resueltos en
  local (ver abajo), así que el render no depende de terceros.

## Los tres parches a la app

`lib/server.js` sirve el repositorio tal cual, con tres cambios que no tocan una
sola línea de la interfaz:

1. `js/store.js` → `LocalBackend`, para que los datos de demostración vivan en
   ese navegador y no en la cuenta de nadie.
2. `index.html` → sin el CDN de Supabase y sin service worker, para que no haya
   red ni caché entre corridas.
3. Space Grotesk servida desde `teaser/fonts/`, en vez de Google Fonts.

Si alguna vez falla con *"js/store.js cambió"*, es que se renombró esa línea en
la app: hay que actualizar el parche en `lib/server.js`.

## Cambiar el guion

Los textos, tiempos y acciones están en `timeline.js`. Un `cue` no simula nada:
busca un elemento real y le hace clic.

```js
{ t: 11520, fn: click(".hb-grid .hb-today:nth-child(1)") },   // marca "Deporte"
{ t: [5220, 6700], sel: "#r-mision", text: "Cerrar la propuesta de Andes" },
```

Si se cambia el marcado de la app, hay que revisar esos selectores: el render
avisa en consola cuando un `cue` no encuentra su elemento.

## Advertencia sobre `stills.js`

El timeline se recorre siempre completo, aunque sólo se guarden algunos
fotogramas. Saltar directo a un instante deja los campos sin escribir y el
ritual se guardaría vacío, mostrando una app que no corresponde al guion.
