/* Pruebas en navegador · Tu casa y tu vitrina desde Inicio, y la vida de tu elefante en su casa:
   los dos botones abren la pantalla completa al tiro (y el elefante del día lleva a su casa); al entrar,
   tu elefante hace lo que contaba Inicio; camina a su rincón y hace cosas (duerme, mira por la ventana,
   le hace cariño al gato); hace solo lo que permite su cuarto; tocarlo lo interrumpe.
   Sin WebGL, los botones llevan a Progreso y a Insignias */
const { chromium, URL, nuevoContexto, registrar, shot } = require("./lib.cjs");
async function preparar(p, email) {
  await registrar(p, email);
  await p.evaluate(() => {
    localStorage.removeItem("rumbo-sin-escenas");
    ledgerRegistrar(STATE, "pts-test", 5000, 2500, "test");   // Imparable: planta, reloj y biblioteca
    ["cua-gato", "cua-pecera"].forEach(id => ledgerRegistrar(STATE, "compra:" + id, -100, 0, "test"));
    ["primer-paso", "semana-fuego"].forEach(id => { STATE.gamif.badges.push(id); ledgerRegistrar(STATE, "insignia:" + id, 1, 1, "Insignia"); });
    recalcGamif(STATE); saveState();
  });
}
const rut = p => p.evaluate(() => CIELO_ESTADO.motor && CIELO_ESTADO.motor.rutina());
// Adelanta su rutina hasta que esté en esa actividad (en calma no camina solo: la prueba lo lleva)
const hasta = (p, id, mas = 1.5) => p.evaluate(([id, mas]) => {
  const m = CIELO_ESTADO.motor; let r = m.rutinaPaso(0.1, id), n = 0;
  while (n++ < 80 && !(r.act === id && r.fase === "hace")) r = m.rutinaPaso(0.5);
  return m.rutinaPaso(mas);
}, [id, mas]);
const en = (p, ruta, extra) => p.waitForFunction(([ruta, extra]) => CURRENT === ruta && (!extra || (CIELO_ESTADO.motor && CIELO_ESTADO.motor.vista().libre)), [ruta, extra], { timeout: 20000 }).catch(() => {});

