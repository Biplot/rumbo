/* Pruebas en navegador · Iniciar sesión con Google (vía Supabase), con Supabase simulado */
const { URL, nuevoContexto, registrar } = require("./lib.cjs");
module.exports = async ({ b, ok, errs }) => {
  const ctx = await nuevoContexto(b, { fecha: "2026-09-28T08:00:00", w: 390, h: 844 });
  let google = false, authorize = null;
  await ctx.route("https://eakkoggblavtaudbzzos.supabase.co/auth/v1/settings", r =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ external: { email: true, google } }) }));
  await ctx.route("https://eakkoggblavtaudbzzos.supabase.co/auth/v1/authorize**", r => {
    authorize = new globalThis.URL(r.request().url());
    r.fulfill({ contentType: "text/html", body: "<p>Google</p>" });
  });
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await registrar(p, "google@test.cl");
  await p.evaluate(() => doLogout()); await p.waitForTimeout(300);
  ok(await p.locator("#auth-google").isHidden(), "en modo local (o sin Google activo en Supabase) no aparece el botón");

  // La pantalla de acceso pregunta a Supabase si Google está activo
  const disp = await p.evaluate(async () => { SupabaseBackend._google = null; const a = await SupabaseBackend.googleDisponible(); return a; });
  ok(disp === false, "Supabase sin Google activo: googleDisponible() = false");
  google = true;
  ok(await p.evaluate(async () => { SupabaseBackend._google = null; return SupabaseBackend.googleDisponible(); }) === true, "Supabase con Google activo: googleDisponible() = true");
  await p.evaluate(() => { LocalBackend.googleDisponible = () => SupabaseBackend.googleDisponible(); LocalBackend.loginGoogle = () => SupabaseBackend.loginGoogle(); showAuth(); });
  await p.waitForTimeout(200);
  ok(await p.locator("#auth-google").isVisible(), "con Google activo aparece Continuar con Google");
  await p.click('[data-action="auth-google"]'); await p.waitForTimeout(800);
  ok(authorize && authorize.searchParams.get("provider") === "google" && authorize.searchParams.get("redirect_to") === URL && authorize.searchParams.get("prompt") === "select_account",
    "va a Google por Supabase y vuelve a Rumbo, dejando elegir la cuenta");

  // Si se cancela en Google, Rumbo lo explica en la pantalla de acceso
  await p.goto("about:blank"); await p.goto(URL + "#error=access_denied&error_code=400&error_description=The+user+denied+access"); await p.waitForTimeout(700);
  ok((await p.locator("#auth-error").innerText()).includes("Se canceló el inicio de sesión con Google") && !(await p.evaluate(() => location.hash)).includes("error"),
    "si cancelas en Google, lo dice y limpia la dirección");

  // Vincular Google a una cuenta existente (p. ej. creada con Outlook): misma cuenta, mismos datos
  await registrar(p, "outlook@test.cl");
  await p.addStyleTag({ content: ".toast{display:block!important}" });
  const marca = await p.evaluate(() => { STATE.profile.motto = "Mis datos de siempre"; saveState(); return CURRENT_USER.id; });
  await p.evaluate(() => {
    LocalBackend.googleDisponible = async () => true;
    LocalBackend.identidades = async () => window.__ids || [{ provider: "email", email: "outlook@test.cl" }];
    LocalBackend.vincularGoogle = async () => { window.__vincular = (window.__vincular || 0) + 1; return { error: _traducirVinculo("Manual linking is disabled") }; };
  });
  await p.goto(URL + "#cuenta"); await p.waitForTimeout(400);
  ok((await p.locator("#acc-google").innerText()).includes("Vincular con Google"), "Cuenta ofrece Vincular con Google si aún no está");
  await p.click('[data-action="acc-vincular-google"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.__vincular) === 1 && (await p.locator("#toast").innerText()).includes("Allow manual linking"), "si falta activar la vinculación en Supabase, lo explica");
  await p.evaluate(() => { window.__ids = [{ provider: "email", email: "outlook@test.cl" }, { provider: "google", email: "yo@gmail.com" }]; rerender(); });
  await p.waitForTimeout(300);
  const vinc = await p.locator("#acc-google").innerText();
  ok(vinc.includes("Vinculada con yo@gmail.com") && !vinc.includes("Vincular con Google"), "ya vinculada: muestra el Google y no el botón");
  // Al volver de Google con error de identidad ya usada, se queda en Cuenta con un mensaje claro (sin salir de la cuenta)
  await p.goto("about:blank"); await p.goto(URL + "?vincular=1#error=server_error&error_description=Identity+is+already+linked+to+another+user"); await p.waitForTimeout(900);
  const st = await p.evaluate(() => ({ ruta: location.hash, id: CURRENT_USER && CURRENT_USER.id, motto: STATE.profile.motto, busca: location.search }));
  ok(st.ruta === "#cuenta" && st.id === marca && st.motto === "Mis datos de siempre" && st.busca === "" && (await p.locator("#toast").innerText()).includes("otra cuenta de Rumbo"),
    "si ese Google ya tiene otra cuenta, sigues en tu cuenta (mismos datos) y te dice qué hacer");
  await ctx.close();
};
