/* Tests de «Tu semana, tu mes y tu trimestre, desde tu día» (rituales-cadena.js): qué se ofrece al abrir el día,
   en qué orden (reloj de arena), lo obligatorio (abrir la semana), los plazos y la primera semana de una cuenta nueva */
export default async function ({ G, test, assert }) {
  console.log("\nTu semana, tu mes y tu trimestre, desde tu día");
  const defaultState = G("defaultState"), migrate = G("migrate"), items = G("cadenaItems");
  const usar = s => G("(s => { STATE = s; })")(s);
  const at = (iso, h = 9) => new Date(`${iso}T${String(h).padStart(2, "0")}:00:00`);
  const lista = now => items(now).map(i => i.tipo + ":" + i.clave).join(" ");
  const nuevo = () => { const s = migrate(defaultState()); s.settings.year = 2026; delete s.settings.alta; usar(s); return s; };

  test("lunes: abrir la semana es obligatorio; cerrar la pasada, solo si tuvo algo; hasta el miércoles", () => {
    const s = nuevo();
    assert.equal(lista(at("2026-11-16")), "sem-apertura:2026-11-16");
    assert.equal(items(at("2026-11-16"))[0].obligatorio, true);
    s.ritual.dias["2026-11-10"] = { hecho: true, ts: 1 };
    assert.equal(lista(at("2026-11-16")), "sem-cierre:2026-11-09 sem-apertura:2026-11-16");
    assert.equal(items(at("2026-11-16"))[0].obligatorio, false, "cerrar la semana pasada se puede dejar para después");
    assert.equal(lista(at("2026-11-18", 20)), "sem-cierre:2026-11-09 sem-apertura:2026-11-16", "el miércoles todavía");
    assert.equal(lista(at("2026-11-19")), "", "el jueves ya no se ofrece al abrir el día");
    s.ritual.semanas["2026-11-16"] = { apertura: { ts: 1 } };
    assert.equal(lista(at("2026-11-16")), "sem-cierre:2026-11-09", "con la semana ya abierta (el domingo), solo queda cerrar la pasada");
    s.ritual.semanas["2026-11-09"] = { cierre: { ts: 1 } };
    assert.equal(lista(at("2026-11-16")), "");
  });

  test("día 1: cerrar el mes que terminó y abrir el nuevo, hasta el día 5", () => {
    const s = nuevo();
    s.ritual.semanas["2026-11-30"] = { apertura: { ts: 1 } };
    assert.equal(lista(at("2026-12-01")), "mes-cierre:2026-11 mes-apertura:2026-12");
    assert.equal(JSON.stringify(items(at("2026-12-01")).map(i => i.obligatorio)), "[false,false]", "el mes no es obligatorio");
    assert.equal(lista(at("2026-12-05")), "mes-cierre:2026-11 mes-apertura:2026-12");
    assert.equal(lista(at("2026-12-06")), "");
    s.ritual.meses["2026-12"] = { apertura: { ts: 1 } };
    assert.equal(lista(at("2026-12-02")), "mes-cierre:2026-11", "abierto desde Ritual → Mes: solo queda cerrar el anterior");
  });

  test("1 de enero: reloj de arena (cierres de lo chico a lo grande, aperturas de lo grande a lo chico)", () => {
    const s = nuevo();
    s.ritual.dias["2026-11-10"] = { hecho: true, ts: 1 };   // el trimestre tuvo algo: se ofrece cerrarlo
    assert.equal(lista(at("2027-01-01")), "mes-cierre:2026-12 tri-cierre:2026-Q4 tri-apertura:2027-Q1 mes-apertura:2027-01");
    assert.equal(items(at("2027-01-01"))[0].pasos, 7, "cerrar diciembre suma «Tu año»");
    assert.equal(lista(at("2027-01-15")), "tri-cierre:2026-Q4 tri-apertura:2027-Q1", "el trimestre, hasta el día 15");
    assert.equal(lista(at("2027-01-16")), "");
    s.ritual.trimestres["2027-Q1"] = { apertura: { ts: 1 } }; s.ritual.trimestres["2026-Q4"] = { cierre: { ts: 1 } };
    s.ritual.dias["2027-01-27"] = { hecho: true, ts: 1 };
    assert.equal(lista(at("2027-02-01")), "sem-cierre:2027-01-25 mes-cierre:2027-01 mes-apertura:2027-02 sem-apertura:2027-02-01", "lunes 1 de febrero: semana y mes");
  });

  test("la primera semana de una cuenta nueva, nada: los rituales grandes esperan", () => {
    const s = nuevo(); s.settings.alta = "2026-11-12";
    assert.equal(lista(at("2026-11-16")), "");
    assert.equal(lista(at("2026-11-23")), "sem-apertura:2026-11-23", "pasada la primera semana, sí");
  });

  test("dejar para mañana: lo saltado no vuelve hoy; las pruebas automáticas pueden apagar la cadena", () => {
    nuevo();
    G("cadenaSaltar")(["mes-cierre:2026-11"]);
    assert.ok(G("cadenaSaltados")().includes("mes-cierre:2026-11"));
    G('localStorage.setItem("rumbo-sin-cadena", "1")');
    assert.equal(G("cadenaPorOfrecer")(at("2026-11-16")).length, 0);
    G('localStorage.removeItem("rumbo-sin-cadena"); localStorage.removeItem("rumbo-cadena-salto")');
    assert.equal(G("cadenaPorOfrecer")(at("2026-11-16")).length, 1, "lo obligatorio se ofrece siempre");
  });
}
