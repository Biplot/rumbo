/* Tests de la biblioteca (biblioteca.js): el orden de la repisa, la meta del año sin los libros de antes, las medallas
   nuevas (Un libro al mes, El ladrillo), lo que se publica para las visitas (sin notas ni frases), lo que llega de un
   amigo (limpio), el recordatorio del préstamo y el aviso de «te recomendó un libro» */
export default async function ({ G, test, assert, clone }) {
  console.log("\nLa biblioteca");
  const defaultState = G("defaultState"), libros = G("bibLibros"), delAnio = G("bibDelAnio"), lg_libros = G("lg_libros"), mesesSeguidos = G("bibMesesSeguidos");
  const masLargo = G("bibMasLargo"), publica = G("bibPublica"), visitaLimpia = G("bibVisitaLimpia"), tono = G("bibTono"), prestViejos = G("bibPrestamosViejos");
  const anio = String(G("anioActual")()), L = (id, o) => Object.assign({ id, titulo: "Libro " + id, autor: "", estado: "terminado", paginas: 200, pagina: 200, valoracion: 0, nota: "", color: "#17C3B2", inicio: "", fin: "" }, o);
  const S = defaultState();
  S.lecturas = [
    L("a", { titulo: "Zorro", autor: "Rojas", fin: anio + "-03-02", valoracion: 3, color: "#3E8BD6" }),
    L("b", { titulo: "Alba", autor: "Allende", fin: anio + "-01-10", valoracion: 5, color: "#FF6B4A", nota: "secreta", frase: "privada", prestado: { a: "Ana", desde: anio + "-01-20" } }),
    L("c", { titulo: "Viejo", autor: "Neruda", antes: true, anio: 2019, fin: "", color: "#2E9E7B" }),
    L("d", { titulo: "Leyendo", estado: "leyendo", fin: "" }),
    L("e", { titulo: "Pasado", autor: "Mistral", fin: (+anio - 1) + "-12-30", valoracion: 4, color: "#F4A63B", paginas: 640 }),
  ];
  test("la repisa: solo los terminados (también los de antes), por fecha con los de antes primero", () => {
    assert.deepEqual(clone(libros(S, "fecha").map(l => l.id)), ["c", "e", "b", "a"]);
  });
  test("por autor, por tu nota y por color (como un arcoíris)", () => {
    assert.deepEqual(clone(libros(S, "autor").map(l => l.id)), ["b", "e", "c", "a"]);
    assert.deepEqual(clone(libros(S, "nota").map(l => l.id)), ["b", "e", "a", "c"]);
    assert.ok(tono("#FF6B4A") < tono("#F4A63B") && tono("#F4A63B") < tono("#2E9E7B") && tono("#2E9E7B") < tono("#3E8BD6"), "coral, ámbar, verde, azul");
    assert.deepEqual(clone(libros(S, "color").map(l => l.id)), ["b", "e", "c", "a"]);
  });
  test("«Por leer», tus libros deseados: solo los por leer, el último que anotaste primero", () => {
    const D = defaultState(); D.lecturas = [L("p1", { estado: "por-leer" }), L("t1"), L("p2", { estado: "por-leer" }), L("y1", { estado: "leyendo" })];
    assert.deepEqual(clone(G("bibDeseados")(D).map(l => l.id)), ["p2", "p1"]);
    assert.deepEqual(clone(D.lecturas.map(l => l.id)), ["p1", "t1", "p2", "y1"], "no cambia el orden de tus libros");
    assert.deepEqual(clone(G("bibDeseados")(defaultState())), []);
  });
  test("la meta del año cuenta los terminados este año en Rumbo; los de antes y los del año pasado no", () => {
    assert.equal(delAnio(S, anio), 2);
    assert.equal(lg_libros(S), 3, "las medallas de libros no cuentan los de antes de Rumbo");
  });
  test("Un libro al mes: el mejor tramo de meses seguidos con al menos un libro (cruza el cambio de año)", () => {
    const M = defaultState();
    M.lecturas = ["2025-11-03", "2025-12-20", "2026-01-15", "2026-03-01", "2026-04-02", "2026-04-28"].map((f, i) => L("m" + i, { fin: f }));
    M.lecturas.push(L("x", { antes: true, fin: "2026-02-01" }));   // uno de antes no tapa el hueco de febrero
    assert.equal(mesesSeguidos(M), 3, "noviembre, diciembre y enero");
    M.lecturas.push(L("f", { fin: "2026-02-10" })); assert.equal(mesesSeguidos(M), 6, "con febrero: de noviembre a abril");
  });
  test("El ladrillo: el libro más largo que terminaste en Rumbo", () => {
    assert.equal(masLargo(S), 640);
    const T = defaultState(); T.lecturas = [L("g", { paginas: 900, antes: true }), L("h", { paginas: 900, estado: "leyendo" }), L("i", { paginas: 350 })];
    assert.equal(masLargo(T), 350, "los de antes y los que estás leyendo no cuentan");
  });
  test("lo que ven tus amigos: lomos, título, autor y ★; nunca tus notas, tus frases ni a quién prestaste", () => {
    const p = clone(publica(S)), txt = JSON.stringify(p);
    assert.equal(p.libros.length, 4); assert.deepEqual(p.libros.map(x => x.t), ["Viejo", "Pasado", "Alba", "Zorro"]);
    assert.deepEqual(Object.keys(p.libros[2]).sort(), ["a", "c", "e", "f", "i", "j", "p", "t"]);
    assert.ok(!/secreta|privada|Ana/.test(txt), "sin la nota, la frase ni el préstamo");
    assert.equal(p.anio, 2); assert.equal(p.meta, 12);
    assert.equal(publica(defaultState()), null, "sin libros, nada que mostrar");
  });
  test("lo que llega de un amigo se limpia (colores, formato, ★, largo)", () => {
    const v = clone(visitaLimpia({ estilo: "raro", meta: "x", anio: 3, libros: [{ t: " Drácula ", a: "Stoker", c: "javascript:alert(1)", p: "99999", f: "g", e: 9, j: 1 }, { t: "" }, "nada", { t: "x".repeat(200) }] }));
    assert.equal(v.estilo, "repisa"); assert.equal(v.libros.length, 2);
    assert.deepEqual([v.libros[0].titulo, v.libros[0].formato, v.libros[0].estrellas, v.libros[0].paginas, v.libros[0].juntos], ["Drácula", "grande", 5, 3000, true]);
    assert.ok(/^#[0-9a-f]{6}$/i.test(v.libros[0].color), "un color raro se cambia por uno de Rumbo");
    assert.equal(v.libros[1].titulo.length, 60); assert.equal(v.meta, 12); assert.equal(v.delAnio, 3);
    assert.equal(visitaLimpia(null), null); assert.equal(visitaLimpia({ libros: "no" }), null);
  });
  test("los préstamos de 30 días o más", () => {
    assert.deepEqual(clone(prestViejos(S, anio + "-02-18").map(l => l.id)), [], "29 días: todavía no");
    assert.deepEqual(clone(prestViejos(S, anio + "-02-19").map(l => l.id)), ["b"], "30 días: sí");
  });

  /* ---------- El servidor ---------- */
  const { prestamoPendiente, textoPrestamo } = await import("../notifier/elefante.mjs");
  test("tu elefante te recuerda el préstamo a los 30 días, y una vez por semana después (hasta tres veces)", () => {
    const data = { lecturas: [{ titulo: "Alba", prestado: { a: "Ana", desde: "2026-10-01" } }] };
    assert.equal(prestamoPendiente(data, "2026-10-30"), null);
    assert.deepEqual(prestamoPendiente(data, "2026-10-31"), { titulo: "Alba", a: "Ana", dias: 30 });
    assert.equal(prestamoPendiente(data, "2026-11-01"), null, "al día siguiente no");
    assert.equal(prestamoPendiente(data, "2026-11-07").dias, 37);
    assert.equal(prestamoPendiente(data, "2026-11-14").dias, 44);
    assert.equal(prestamoPendiente(data, "2026-11-21"), null, "después de la tercera, ya no insiste");
    assert.equal(textoPrestamo({ titulo: "Alba", a: "Ana", dias: 30 }), "Hace 30 días le prestaste «Alba» a Ana. ¿Ya volvió a tu repisa? Yo le guardo el lugar.");
  });
  const { mensajeLibro, avisoLibro } = await import("../notifier/biblioteca.mjs");
  function sbFalso(fila) {
    const marcados = [];
    return {
      marcados,
      from: t => {
        const api = {
          update(c) { marcados.push(c); return api; }, select() { return api; }, eq() { return api; },
          maybeSingle: async () => t === "libro_recomendaciones" ? { data: fila, error: null } : t === "perfiles" ? { data: { nombre: "Ana María" }, error: null } : { data: { notif: {} }, error: null },
          then(res) { return Promise.resolve({ data: [{ id: 1, endpoint: "e" }], error: null }).then(res); },
        };
        return api;
      },
    };
  }
  const env = [], sb1 = sbFalso({ para: "b", titulo: "Drácula", autor: "Bram Stoker" });
  const r1 = await avisoLibro({ sb: sb1, yo: "a", body: { id: 5 }, enviar: async (ds, m) => { env.push(m); return { enviadas: 1 }; }, ahora: new Date("2026-11-04T15:00:00Z") });
  const r2 = await avisoLibro({ sb: sbFalso(null), yo: "a", body: { id: 5 }, enviar: async () => ({ enviadas: 1 }) });
  test("«Ana te recomendó un libro»: se avisa una vez (se marca antes de mandar)", () => {
    assert.equal(r1.enviadas, 1); assert.deepEqual(sb1.marcados[0], { avisado: true });
    assert.deepEqual(env[0], { title: "Ana te recomendó un libro", body: "«Drácula» de Bram Stoker: quedó en tu «Por leer».", url: "./#lecturas", tag: "rumbo-libro-recomienda" });
    assert.equal(r2.motivo, "ya-avisado");
    assert.equal(mensajeLibro({}).title, "Un amigo te recomendó un libro");
  });
}
