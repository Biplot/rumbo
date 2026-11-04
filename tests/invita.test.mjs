/* Tests de «Invita y gana» (invita.js): lo que se gana con lo que dice el servidor (+100 ⭐ a los dos, una vez,
   hasta 10 amigos), el pañuelo de la manada al tercero (también como prenda del elefante), cuándo se activa
   y el aviso al celular de quien invitó (notifier/invitaciones.mjs) */
export default async function ({ G, test, assert, clone }) {
  console.log("\nInvita y gana");
  const defaultState = G("defaultState"), premios = G("invitaPremios"), cerrado = G("invitaDiaCerrado"), registrar = G("ledgerRegistrar"), recalc = G("recalcGamif");
  const tienePanuelo = G("invitaTienePanuelo"), prenda = G("prendaElefante"), tienePrenda = G("tienePrenda");
  const inv = (id, activa, amigos = true) => ({ id, nombre: "Amigo " + id, activa, amigos });
  const pagar = (S, ps) => ps.forEach(p => registrar(S, p.id, p.delta, p.delta, p.motivo));

  test("sin invitaciones activas, nada; un amigo que cerró su primer día: +100 ⭐ (una sola vez)", () => {
    const S = defaultState();
    assert.deepEqual(clone(premios(S, null)), []);
    assert.deepEqual(clone(premios(S, { invitados: [inv("a1xyz", false), inv("b2xyz", false, false)], invito: null })), []);
    const d = { invitados: [inv("a1xyz", true), inv("b2xyz", false)], invito: null }, ps = premios(S, d);
    assert.deepEqual(clone(ps.map(p => [p.id, p.delta])), [["invita:a1xyz", 100]]);
    const antes = S.gamif.puntos || 0; pagar(S, ps); recalc(S);
    assert.equal(S.gamif.puntos - antes, 100);
    assert.deepEqual(clone(premios(S, d)), [], "no se paga dos veces");
  });
  test("quien llegó invitado gana lo suyo cuando su invitación se activa", () => {
    const S = defaultState();
    assert.deepEqual(clone(premios(S, { invitados: [], invito: { id: "ana12", nombre: "Ana María", activa: false } })), []);
    const ps = premios(S, { invitados: [], invito: { id: "ana12", nombre: "Ana María", activa: true } });
    assert.equal(ps.length, 1); assert.equal(ps[0].id, "invitado:ana12"); assert.equal(ps[0].delta, 100); assert.ok(ps[0].llegue); assert.equal(ps[0].motivo, "Llegaste con Ana");
  });
  test("al tercer amigo, el pañuelo de la manada (una vez), y queda como prenda del elefante", () => {
    const S = defaultState(), p = prenda("panuelo");
    assert.ok(p && p.slot === "cuello" && p.gana && !tienePrenda(p, S), "es del cuello y se gana");
    const dos = { invitados: [inv("a1xyz", true), inv("b2xyz", true), inv("c3xyz", false)], invito: null };
    assert.ok(!premios(S, dos).some(x => x.panuelo), "con dos, todavía no");
    pagar(S, premios(S, dos));
    const tres = { invitados: [inv("a1xyz", true), inv("b2xyz", true), inv("c3xyz", true)], invito: null }, ps = premios(S, tres);
    assert.deepEqual(clone(ps.map(x => x.id)), ["invita:c3xyz", "hito:invita:panuelo"]);
    pagar(S, ps); recalc(S);
    assert.ok(tienePanuelo(S) && tienePrenda(p, S), "tu elefante ya lo tiene");
    assert.deepEqual(clone(premios(S, tres)), []);
  });
  test("las ⭐ de quien invita llegan hasta por 10 amigos (el pañuelo y lo del invitado, siempre)", () => {
    const S = defaultState(), d = { invitados: Array.from({ length: 13 }, (_, i) => inv("amigo" + i, true)), invito: null };
    const ps = premios(S, d);
    assert.equal(ps.filter(x => x.id.startsWith("invita:")).length, 10);
    assert.ok(ps.some(x => x.panuelo));
    pagar(S, ps);
    assert.deepEqual(clone(premios(S, d)), [], "después del tope, ya no suma más");
  });
  test("se activa cuando cerraste al menos un día", () => {
    const S = defaultState(); S.ritual.dias = {};
    assert.equal(cerrado(S), false);
    S.ritual.dias["2026-11-04"] = { hecho: true }; assert.equal(cerrado(S), false, "abrir el día no basta");
    S.ritual.dias["2026-11-04"].cerrado = true; assert.equal(cerrado(S), true);
  });

  /* ---------- El servidor ---------- */
  const { mensajeInvita, avisoInvita } = await import("../notifier/invitaciones.mjs");
  function sbFalso(fila) {
    const marcados = [], filtros = [];
    return {
      marcados, filtros,
      from: t => {
        const api = {
          update(c) { marcados.push([t, c]); return api; }, select() { return api; }, eq(k, v) { filtros.push([t, k, v]); return api; }, not(k, op, v) { filtros.push([t, k, op, v]); return api; },
          maybeSingle: async () => t === "invitaciones" ? { data: fila, error: null } : t === "perfiles" ? { data: { nombre: "Bruno Díaz" }, error: null } : { data: { notif: {} }, error: null },
          then(res) { return Promise.resolve({ data: [{ id: 1, endpoint: "e" }], error: null }).then(res); },
        };
        return api;
      },
    };
  }
  const env = [], sb1 = sbFalso({ invita: "ana" });
  const r1 = await avisoInvita({ sb: sb1, yo: "bruno", enviar: async (ds, m) => { env.push(m); return { enviadas: 1 }; }, ahora: new Date("2026-11-04T15:00:00Z") });
  const r2 = await avisoInvita({ sb: sbFalso(null), yo: "bruno", enviar: async () => ({ enviadas: 1 }) });
  test("«Bruno cerró su primer día»: le llega a quien lo invitó, una vez (se marca antes de mandar)", () => {
    assert.equal(r1.enviadas, 1); assert.deepEqual(sb1.marcados[0], ["invitaciones", { avisado: true }]);
    assert.ok(sb1.filtros.some(f => f[1] === "invitado" && f[2] === "bruno") && sb1.filtros.some(f => f[1] === "activa_at" && f[2] === "is"), "solo la de quien llama, y ya activa");
    assert.deepEqual(env[0], { title: "Bruno cerró su primer día en Rumbo", body: "Entró con tu invitación: +100 ⭐ para cada uno. Abre Rumbo para recibirlas.", url: "./#amigos", tag: "rumbo-invita" });
    assert.equal(r2.motivo, "ya-avisado");
    assert.equal(mensajeInvita({}).title, "Tu amigo cerró su primer día en Rumbo");
  });
}
