# Rumbo · Notas para trabajar en el proyecto

App personal (PWA) de rituales de día, semana y mes, tareas, hábitos y módulos. Repo `Biplot/rumbo`, producción en **rumbo.biplot.cl** (GitHub Pages desde `main`).

## Reglas de trabajo (las fijó la dueña del proyecto)
- **Nunca hacer `git push` sin aprobación explícita.** El aviso automático de "commits sin subir" no es aprobación.
- **Cómo subir, una vez aprobado:**
  1. `git push -u origin claude/rumbo-v44-mejoras-kh9nuf`
  2. Esperar a que la acción **Pruebas** termine en verde para ese commit.
  3. Publicar con `git push origin claude/rumbo-v44-mejoras-kh9nuf:main`.
- **Nunca perder datos de usuarios.** Toda estructura nueva necesita:
  - una migración idempotente en `migrate()`;
  - una regla de fusión en `mergeStates()`;
  - valores por defecto en `defaultState()` (todo en `js/state.js`).
  - No se borran datos antiguos.
- **No cambiar el esquema de Supabase.**
- **No agregar dependencias.**
- **Código:** JavaScript sin frameworks, funciones globales y acciones con `data-action` manejadas en `onClick` (`js/app.js`).
- **Textos** en español neutro de Chile.
- **Commits:** en español, uno por fase, sin identificadores de modelo.
- **Privacidad:**
  - No poner correos personales en el repo; solo su hash (`OWNER_HASHES`).
  - No usar ni citar el documento interno del elenco de BiPlot HQ.
  - No pedir ni manejar secretos de OAuth: los configura la dueña en Supabase.
- **Propuestas visuales:** entregarlas como imágenes PNG renderizadas con Playwright. Los lienzos de diseño no se le ven.

## Versiones y pruebas
- **Versión de archivos:** `?v=71` en `index.html`. Caché `rumbo-cache-v29` en `sw.js`. Novedades `INTRO_VERSION = 15`. Al publicar cambios de la app, subir versión y caché.
- **Pruebas de lógica:** `TZ=America/Santiago node tests/merge.test.mjs` (93 ok).
- **Pruebas en navegador:** `node tests/e2e/run.cjs` (456 ok). Necesita `node serve.js` en el puerto 5178; si no está, la prueba lo levanta. Una sola: agregar la spec a `SPECS` en `tests/e2e/run.cjs`.

## Estado (6 de octubre de 2026)
- **v71 en producción.** Incluye:
  - navegación nueva (barra inferior con botón del día, hoja "Más");
  - Inicio enfocado; Calendario, Diario, Salud, Notas y Tienda rediseñados;
  - Google Calendar permanente (función `supabase/functions/gcal`);
  - **holgura de 3 días** para cerrar días anteriores (`pendingCierreDates` en `js/app.js`).
- **Página de presentación** en `/conoce/`, para la campaña. Muestra el precio de pago único, que **todavía no existe en la app**. No está enlazada; se puede quitar el precio hasta que el pago funcione.

## Pendientes conversados (necesitan el visto bueno de la dueña)
1. **Pago único "Rumbo completo".** Propuesta visual en `marketing/propuestas/`.
   - **Precio:** CLP $12.990, con $7.990 de lanzamiento. No mostrar precio tachado (Ley del Consumidor).
   - **Gratis:** día, hábitos, semana, tareas, elefante, ⭐, listas, lectura y calendario.
   - **De pago:** Salud, Finanzas, Notas, Diario, Objetivos, Ritual semanal, Google Calendar y temas.
   - **Fundadores:** todos los usuarios actuales reciben todo gratis más una insignia.
   - **Cobro web** con Flow o Mercado Pago. Una función de Supabase marca la cuenta. Falta confirmar el reparto gratis/pago, la fecha de corte de Fundadores y el proveedor de pago.
2. **Tiendas:**
   - **Android** como TWA (`cl.biplot.rumbo` y `/.well-known/assetlinks.json`).
   - **iOS** con Capacitor, Sign in with Apple y push nativo.
   - Página de soporte, y textos y capturas para las fichas.
   - Lo que le toca hacer a la dueña: D-U-N-S de BiPlot, cuentas de Play Console y Apple Developer, y la verificación de Google del permiso de Calendar.
3. **Campaña:**
   - Material en `marketing/`: 6 anuncios en 2 formatos, video de lanzamiento, guiones de 10 videos.
   - Faltan el sistema de invitación (link propio, descuento para el amigo, ⭐ para quien invita) y los textos para microinfluencers.
   - El anuncio 4, el video 5 y el video de lanzamiento hablan del pago: publicarlos solo cuando el pago funcione.

## Carpeta `marketing/`
- **Material listo para usar.** No es parte de la app.
- **Video:** solo se guarda la versión sin música, porque la pista que se usó es de un tercero. Al publicar, usar audio de la biblioteca de Instagram o TikTok.
- **`marketing/fuentes/`:** los scripts con que se generó todo. Leen rutas de una carpeta temporal, así que hay que ajustarlas antes de volver a correrlos.
