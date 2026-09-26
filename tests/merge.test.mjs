/* ============================================================
   Rumbo · Tests de fusión multi-dispositivo (monedas / ledger)
   Uso: node tests/merge.test.mjs   (sin dependencias)
   Carga js/state.js + js/habitos-motor.js + js/store.js en un contexto vm,
   igual que el navegador (funciones globales).
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mem = {};
const ctx = vm.createContext({
  console, Math, Date, JSON,
  localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } },
});
for (const f of ["js/store.js", "js/state.js", "js/anios.js", "js/agenda.js", "js/habitos-motor.js", "js/tareas-motor.js", "js/ritual-mes.js", "js/ritual-semana.js", "js/ritual-express.js"]) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: f });
}
const G = name => vm.runInContext(name, ctx);
const defaultState = G("defaultState"), migrate = G("migrate"), mergeStates = G("mergeStates");
const ledgerRegistrar = G("ledgerRegistrar"), ledgerAnular = G("ledgerAnular"), ledgerComprar = G("ledgerComprar");

const clone = o => JSON.parse(JSON.stringify(o));
/* Simula loadUserState: fusiona nube + local y migra */
const cargar = (nube, local) => migrate(mergeStates(clone(nube), clone(local)));

/* Estado "viejo" (v43, sin ledger) con saldo */
function estadoViejo(puntos, xp, extra = {}) {
  const s = defaultState();
  delete s.gamif.ledger; delete s.gamif.perks;
  s.gamif.puntos = puntos; s.gamif.xp = xp;
  Object.assign(s.gamif, extra);
  return s;
}

let pass = 0, fail = 0;
function test(nombre, fn) {
  try { fn(); pass++; console.log("  ✓ " + nombre); }
  catch (e) { fail++; console.log("  ✗ " + nombre + "\n    " + (e && e.message)); }
}

console.log("Fusión de monedas (ledger)");

test("(a) comprar en A y abrir B con estado viejo (v43): saldo menor, artículo una vez", () => {
  const base = migrate(estadoViejo(1000, 1000));
  const A = clone(base);
  assert.equal(ledgerComprar(A, "tema-grafito", 400).ok, true);
  const nube = clone(A);
  const B = estadoViejo(1000, 1000); // PC con estado local viejo, anterior al ledger
  const r = cargar(nube, B);
  assert.equal(r.gamif.puntos, 600);
  assert.equal(r.gamif.owned.filter(x => x === "tema-grafito").length, 1);
  assert.equal(r.gamif.ledger.filter(m => m.id === "compra:tema-grafito").length, 1);
});

test("(a') comprar en A y abrir B con ledger viejo: saldo menor, artículo una vez", () => {
  const base = migrate(estadoViejo(1000, 1000));
  const A = clone(base), B = clone(base);
  ledgerComprar(A, "tit-constructor", 300);
  const r1 = cargar(A, B), r2 = cargar(B, A);
  for (const r of [r1, r2]) {
    assert.equal(r.gamif.puntos, 700);
    assert.deepEqual(clone(r.gamif.owned.filter(x => x === "tit-constructor")), ["tit-constructor"]);
  }
});

test("(b) ganar monedas en A y en B por eventos distintos: se suman ambos", () => {
  const base = migrate(estadoViejo(100, 100));
  const A = clone(base), B = clone(base);
  ledgerRegistrar(A, "ritual-apertura:2026-09-23", 50, 50);
  ledgerRegistrar(B, "ritual-cierre:2026-09-23", 40, 40);
  const r = cargar(A, B);
  assert.equal(r.gamif.puntos, 190);
  assert.equal(r.gamif.xp, 190);
});

test("(c) el mismo evento en A y en B cuenta una sola vez", () => {
  const base = migrate(estadoViejo(0, 0));
  const A = clone(base), B = clone(base);
  ledgerRegistrar(A, "ritual-apertura:2026-09-23", 50, 50, "", 1000);
  ledgerRegistrar(B, "ritual-apertura:2026-09-23", 50, 50, "", 2000);
  assert.equal(ledgerRegistrar(A, "ritual-apertura:2026-09-23", 50, 50), false, "no paga dos veces en el mismo equipo");
  const r = cargar(A, B);
  assert.equal(r.gamif.puntos, 50);
  assert.equal(r.gamif.xp, 50);
});

