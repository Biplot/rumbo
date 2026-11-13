/* Tests de 🧭 Norte, tu brújula para Norte-Desk: las tareas de hoy y los hábitos con tiempo en «hoy», completar una
   tarea y una sesión de foco, en el servidor (notifier/norte.mjs, con un Supabase falso) y al aplicarlos en la app
   (norteAplicar de js/norte.js): con las mismas ⭐ que en Rumbo, y sin duplicar nada */
export default async function ({ G, test, assert, clone }) {
  console.log("\nNorte, tu brújula: tareas de hoy y foco (Norte-Desk)");
  const { atenderNorte, resumenDia, hashToken } = await import("../notifier/norte.mjs");

  /* ---------- Un Supabase falso (como en norte.test.mjs) ---------- */
  function sbFalso(tablas, ahora) {
    const log = { inserts: [] };
    const T = n => (tablas[n] = tablas[n] || []);
    function consulta(nombre) {
      const filtros = []; let modo = "select", op = {}, filas = null, cambios = null, unico = false;
      const q = {
        select(c, o) { if (modo === "select") op = o || {}; return q; },
        eq(k, v) { filtros.push(r => r[k] === v); return q; },
        gte(k, v) { filtros.push(r => String(r[k]) >= String(v)); return q; },
        maybeSingle() { unico = true; return q; },
        insert(f) { modo = "insert"; filas = [].concat(f); return q; },
        upsert(f) { modo = "upsert"; filas = [].concat(f); return q; },
        update(c) { modo = "update"; cambios = c; return q; },
        then(ok, ko) { return Promise.resolve().then(correr).then(ok, ko); },
      };
      function correr() {
        const t = T(nombre);
        if (modo === "insert" || modo === "upsert") { filas.forEach(f => { t.push(Object.assign({ creado: ahora.toISOString() }, f)); log.inserts.push({ tabla: nombre, f }); }); return { data: null, error: null }; }
        const sel = t.filter(r => filtros.every(f => f(r)));
        if (modo === "update") { sel.forEach(r => Object.assign(r, cambios)); return { data: null, error: null }; }
        if (op.head) return { data: null, count: sel.length, error: null };
        return { data: unico ? sel[0] || null : sel, error: null };
      }
      return q;
    }
    return { tablas, log, from: consulta, rpc: async () => ({ data: null, error: null }) };
  }
  const U = "00000000-0000-0000-0000-0000000000aa", TOKEN = "ab".repeat(32), AHORA = new Date("2026-11-11T15:00:00Z"), HOY = "2026-11-11";
  const estado = () => ({
    settings: { notif: { tz: "America/Santiago" } },
    habitos: {
      defs: [
        { id: "h1", nombre: "Leer", minutos: 20, frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h2", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
        { id: "h3", nombre: "Guitarra", minutos: 30, frecuencia: { tipo: "diario" }, creado: "2026-01-01" },
      ],
      log: {},
    },
    enfoque: { sesiones: [{ id: "f1", fecha: HOY, habId: "h1", real: 10, completa: false }, { id: "f2", fecha: "2026-11-10", habId: "h1", real: 30 }] },
    ritual: { dias: {} },
    agenda: { dias: { [HOY]: [
      { id: "t1", txt: "Pagar la luz", ambito: "per", estado: "pendiente" },
      { id: "t2", txt: "Correo", estado: "hecha", done: true },
      { id: "t3", txt: "Escribir el informe", ambito: "pro", estado: "pendiente", esSapo: true },
      { id: "t4", txt: "Vieja", borrada: true },
      { id: "t5", txt: "Pasó a mañana", estado: "migrada" },
    ] } },
    agua: { meta: 2000, dias: {} },
  });
  const nuevoSb = () => sbFalso({
    estado_usuario: [{ user_id: U, data: estado() }],
    norte_aparatos: [{ id: "ap1", user_id: U, token_hash: hashToken(TOKEN), desconectado: null }],
    norte_pendientes: [], agua_pendientes: [],
  }, AHORA);
  const pedir = (sb, body) => atenderNorte({ sb, body, autorizacion: "Bearer " + TOKEN, ahora: AHORA });

  /* ---------- «hoy» con tareas y hábitos con tiempo ---------- */
  const sb0 = nuevoSb(), h0 = await pedir(sb0, { accion: "hoy" });
  test("hoy: trae tus tareas (el bocado primero, las hechas al final, sin borradas ni movidas) y tus hábitos con tiempo", () => {
    const d = h0.cuerpo.datos;
    assert.deepEqual(d.tareas.map(t => [t.id, t.hecha, t.bocado]), [["t3", false, true], ["t1", false, false], ["t2", true, false]]);
    assert.equal(d.tareas[0].texto, "Escribir el informe"); assert.equal(d.tareas[0].ambito, "pro");
    assert.deepEqual(d.habitos_tiempo, [{ nombre: "Leer", minutos: 20, hoy: 10, hecho: false }, { nombre: "Guitarra", minutos: 30, hoy: 0, hecho: false }]);
    assert.equal(d.tareas_pendientes, 2);
  });

  /* ---------- Completar una tarea ---------- */
  const sb1 = nuevoSb(), c1 = await pedir(sb1, { accion: "completar_tarea", id: "t1" });
  const c1b = await pedir(sb1, { accion: "hoy" }), c2 = await pedir(sb1, { accion: "completar_tarea", id: "t1" });
  const c3 = await pedir(nuevoSb(), { accion: "completar_tarea", id: "nada" }), c4 = await pedir(nuevoSb(), { accion: "completar_tarea", id: "t2" });
  const c5 = await pedir(nuevoSb(), { accion: "completar_tarea", id: "mal id!" });
  test("completar_tarea: va a la bandeja como tarea_hecha y «hoy» ya la cuenta hecha; la que no existe, 404", () => {
    assert.equal(c1.status, 200); assert.match(c1.cuerpo.texto, /^Listo, completé Pagar la luz\. Te queda una tarea\.$/);
    const p = sb1.tablas.norte_pendientes[0];
    assert.equal(p.tipo, "tarea_hecha"); assert.deepEqual([p.datos.tid, p.datos.fecha], ["t1", HOY]);
    assert.ok(c1b.cuerpo.datos.tareas.find(t => t.id === "t1").hecha); assert.equal(c1b.cuerpo.datos.tareas_pendientes, 1);
    assert.deepEqual([c2.status, c2.cuerpo.datos.ya], [200, true], "una segunda vez: ya estaba hecha (y no se pide de nuevo)");
    assert.equal(sb1.tablas.norte_pendientes.length, 1);
    assert.deepEqual([c3.status, c3.cuerpo.error], [404, "tarea-no-encontrada"]);
    assert.equal(c4.cuerpo.datos.ya, true, "la que ya estaba hecha");
    assert.deepEqual([c5.status, c5.cuerpo.error], [400, "dato-invalido"]);
  });

  /* ---------- Una sesión de foco ---------- */
  const sbF = nuevoSb(), f1 = await pedir(sbF, { accion: "foco", habito: "leer", minutos: 10, completa: true, inicio: "2026-11-11T14:45:00Z" });
  const f1b = await pedir(sbF, { accion: "hoy" });
  const f2 = await pedir(nuevoSb(), { accion: "foco", tarea: "t3", minutos: 25, completa: true });
  const f3 = await pedir(nuevoSb(), { accion: "foco", minutos: 15 }), f4 = await pedir(nuevoSb(), { accion: "foco", minutos: 0 });
  const f5 = await pedir(nuevoSb(), { accion: "foco", habito: "nadar", minutos: 10 });
  test("foco: va a la bandeja; si completa los minutos de un hábito con tiempo, «hoy» ya lo cuenta hecho", () => {
    assert.equal(f1.status, 200); assert.equal(f1.cuerpo.texto, "Guardé 10 minutos de foco en Leer. Con eso completas Leer hoy, bien hecho.");
    assert.equal(f1.cuerpo.datos.completa_habito, true);
    const p = sbF.tablas.norte_pendientes[0];
    assert.equal(p.tipo, "foco"); assert.deepEqual([p.datos.hid, p.datos.min, p.datos.completa, p.datos.ini], ["h1", 10, true, Date.parse("2026-11-11T14:45:00Z")]);
    const leer = f1b.cuerpo.datos.habitos_tiempo.find(h => h.nombre === "Leer");
    assert.deepEqual([leer.hoy, leer.hecho], [20, true]); assert.ok(f1b.cuerpo.datos.habitos_hechos.includes("Leer"));
    assert.equal(f2.cuerpo.texto, "Guardé 25 minutos de foco en Escribir el informe."); assert.equal(f2.cuerpo.datos.completa_habito, false);
    assert.equal(f3.cuerpo.texto, "Guardé 15 minutos de foco.");
    assert.deepEqual([f4.status, f4.cuerpo.error], [400, "dato-invalido"]);
    assert.deepEqual([f5.status, f5.cuerpo.error], [404, "habito-no-encontrado"]);
  });
  test("resumenDia sin agenda ni foco no falla", () => {
    const d = resumenDia({}, { norte: [], agua: [] }, HOY);
    assert.deepEqual([d.tareas, d.habitos_tiempo], [[], []]);
  });

  /* ================= La app: aplicar tarea_hecha y foco (js/norte.js) ================= */
  const defaultState = G("defaultState"), migrate = G("migrate"), aplicar = G("norteAplicar"), resumen = G("norteResumen");
  const todayISO = G("todayISO"), monthKey = G("monthKey"), buscarTarea = G("buscarTarea"), nuevaTarea = G("nuevaTarea"), ledgerVigente = G("ledgerVigente");
  G("(s => { STATE = s; })")(defaultState());
  const hoy = todayISO(), dt = new Date(hoy + "T12:00:00"), mk = monthKey(dt.getFullYear(), dt.getMonth()), dia = dt.getDate();
  const t0 = Date.parse(hoy + "T09:00:00");
  const ped = (n, tipo, datos) => ({ id: "f000000000" + n, tipo, datos: Object.assign({ fecha: hoy }, datos), creado: new Date(t0 + n * 60e3).toISOString() });
  const nuevoEstado = () => {
    const s = migrate(defaultState());
    s.habitos.defs.push({ id: "hl", nombre: "Leer", minutos: 20, frecuencia: { tipo: "diario" }, creado: "2026-01-01" });
    const t = nuevaTarea(s, hoy, { txt: "Pagar la luz", ambito: "per" }); t.id = "tluz";
    s.enfoque = { sesiones: [{ id: "previa", fecha: hoy, habId: "hl", real: 10, min: 10, completa: false }], sigue: {}, pref: {} };
    return s;
  };
  const S = nuevoEstado(), p0 = S.gamif.puntos;
  const r1 = aplicar([ped(1, "tarea_hecha", { tid: "tluz" }), ped(2, "foco", { hid: "hl", min: 12, completa: true, ini: t0, titulo: "Leer" })], S);
  test("la app: completa la tarea (+15 ⭐ como a mano) y suma el foco a tu historial; el hábito con tiempo queda marcado", () => {
    assert.deepEqual(clone(r1.aplicados.map(x => x.tipo)), ["tarea_hecha", "foco"]);
    const t = buscarTarea(S, hoy, "tluz");
    assert.equal(t.estado, "hecha"); assert.ok(ledgerVigente(S, "tarea:tluz"), "el mismo id de ⭐ que al tocarla en la app");
    const rec = S.enfoque.sesiones.find(x => x.id === "nff0000000002");
    assert.ok(rec, "la sesión, con id fijo"); assert.deepEqual([rec.habId, rec.real, rec.completa, rec.tipo, rec.con], ["hl", 12, true, "habito", "Norte-Desk"]);
    assert.ok(ledgerVigente(S, "foco:nff0000000002"), "+5 ⭐ por sesión completa de 10 minutos o más");
    assert.equal(S.habitos.log[mk].hl[dia], true, "10 + 12 minutos ≥ 20: Leer queda marcado");
    assert.ok(ledgerVigente(S, "habito:hl:" + hoy));
    assert.equal(r1.aplicados[1].habito, "Leer");
    assert.equal(S.gamif.puntos, p0 + 15 + 5 + 5);
    assert.equal(resumen(r1), "🧭 Norte marcó Leer, completó una tarea y guardó 12 min de foco · +25 ⭐");
  });
  const r2 = aplicar([ped(1, "tarea_hecha", { tid: "tluz" }), ped(2, "foco", { hid: "hl", min: 12, completa: true })], S);
  const Sc = nuevoEstado(); aplicar([ped(3, "foco", { min: 5, completa: true })], Sc);
  test("la app: la misma bandeja otra vez no suma nada; un foco corto o libre no marca hábitos ni da ⭐", () => {
    assert.equal(r2.nuevos, 0); assert.equal(S.enfoque.sesiones.filter(x => x.id === "nff0000000002").length, 1);
    const rec = Sc.enfoque.sesiones.find(x => x.id === "nff0000000003");
    assert.deepEqual([rec.tipo, rec.real], ["libre", 5]); assert.ok(!ledgerVigente(Sc, "foco:nff0000000003"), "menos de 10 minutos: sin ⭐");
    assert.ok(!(Sc.habitos.log[mk] && Sc.habitos.log[mk].hl), "Leer no se marca: no era de Leer");
  });
}
