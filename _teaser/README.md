# Teaser de Rumbo

Teaser de 27 s para Reels, TikTok y Stories (9:16, 1080 × 1920) y versión 16:9 (1920 × 1080). Muestra la app de verdad,
grabada con la cuenta de ejemplo «Camila» (miércoles 18 de noviembre de 2026, en Norte noche), dentro de un teléfono con
cámara virtual, textos cortos y el cierre con el logo. No se publica en rumbo.biplot.cl (`.vercelignore`).

## Archivos
- `escenas.json` — **el guion**: orden, duración, textos (`*palabra*` va en ámbar), toma de la app, toques y cámara de cada
  escena, el cierre, los fps y el pulso de la música (bpm y primer beat). Se edita sin tocar el motor.
- `grabar.cjs` — graba las tomas de la app cuadro a cuadro (390 × 844 al triple, 60 cuadros por segundo) con el reloj de la página en pausa, para
  que salgan nítidas y fluidas. Deja los cuadros en `tomas/` (no se suben al repo).
- `componer.html` — el compositor: fondo, teléfono, cámara, toques, textos, el elefante y el cierre. Abierto en el
  navegador (`node serve.js` y `http://localhost:5178/_teaser/componer.html?formato=916`) se reproduce solo; con `&guia`
  muestra las zonas seguras de las redes.
- `render.cjs` — saca una foto por cuadro y arma el MP4 (H.264) con ffmpeg en `salida/`.
- `elefante.svg` — el elefante de la landing.

## Cómo se arma
```bash
node _teaser/grabar.cjs                      # las 7 tomas (o: node _teaser/grabar.cjs agua casa)
node _teaser/render.cjs --borrador           # borrador 9:16 (540 × 960, 15 fps), en menos de un minuto
node _teaser/render.cjs                      # final 9:16
node _teaser/render.cjs --formato 169        # final 16:9
node _teaser/render.cjs --fotos 3.5,12.2     # solo esos instantes, como PNG
```
Cada render deja también `-guia.mp4` (un clic en cada beat y uno más fuerte en cada corte) y `beats.txt`, para montar la
música. El video principal va con audio en silencio hasta elegir la pista.

Necesita Playwright (Chromium), ffmpeg y salida a Google Fonts (Bricolage Grotesque y Figtree).