test("(d) marcar / desmarcar / volver a marcar un hábito en equipos distintos: gana lo más reciente", () => {
  const base = migrate(estadoViejo(0, 0));
  const hid = base.habitos.defs[0].id;
  const id = `habito:${hid}:2026-09-23`;
  const A = clone(base), B = clone(base);
  // A marca (t=1000)
  ledgerRegistrar(A, id, 5, 5, "", 1000);
  A.habitos.log["2026-9"] = { [hid]: { 23: true } };
  // B recibe el estado de A y desmarca (t=2000)
  let B2 = cargar(A, B);
  ledgerAnular(B2, id, 2000);
  delete B2.habitos.log["2026-9"][hid][23];
  // A (aún con la marca) se fusiona con B2 → queda desmarcado, 0 monedas
  let r = cargar(B2, A);
  assert.equal(r.gamif.puntos, 0);
  assert.equal(!!(r.habitos.log["2026-9"] && r.habitos.log["2026-9"][hid] && r.habitos.log["2026-9"][hid][23]), false);
  // A vuelve a marcar (t=3000) → gana la marca y paga una sola vez
  const A3 = clone(r);
  ledgerRegistrar(A3, id, 5, 5, "", 3000);
  A3.habitos.log["2026-9"][hid][23] = true;
  r = cargar(B2, A3);
  assert.equal(r.gamif.puntos, 5);
  assert.equal(r.habitos.log["2026-9"][hid][23], true);
  assert.equal(r.gamif.ledger.filter(m => m.id === id).length, 1);
});

test("(e) comprar lo mismo en A y B sin conexión: se cobra una vez", () => {
  const base = migrate(estadoViejo(1000, 1000));
  const A = clone(base), B = clone(base);
  ledgerComprar(A, "tema-medianoche", 500, 1000);
  ledgerComprar(B, "tema-medianoche", 500, 2000);
  const r = cargar(A, B);
  assert.equal(r.gamif.puntos, 500);
  assert.equal(r.gamif.owned.filter(x => x === "tema-medianoche").length, 1);
});

test("migración idempotente: insignias y compras previas no se pagan ni cobran de nuevo", () => {
  const v = estadoViejo(800, 1500, { badges: ["primer-paso"], owned: ["tema-grafito"] });
  const m1 = migrate(clone(v));
  const m2 = migrate(clone(m1));
  for (const r of [m1, m2]) {
    assert.equal(r.gamif.puntos, 800);
    assert.equal(r.gamif.xp, 1500);
    assert.ok(r.gamif.owned.includes("tema-grafito"));
  }
  assert.equal(m2.gamif.ledger.length, m1.gamif.ledger.length);
  assert.equal(ledgerRegistrar(m2, "insignia:primer-paso", 20, 20), false);
  assert.equal(ledgerComprar(m2, "tema-grafito", 400).ok, false);
  assert.equal(m2.gamif.puntos, 800);
});

test("dos saldo-inicial distintos (migrados por separado): se conserva el menor", () => {
  const A = migrate(estadoViejo(900, 900)), B = migrate(estadoViejo(1200, 1200));
  const r = cargar(A, B);
  assert.equal(r.gamif.puntos, 900);
});

test("insignia ganada en A no se paga dos veces aunque B la marque después", () => {
  const base = migrate(estadoViejo(0, 0));
  const A = clone(base), B = clone(base);
  A.gamif.badges.push("madrugador"); ledgerRegistrar(A, "insignia:madrugador", 40, 40, "", 1000);
  B.gamif.badges.push("madrugador"); ledgerRegistrar(B, "insignia:madrugador", 40, 40, "", 2000);
  const r = cargar(A, B);
  assert.equal(r.gamif.puntos, 40);
  assert.deepEqual(clone(r.gamif.badges), ["madrugador"]);
});

test("perks de la cuenta dueña no generan movimientos", () => {
  const s = migrate(estadoViejo(100, 100));
  s.gamif.perks = ["tema-bosque-oscuro"];
  migrate(s);
  assert.ok(s.gamif.owned.includes("tema-bosque-oscuro"));
  assert.equal(s.gamif.puntos, 100);
  assert.equal(s.gamif.ledger.some(m => m.id.includes("bosque-oscuro")), false);
});

test("mergeStates no usa Math.max de saldos (ambos viejos → menor)", () => {
  const r = mergeStates(estadoViejo(600, 900), estadoViejo(1000, 1000));
  assert.equal(r.gamif.puntos, 600);
  assert.equal(r.gamif.xp, 1000);
});

/* Tests adicionales registrados por otras fases (hábitos, ritual de mes, registro diario…) */
for (const f of ["extra.test.mjs", "agenda.test.mjs", "semana.test.mjs", "express.test.mjs", "anios.test.mjs"]) {
  const p = path.join(root, "tests", f);
  if (!fs.existsSync(p)) continue;
  const mod = await import(p);
  await mod.default({ G, test, assert, clone, cargar, estadoViejo });
}

console.log(`\n${pass} ok · ${fail} fallidos`);
process.exit(fail ? 1 : 0);
