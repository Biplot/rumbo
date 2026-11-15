/* Tests de 🧭 Norte, tu brújula: la vuelta que toma la bandeja y la aplica (nortePendientes en js/norte.js). Si no se puede
   aplicar al tiro (otra sincronización en curso, cambios sin subir o una ventana abierta), se reintenta en unos segundos con
   lo ya tomado, sin esperar los 2 minutos de la reserva (Chris, 2026-11-15: abrir el día con Norte tardó 3 minutos y medio) */
export default async function ({ G, test, assert }) {
  console.log("\nNorte, tu brújula: la vuelta de la bandeja");
  const defaultState = G("defaultState"), migrate = G("migrate"), todayISO = G("todayISO");
  const hoy = todayISO();
  // Lo que en la app ponen app.js y el navegador: aquí, de mentira
  const mundo = { tomar: [], confirmados: [], sync: [], timers: [] };
  G("var CURRENT_USER = { id: 'u-prueba' }; var esCuentaDuena = () => true; var toast = () => {}; var flushCloudSave = async () => {};");
  G("amigosPublicar = () => {}; invitaRevisar = () => {};");
  G("(m => { syncFromCloud = async () => (m.sync.length ? m.sync.shift() : true); setTimeout = (f, ms) => { m.timers.push(ms); return m.timers.length; }; clearTimeout = () => {};"
    + " BACKEND.nortePendientesTomar = async () => (m.tomar.length ? m.tomar.shift() : []); BACKEND.nortePendientesConfirmar = async ids => { m.confirmados.push(...ids); return { n: ids.length }; }; })")(mundo);
  G("var syncFromCloud, setTimeout, clearTimeout;");
  const vuelta = () => G("nortePendientes()"), NORTE = G("NORTE");
  const abrir = { id: "b000000001", tipo: "abrir", datos: { fecha: hoy, completo: true, mision: "Probar la bandeja", primer_bocado: "Escribir", energia: 4 }, creado: new Date().toISOString() };
  const estadoNuevo = () => { const s = migrate(defaultState()); G("(s => { STATE = s; })")(s); return s; };

  // (el arnés no espera pruebas async: primero se corren las vueltas y después se revisa, como en norte.test.mjs)
  const s1 = estadoNuevo(); mundo.tomar = [[abrir]]; mundo.sync = [true]; mundo.confirmados = []; mundo.timers = [];
  await vuelta();
  const r1 = { abierto: !!(s1.ritual.dias[hoy] && s1.ritual.dias[hoy].hecho), confirmados: mundo.confirmados.slice(), tomados: NORTE.tomados.size, timers: mundo.timers.slice() };
  test("la bandeja se aplica y se confirma en la misma vuelta cuando se puede", () => {
    assert.ok(r1.abierto, "el día quedó abierto");
    assert.deepEqual(r1.confirmados, ["b000000001"]); assert.equal(r1.tomados, 0); assert.deepEqual(r1.timers, []);
  });

  estadoNuevo(); mundo.tomar = [[abrir]]; mundo.sync = [false]; mundo.confirmados = []; mundo.timers = [];
  await vuelta();
  const r2a = { abierto: !!G("STATE").ritual.dias[hoy], timers: mundo.timers.slice(), tomados: NORTE.tomados.size };
  mundo.sync = [true];   // la vuelta siguiente: la bandeja ya no lo entrega (está reservado), pero esta app lo tiene
  await vuelta();
  const r2b = { abierto: !!(G("STATE").ritual.dias[hoy] && G("STATE").ritual.dias[hoy].hecho), confirmados: mundo.confirmados.slice(), tomados: NORTE.tomados.size, reintentos: NORTE.reintentos };
  test("si otra sincronización está en curso, reintenta a los 5 segundos con lo ya tomado (la reserva sigue siendo suya)", () => {
    assert.ok(!r2a.abierto, "todavía no se aplica: el día de la nube no se pudo traer");
    assert.deepEqual(r2a.timers, [5000], "otra vuelta en 5 segundos"); assert.equal(r2a.tomados, 1, "lo tomado se guarda");
    assert.ok(r2b.abierto, "se aplicó sin esperar los 2 minutos");
    assert.deepEqual(r2b.confirmados, ["b000000001"]); assert.equal(r2b.tomados, 0); assert.equal(r2b.reintentos, 0);
  });

  estadoNuevo(); mundo.tomar = [[abrir]]; mundo.sync = [false]; mundo.confirmados = []; mundo.timers = [];
  await vuelta();
  NORTE.tomados.forEach(x => { x.hasta = Date.now() - 1; });
  mundo.sync = [true];
  await vuelta();
  const r3 = { abierto: !!G("STATE").ritual.dias[hoy], confirmados: mundo.confirmados.slice(), tomados: NORTE.tomados.size };
  test("lo tomado hace más de 100 segundos ya no se usa (la reserva pudo pasar a otro equipo)", () => {
    assert.ok(!r3.abierto, "no se aplica con una reserva vencida"); assert.deepEqual(r3.confirmados, []); assert.equal(r3.tomados, 0);
  });

  estadoNuevo(); NORTE.reintentos = 0; mundo.timers = []; mundo.tomar = [[abrir]]; mundo.sync = Array(10).fill(false);
  for (let i = 0; i < 8; i++) await vuelta();
  const r4 = mundo.timers.length;
  NORTE.tomados.clear(); NORTE.reintentos = 0; mundo.sync = [];
  test("los reintentos seguidos tienen tope; después sigue la revisión de cada 20 segundos", () => {
    assert.equal(r4, 6, "6 reintentos de 5 segundos como mucho");
  });
}