module.exports = async ({ b, ok, errs }) => {
  const b3 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  {
    const ctx = await nuevoContexto(b3, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "casa-vida@test.cl");
    await p.goto(URL + "#inicio"); await p.waitForTimeout(500);
    const ahora = await p.evaluate(() => { const a = eleActividadAhora(STATE); return { id: a.id, txt: a.txt }; });
    ok(await p.locator("#view .mundo__b").count() === 2 && (await p.locator(".mundo__b--casa small").innerText()).toLowerCase().includes(ahora.txt), "Inicio tiene Tu casa y Tu vitrina; tu casa cuenta lo que hace tu elefante ahora");
    ok((await p.locator(".mundo__b--vitrina small").innerText()) === "2 medallas de 56" && await p.locator(".mundo__b--vitrina .med-chip__m").count() === 2, "tu vitrina cuenta tus medallas y muestra las últimas");
    await shot(p, "casa-vida-inicio");

    // Tu casa: un toque y a pantalla completa; tu elefante está en lo que decía Inicio
    await p.click(".mundo__b--casa"); await en(p, "cuarto", true); await p.waitForTimeout(600);
    ok(await p.evaluate(() => document.body.classList.contains("en-lugar")) && (await p.locator(".lugar__t b").innerText()) === "Tu casa", "un toque en Tu casa la abre a pantalla completa");
    ok((await rut(p)).act === ahora.id && (await p.locator("#cuaAhora").innerText()).includes(ahora.txt), "y tu elefante está haciendo lo que decía Inicio (la hoja lo cuenta)");
    // Las medallas de la repisa no se tapan entre sí
    const rep = await p.evaluate(() => CIELO_ESTADO.motor.cajasRepisa());
    ok(rep.length === 2 && rep.every((a, i) => rep.every((b, j) => j <= i || Math.min(a.x1, b.x1) <= Math.max(a.x0, b.x0) || Math.min(a.y1, b.y1) <= Math.max(a.y0, b.y0))), "en la repisa, cada medalla en su lugar, sin tapar a la de al lado");
    // Duerme la siesta en su alfombra
    const s = await hasta(p, "siesta");
    ok(s.pose.echado > 0.9 && s.pose.dormir > 0.9 && s.pose.zzz > 0.5 && Math.hypot(s.x - 0.45, s.z - 0.6) < 0.1, "duerme la siesta echado en su alfombra, con zzz");
    // Camina hasta la ventana y mira afuera
    const v = await hasta(p, "ventana");
    ok(v.fase === "hace" && v.x < -0.3 && Math.hypot(v.x - s.x, v.z - s.z) > 0.8 && v.pose.alza > 0.3 && v.pose.echado < 0.1 && (await p.locator("#cuaAhora").innerText()).includes("mira por la ventana"), "se levanta, camina hasta la ventana y mira afuera");
    await shot(p, "casa-vida-ventana");
    // Con el gato que compraste, le hace cariño (y le salen corazones)
    const g = await hasta(p, "gato");
    ok(g.fase === "hace" && g.pose.olfa > 0.4 && g.z > 1.2, "va donde el gato y le hace cariño con la trompa");
    await p.evaluate(() => CIELO_ESTADO.motor.rutinaPaso(0.4));
    ok((await p.evaluate(() => CIELO_ESTADO.motor.cuarto().reaccion)), "y le salen corazones");
    ok(await p.evaluate(() => { const l = eleActividades(STATE).map(a => a.id); return l.includes("peces") && l.includes("libros") && !l.includes("baile"); }), "hace lo que permite su cuarto: mira los peces y busca libros, pero sin tocadiscos no baila");
    // Tocarlo lo interrumpe: reacciona y después sigue con otra cosa
    await hasta(p, "repisa", 1); await p.waitForTimeout(300);
    const q = await p.evaluate(() => CIELO_ESTADO.motor.dondeElefante());
    if (q) await p.mouse.click(q[0], q[1]);
    await p.waitForTimeout(150);
    const r1 = await p.evaluate(() => CIELO_ESTADO.motor.cuarto().reaccion), r2 = await p.evaluate(() => CIELO_ESTADO.motor.rutinaPaso(2.6));
    ok(r1 && !(r2.act === "repisa" && r2.fase === "hace"), "si lo tocas mientras admira sus medallas, reacciona y deja lo que hacía");
    // ‹ / Escape vuelven a Inicio
    await p.keyboard.press("Escape"); await en(p, "inicio");
    ok(await p.evaluate(() => CURRENT === "inicio" && !document.body.classList.contains("en-lugar")), "Escape vuelve a Inicio");
    // Tu vitrina: un toque y a pantalla completa
    await p.click(".mundo__b--vitrina"); await en(p, "cielo", true); await p.waitForTimeout(500);
    ok((await p.locator(".lugar__t b").innerText()) === "Tu vitrina" && (await p.locator(".lugar__t small").innerText()).startsWith("2 de 56 medallas"), "un toque en Tu vitrina abre tus medallas a pantalla completa");
    await p.keyboard.press("Escape"); await en(p, "inicio");
    // El elefante de tu día también lleva a su casa
    await p.click(".ele-hero"); await en(p, "cuarto", true);
    ok(await p.evaluate(() => CURRENT === "cuarto"), "tocar el elefante de tu día te lleva a su casa");
    await ctx.close();
  }
  await b3.close();

  // Sin WebGL: los botones llevan a la tarjeta de cada lugar
  {
    const ctx = await nuevoContexto(b, { fecha: "2026-10-28T15:00:00", w: 390, h: 844 });
    await ctx.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (t, o) { return /webgl/i.test(t) ? null : orig.call(this, t, o); };
    });
    const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
    await preparar(p, "casa-vida-plano@test.cl");
    await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
    await p.click(".mundo__b--casa"); await en(p, "recompensas");
    ok(await p.evaluate(() => CURRENT === "recompensas") && await p.locator(".casa-card.is-sin3d").count() === 1, "sin WebGL, Tu casa lleva a Progreso, con tu elefante de siempre");
    await p.goto(URL + "#inicio"); await p.waitForTimeout(400);
    await p.click(".mundo__b--vitrina"); await en(p, "insignias");
    ok(await p.evaluate(() => CURRENT === "insignias"), "y Tu vitrina, a Insignias");
    await ctx.close();
  }
};
