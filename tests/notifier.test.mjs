/* Tests del notificador: reglas (notifier/reglas.mjs) y a quién le toca cada aviso (notifier/recordatorios.mjs) */
export default async function ({ test, assert }) {
  console.log("\nAvisos del servidor");
  const { avisoSemana, avisoTrimestre, enVentana, horasEnVentana } = await import("../notifier/reglas.mjs");

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
    assert.deepEqual(horasEnVentana(n, 16 * 60, 30), []);
    assert.deepEqual(horasEnVentana({ ...n, mediodia: null }, 13 * 60 + 10, 30), []);
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
  const r3 = await enviarRecordatorios({ sb: sbTarde, enviar, ahora: new Date("2026-10-15T19:00:00Z") });   // 16:00: nada
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
}
