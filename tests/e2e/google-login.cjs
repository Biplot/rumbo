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
  await ctx.close();
};
