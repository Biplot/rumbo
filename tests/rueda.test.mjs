/* Tests de la Rueda de la vida (rueda.js): las áreas que se ven (ocultas, nombres, colores), las notas por índice,
   el promedio de las áreas visibles, el rumbo del mes, «Lo que dice tu Rumbo», el paso para el área que pide
   cariño, las frases, el dibujo de los seis estilos (de 5 a 10 áreas) y la fusión entre equipos */
export default async function ({ G, test, assert, clone }) {
  console.log("\nLa Rueda de la vida");
  const defaultState = G("defaultState"), visibles = G("ruedaVisibles"), corto = G("ruedaCorto"), color = G("ruedaColor"), cfg = G("ruedaCfg");
  const poner = G("ruedaPoner"), mes = G("ruedaMes"), prom = G("ruedaPromedio"), rumbo = G("ruedaRumbo"), rumboTxt = G("ruedaRumboTxt");
  const pistas = G("ruedaPistas"), paso = G("ruedaPaso"), frase = G("ruedaFrase"), ponerFrase = G("ruedaPonerFrase"), svg = G("ruedaSVG"), datosAnio = G("datosAnio");
  const mergeStates = G("mergeStates"), ESTILOS = G("RUEDA_ESTILOS"), anioBase = G("anioBase");
  const nuevo = () => { const S = defaultState(); S.settings.year = 2026; return S; };

  test("las 8 áreas de fábrica, con su nombre corto y su color; una renombrada usa su primera palabra", () => {
    const S = nuevo();
    assert.deepEqual(clone(visibles(S)), [0, 1, 2, 3, 4, 5, 6, 7]);
    assert.equal(corto(S, 4), "Para mí"); assert.equal(color(S, 0), "#17A99A");
    S.rueda.areas[7] = "Mascotas y casa"; assert.equal(corto(S, 7), "Mascotas");
    cfg(S).colores[7] = "#123456"; assert.equal(color(S, 7), "#123456");
    cfg(S).colores[6] = "rojo"; assert.equal(color(S, 6), "#2E9E7B", "un color raro vuelve al de fábrica");
  });
  test("ocultar un área la saca de la rueda pero guarda sus notas; las nuevas van al final (hasta 10)", () => {
    const S = nuevo(); poner(S, 2026, 10, 7, 8);
    cfg(S).ocultas = [7]; assert.deepEqual(clone(visibles(S)), [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(mes(S, 2026, 10)[7], 8, "la nota sigue ahí");
    S.rueda.areas.push("Mascotas"); poner(S, 2026, 10, 8, 6);
    assert.deepEqual(clone(visibles(S)), [0, 1, 2, 3, 4, 5, 6, 8]); assert.equal(mes(S, 2026, 10)[8], 6);
    assert.equal(mes(S, 2026, 9)[8], 0, "en los meses sin nota, 0");
  });
  test("poner una nota: entre 0 y 10, entera, y marca la edición (año base y otros años)", () => {
    const S = nuevo();
    assert.equal(poner(S, 2026, 10, 0, 12), 10); assert.equal(poner(S, 2026, 10, 1, -3), 0); assert.equal(poner(S, 2026, 10, 2, 6.6), 7);
    assert.ok(S.rueda.ts > 0, "el año base guarda la hora de la edición");
    poner(S, 2027, 0, 0, 5); assert.equal(S.anios[2027].rueda.meses[0][0], 5); assert.ok(S.anios[2027].rueda.ts > 0, "otro año, su propia hora");
  });
  test("el promedio cuenta solo las áreas que se ven (sin notas, null)", () => {
    const S = nuevo(); assert.equal(prom(S, mes(S, 2026, 10)), null);
    [6, 8, 6, 6, 4, 6, 6, 10].forEach((v, k) => poner(S, 2026, 10, k, v));
    assert.equal(prom(S, mes(S, 2026, 10)), 6.5);
    cfg(S).ocultas = [7]; assert.equal(prom(S, mes(S, 2026, 10)), 6, "sin la oculta");
  });
  test("tu rumbo del mes: el área que más subió y la que pide cariño", () => {
    const S = nuevo();
    [6, 7, 6, 5, 4, 6, 7, 5].forEach((v, k) => poner(S, 2026, 9, k, v));
    [7, 9, 6, 6, 4, 7, 6, 6].forEach((v, k) => poner(S, 2026, 10, k, v));
    const R = rumbo(S, 2026, 10);
    assert.deepEqual(clone([R.mejor, R.menor, R.prom, R.promAnt]), [{ k: 1, dif: 2 }, { k: 4, v: 4 }, 6.4, 5.8]);
    assert.deepEqual(clone(rumboTxt(S, R)), { t: "Apuntas a Familia (+2)", s: "Pide cariño: Tiempo para mí (4)" });
    const P = nuevo(); [5, 9, 7, 7, 8, 7, 7, 7].forEach((v, k) => poner(P, 2026, 0, k, v));
    assert.equal(rumboTxt(P, rumbo(P, 2026, 0)).t, "Tu área más alta: Familia (9)", "el primer mes, sin comparar");
    assert.equal(rumboTxt(nuevo(), rumbo(nuevo(), 2026, 0)).t, "Todavía sin notas");
  });
  test("Lo que dice tu Rumbo: tu ánimo, tus libros, tus contactos, tu ahorro y lo que le asignaste al área", () => {
    const S = nuevo();
    S.vida.diario = [{ id: "a", fecha: "2026-10-02", mood: 4, gratitud: "el sol" }, { id: "b", fecha: "2026-10-05", mood: 3 }, { id: "c", fecha: "2026-09-30", mood: 1 }];
    S.lecturas = [{ id: "l1", titulo: "Drácula", estado: "terminado", fin: "2026-10-12", paginas: 418 }, { id: "l2", titulo: "Viejo", estado: "terminado", antes: true, fin: "2026-10-01", paginas: 100 }];
    S.vida.relaciones = [{ id: "p1", nombre: "Ana", ultimoContacto: "2026-10-20" }, { id: "p2", nombre: "Bruno", ultimoContacto: "2026-09-02" }];
    const D = datosAnio(S, 2026); D.finanzas.meses[9] = { ingreso: 0, gasto: 0, ahorro: 90000, metaAhorro: 120000 };
    S.habitos.defs = [{ id: "h1", nombre: "Yoga", icon: "🧘", frecuencia: { tipo: "diario" }, area: 5 }];
    S.habitos.log = { "2026-10": { h1: { 3: true, 4: true, 9: true } } };
    D.metas.mensuales[9] = [{ id: "o1", texto: "Ir al psicólogo", done: true, area: 5 }];
    assert.deepEqual(clone(pistas(S, 2026, 9, 5)), ["Tu ánimo en el Diario: 3,5 de 5", "1 día con gratitud", "Yoga: 3 días este mes", "Objetivo: «Ir al psicólogo» ✓"]);
    assert.deepEqual(clone(pistas(S, 2026, 9, 6)), ["418 páginas en 1 libro terminado"], "los libros de antes no cuentan");
    assert.deepEqual(clone(pistas(S, 2026, 9, 1)), ["Hablaste con 1 persona de Relaciones"]);
    assert.deepEqual(clone(pistas(S, 2026, 9, 2)), ["Ahorro: 75 % de tu meta del mes"]);
    S.rueda.areas[6] = "Música"; assert.deepEqual(clone(pistas(S, 2026, 9, 6)), [], "si la renombras, ya no usa las pistas de fábrica");
  });
  test("el paso chico: para el área que pide cariño (6 o menos), una vez por mes", () => {
    const S = nuevo(); [7, 9, 6, 6, 4, 7, 6, 6].forEach((v, k) => poner(S, 2026, 10, k, v));
    const p = paso(S, 2026, 10);
    assert.deepEqual([p.k, p.tipo, p.nombre, p.btn, p.txt], [4, "habito", "20 minutos para mí", "Crear hábito", "¿Un hábito chico? «20 minutos para mí»"]);
    cfg(S).pasoNo["2026-11"] = 1; assert.equal(paso(S, 2026, 10), null, "«Ahora no» lo guarda hasta el mes siguiente");
    const A = nuevo(); [8, 9, 8, 7, 7, 8, 9, 8].forEach((v, k) => poner(A, 2026, 10, k, v)); assert.equal(paso(A, 2026, 10), null, "todo sobre 6: sin paso");
    const C = nuevo(); C.rueda.areas[4] = "Mi huerto"; [7, 9, 6, 6, 3, 7, 6, 6].forEach((v, k) => poner(C, 2026, 10, k, v));
    assert.equal(paso(C, 2026, 10).txt, "¿Un hábito chico para «Mi huerto»?");
  });
  test("una frase por área y por mes (vacía, se borra), guardada en su año", () => {
    const S = nuevo(); ponerFrase(S, 2026, 10, 4, "  Trabajé demasiado  ");
    assert.equal(frase(S, 2026, 10, 4), "Trabajé demasiado"); assert.equal(frase(S, 2026, 9, 4), "");
    ponerFrase(S, 2026, 10, 4, ""); assert.equal(frase(S, 2026, 10, 4), "");
    ponerFrase(S, 2027, 0, 1, "x".repeat(150)); assert.equal(S.anios[2027].rueda.frases[0][1].length, 100);
  });
  test("los seis estilos se dibujan de 5 a 10 áreas, con la sombra del mes pasado y las etiquetas", () => {
    assert.deepEqual(clone(ESTILOS.map(e => e.id)), ["rosa", "fantasma", "instrumento", "constelacion", "mandala", "vitral"]);
    ESTILOS.forEach(E => [5, 8, 10].forEach(n => {
      const vals = Array.from({ length: n }, (_, i) => i % 11), ant = vals.map(v => Math.max(0, v - 1));
      const s = svg(vals, { estilo: E.id, ant, etiquetas: vals.map((v, i) => ({ corto: "Área" + i, v, ant: ant[i] })) });
      assert.ok(s.startsWith("<svg") && s.endsWith("</svg>"), `${E.id} con ${n}`);
      assert.equal((s.match(/class="rd-eti"/g) || []).length, n, `${E.id}: una etiqueta por área`);
      assert.ok(/stroke-dasharray="5 4"/.test(s), `${E.id}: la sombra punteada`);
    }));
    const mini = svg([1, 2, 3, 4, 5], { estilo: "vitral", mini: true });
    assert.ok(/viewBox="0 0 320 320"/.test(mini) && !/rd-eti/.test(mini), "la miniatura, sin etiquetas");
    assert.ok(/clip-path/.test(svg([5, 5, 5, 5, 5], { estilo: "fantasma" })), "los de fondo oscuro van recortados en un círculo");
  });
  test("fusión: la rueda del año base gana la edición más reciente", () => {
    const a = nuevo(), b = nuevo();
    poner(a, anioBase(a), 10, 0, 3); a.rueda.ts = 100;
    poner(b, anioBase(b), 10, 0, 9); b.rueda.ts = 200;
    assert.equal(mergeStates(clone(a), clone(b)).rueda.meses[10][0], 9, "la del servidor es más nueva");
    b.rueda.ts = 50; assert.equal(mergeStates(clone(a), clone(b)).rueda.meses[10][0], 3, "la local es más nueva");
  });
}
