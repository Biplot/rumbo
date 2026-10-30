/* Tests de Amigos (amigos.js, store.js y notifier/amigos.mjs): lo que se publica, lo que llega de afuera,
   las reglas de la base local (las mismas de supabase/amigos.sql) y los avisos al celular */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAmigos");
  const estadoPublico = G("amigosEstadoPublico"), estadoLimpio = G("amigosEstadoLimpio"), deOtro = G("avatarDeOtro");
  const LB = G("LocalBackend"), ls = G("localStorage");
  const { mensajeAmigo, puedeAvisarAmigo, parAmistad } = await import("../notifier/amigos.mjs");

  test("lo que ven tus amigos: solo lo que elegiste mostrar", () => {
    const d = { fecha: "2026-10-30", abrio: true, cerro: true, racha: 12, rango: 2, rangoNombre: "Enfocado" };
    assert.deepEqual(clone(estadoPublico(d, {})), { fecha: "2026-10-30", abrio: true, cerro: true, racha: 12, rango: 2, rangoNombre: "Enfocado" });
    assert.deepEqual(clone(estadoPublico(d, { dia: false, rango: false })), { fecha: "2026-10-30", racha: 12 });
    assert.deepEqual(clone(estadoPublico(d, { dia: false, racha: false, rango: false })), { fecha: "2026-10-30" });
  });

  test("lo que llega de un amigo se limpia: solo números, sí/no y el nombre del rango de la app", () => {
    const e = clone(estadoLimpio({ fecha: "2026-10-30<b>", cerro: "sí", racha: "<img src=x onerror=alert(1)>", rango: 99, rangoNombre: "<script>" }));
    assert.deepEqual(e, { fecha: "2026-10-30", abrio: false, cerro: true, racha: 0, rango: 6, rangoNombre: "Alto Valor" });
    assert.deepEqual(clone(estadoLimpio(null)), { fecha: "" });
  });

  test("el avatar de un amigo: solo del catálogo y con piezas de la paleta", () => {
    assert.ok(deOtro({ id: "faro" }).startsWith("<svg"));
    assert.equal(deOtro({ id: "inventado" }), null);
    assert.equal(deOtro(null), null);
    const malo = deOtro({ id: "propio", propio: { piel: '"/><script>alert(1)</script>', pelo: "<x>", fondo: "javascript:", ropa: "#F4AE3D" } });
    assert.ok(malo.startsWith("<svg") && !malo.includes("script") && !malo.includes("<x>") && malo.includes("#F4AE3D"));
    assert.ok(deOtro({ id: "propio", propio: { piel: "#9C6444" } }).includes("#B07650"), "los colores de antes pasan a su par");
  });

  // La base local (la que usan las pruebas y el modo sin servidor), con las reglas de supabase/amigos.sql
  const como = id => ls.setItem("rumbo_session", id);
  ls.removeItem("rumbo_amigos");
  como("u_a"); const pa = await LB.amigosPerfil({ nombre: "Ana", estado: { fecha: "2026-10-30", cerro: true } });
  como("u_b"); const pb = await LB.amigosPerfil({ nombre: "Bruno" });
  como("u_c"); const pc = await LB.amigosPerfil({ nombre: "Cami" });
  const r = {};
  como("u_b"); r.propio = await LB.amigosPedir(pb.codigo); r.nada = await LB.amigosPedir("ZZZZZZ"); r.pide = await LB.amigosPedir(pa.codigo.toLowerCase()); r.otra = await LB.amigosPedir(pa.codigo);
  r.autoAcepta = await LB.amigosResponder("u_a", true);
  como("u_a"); r.listaA = await LB.amigosLista(); r.acepta = await LB.amigosResponder("u_b", true);
  como("u_b"); r.listaB = await LB.amigosLista();
  r.an = []; for (let i = 0; i < 4; i++) r.an.push(await LB.amigosAnimo("u_a", i === 0 ? "  ¡Vamos!  " : ""));
  como("u_c"); r.noAmigos = await LB.amigosAnimo("u_a", "hola");
  como("u_a"); r.animos = await LB.amigosLista(); r.vistos = await LB.amigosAnimosVistos(); r.animos2 = await LB.amigosLista();
  como("u_c"); await LB.amigosPedir(pb.codigo);
  como("u_b"); r.cruzada = await LB.amigosPedir(pc.codigo);
  como("u_a"); await LB.amigosBloquear("u_c");
  como("u_c"); r.bloqBuscar = await LB.amigosBuscar(pa.codigo); r.bloqPedir = await LB.amigosPedir(pa.codigo); r.bloqQuitar = await LB.amigosQuitar("u_a");
  como("u_a"); r.bloqueados = await LB.amigosLista(); r.desbloquea = await LB.amigosQuitar("u_c");

  test("base local: códigos de 6 letras y números, únicos y sin los que se confunden", () => {
    [pa, pb, pc].forEach(p => assert.match(p.codigo, /^[A-HJKMNP-Z2-9]{6}$/));
    assert.equal(new Set([pa.codigo, pb.codigo, pc.codigo]).size, 3);
  });
  test("base local: pedir amistad con el código (tu código y uno inventado no sirven); solo el otro acepta", () => {
    assert.equal(r.propio.estado, "tu-codigo"); assert.equal(r.nada.estado, "no-existe");
    assert.deepEqual(clone(r.pide), { estado: "pedida", otro: "u_a" }); assert.equal(r.otra.estado, "pedida");
    assert.equal(r.autoAcepta.r, "nada");
    assert.equal(r.listaA.recibidas.length, 1); assert.equal(r.listaA.recibidas[0].nombre, "Bruno");
    assert.equal(r.acepta.r, "aceptada");
    assert.equal(r.listaB.amigos.length, 1); assert.equal(r.listaB.amigos[0].nombre, "Ana"); assert.equal(r.listaB.amigos[0].estado.cerro, true);
  });
  test("base local: ánimos solo entre amigos, hasta 3 al día y con el mensaje limpio; al verlos dejan de salir", () => {
    assert.ok(r.an[0].id && r.an[1].id && r.an[2].id); assert.equal(r.an[3].error, "limite");
    assert.equal(r.noAmigos.error, "no-amigos");
    assert.equal(r.animos.animos.length, 3); assert.equal(r.animos.animos.find(x => x.mensaje).mensaje, "¡Vamos!");
    assert.equal(r.vistos.n, 3); assert.equal(r.animos2.animos.length, 0);
  });
  test("base local: si el otro ya te había pedido, pedirle acepta; bloquear impide encontrarte o pedirte", () => {
    assert.equal(r.cruzada.estado, "aceptada");
    assert.equal(r.bloqBuscar, null); assert.equal(r.bloqPedir.estado, "no-existe"); assert.equal(r.bloqQuitar.r, "nada");
    assert.equal(r.bloqueados.bloqueados.length, 1); assert.equal(r.desbloquea.r, "quitada");
  });
  ls.removeItem("rumbo_amigos"); ls.removeItem("rumbo_session");

  test("avisos al celular: cada uno con su texto, al ver Amigos", () => {
    assert.deepEqual(mensajeAmigo("animo", { nombre: "Ana", mensaje: "¡Vamos!" }), { title: "Ana te mandó ánimo", body: "«¡Vamos!»", url: "./#amigos", tag: "rumbo-amigos-animo" });
    assert.equal(mensajeAmigo("animo", { nombre: " " }).title, "Un amigo te mandó ánimo");
    assert.equal(mensajeAmigo("solicitud", { nombre: "Bruno" }).body, "Bruno quiere sumarte a sus amigos en Rumbo.");
    assert.equal(mensajeAmigo("aceptada", { nombre: "Cami" }).title, "Cami aceptó tu solicitud");
    assert.equal(mensajeAmigo("otro", {}), null);
  });
  test("avisos al celular: nunca de noche (22:00 a 8:00 donde vive) y solo si tiene encendido «Amigos»", () => {
    // Santiago es UTC-3 en octubre
    assert.equal(puedeAvisarAmigo({}, new Date("2026-10-30T15:00:00Z")), true);    // 12:00
    assert.equal(puedeAvisarAmigo({}, new Date("2026-10-31T01:30:00Z")), false);   // 22:30
    assert.equal(puedeAvisarAmigo({}, new Date("2026-10-30T10:30:00Z")), false);   // 7:30
    assert.equal(puedeAvisarAmigo({}, new Date("2026-10-30T11:00:00Z")), true);    // 8:00
    assert.equal(puedeAvisarAmigo({ tz: "Europe/Madrid" }, new Date("2026-10-30T22:30:00Z")), false);   // 23:30 en Madrid
    assert.equal(puedeAvisarAmigo({ avisos: { amigos: false } }, new Date("2026-10-30T15:00:00Z")), false);
    assert.equal(puedeAvisarAmigo({ tz: "Zona/Inventada" }, new Date("2026-10-30T15:00:00Z")), true);
  });
  test("el par de una amistad se ordena como en la base (a < b)", () => {
    assert.deepEqual(parAmistad("b2", "A1"), ["a1", "b2"]);
    assert.deepEqual(parAmistad("00000000-0000-0000-0000-00000000000a", "00000000-0000-0000-0000-000000000009"), ["00000000-0000-0000-0000-000000000009", "00000000-0000-0000-0000-00000000000a"]);
  });
}
