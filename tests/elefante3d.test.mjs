/* Tests del elefante en 3D (elefante-3d.js): se arma con three.js de verdad (sin dibujar) en cada tipo,
   etapa, ánimo y prenda; crece con la etapa, viste cada prenda, reacciona al tocarlo y toma sus posturas
   (camina, se echa a dormir, se sienta, riega, baila) */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export default async function ({ G, test, assert }) {
  console.log("\nTu elefante en 3D");
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  // Un documento mínimo: los símbolos (zzz, corazones) se dibujan en un lienzo 2D
  const lienzo = () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } }) });
  const ctx = vm.createContext({ console, Math, Date, JSON, document: { createElement: () => lienzo(), createElementNS: () => lienzo() }, self: {}, window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, "js/vendor/three-0.128.0.min.js"), "utf8"), ctx, { filename: "three.js" });
  vm.runInContext(fs.readFileSync(path.join(root, "js/elefante-3d.js"), "utf8"), ctx, { filename: "elefante-3d.js" });
  const T = vm.runInContext("THREE", ctx), crear = vm.runInContext("crearElefante3D", ctx);
  const PRENDAS = G("PRENDAS_ELEFANTE"), TIPOS = Object.keys(G("TIPOS_ELEFANTE"));
  const mallas = E => { let n = 0; E.g.traverse(o => { if (o.isMesh) n++; }); return n; };
  const alto = E => { E.g.updateMatrixWorld(true); const b = new T.Box3().setFromObject(E.g); return b.max.y - b.min.y; };

  test("se arma en los 6 tipos, las 4 etapas y los 3 ánimos (y se libera)", () => {
    assert.equal(TIPOS.length, 6);
    let n = 0;
    TIPOS.forEach(tipo => [0, 1, 2, 3].forEach(etapa => ["normal", "feliz", "sueno"].forEach(animo => {
      const E = crear(T, { tipo, etapa, animo, calmo: true });
      assert.ok(mallas(E) > 40, `${tipo}/${etapa}/${animo} tiene forma`);
      E.vivo(0); E.vivo(1.7); E.dispose(); n++;
    })));
    assert.equal(n, 72);
  });

  test("crece con la etapa: la cría es más chica que el sabio, con la cabeza más grande en proporción", () => {
    const cria = crear(T, { tipo: "clasico", etapa: 0, calmo: true }), sabio = crear(T, { tipo: "clasico", etapa: 3, calmo: true });
    assert.ok(alto(cria) < alto(sabio) * 0.75);
    assert.equal(cria.g.scale.x, 0.62); assert.equal(sabio.g.scale.x, 1.04);
    cria.dispose(); sabio.dispose();
  });

  test("cada tipo tiene lo suyo: joroba y lana del Mamut, domos del Asiático, contorno de la Tinta", () => {
    const n = tipo => { const E = crear(T, { tipo, etapa: 2, calmo: true }), k = mallas(E); E.dispose(); return k; };
    const base = n("clasico");
    assert.ok(n("mamut") > base + 15, "el Mamut suma joroba, flecos y colmillos en espiral");
    assert.ok(n("asiatico") > base, "el Asiático suma los dos domos y pecas");
    assert.ok(n("tinta") > base * 1.5, "la Tinta suma el contorno de tinta a cada forma");
  });

  test("las 15 prendas se visten en su espacio y cada una agrega su forma", () => {
    assert.equal(PRENDAS.length, 15);
    const sin = crear(T, { tipo: "clasico", etapa: 2, calmo: true }), base = mallas(sin); sin.dispose();
    PRENDAS.forEach(p => {
      const E = crear(T, { tipo: "clasico", etapa: 2, ropa: { [p.slot]: p.id }, calmo: true });
      assert.ok(mallas(E) > base, `${p.id} (${p.slot}) se ve`);
      E.vivo(0.5); E.dispose();
    });
    // todas a la vez, una por espacio, en una cría Peluche
    const E = crear(T, { tipo: "peluche", etapa: 0, ropa: { cabeza: "corona", ojos: "sol", cuello: "bufanda", espalda: "capa", trompa: "taza", pies: "zapatillas" }, calmo: true });
    assert.ok(mallas(E) > base + 20); E.dispose();
  });

  test("al tocarlo reacciona: salta (y vuelve al piso), saluda con la trompa, le salen corazones", () => {
    const E = crear(T, { tipo: "clasico", etapa: 2 });
    E.vivo(10); const y0 = E.g.position.y;
    E.reaccion("salta"); E.vivo(10); E.vivo(10.3);
    assert.ok(E.ocupado() && E.g.position.y > y0 + 0.2, "está en el aire");
    E.vivo(11.5); assert.ok(!E.ocupado() && Math.abs(E.g.position.y - y0) < 1e-6, "aterriza");
    E.reaccion("corazones"); E.vivo(20); E.vivo(20.6);
    let visibles = 0; E.g.traverse(o => { if (o.isSprite && o.material.opacity > 0.2) visibles++; });
    assert.ok(visibles >= 2, "corazones a la vista");
    E.reaccion("saluda"); E.vivo(30); E.vivo(30.65); assert.ok(E.ocupado());
    E.vivo(32); assert.ok(!E.ocupado());
    E.dispose();
  });

  test("vive en su cuarto: camina con las patas en diagonal, se echa a dormir, se sienta, riega, baila y vuelve a pararse", () => {
    const E = crear(T, { tipo: "clasico", etapa: 2 });
    let t = 0;
    const correr = (seg, cada) => { for (const fin = t + seg; t < fin; t += 1 / 30) { E.vivo(t); if (cada) cada(E.pose()); } };
    E.postura({ andar: 1 });
    let diagonal = 0, alzada = 0;
    correr(1.5, q => {
      const d = [q.pies[0][0] - 0.38, q.pies[1][0] - 0.38, q.pies[2][0] + 0.44, q.pies[3][0] + 0.44];
      if (Math.abs(d[0]) > 0.05 && Math.sign(d[0]) === Math.sign(d[3]) && Math.sign(d[0]) !== Math.sign(d[1]) && Math.sign(d[1]) === Math.sign(d[2])) diagonal++;
      alzada = Math.max(alzada, ...q.pies.map(f => f[1]));
    });
    assert.ok(diagonal > 10 && alzada > 0.04, "camina: adelante derecha con atrás izquierda, y levanta las patas");
    E.postura({ echado: 1, dormir: 1 });
    let zzz = 0; correr(2.5, q => { zzz = Math.max(zzz, q.zzz); });
    const q1 = E.pose();
    assert.ok(q1.alto < -0.27 && q1.ojos < 0.2 && zzz > 0.5, "se echa en el piso, cierra los ojos y le salen zzz");
    E.postura({ sentado: 1, giro: 0.6 }); correr(2.5);
    assert.ok(E.pose().sentado > 0.95 && E.pose().giro > 0.55, "se sienta y gira la cabeza");
    E.postura({ regar: 1 }); let gotas = 0; correr(2.5, q => { gotas = Math.max(gotas, q.gotas); });
    assert.ok(gotas > 0.5, "riega: le salen gotas de la trompa");
    E.postura({ baile: 1 }); let notas = 0; correr(2.5, q => { notas = Math.max(notas, q.notas); });
    assert.ok(notas > 0.5, "baila con notas");
    E.postura({}); correr(3);
    const q2 = E.pose();
    assert.ok(Math.abs(q2.alto) < 0.01 && Math.abs(q2.pies[0][0] - 0.38) < 0.01 && q2.zzz === 0 && q2.notas === 0, "y vuelve a pararse como siempre");
    E.dispose();
    // con sueño (no cerraste tu día) tiene los ojos entrecerrados, pero los zzz salen solo cuando duerme
    const Z = crear(T, { tipo: "clasico", etapa: 2, animo: "sueno" });
    for (let k = 0; k < 40; k++) Z.vivo(k / 30 + 1);
    assert.ok(Z.pose().zzz === 0 && Z.pose().ojos > 0.4 && Z.pose().ojos < 0.7, "con sueño, despierto: ojos entrecerrados y sin zzz");
    Z.postura({ echado: 1, dormir: 1 }); let zz = 0; for (let k = 0; k < 90; k++) { Z.vivo(k / 30 + 3); zz = Math.max(zz, Z.pose().zzz); }
    assert.ok(zz > 0.5, "y al dormir la siesta, ahí sí los zzz");
    Z.dispose();
    // en calma (sin animaciones) la postura llega de una: duerme echado, quieto
    const C = crear(T, { tipo: "peluche", etapa: 0, calmo: true });
    C.postura({ echado: 1, dormir: 1 }); C.vivo(0);
    assert.ok(C.pose().alto < -0.29 && C.pose().zzz > 0.8);
    C.dispose();
  });
}
