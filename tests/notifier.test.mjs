/* Tests del notificador: reglas (notifier/reglas.mjs) y a quién le toca cada aviso (notifier/recordatorios.mjs) */
export default async function ({ G, test, assert }) {
  console.log("\nAvisos del servidor");
  const { avisoSemana, avisoTrimestre, enVentana, horasEnVentana, avisosActivos, horaAviso, AVISOS_TIPOS, AVISOS_NIVELES } = await import("../notifier/reglas.mjs");

  test("ventana: desde la hora en punto hasta 30 minutos después", () => {
    assert.equal(enVentana(8 * 60, "08:00", 30), true);
    assert.equal(enVentana(8 * 60 + 29, "08:00", 30), true);
    assert.equal(enVentana(8 * 60 + 30, "08:00", 30), false);
    assert.equal(enVentana(7 * 60 + 59, "08:00", 30), false);
  });

  test("ventana: solo las horas que tocan ahora; mediodía solo si la eligió", () => {
    const n = { manana: "08:00", noche: "21:00", mediodia: "13:00" };
    assert.deepEqual(horasEnVentana(n, 8 * 60 + 5, 30), ["manana"]);
    assert.deepEqual(horasEnVentana(n, 13 * 60 + 10, 30), ["mediodia"]);
    assert.deepEqual(horasEnVentana(n, 21 * 60 + 20, 30), ["noche"]);
    assert.deepEqual(horasEnVentana(n, 15 * 60, 30), []);
    assert.deepEqual(horasEnVentana(n, 16 * 60, 30), ["agua"], "a las 16:00 tu elefante mira el agua");
    assert.deepEqual(horasEnVentana(n, 20 * 60 + 5, 30), ["habitos"], "y a la hora de los hábitos, tu racha");
    assert.deepEqual(horasEnVentana({ ...n, avisos: { elefante: false } }, 16 * 60, 30), [], "con tu elefante apagado, nada a esa hora");
    assert.deepEqual(horasEnVentana({ ...n, mediodia: null }, 13 * 60 + 10, 30), []);
  });

  test("avisos: el servidor decide igual que la app (avisosActivos de js/state.js)", () => {
    const casos = [{}, { mediodia: "13:00" }, { avisos: { semana: false } }, { mediodia: "13:00", avisos: { mediodia: false } },
      { avisos: { habitos: true, cumpleanos: true, contactos: true } }, { avisos: Object.fromEntries(AVISOS_TIPOS.map(k => [k, false])) }, { avisos: "roto" }];
    for (const n of casos) assert.deepEqual(avisosActivos(n), JSON.parse(JSON.stringify(G("avisosActivos")(n))));
    assert.deepEqual(AVISOS_NIVELES, JSON.parse(JSON.stringify(G("AVISOS_NIVELES"))));
    assert.deepEqual(avisosActivos({}), { manana: true, noche: true, insistencia: false, pendientes: false, mediodia: false, semana: true, mes: true, trimestre: true, habitos: false, cumpleanos: false, contactos: false, amigos: true, elefante: true });
    assert.equal(G("nivelAvisos")({}), "recomendado");
    assert.equal(G("nivelAvisos")({ avisos: { semana: false } }), "personalizado");
  });

  test("ventana: el segundo aviso de cierre (1 h después) y el de hábitos, solo si están encendidos", () => {
    const n = { noche: "21:00", habitosHora: "19:30", avisos: { insistencia: true, habitos: true } };
    assert.deepEqual(horasEnVentana(n, 22 * 60 + 5, 30), ["insistencia"]);
    assert.deepEqual(horasEnVentana(n, 19 * 60 + 40, 30), ["habitos"]);
    assert.deepEqual(horasEnVentana({ noche: "21:00" }, 22 * 60 + 5, 30), []);
    assert.equal(horaAviso({ noche: "23:30" }, "insistencia"), null);              // pasaría de la medianoche
  });

  /* Supabase de mentira: suscripciones_push, estado_usuario y notif_sent (con su llave única) */
  const { enviarRecordatorios } = await import("../notifier/recordatorios.mjs");
  function sbFalso({ subs, estados }) {
    const sent = new Set(), lecturas = [];
    return {
      sent, lecturas,
      from(tabla) {
        let cols = "", filtro = () => true;
        const q = {
          select(c) { cols = c.replace(/\s/g, ""); return q; },
          in(col, vals) { filtro = r => vals.includes(r[col]); return q; },
          async insert(f) {
            const k = [f.user_id, f.tipo, f.fecha].join("|");
            if (sent.has(k)) return { error: { message: "duplicate key" } };
            sent.add(k); return { error: null };
          },
          then(ok, ko) {
            lecturas.push(tabla + ":" + cols);
            let data;
            if (tabla === "suscripciones_push") data = subs.filter(filtro);
            else if (cols.includes("notif:data->settings->notif")) data = estados.filter(filtro).map(r => ({ user_id: r.user_id, notif: ((r.data || {}).settings || {}).notif ?? null }));
            else data = estados.filter(filtro);
            return Promise.resolve({ data: JSON.parse(JSON.stringify(data)), error: null }).then(ok, ko);
          },
        };
        return q;
      },
    };
  }
  const dispositivo = (id, user_id) => ({ id, user_id, endpoint: "https://push.example/" + id, p256dh: "p", auth: "a" });
  const estados = [
    { user_id: "u1", data: { settings: { notif: { manana: "08:00", noche: "21:00", tz: "America/Santiago" } } } },
    { user_id: "u2", data: { settings: { notif: { manana: "10:00", noche: "22:00", tz: "America/Santiago" } } } },
    { user_id: "u3", data: { settings: { notif: { manana: "08:00", tz: "America/Santiago" } } } },   // sin dispositivos
    { user_id: "u4", data: { settings: {} } },                                                      // horas por defecto
  ];
  const subs = [dispositivo("a", "u1"), dispositivo("b", "u1"), dispositivo("c", "u2"), dispositivo("d", "u4")];
  const envios = [];
  const enviar = async (ds, msg) => { envios.push({ a: ds.map(d => d.id).sort().join(","), tag: msg.tag }); return { enviadas: ds.length, fallidas: 0, borradas: 0 }; };
  const sb = sbFalso({ subs, estados });
  // 2026-10-15 08:05 en Santiago (UTC-3): mañana de u1 y de u4 (08:00 por defecto); u2 aún no
  const r1 = await enviarRecordatorios({ sb, enviar, ahora: new Date("2026-10-15T11:05:00Z") });
  const envios1 = envios.splice(0);
  const r2 = await enviarRecordatorios({ sb, enviar, ahora: new Date("2026-10-15T11:10:00Z") });
  const envios2 = envios.splice(0);
  const sbTarde = sbFalso({ subs, estados });
  const r3 = await enviarRecordatorios({ sb: sbTarde, enviar, ahora: new Date("2026-10-15T18:00:00Z") });   // 15:00: nada
  const sbMes = sbFalso({ subs, estados: [{ user_id: "u1", data: { settings: { notif: { manana: "08:00", tz: "America/Santiago" } }, ritual: { meses: {} } } }] });
  await enviarRecordatorios({ sb: sbMes, enviar, ahora: new Date("2026-11-01T11:05:00Z") });                // día 1 del mes
  const enviosMes = envios.splice(0);

  test("recordatorios: a la hora, a todos los dispositivos de cada persona; horas por defecto si no las eligió", () => {
    assert.deepEqual(envios1, [{ a: "a,b", tag: "rumbo-manana" }, { a: "d", tag: "rumbo-manana" }]);
    assert.equal(r1.usuarios, 3); assert.equal(r1.en_hora, 2); assert.equal(r1.enviados, 3);
  });
  test("recordatorios: el mismo aviso no se repite en la siguiente pasada", () => {
    assert.deepEqual(envios2, []); assert.equal(r2.saltados, 2);
  });
  test("recordatorios: fuera de hora solo se leen los dispositivos y los horarios, no el estado completo", () => {
    assert.equal(r3.en_hora, 0); assert.equal(r3.enviados, 0);
    assert.equal(sbTarde.lecturas.some(l => l === "estado_usuario:user_id,data"), false);
    assert.equal(sbTarde.lecturas.length, 2);
  });
  test("recordatorios: el día 1 también llega el de abrir el mes (con su mes en el tag)", () => {
    assert.deepEqual(enviosMes.map(e => e.tag), ["rumbo-manana", "rumbo-mes-apertura-2026-11"]);
  });

  /* Una persona con un dispositivo, a una hora dada (UTC; Santiago es UTC-3 en octubre) */
  async function correr(data, isoUTC, sb) {
    sb = sb || sbFalso({ subs: [dispositivo("z", "x")], estados: [{ user_id: "x", data }] });
    const msgs = [];
    await enviarRecordatorios({ sb, enviar: async (ds, msg) => { msgs.push(msg); return { enviadas: ds.length, fallidas: 0, borradas: 0 }; }, ahora: new Date(isoUTC) });
    return msgs;
  }
  const base = extra => ({ settings: { notif: { manana: "08:00", noche: "21:00", tz: "America/Santiago", ...((extra || {}).notif || {}) } }, ...(extra || {}), ...(extra && extra.notif ? { settings: { notif: { manana: "08:00", noche: "21:00", tz: "America/Santiago", ...extra.notif } } } : {}) });
  const tags = ms => ms.map(m => m.tag);
  // jueves 2026-10-15 08:05 · 20:05 · 21:05 · 22:05, domingo 2026-10-18 08:05 y 21:05, domingo 2026-11-01 08:05
  const J0805 = "2026-10-15T11:05:00Z", J2005 = "2026-10-15T23:05:00Z", J2105 = "2026-10-16T00:05:00Z", J2205 = "2026-10-16T01:05:00Z";
  const D0805 = "2026-10-18T11:05:00Z", D2105 = "2026-10-19T00:05:00Z", N0805 = "2026-11-01T11:05:00Z";

  const rPref = [
    await correr(base(), D2105),
    await correr(base({ notif: { avisos: { semana: false } } }), D2105),
    await correr(base({ notif: { avisos: Object.fromEntries(AVISOS_TIPOS.map(k => [k, AVISOS_NIVELES.esencial.includes(k)])) } }), N0805),
  ];
  test("avisos: cada persona recibe solo lo que eligió (semana apagada, nivel esencial sin el de mes)", () => {
    assert.deepEqual(tags(rPref[0]), ["rumbo-noche", "rumbo-semana-cierre-2026-10-12"]);
    assert.deepEqual(tags(rPref[1]), ["rumbo-noche"]);
    assert.deepEqual(tags(rPref[2]), ["rumbo-manana"]);
  });

  const rRitual = [
    await correr(base({ ritual: { dias: { "2026-10-15": { hecho: true } } } }), J0805),
    await correr(base({ ritual: { dias: { "2026-10-15": { hecho: true, cerrado: true } } } }), J2105),
    await correr(base({ notif: { avisos: { insistencia: true } } }), J2205),
    await correr(base({ notif: { avisos: { insistencia: true } }, ritual: { dias: { "2026-10-15": { hecho: true, cerrado: true } } } }), J2205),
  ];
  test("abrir y cerrar: no llegan si ya lo hiciste; el segundo aviso de cierre, solo si aún no cierras", () => {
    assert.deepEqual(tags(rRitual[0]), []);
    assert.deepEqual(tags(rRitual[1]), []);
    assert.deepEqual(tags(rRitual[2]), ["rumbo-noche-2"]);
    assert.deepEqual(tags(rRitual[3]), []);
  });

  const sinCerrarSb = sbFalso({ subs: [dispositivo("z", "x")], estados: [{ user_id: "x", data: base({ notif: { avisos: { pendientes: true } }, ritual: { dias: { "2026-10-14": { hecho: true } } } }) }] });
  const rPend = [
    await correr(null, J0805, sinCerrarSb),
    await correr(null, "2026-10-15T11:20:00Z", sinCerrarSb),   // otra pasada en la misma ventana
    await correr(base({ notif: { avisos: { pendientes: true, manana: false } }, ritual: { dias: { "2026-10-14": { hecho: true } } }, agenda: { dias: { "2026-10-13": [{ txt: "Llamar" }] } } }), J0805),
    await correr(base({ notif: { avisos: { pendientes: true } }, agenda: { dias: { "2026-10-11": [{ txt: "Vieja" }], "2026-10-14": [{ txt: "Borrada", borrada: true }] } } }), J0805),
  ];
  test("días sin cerrar: va dentro del aviso de la mañana (sin repetirse); solo, si el de la mañana está apagado", () => {
    assert.deepEqual(tags(rPend[0]), ["rumbo-manana"]);
    assert.ok(rPend[0][0].body.includes("Te quedó ayer sin cerrar: puedes cerrarlo hasta el sábado."));
    assert.deepEqual(tags(rPend[1]), []);
    assert.deepEqual(tags(rPend[2]), ["rumbo-dias-sin-cerrar"]);
    assert.equal(rPend[2][0].body, "Te quedaron 2 días sin cerrar (el martes y ayer). El primero se puede cerrar hasta mañana. Yo te lo guardo mientras.");
    assert.equal(rPend[3][0].body.includes("sin cerrar"), false);   // fuera de la holgura o tareas borradas: no cuentan
  });

  const habitos = { defs: [
    { id: "h1", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
    { id: "h2", nombre: "Agua", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
    { id: "h3", nombre: "Gym", frecuencia: { tipo: "dias", dias: [0] }, creado: "2026-10-01" },      // solo lunes
    { id: "h4", nombre: "Pausado", frecuencia: { tipo: "diario" }, creado: "2026-10-01", pausado: true },
  ], log: { "2026-10": { h2: { 15: true } } } };
  const rHab = [
    await correr(base({ notif: { avisos: { habitos: true }, habitosHora: "20:00" }, habitos }), J2005),
    await correr(base({ notif: { avisos: { habitos: true } }, habitos: { ...habitos, log: { "2026-10": { h1: { 15: true }, h2: { 15: true } } } } }), J2005),
    await correr(base({ habitos }), J2005),
  ];
  test("hábitos pendientes: con el motor de la app, solo los que tocan hoy y faltan; nada si están al día o apagado", () => {
    assert.deepEqual(tags(rHab[0]), ["rumbo-habitos"]);
    assert.equal(rHab[0][0].body, "Te falta 1: Leer. Vamos de a uno: yo te acompaño.");
    assert.deepEqual(tags(rHab[1]), []);
    assert.deepEqual(tags(rHab[2]), []);
  });

  const vida = { relaciones: [
    { nombre: "Ana", cumple: "1990-10-15", frecuencia: 30, ultimoContacto: "2026-08-01" },
    { nombre: "Pedro", cumple: "1985-03-02", frecuencia: 7, ultimoContacto: "2026-10-17" },
    { nombre: "Sin aviso", frecuencia: 0, ultimoContacto: "2020-01-01" },
  ] };
  const rRel = [
    await correr(base({ notif: { avisos: { cumpleanos: true, contactos: true } }, vida }), J0805),
    await correr(base({ notif: { avisos: { cumpleanos: true, contactos: true } }, vida }), D0805),
    await correr(base({ vida }), J0805),
  ];
  test("relaciones: el cumpleaños en la mañana del día; los contactos pendientes, los domingos", () => {
    assert.deepEqual(tags(rRel[0]), ["rumbo-manana", "rumbo-cumpleanos"]);
    assert.equal(rRel[0][1].body, "Hoy cumple Ana. ¿Le escribimos? Yo le canto con la trompa.");
    assert.deepEqual(tags(rRel[1]), ["rumbo-manana", "rumbo-contactos-2026-10-12"]);
    assert.equal(rRel[1][1].body, "Hace tiempo que no hablas con Ana. ¿Le mandamos un saludo?");
    assert.deepEqual(tags(rRel[2]), ["rumbo-manana"]);
  });

  /* Tu elefante te escribe: la racha en riesgo, el agua atrasada (uno al día entre los dos) y la voz de siempre */
  const E1605 = "2026-10-15T19:05:00Z";
  const racha = { defs: [
    { id: "h1", nombre: "Leer", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
    { id: "h2", nombre: "Agua", frecuencia: { tipo: "diario" }, creado: "2026-10-01" },
  ], log: { "2026-10": { h1: { 10: true, 11: true, 12: true, 13: true, 14: true } } } };
  const aguaAyer = { meta: 2000, dias: { "2026-10-14": { r: [{ id: "a", ml: 1800, ts: 1 }], b: [] }, "2026-10-15": { r: [{ id: "b", ml: 250, ts: 2 }], b: [] } } };
  const sbUno = sbFalso({ subs: [dispositivo("z", "x")], estados: [{ user_id: "x", data: base({ habitos: racha, agua: aguaAyer }) }] });
  const rEle = {
    racha: await correr(base({ habitos: racha }), J2005),
    rachaConHabitos: await correr(base({ notif: { avisos: { habitos: true } }, habitos: racha }), J2005),
    sinRacha: await correr(base({ habitos: { ...racha, log: {} } }), J2005),
    apagado: await correr(base({ notif: { avisos: { elefante: false } }, habitos: racha, agua: aguaAyer }), J2005),
    agua: await correr(base({ agua: aguaAyer }), E1605),
    aguaAlDia: await correr(base({ agua: { ...aguaAyer, dias: { ...aguaAyer.dias, "2026-10-15": { r: [{ id: "b", ml: 900, ts: 2 }], b: [] } } } }), E1605),
    noAnota: await correr(base({ agua: { meta: 2000, dias: {} } }), E1605),
    uno1: await correr(null, E1605, sbUno), uno2: await correr(null, J2005, sbUno),
    manana: await correr(base(), J0805), manana2: await correr(base(), J0805),
  };
  test("tu elefante: si tu racha está por cortarse, te escribe a la hora de tus hábitos con su broma", () => {
    assert.deepEqual(tags(rEle.racha), ["rumbo-elefante-racha"]);
    assert.equal(rEle.racha[0].title, "🔥 Tu racha te espera");
    assert.equal(rEle.racha[0].body, "Tu racha de Leer va en 5 días. ¿Diez páginas antes de dormir? Yo te espero con el libro abierto.");
    assert.deepEqual(tags(rEle.sinRacha), [], "sin racha de 3 o más, nada");
    assert.deepEqual(tags(rEle.apagado), [], "con tu elefante apagado, nada");
  });
  test("tu elefante: si también pediste el de hábitos, va todo en un solo aviso", () => {
    assert.deepEqual(tags(rEle.rachaConHabitos), ["rumbo-elefante-racha"]);
    assert.match(rEle.rachaConHabitos[0].body, /También te falta 1: Agua\.$/);
  });
  test("tu elefante: el agua a las 16:00, solo si la anotas y vas bajo el 40 %; no dice la meta", () => {
    assert.deepEqual(tags(rEle.agua), ["rumbo-elefante-agua"]);
    assert.match(rEle.agua[0].body, /0,25 L/);
    assert.ok(!/de 2 L|meta/.test(rEle.agua[0].body), rEle.agua[0].body);
    assert.deepEqual(tags(rEle.aguaAlDia), [], "con 0,9 de 2 L (45 %) va bien");
    assert.deepEqual(tags(rEle.noAnota), [], "si no anotas tu agua, no te la pide");
  });
  test("tu elefante: como mucho uno al día entre la racha y el agua", () => {
    assert.deepEqual(tags(rEle.uno1), ["rumbo-elefante-agua"]);
    assert.deepEqual(tags(rEle.uno2), [], "en la noche ya no escribe por la racha");
  });
  test("tu elefante: los avisos de siempre hablan con su voz, y el mismo día dicen lo mismo", () => {
    assert.equal(rEle.manana[0].title, "🌅 Buenos días");
    assert.ok(/(trompa lista|café|abrimos juntos)/.test(rEle.manana[0].body), rEle.manana[0].body);
    assert.equal(rEle.manana[0].body, rEle.manana2[0].body);
  });

  test("trimestre: cierre el penúltimo día en la noche, solo si falta cerrarlo", () => {
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", {}).clave, "2026-Q4");
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", {}).hora, "noche");
    assert.equal(avisoTrimestre("tri-cierre", "2026-06-29", {}).clave, "2026-Q2");   // junio tiene 30
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-31", {}), null);             // el último día va el de mes
    assert.equal(avisoTrimestre("tri-cierre", "2026-11-29", {}), null);             // no es fin de trimestre
    assert.equal(avisoTrimestre("tri-cierre", "2026-12-30", { "2026-Q4": { cierre: { ts: 1 } } }), null);
  });

  test("trimestre: apertura el día 2 en la mañana; invita a cerrar el anterior si falta", () => {
    const a = avisoTrimestre("tri-apertura", "2027-01-02", {});
    assert.equal(a.clave, "2027-Q1"); assert.equal(a.hora, "manana"); assert.equal(a.pendienteAnterior, true);
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-02", { "2026-Q4": { cierre: { ts: 1 } } }).pendienteAnterior, false);
    assert.equal(avisoTrimestre("tri-apertura", "2026-10-02", { "2026-Q3": { cierre: { ts: 1 } } }).clave, "2026-Q4");
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-01", {}), null);            // el día 1 va el de mes
    assert.equal(avisoTrimestre("tri-apertura", "2027-02-02", {}), null);            // no es el primer mes
    assert.equal(avisoTrimestre("tri-apertura", "2027-01-02", { "2027-Q1": { apertura: { ts: 1 } } }), null);
  });

  test("semana: el día del ritual y el siguiente, solo si falta", () => {
    assert.equal(avisoSemana("semana-cierre", "2026-09-27", 0, {}), "noche");        // domingo
    assert.equal(avisoSemana("semana-apertura", "2026-09-28", 0, {}), "manana");     // lunes
    assert.equal(avisoSemana("semana-apertura", "2026-09-28", 0, { "2026-09-28": { apertura: {} } }), null);
    assert.equal(avisoSemana("semana-cierre", "2026-09-28", 1, {}), "manana");       // ritual el lunes
  });

  /* ---------- Lo que espera en la bandeja de Norte ya cuenta (no se repite el aviso) ---------- */
  const { conBandeja } = await import("../notifier/norte.mjs");
  const HOYB = "2026-10-15";
  const meditar = { id: "h1", nombre: "Meditar", frecuencia: { tipo: "diario" }, creado: "2026-01-01" };
  const conHabito = (notif) => ({ settings: { notif: Object.assign({ tz: "America/Santiago" }, notif) }, habitos: { defs: [meditar], log: {} }, ritual: { dias: {} }, agua: { meta: 2000, dias: {} } });
  test("conBandeja: abre el día (con el bocado), marca el hábito y suma el agua en una copia; lo ya aplicado no se repite", () => {
    const data = conHabito({});
    data.norte = { hechos: [{ id: "viejo" }] };
    data.agua.dias[HOYB] = { r: [{ id: "a1", ml: 250 }] };
    const bandeja = {
      norte: [
        { id: "p1", tipo: "habito", datos: { hid: "h1", fecha: HOYB }, creado: "2026-10-15T10:00:00Z" },
        { id: "p2", tipo: "abrir", datos: { fecha: HOYB, primer_bocado: "Escribir el informe", energia: 4 }, creado: "2026-10-15T10:01:00Z" },
        { id: "viejo", tipo: "cerrar", datos: { fecha: HOYB }, creado: "2026-10-15T09:00:00Z" },
      ],
      agua: [{ id: "v1", fecha: HOYB, ml: 500 }, { id: "a1", fecha: HOYB, ml: 250 }],
    };
    const antes = JSON.stringify(data), c = conBandeja(data, bandeja, HOYB);
    assert.equal(JSON.stringify(data), antes, "el estado original no cambia");
    assert.deepEqual(c.ritual.dias[HOYB], { hecho: true, sapo: "Escribir el informe", energia: 4 }, "el pedido «viejo» ya estaba aplicado: no cierra");
    assert.equal(c.habitos.log["2026-10"].h1[15], true);
    assert.deepEqual(c.agua.dias[HOYB].r, [{ id: "a1", ml: 250 }, { id: "v1", ml: 500 }], "el vaso que ya estaba no se suma dos veces");
    const legado = conHabito({}); legado.agua.dias[HOYB] = { ml: 300 };
    assert.deepEqual(conBandeja(legado, { norte: [], agua: [{ id: "v2", fecha: HOYB, ml: 250 }] }, HOYB).agua.dias[HOYB].r, [{ id: "ml", ml: 300 }, { id: "v2", ml: 250 }]);
  });

  /* Un Supabase de mentira con la bandeja (norte_pendientes y agua_pendientes) */
  function sbConBandeja({ subs, estados, norte = [], agua = [], sinTablas = false }) {
    const sent = new Set();
    return {
      sent,
      from(tabla) {
        let filtro = () => true, cols = "";
        const q = {
          select(c) { cols = c.replace(/\s/g, ""); return q; },
          in(col, vals) { filtro = r => vals.includes(r[col]); return q; },
          async insert(f) { const k = [f.user_id, f.tipo, f.fecha].join("|"); if (sent.has(k)) return { error: { message: "duplicate key" } }; sent.add(k); return { error: null }; },
          then(ok, ko) {
            let r;
            if (tabla === "suscripciones_push") r = { data: subs.filter(filtro), error: null };
            else if (tabla === "norte_pendientes" || tabla === "agua_pendientes") r = sinTablas ? { data: null, error: { message: `relation "public.${tabla}" does not exist` } } : { data: (tabla === "norte_pendientes" ? norte : agua).filter(filtro), error: null };
            else if (cols.includes("notif:data->settings->notif")) r = { data: estados.filter(filtro).map(e => ({ user_id: e.user_id, notif: ((e.data || {}).settings || {}).notif ?? null })), error: null };
            else r = { data: estados.filter(filtro), error: null };
            return Promise.resolve(JSON.parse(JSON.stringify(r))).then(ok, ko);
          },
        };
        return q;
      },
    };
  }
  const enviosB = [];
  const enviarB = async (ds, msg) => { enviosB.push(ds.map(d => d.id).join(",") + ":" + msg.tag); return { enviadas: ds.length, fallidas: 0, borradas: 0 }; };
  const subsB = [dispositivo("x1", "ub1"), dispositivo("x2", "ub2")];
  // 08:05 en Santiago: a ub1 le espera «abrir el día» en la bandeja; ub2 no le dijo nada a Norte
  await enviarRecordatorios({ enviar: enviarB, ahora: new Date("2026-10-15T11:05:00Z"), sb: sbConBandeja({
    subs: subsB, estados: [{ user_id: "ub1", data: conHabito({ manana: "08:00" }) }, { user_id: "ub2", data: conHabito({ manana: "08:00" }) }],
    norte: [{ user_id: "ub1", id: "q1", tipo: "abrir", datos: { fecha: HOYB, energia: 3 }, creado: "2026-10-15T10:30:00Z" }],
  }) });
  const enviosManana = enviosB.splice(0);
  // 20:05: el aviso de hábitos; ub1 ya marcó Meditar por Norte, ub2 no
  const notifHab = { habitosHora: "20:00", avisos: { habitos: true, elefante: false, noche: false } };
  await enviarRecordatorios({ enviar: enviarB, ahora: new Date("2026-10-15T23:05:00Z"), sb: sbConBandeja({
    subs: subsB, estados: [{ user_id: "ub1", data: conHabito(notifHab) }, { user_id: "ub2", data: conHabito(notifHab) }],
    norte: [{ user_id: "ub1", id: "q2", tipo: "habito", datos: { hid: "h1", fecha: HOYB }, creado: "2026-10-15T22:00:00Z" }],
  }) });
  const enviosHab = enviosB.splice(0);
  // Sin las tablas de la bandeja (norte.sql sin correr), los avisos salen como antes
  await enviarRecordatorios({ enviar: enviarB, ahora: new Date("2026-10-15T11:05:00Z"), sb: sbConBandeja({
    subs: subsB, estados: [{ user_id: "ub1", data: conHabito({ manana: "08:00" }) }], sinTablas: true,
  }) });
  const enviosSinTablas = enviosB.splice(0);
  test("recordatorios: lo que le dijiste a Norte ya cuenta; no te recuerda abrir el día ni un hábito que ya marcaste", () => {
    assert.deepEqual(enviosManana, ["x2:rumbo-manana"], "a ub1 no le pide abrir el día: ya se lo dijo a Norte");
    assert.deepEqual(enviosHab, ["x2:rumbo-habitos"], "a ub1 no le recuerda Meditar: lo marcó por Norte");
    assert.deepEqual(enviosSinTablas, ["x1:rumbo-manana"], "sin la bandeja, como antes");
  });
}
