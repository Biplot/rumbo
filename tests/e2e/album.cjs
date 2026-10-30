/* Pruebas en navegador · 📷 Álbum del mes, en el celular: en el cierre de octubre, fotos con su comentario y la
   portada (+30 ⭐), una foto de septiembre (pregunta), quitar una, el álbum en el Diario y la estantería, un estilo
   de la Tienda y la miniatura en Ritual › Mes. Sin servidor: las fotos quedan en este navegador (IndexedDB). */
const { URL, nuevoContexto, registrar, shot } = require("./lib.cjs");

/* Un APP1 con EXIF (DateTimeOriginal) para meterlo en un JPEG */
function app1Exif(fecha) {
  const tiff = [], u16 = n => [n & 255, n >> 8], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24];
  tiff.push(0x49, 0x49, ...u16(42), ...u32(8));
  tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(20), ...u32(44), ...u32(0));
  tiff.push(...[...fecha].map(c => c.charCodeAt(0)), 0);
  const cuerpo = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff], largo = cuerpo.length + 2;
  return Buffer.from([0xFF, 0xE1, largo >> 8, largo & 255, ...cuerpo]);
}

module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-10-31T20:00:00", w: 390, h: 844 });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  const dialogos = []; p.on("dialog", d => { dialogos.push(d.message()); d.accept(); });
  const modal = () => p.locator("#modal").innerText();
  const ir = async r => { await p.evaluate(() => closeModal()); await p.goto(URL + "#" + r); await p.waitForTimeout(700); };
  const miniaturas = () => p.locator("#modal .alb-grid .alb-t:not(.alb-t--mas)");
  const album = () => p.evaluate(() => JSON.parse(JSON.stringify(STATE.album.meses["2026-10"] || null)));
  const blobs = sel => p.evaluate(s => [...document.querySelectorAll(s)].filter(i => (i.src || "").startsWith("blob:")).length, sel);

  await registrar(p, "album@test.cl");
  await p.evaluate(() => { STATE.lecturas.push({ id: "l1", titulo: "Rayuela", autor: "Cortázar", estado: "terminado", valoracion: 5, pagina: 600, paginas: 600, nota: "", color: "#17C3B2", portada: "", inicio: "2026-10-01", fin: "2026-10-20" }); saveState(); });
  // Las fotos: JPEG hechos con canvas (la última, con EXIF de septiembre)
  const b64 = await p.evaluate(() => [["#F9B26B", "#7D4F9E"], ["#8ED0F0", "#2F86BF"], ["#FFD9A8", "#E86A7E"], ["#BFE2D2", "#6C7FD8"]].map(([c1, c2]) => {
    const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 900; const g = cv.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 900);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, 1200, 900); g.fillStyle = "#fff"; g.beginPath(); g.arc(800, 360, 130, 0, 7); g.fill();
    return cv.toDataURL("image/jpeg", 0.9).split(",")[1];
  }));
  const archivo = (i, buf) => ({ name: `foto${i + 1}.jpg`, mimeType: "image/jpeg", buffer: buf });
  const jpgs = b64.map(x => Buffer.from(x, "base64"));
  const sept = Buffer.concat([jpgs[3].subarray(0, 2), app1Exif("2026:09:28 18:30:00"), jpgs[3].subarray(2)]);

  // 1) El cierre de octubre: después de la reflexión, «Álbum del mes»
  await p.evaluate(() => openMesCierre("2026-10"));
  for (let i = 0; i < 3; i++) { await p.click('[data-action="mes-next"]'); await p.waitForTimeout(120); }
  await p.fill("#mc-mejor", "El cumpleaños de Ana"); await p.click('[data-action="mes-next"]'); await p.waitForTimeout(200);
  let t = await modal();
  ok(/Paso 5 de 6/i.test(t) && /álbum del mes/i.test(t) && t.includes("Hasta 9 fotos"), "el cierre de mes tiene un paso nuevo: «Álbum del mes» (5 de 6)");
  ok(t.includes("Lo mejor: El cumpleaños de Ana") && t.includes("Terminaste «Rayuela»"), "con ideas para tus fotos: lo mejor del mes y el libro que terminaste");

  // 2) Tres fotos: quedan en este navegador, la primera es la portada
  await p.setInputFiles("#modal .alb-t--mas input", jpgs.slice(0, 3).map((x, i) => archivo(i, x))); await p.waitForTimeout(1500);
  ok(await miniaturas().count() === 3 && await p.locator("#modal .alb-t.is-portada").count() === 1, "agrega 3 fotos: la primera queda de portada");
  const locales = await p.evaluate(async () => (await FOTOS_DB.lista()).map(x => ({ pend: x.v.pendiente, full: x.v.full && x.v.full.size, mini: x.v.mini && x.v.mini.size })));
  ok(locales.length === 3 && locales.every(x => x.pend === false && x.full > 0 && x.mini > 0 && x.mini < x.full), "se guardan achicadas, con su miniatura (sin servidor, en este navegador)");
  ok(await blobs("#modal .alb-grid img") === 3, "y se ven las miniaturas");
  const a1 = await album();
  ok(a1.fotos.length === 3 && a1.fotos.every(f => f.ruta.endsWith("/2026-10/" + f.id) && f.w === 1200 && f.h === 900), "en tu documento: la ruta de cada foto y su tamaño (no la foto)");
  await shot(p, "album-paso");

  // 3) Una de septiembre: pregunta antes de ponerla
  await p.setInputFiles("#modal .alb-t--mas input", [archivo(3, sept)]); await p.waitForTimeout(1500);
  ok(dialogos.some(d => d.includes("septiembre") && d.includes("álbum de octubre")) && await miniaturas().count() === 4, "una foto de septiembre: pregunta si la pone igual en el álbum de octubre");

  // 4) Comentarios: con el tercero, +30 ⭐
  const comentar = async (i, txt) => {
    await miniaturas().nth(i).click(); await p.waitForTimeout(300);
    await p.fill("#alb-com", txt); await p.click('[data-action="alb-listo"]'); await p.waitForTimeout(300);
  };
  await comentar(0, "El atardecer desde el San Cristóbal, después de correr 10 km.");
  await comentar(1, "Domingo en Maitencillo. El agua, helada.");
  ok(!(await p.evaluate(() => albumPremiado("2026-10"))) && (await modal()).includes("llevas 2"), "con 2 comentarios todavía no hay ⭐ (llevas 2)");
  const antes = await p.evaluate(() => STATE.gamif.puntos);
  await comentar(2, "El cumpleaños de Ana: llovió y lo celebramos igual en la terraza.");
  ok(await p.evaluate(() => albumPremiado("2026-10")) && await p.evaluate(() => STATE.gamif.puntos) === antes + 30 && /\+30[\s\S]*por tu álbum/.test(await modal()), "con 3 fotos comentadas: +30 ⭐");
  ok((await p.locator("#modal .alb-t i.is-ok").count()) === 3, "cada miniatura muestra si tiene comentario");

  // 5) La foto de la playa, de portada; quitar la de septiembre
  await miniaturas().nth(1).click(); await p.waitForTimeout(300);
  ok((await modal()).includes("Foto 2 de 4") && await p.locator("#alb-com").inputValue() === "Domingo en Maitencillo. El agua, helada.", "al tocar una foto: se ve grande, con su comentario");
  await p.click('[data-action="alb-portada"]'); await p.waitForTimeout(300);
  ok(await p.locator('[data-action="alb-portada"][disabled]').count() === 1, "«Portada»: ahora es la portada");
  await p.click('[data-action="alb-listo"]'); await p.waitForTimeout(300);
  const a2 = await album();
  ok(a2.portada === a2.fotos[1].id && (await miniaturas().first().getAttribute("aria-label")).includes("Maitencillo"), "la portada pasa al primer lugar");
  await miniaturas().nth(3).click(); await p.waitForTimeout(300);
  await p.click('[data-action="alb-quitar"]'); await p.waitForTimeout(600);
  const a3 = await album();
  ok(a3.fotos.length === 3 && a3.borradas.length === 1 && (await p.evaluate(async () => (await FOTOS_DB.lista()).length)) === 3, "quitar la de septiembre la borra de verdad");

  // 6) Cerrar el mes
  await p.click('[data-action="mes-next"]'); await p.waitForTimeout(200);
  ok(/Paso 6 de 6/i.test(await modal()), "después viene la nota del mes");
  await p.click('[data-action="mes-finish"]'); await p.waitForTimeout(600);
  ok(await p.evaluate(() => !!STATE.ritual.meses["2026-10"].cierre && (STATE.gamif.ledger || []).filter(x => x.id === "album:2026-10").length === 1), "el mes queda cerrado y los +30 ⭐ se dieron una sola vez");

  // 7) En el Diario: el álbum de octubre; al tocarlo, sus páginas
  await ir("diario");
  const d = await p.locator(".alb-diario").innerText();
  ok(d.includes("Álbum de octubre") && d.includes("3 fotos") && d.includes("Maitencillo"), "el Diario muestra el álbum de octubre, con la portada primero");
  ok(await blobs(".alb-diario img") === 3, "con sus fotos");
  await p.click('.alb-diario [data-action="alb-ver"].btn'); await p.waitForTimeout(500);
  ok(await p.locator("#modal .alb .alb--clasico").count() === 1 && await blobs("#modal .alb img") === 3 && (await modal()).includes("Maitencillo"), "el álbum: una página en estilo Clásico, con las 3 fotos y sus comentarios");
  ok((await p.locator("#modal .alb-estilos").innerText()).includes("3 estilos más en la Tienda"), "y la invitación a los otros estilos");
  ok(await p.evaluate(() => document.documentElement.scrollWidth) <= 390, "sin moverse de lado en el celular");
  await shot(p, "album-clasico");

  // 8) Comprar el estilo Bullet journal y usarlo en octubre
  await p.evaluate(() => { closeModal(); registrarMovimiento("prueba:album", 400, 0, "Para probar"); buyItem("alb-bujo"); });
  ok(await p.evaluate(() => isOwned("alb-bujo")), "en la Tienda se compra «Álbum Bullet journal»");
  await p.evaluate(() => openAlbum("2026-10")); await p.waitForTimeout(300);
  await p.click('#modal .alb-estilos [data-v="bujo"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modal .alb--bujo").count() === 1 && await p.evaluate(() => STATE.album.meses["2026-10"].estilo) === "bujo", "octubre pasa a Bullet journal");
  await shot(p, "album-bujo");

  // 9) La estantería del año
  await p.click('#modal [data-action="alb-estante"]'); await p.waitForTimeout(400);
  ok(await p.locator("#modal .alb-tapa").count() === 12 && await p.locator("#modal .alb-tapa--bujo").count() === 1 && (await modal()).includes("3 momentos en 2026"), "«Tus álbumes»: los 12 meses, octubre con su portada (3 momentos en 2026)");
  await p.click('#modal .alb-tapa:has-text("Sep")'); await p.waitForTimeout(300);
  ok((await modal()).includes("Álbum de septiembre") && await p.locator("#modal .alb-t--mas").count() === 1, "un mes sin álbum se puede armar desde la estantería");
  await shot(p, "album-estante");

  // 10) Ritual › Mes: la miniatura en «Meses anteriores»; y al volver a entrar, las fotos siguen ahí
  await p.evaluate(() => { closeModal(); RITUAL_VIEW = "mes"; }); await ir("ritual");
  ok(await p.locator(".alb-mini").count() === 1, "en Ritual › Mes, octubre lleva la miniatura de su portada");
  await p.reload(); await p.waitForSelector("#app:not([hidden])"); await p.waitForTimeout(800); await ir("diario");
  ok(await blobs(".alb-diario img") === 3, "al volver a abrir la app, las fotos se ven (desde este navegador)");

  // 11) En la Tienda, «Tu álbum»
  await ir("recompensas"); await p.click('[data-action="tienda-sec"][data-v="estilo"]'); await p.waitForTimeout(300);
  const tienda = await p.locator("#view").innerText();
  ok(/tu álbum/i.test(tienda) && tienda.includes("Álbum Polaroid") && tienda.includes("Álbum Película") && !tienda.includes("Álbum Bullet journal"), "la Tienda ofrece Polaroid y Película (Bullet journal ya es tuyo)");
  await ctx.close();
};
