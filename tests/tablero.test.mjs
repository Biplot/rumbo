/* Tests de Amigos en una pantalla (amigos-tablero.js): qué espera tu respuesta (también es el número del
   punto de Amigos) y qué va en «Esta semana» */
export default async function ({ G, test, assert, clone }) {
  console.log("\nAmigos en una pantalla");
  const pendientes = G("amPendientes"), semana = G("amSemana"), nuevos = G("amigosNuevos"), plLimpio = G("plLimpio");
  const AMIGOS = G("AMIGOS"), PLAN = G("PLAN"), CONJ = G("CONJ"), OBJ = G("OBJ"), LCOM = G("LCOM"), LJ = G("LJ");
  const hoy = G("todayISO()"), mas = n => G(`agSumar(${JSON.stringify(hoy)}, ${n})`);
  // Un plan de Ana para Bruno (tú): o cambia lo que haga falta
  const plan = (id, o = {}) => plLimpio(Object.assign({ id, titulo: "Plan " + id, tipo: "otro", creador: "a", respuesta: "voy", fecha: mas(2), hora: "21:00",
    miembros: [{ id: "a", nombre: "Ana", respuesta: "voy" }, { id: "b", yo: true, nombre: "Bruno", respuesta: o.respuesta || "voy" }] }, o));
  const poner = (o = {}) => {
    AMIGOS.lista = Object.assign({ amigos: [], recibidas: [], enviadas: [], animos: [], bloqueados: [] }, o.l || {});
    AMIGOS.animosVistos = o.vistos || [];
    PLAN.lista = o.planes || []; CONJ.lista = o.conj || []; OBJ.lista = o.obj || []; LCOM.lista = o.listas || []; LJ.lista = o.lecturas || [];
  };
  const votar = (id, o = {}) => plan(id, Object.assign({ fecha: null, hora: null, opciones: [{ id: 1, fecha: mas(3), votos: [] }, { id: 2, fecha: mas(4), votos: [] }] }, o));

  test("para responder: las invitaciones de todo tipo, votar, las solicitudes, lo que debes y los ánimos (en una fila)", () => {
    poner({
      l: { recibidas: [{ id: "c", nombre: "Cami" }], animos: [{ id: 1, nombre: "Pedro", mensaje: "¡Vamos!" }, { id: 2, nombre: "Ana" }] },
      planes: [
        plan("inv", { respuesta: "pendiente" }),                                   // te invitan
        votar("vota"),                                                             // vas, pero no has dicho qué fechas te sirven
        votar("mio", { creador: "b" }),                                            // lo propusiste tú: eliges, no votas
        votar("no", { respuesta: "no" }),                                          // dijiste que no
        plan("abierto", { respuesta: "abierto" }),                                 // ¿quién se suma?: no espera tu respuesta
        plan("cancelado", { respuesta: "pendiente", cancelado: true }),
        plan("paso", { respuesta: "pendiente", fecha: mas(-2) }),
        plan("cuenta", { fecha: mas(-1), gastos: [{ id: 1, user_id: "a", monto: 18000, para: ["a", "b", "c"] }] }),   // debes 6.000 a Ana
      ],
      conj: [{ id: "h1", estado: "invitado" }, { id: "h2", estado: "activo" }], obj: [{ id: "o1", estado: "invitado" }],
      listas: [{ id: "l1", estado: "invitado" }, { id: "l2", estado: "activo" }], lecturas: [{ id: "j1", estado: "invitado" }],
    });
    const p = pendientes();
    assert.deepEqual(clone(p.map(x => x.tipo)), ["plan", "votar", "solicitud", "habito", "objetivo", "lista", "lectura", "deuda", "animo"]);
    assert.deepEqual(clone([p[0].p.id, p[1].p.id]), ["inv", "vota"]);
    assert.deepEqual(clone(p[7].d), { de: "b", a: "a", monto: 6000 });
    assert.equal(p[8].animos.length, 2, "los dos ánimos van juntos");
    assert.equal(nuevos(), 9, "el punto de Amigos cuenta lo mismo");
  });
  test("lo ya respondido no cuenta: ánimos vistos, fechas votadas, la cuenta saldada", () => {
    poner({
      l: { animos: [{ id: 1, nombre: "Pedro" }] }, vistos: [1],
      planes: [votar("vota", { opciones: [{ id: 1, fecha: mas(3), votos: ["b"] }, { id: 2, fecha: mas(4), votos: [] }] }),
        plan("cuenta", { fecha: mas(-1), gastos: [{ id: 1, user_id: "a", monto: 18000, para: ["a", "b"] }, { id: 2, user_id: "b", monto: 9000, para: ["a"], pago: true }] })],
    });
    assert.deepEqual(clone(pendientes()), []);
    assert.equal(nuevos(), 0);
    poner(); AMIGOS.lista = null;
    assert.equal(nuevos(), 0, "sin la lista de amigos, nada");
  });
  test("esta semana: tus planes (si vas o tal vez), los abiertos y los cumpleaños, por día y hora", () => {
    const cumple = n => mas(n).slice(5, 10);
    poner({
      l: { amigos: [{ id: "a", nombre: "Ana", estado: { cumple: cumple(0) } }, { id: "c", nombre: "Cami", estado: { cumple: cumple(8) } }, { id: "d", nombre: "Dani", estado: {} }] },
      planes: [
        plan("seis", { fecha: mas(6), hora: null }), plan("hoy", { fecha: hoy, hora: "20:00" }), plan("tal-vez", { fecha: mas(3), respuesta: "quizas" }),
        plan("abierto", { respuesta: "abierto" }), plan("siete", { fecha: mas(7) }), plan("no", { respuesta: "no" }),
        plan("cancelado", { cancelado: true }), plan("invita", { respuesta: "pendiente" }), votar("sin-fecha"),
      ],
    });
    const s = semana();
    assert.deepEqual(clone(s.map(x => x.tipo === "cumple" ? "cumple:" + x.a.nombre : x.p.id)), ["cumple:Ana", "hoy", "abierto", "tal-vez", "seis"]);
    assert.equal(s[0].fecha, hoy);
  });
  poner(); AMIGOS.lista = null;
}
