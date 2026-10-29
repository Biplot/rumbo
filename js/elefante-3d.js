/* ============================================================
   RUMBO · 🐘 Tu elefante en 3D (vive en su cuarto)
   El mismo elefante del dibujo (elefante.js), hecho de formas redondas y tiernas:
   cabeza grande, ojos con brillo, mejillas rosadas, patitas cortas y trompa enroscada.
   Trae sus 6 tipos, sus 4 etapas (cría → sabio), su ánimo (feliz, normal, con sueño),
   sus reacciones al tocarlo (salta, saluda, corazones) y sus 15 prendas en sus 6 espacios.
   crearElefante3D(T, { tipo, etapa, animo, ropa, calmo }) → { g, vivo(t), reaccion(r), ocupado(), dispose() }
   Lo usa cielo-3d.js en el cuarto; sin WebGL queda el dibujo de siempre.
   ============================================================ */
function crearElefante3D(T, op) {
  op = op || {};
  const tipo = ["clasico", "asiatico", "mamut", "peluche", "geometrico", "tinta"].includes(op.tipo) ? op.tipo : "clasico";
  const i = Math.max(0, Math.min(3, op.etapa | 0)), animo = op.animo || "normal", ropa = op.ropa || {}, CALMO = !!op.calmo;
  const ETAPA = [{ s: 0.62, cab: 1.24 }, { s: 0.8, cab: 1.12 }, { s: 1, cab: 1 }, { s: 1.04, cab: 1 }][i];
  const GEO = tipo === "geometrico", TINTA = tipo === "tinta";
  const P = {
    clasico: { b: 0x8FA5C2, s: 0x7088A8, l: 0xB4C6DB, o: 0xF0B3C1, ojo: 0x1B2436, colm: 0xFFF8EC },
    asiatico: { b: 0x9F978F, s: 0x7F7770, l: 0xC4BDB5, o: 0xE9B7B3, ojo: 0x2A2320, colm: 0xFFF8EC, rojo: 0xB5774A, peca: 0xF2BDBB },
    mamut: i === 0 ? { b: 0xB98A63, s: 0x9A6E4B, l: 0xD6AE86, o: 0xC99E7C, ojo: 0x1E130C, colm: 0xFFF6E4, pelo: 0x8A5C3A }
      : { b: 0x8B5C3E, s: 0x6A432B, l: 0xB47C55, o: 0xA47452, ojo: 0x1E130C, colm: 0xFFF6E4, pelo: 0x5B3822 },
    peluche: { b: 0xA9BCD6, s: 0x889EBC, l: 0xCAD7E7, o: 0xF2C1CB, ojo: 0x2A2F3A, colm: 0xFFFFFF, hilo: 0x6E84A2 },
    geometrico: { b: 0x7FA8CF, s: 0x5C86B0, l: 0xA9C6E2, o: 0xF0A7B6, ojo: 0x13243A, colm: 0xFFFFFF, oro: 0xF2C24B },
    tinta: { b: 0xFFFDF7, s: 0xF1ECE0, l: 0xFFFFFF, o: i === 3 ? 0xF6D3DA : 0xFFFDF7, ojo: 0x1F2A3D, colm: 0xFFFDF7, t: 0x1F2A3D },
  }[tipo];

  /* -------- Materiales y formas -------- */
  const usados = new Set();
  const guardar = x => { usados.add(x); return x; };
  const grad = (() => {   // para la Tinta: sombras a lápiz en dos o tres tonos
    if (!TINTA || i === 0) return null;
    const d = i === 1 ? new Uint8Array([170, 255]) : new Uint8Array([120, 200, 255]);
    const t = new T.DataTexture(d, d.length, 1, T.LuminanceFormat); t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return guardar(t);
  })();
  function mat(c, o) {
    o = o || {};
    let m;
    if (TINTA && !o.real) m = grad ? new T.MeshToonMaterial({ color: c, gradientMap: grad }) : new T.MeshBasicMaterial({ color: c });
    else {
      const p = Object.assign({ color: c, roughness: tipo === "peluche" ? 1 : 0.78, metalness: 0, flatShading: GEO && !o.liso }, o);
      delete p.real; delete p.liso;
      if (p.envMapIntensity === undefined) p.envMapIntensity = p.metalness > 0.3 ? 1 : 0.3;
      m = new T.MeshStandardMaterial(p);
    }
    m.color.convertSRGBToLinear();
    return guardar(m);
  }
  const brillo = guardar(new T.MeshBasicMaterial({ color: 0xFFFFFF }));
  const ESF = guardar(GEO ? new T.IcosahedronGeometry(1, 1) : new T.SphereGeometry(1, 32, 24));
  const ESF_CH = guardar(new T.SphereGeometry(1, 16, 12));
  const CIL = guardar(new T.CylinderGeometry(1, 1, 1, GEO ? 6 : 24));
  function bola(m, x, y, z, sx, sy, sz, padre, geo) { const me = new T.Mesh(geo || ESF, m); me.position.set(x, y, z); me.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); (padre || cuerpo).add(me); return me; }
  function tubo(m, r0, r1, h, x, y, z, padre) { const me = new T.Mesh(guardar(new T.CylinderGeometry(r1, r0, h, GEO ? 6 : 20)), m); me.position.set(x, y, z); (padre || cuerpo).add(me); return me; }
  /* Un disco plano sobre la superficie, mirando hacia afuera (mejillas, botones, parches) */
  /* Orienta un objeto para que su +z mire hacia n (en las coordenadas de su padre), con la vertical hacia arriba */
  const ARRIBA = new T.Vector3(0, 1, 0), CERO = new T.Vector3(), M4 = new T.Matrix4();
  function mirar(o, n) { M4.lookAt(n, CERO, ARRIBA); o.quaternion.setFromRotationMatrix(M4); return o; }
  function sobre(m, padre, centro, dir, rad, w, h, grosor, geo) {
    const n = dir.clone().normalize(), me = new T.Mesh(geo || ESF_CH, m);
    me.position.copy(centro).addScaledVector(n, rad); mirar(me, n); me.scale.set(w, h, grosor || 0.02); padre.add(me); return me;
  }

  const B = mat(P.b), S = mat(P.s), L = mat(P.l), O = mat(P.o), OJO = mat(P.ojo, { roughness: 0.25, liso: true }), COLM = mat(P.colm, { roughness: 0.4, liso: true });
  const ROSA = mat(0xF7A6B6, { roughness: 0.95, liso: true });

  const g = new T.Group(), cuerpo = new T.Group(); g.add(cuerpo); g.scale.setScalar(ETAPA.s);

  /* -------- Cuerpo redondo y patitas cortas -------- */
  bola(B, -0.08, 0.9, 0, 0.78, 0.64, 0.64);
  bola(B, 0.28, 0.86, 0, 0.6, 0.57, 0.6);
  if (tipo !== "tinta") bola(L, 0.02, 1.32, 0, 0.42, 0.14, 0.34);   // lomo con luz, como en el dibujo
  const PATAS = [[0.38, 0.31, B], [0.38, -0.31, B], [-0.44, 0.3, S], [-0.44, -0.3, S]];
  const pies = [];
  PATAS.forEach(([x, z, m]) => {
    const p = new T.Group(); p.position.set(x, 0, z); cuerpo.add(p);
    const c = new T.Mesh(CIL, m); c.scale.set(0.19, 0.42, 0.19); c.position.y = 0.33; p.add(c);
    bola(m, 0, 0.13, 0, 0.215, 0.14, 0.215, p);
    pies.push(p);
  });
  // uñitas (o almohadillas rosadas en el Peluche), salvo con zapatillas
  if (!ropa.pies) pies.forEach((p, k) => {
    if (tipo === "peluche") { sobre(mat(0xF2C1CB), p, new T.Vector3(0, 0.11, 0), new T.Vector3(1, 0, 0), 0.2, 0.1, 0.07, 0.03); return; }
    if (k > 1 && tipo !== "mamut") return;
    [-0.09, 0, 0.09].forEach(dz => bola(mat(TINTA ? 0xFFFDF7 : 0xF6EFE4, { liso: true }), 0.185, 0.09, dz, 0.035, 0.03, 0.04, p, ESF_CH));
  });

  /* -------- Cola -------- */
  const cola = new T.Group(); cola.position.set(-0.84, 1.02, 0); cola.rotation.z = -0.5; cuerpo.add(cola);
  tubo(B, 0.035, 0.025, 0.42, 0, -0.2, 0, cola);
  bola(tipo === "mamut" ? mat(P.pelo) : tipo === "asiatico" && i === 0 ? mat(P.rojo) : S, 0, -0.44, 0, 0.07, 0.1, 0.07, cola);

  /* -------- Tipos: lo que agrega cada uno al cuerpo -------- */
  if (tipo === "mamut") {
    bola(B, -0.18, 1.38, 0, 0.56, 0.4, 0.52);   // joroba
    const pelo = mat(P.pelo), conoP = guardar(new T.ConeGeometry(0.06, 0.2, GEO ? 4 : 8));
    for (let k = 0; k < 22; k++) {   // flecos de lana bajo la panza
      const a = k / 22 * Math.PI * 2, x = -0.08 + Math.cos(a) * 0.74, z = Math.sin(a) * 0.6;
      const f = new T.Mesh(conoP, pelo); f.position.set(x, 0.52 + Math.abs(Math.sin(a)) * 0.04, z); f.rotation.x = Math.PI; f.rotation.z = Math.cos(a) * 0.25; cuerpo.add(f);
    }
    if (i === 3) [[-0.3, 1.6], [0.0, 1.55], [-0.55, 1.42]].forEach(([x, y]) => tubo(mat(0xE6DDD2), 0.018, 0.01, 0.2, x, y, 0.38).rotation.x = 0.5);
  }
  if (tipo === "peluche") {
    const lado = new T.Vector3(0, 0, 1);
    if (i === 0) { const et = sobre(mat(0xFFFFFF), cuerpo, new T.Vector3(-0.7, 0.8, 0.2), new T.Vector3(-0.6, 0, 0.8), 0.45, 0.09, 0.12, 0.012, guardar(new T.BoxGeometry(1, 1, 1))); et.rotation.z += 0.3; }
    if (i >= 1) { const pa = sobre(mat(0xF2C24B), cuerpo, new T.Vector3(-0.15, 0.95, 0), lado.clone().add(new T.Vector3(0, 0.35, 0)), 0.64, 0.2, 0.17, 0.02, guardar(new T.BoxGeometry(1, 1, 1))); pa.rotateZ(-0.14); }
    if (i >= 2) sobre(mat(0x17C3B2), pies[2], new T.Vector3(0, 0.36, 0), lado, 0.19, 0.09, 0.09, 0.02, guardar(new T.CylinderGeometry(1, 1, 1, 24))).rotateX(Math.PI / 2);
  }

  /* -------- La cabeza -------- */
  const cab = new T.Group(); cab.position.set(0.7, 1.5, 0); cab.scale.setScalar(ETAPA.cab); cuerpo.add(cab);
  const cabBase = animo === "sueno" ? -0.12 : 0.04; cab.rotation.z = cabBase;
  const R = 0.66;
  bola(B, 0, 0, 0, R, R * 0.95, R, cab);
  if (tipo === "asiatico") { bola(B, -0.04, 0.34, 0.17, 0.32, 0.3, 0.3, cab); bola(B, -0.04, 0.34, -0.17, 0.32, 0.3, 0.3, cab); }
  if (tipo !== "tinta" && tipo !== "geometrico") bola(L, -0.12, 0.38, 0, 0.3, 0.12, 0.28, cab);   // frente con luz
  const C0 = new T.Vector3(0, 0, 0);
  const enCab = (x, y, z) => new T.Vector3(x, y, z).normalize();

  // Ojos grandes con brillo (o arcos si está feliz o con sueño; botones en el Peluche; rombos en el Geométrico)
  const ojos = [], rOjo = [0.128, 0.118, 0.11, 0.11][i];
  const dirOjo = s => enCab(0.72, 0.2, s * 0.58);
  [1, -1].forEach(s => {
    const n = dirOjo(s), pos = n.clone().multiplyScalar(R * (tipo === "peluche" ? 0.99 : 0.93));
    const grupo = new T.Group(); grupo.position.copy(pos); mirar(grupo, n); cab.add(grupo);
    if (animo === "feliz" || animo === "sueno") {
      const arco = new T.Mesh(guardar(new T.TorusGeometry(rOjo * 0.75, rOjo * 0.22, 8, 20, Math.PI)), OJO);
      arco.position.z = 0.02; if (animo === "sueno") arco.rotation.z = Math.PI; grupo.add(arco);
    } else if (tipo === "peluche") {
      const bt = new T.Mesh(guardar(new T.CylinderGeometry(rOjo, rOjo, 0.035, 24)), mat(i === 3 ? 0xE8563A : 0x2A2F3A, { roughness: 0.35, liso: true }));
      bt.rotation.x = Math.PI / 2; grupo.add(bt);
      const ag = mat(i === 3 ? 0xFFD2C5 : 0x8A93A3, { liso: true });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bola(ag, a * rOjo * 0.3, b * rOjo * 0.3, 0.02, 0.014, 0.014, 0.01, grupo, ESF_CH));
    } else {
      const ojo = new T.Mesh(GEO ? guardar(new T.OctahedronGeometry(1, 0)) : ESF_CH, OJO); ojo.scale.set(rOjo * 0.95, rOjo * 1.08, rOjo * 0.6); grupo.add(ojo); ojos.push(ojo);
      {
        const b1 = new T.Mesh(ESF_CH, brillo); b1.scale.setScalar(rOjo * 0.36); b1.position.set(rOjo * 0.25, rOjo * 0.38, rOjo * 0.5); grupo.add(b1); ojos.push(b1);
        const b2 = new T.Mesh(ESF_CH, brillo); b2.scale.setScalar(rOjo * 0.16); b2.position.set(-rOjo * 0.3, -rOjo * 0.36, rOjo * 0.5); grupo.add(b2); ojos.push(b2);
      }
    }
    // mejillas rosadas
    const mj = sobre(ROSA, cab, C0, enCab(0.58, -0.16, s * 0.74), R * 0.97, 0.1, 0.066, 0.02);
    if (animo === "feliz") mj.scale.multiplyScalar(1.2);
    // cejas blancas del sabio (y la pelusa de la cría y del joven)
    if (i === 3 && ["clasico", "asiatico", "mamut", "tinta"].includes(tipo)) {
      const c = sobre(mat(TINTA ? P.t : 0xF4F4F2), cab, C0, enCab(0.66, 0.5, s * 0.46), R * 0.98, 0.075, 0.022, 0.02); c.rotateZ(s * 0.25);
    }
  });
  if ((tipo === "clasico" || tipo === "tinta" || tipo === "peluche") && i <= 1) {
    const pel = mat(TINTA ? P.t : P.s);
    (i === 0 ? [-0.1, 0, 0.1] : [0]).forEach((dz, k) => { const h = tubo(pel, 0.016, 0.008, 0.16, 0.05, R * 0.93, dz, cab); h.rotation.set(dz * 2.2, 0, -0.3 + k * 0.05); });
  }
  if (tipo === "asiatico") {
    const pecas = [[0.7, -0.05, 0.62], [0.74, 0.05, 0.6], [0.75, -0.25, -0.55], [0.62, 0.35, 0.6], [0.66, 0.3, -0.6], [0.55, -0.4, 0.68], [0.58, -0.42, -0.66], [0.3, 0.6, 0.66], [0.35, 0.62, -0.62], [0.72, 0.12, -0.6], [0.48, 0.1, 0.8], [0.5, 0.05, -0.8]];
    const pm = mat(P.peca, { liso: true });
    pecas.slice(0, [0, 2, 6, 12][i]).forEach(q => sobre(pm, cab, C0, enCab(...q), R * 0.97, 0.022, 0.022, 0.01));
    if (i <= 1) { const ro = mat(P.rojo); for (let k = 0; k < (i === 0 ? 9 : 3); k++) { const a = (k / 9 - 0.5) * 2.2, h = tubo(ro, 0.012, 0.006, 0.13, Math.cos(a) * 0.12 - 0.05, R * 0.97, Math.sin(a) * 0.32, cab); h.rotation.set(Math.sin(a) * 0.7, 0, Math.cos(a) * -0.4); } }
  }
  if (tipo === "mamut") {
    const pelo = mat(i === 3 ? 0xE6DDD2 : P.pelo), conoP = guardar(new T.ConeGeometry(0.05, 0.22, 6));
    for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * 1.6, f = new T.Mesh(conoP, pelo); f.position.set(-0.05 + Math.cos(a) * 0.05, R * 0.9, Math.sin(a) * 0.25); f.rotation.set(Math.sin(a) * 0.6, 0, -0.35); f.scale.setScalar(i === 0 ? 1.25 : 1); cab.add(f); }
  }
  if (tipo === "peluche" && i === 3) {   // remiendo con hilo
    const hm = mat(P.hilo);
    for (let k = 0; k < 4; k++) { const st = sobre(hm, cab, C0, enCab(0.1 + k * 0.08, 0.75, 0.62), R * 0.98, 0.012, 0.05, 0.01, guardar(new T.BoxGeometry(1, 1, 1))); st.rotateZ(0.5); }
  }

  // Orejas grandes y redondas, con el centro rosado
  const orejas = [], esc = { asiatico: 0.62, mamut: 0.6 }[tipo] || 1, abre = 0.28;
  [1, -1].forEach(s => {
    // el pivote va en el borde de adelante de la oreja: al aletear, se abre hacia atrás
    const piv = new T.Group(); piv.position.set(-0.02, 0.1, s * R * 0.8); piv.rotation.set(s * 0.12, -s * abre, 0); cab.add(piv);
    const fuera = bola(S, -0.38 * esc, -0.06, s * 0.04, 0.46 * esc, 0.52 * esc, 0.06, piv);
    if (tipo !== "mamut") [1, -1].forEach(c => bola(tipo === "tinta" ? mat(P.o) : O, -0.36 * esc, -0.09, s * 0.04 + c * 0.035, 0.33 * esc, 0.38 * esc, 0.03, piv));
    if (tipo === "asiatico" && i >= 2) [[-0.2, -0.18], [-0.4, 0.04]].slice(0, i === 3 ? 2 : 1).forEach(q => bola(mat(P.peca, { liso: true }), q[0] * esc, q[1] * esc, s * 0.075, 0.025, 0.025, 0.012, piv, ESF_CH));
    orejas.push({ piv, s, fuera });
  });

  // Trompa: baja, avanza y se enrosca en la punta
  const trompa = [], nT = 18, rT = i === 0 ? 0.15 : 0.16;
  const segG = GEO ? guardar(new T.OctahedronGeometry(1, 0)) : ESF;
  for (let k = 0; k < nT; k++) { const m = new T.Mesh(segG, B); cab.add(m); trompa.push(m); }
  const anillos = [];
  if (i >= 2 && tipo !== "geometrico" && tipo !== "tinta") [5, 8].forEach(k => { const a = new T.Mesh(guardar(new T.TorusGeometry(1, 0.035, 6, 24)), S); cab.add(a); anillos.push({ a, k }); });
  const punta = new T.Vector3();
  let alzar = 0;   // 0: en reposo · 1: saludando
  function ponerTrompa(t) {
    let x = R * 0.86, y = -R * 0.3;
    const sway = CALMO ? 0 : Math.sin(t * 1.1) * 0.05;
    for (let k = 0; k < nT; k++) {
      const u = k / (nT - 1);
      const reposo = -1.25 + 2.5 * Math.pow(u, 2.4) + sway * u;
      const saludo = -0.35 + 2.3 * u + Math.sin(t * 9) * 0.25 * u;
      const ang = reposo + (saludo - reposo) * alzar;
      const r = (rT - (rT - 0.075) * u);
      trompa[k].position.set(x, y, 0); trompa[k].scale.set(r, r, r);
      if (k === nT - 1) punta.set(x, y, 0);
      x += Math.cos(ang) * 0.048; y += Math.sin(ang) * 0.048;
    }
    anillos.forEach(({ a, k }) => {
      const p = trompa[k].position, q = trompa[k + 1].position, r = trompa[k].scale.x;
      a.position.copy(p); mirar(a, q.clone().sub(p).normalize()); a.scale.setScalar(r * 1.02);
    });
  }
  ponerTrompa(0);
  // Colmillos según el tipo y la etapa
  const largoColm = { clasico: [0, 0.1, 0.17, 0.26], asiatico: [0, 0, 0, 0.12], peluche: [0, 0, 0.14, 0.22], geometrico: [0, 0.1, 0.17, 0.26], tinta: [0, 0.1, 0.17, 0.26] };
  if (tipo === "mamut") {
    if (i === 1) [1, -1].forEach(s => { const c = new T.Mesh(guardar(new T.ConeGeometry(0.045, 0.24, 12)), COLM); c.position.set(R * 0.72 + 0.06, -R * 0.42, s * 0.2); c.rotation.z = -2.0; cab.add(c); });
    if (i >= 2) [1, -1].forEach(s => {   // colmillos en espiral
      const n = i === 3 ? 13 : 10;
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1), a = -1.1 + u * (i === 3 ? 3.6 : 3.0), rr = 0.05 - u * 0.025;
        bola(COLM, R * 0.7 + 0.04 + Math.cos(a) * 0.04 + u * 0.32, -R * 0.42 + Math.sin(a) * 0.04 - u * 0.12 + u * u * 0.32, s * (0.2 + u * 0.06), rr, rr, rr, cab, ESF_CH);
      }
    });
  } else {
    const lc = largoColm[tipo][i];
    if (lc) [1, -1].forEach(s => { const c = new T.Mesh(guardar(new T.ConeGeometry(0.04, lc, 12)), COLM); c.position.set(R * 0.72 + lc * 0.32, -R * 0.4 - lc * 0.12, s * 0.2); c.rotation.z = -2.1; cab.add(c); });
  }

  /* -------- La Tinta: contorno de tinta alrededor de cada forma -------- */
  if (TINTA) {
    const tinta = guardar(new T.MeshBasicMaterial({ color: new T.Color(P.t).convertSRGBToLinear(), side: T.BackSide }));
    const contornar = o => { if (!o.isMesh || o.userData.sinContorno || o.material === brillo || o.material === OJO) return; const c = new T.Mesh(o.geometry, tinta); c.scale.setScalar(1.07); c.userData.sinContorno = true; o.add(c); };
    const lista = []; g.traverse(o => lista.push(o)); lista.forEach(contornar);
    if (i === 3) { const acu = mat(0xCDEBE6); [cuerpo.children[0], cuerpo.children[1]].forEach(m => { if (m && m.isMesh) m.material = acu; }); }
  }
  /* -------- El Geométrico de sabio: bordes dorados -------- */
  if (GEO && i === 3) {
    const oro = guardar(new T.LineBasicMaterial({ color: new T.Color(P.oro).convertSRGBToLinear() }));
    const bordes = guardar(new T.EdgesGeometry(ESF, 20));
    [cuerpo.children[0], cuerpo.children[1], cab.children[0]].forEach(m => { if (m && m.isMesh) m.add(new T.LineSegments(bordes, oro)); });
  }

  /* ============================================================
     La ropa: cada prenda en su espacio (cabeza, ojos, cuello, espalda, trompa, pies)
     ============================================================ */
  const arriba = new T.Group(); arriba.position.set(-0.04, R * (tipo === "asiatico" ? 1.02 : 0.88), 0); arriba.rotation.z = 0.12; cab.add(arriba);
  const enTrompa = new T.Group(); cab.add(enTrompa);
  const MET = c => mat(c, { metalness: 0.85, roughness: 0.3, real: true, liso: true });
  const domo = (r, m, sy) => { const d = new T.Mesh(guardar(new T.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)), m); d.scale.y = sy || 1; return d; };
  const PRENDA = {
    gorro() { const m = mat(0xE8563A, { real: true }); arriba.add(domo(0.4, m, 1.05)); const b = new T.Mesh(guardar(new T.TorusGeometry(0.4, 0.075, 10, 28)), mat(0xC63F26, { real: true })); b.rotation.x = Math.PI / 2; b.position.y = 0.03; arriba.add(b); bola(mat(0xFFE3D9, { real: true }), 0, 0.46, 0, 0.11, 0.11, 0.11, arriba); },
    jockey() { const m = mat(0x17C3B2, { real: true }); arriba.add(domo(0.4, m, 0.85)); const v = new T.Mesh(guardar(new T.CylinderGeometry(0.42, 0.42, 0.03, 24, 1, false, Math.PI / 2 - 1.1, 2.2)), mat(0x0F8F83, { real: true })); v.position.set(0.16, 0.02, 0); arriba.add(v); bola(mat(0x0F8F83, { real: true }), 0, 0.34, 0, 0.04, 0.03, 0.04, arriba); },
    casco() { arriba.add(domo(0.42, mat(0xD8B77A, { real: true }), 0.9)); const al = new T.Mesh(guardar(new T.CylinderGeometry(0.64, 0.64, 0.035, 32)), mat(0xB9955A, { real: true })); al.position.y = 0.02; arriba.add(al); const ba = new T.Mesh(guardar(new T.CylinderGeometry(0.425, 0.425, 0.07, 32, 1, true)), mat(0x8C6A36, { real: true, side: T.DoubleSide })); ba.position.y = 0.07; arriba.add(ba); },
    corona() {
      const oro = MET(0xF2C24B), aro = new T.Mesh(guardar(new T.CylinderGeometry(0.27, 0.25, 0.12, 28, 1, true)), mat(0xF2C24B, { metalness: 0.85, roughness: 0.3, real: true, liso: true, side: T.DoubleSide })); aro.position.y = 0.06; arriba.add(aro);
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, p = new T.Mesh(guardar(new T.ConeGeometry(0.06, 0.16, 8)), oro); p.position.set(Math.cos(a) * 0.26, 0.19, Math.sin(a) * 0.26); arriba.add(p); bola(mat(0xF2C24B, { metalness: 0.85, roughness: 0.3, real: true, liso: true }), Math.cos(a) * 0.26, 0.28, Math.sin(a) * 0.26, 0.03, 0.03, 0.03, arriba, ESF_CH); }
      sobre(mat(0xE8563A, { roughness: 0.2, real: true, liso: true }), arriba, new T.Vector3(0, 0.06, 0), new T.Vector3(1, 0, 0), 0.27, 0.045, 0.045, 0.03);
      [1, -1].forEach(s => sobre(mat(0x17C3B2, { roughness: 0.2, real: true, liso: true }), arriba, new T.Vector3(0, 0.06, 0), new T.Vector3(0.5, 0, s * 0.86), 0.27, 0.032, 0.032, 0.025));
    },
    lectura() { lentes(m => { const a = new T.Mesh(guardar(new T.TorusGeometry(rOjo * 1.45, 0.016, 8, 28)), m); return a; }, mat(0x2A2F3A, { roughness: 0.4, real: true, liso: true })); },
    sol() { lentes(m => { const l = new T.Mesh(ESF_CH, m); l.scale.set(rOjo * 1.4, rOjo * 1.05, 0.025); return l; }, mat(0x1D2330, { roughness: 0.15, metalness: 0.3, real: true, liso: true }), true); },
    bufanda() {
      const cu = new T.Group(); cu.position.set(0.42, 1.16, 0); cu.rotation.z = -0.95; cuerpo.add(cu);
      const r = new T.Mesh(guardar(new T.TorusGeometry(0.46, 0.12, 12, 32)), mat(0xE8563A, { real: true })); r.rotation.x = Math.PI / 2; r.scale.set(1, 1.05, 1); cu.add(r);
      const cola = new T.Mesh(guardar(new T.BoxGeometry(0.16, 0.42, 0.06)), mat(0xC63F26, { real: true })); cola.position.set(0.18, -0.24, 0.4); cola.rotation.set(0.2, 0, 0.9); cu.add(cola);
    },
    humita() { const h = new T.Group(); h.position.set(0.9, 0.86, 0.06); h.rotation.set(0, 0.35, 0); cuerpo.add(h); const m = mat(0x17C3B2, { real: true }); [1, -1].forEach(s => { const a = new T.Mesh(guardar(new T.ConeGeometry(0.1, 0.18, 4)), m); a.rotation.x = s * Math.PI / 2; a.position.z = s * 0.09; h.add(a); }); bola(mat(0x0F8F83, { real: true }), 0, 0, 0, 0.05, 0.05, 0.05, h); },
    medalla() {
      const h = new T.Group(); h.position.set(0.9, 0.9, 0.06); h.rotation.y = 0.35; cuerpo.add(h);
      const cinta = mat(0x17C3B2, { real: true });
      [1, -1].forEach(s => { const c = new T.Mesh(guardar(new T.BoxGeometry(0.02, 0.24, 0.05)), cinta); c.position.set(0, -0.06, s * 0.06); c.rotation.x = s * 0.42; h.add(c); });
      const d = new T.Mesh(guardar(new T.CylinderGeometry(0.1, 0.1, 0.03, 24)), MET(0xF2C24B)); d.rotation.z = Math.PI / 2; d.position.set(0.02, -0.22, 0); h.add(d);
      sobre(mat(0xE8563A, { real: true, liso: true }), h, new T.Vector3(0.02, -0.22, 0), new T.Vector3(1, 0, 0), 0.018, 0.035, 0.035, 0.01);
    },
    mochila() {
      const h = new T.Group(); h.position.set(-0.22, 1.42, 0); cuerpo.add(h);
      bola(mat(0x0F8F83, { real: true }), 0, 0, 0, 0.3, 0.26, 0.32, h);
      [1, -1].forEach(s => bola(mat(0x17C3B2, { real: true }), 0, -0.04, s * 0.27, 0.18, 0.13, 0.06, h));
      const asa = new T.Mesh(guardar(new T.TorusGeometry(0.08, 0.02, 6, 16, Math.PI)), mat(0x0B6F66, { real: true })); asa.position.y = 0.24; h.add(asa);
    },
    capa() {
      const h = new T.Group(); h.position.set(-0.12, 0.94, 0); cuerpo.add(h);
      // un manto redondo sobre el lomo, que cae por los costados
      const c = new T.Mesh(guardar(new T.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, 1.32)), mat(0x6B4BD6, { real: true, side: T.DoubleSide }));
      c.scale.set(0.84, 0.7, 0.7); c.position.set(-0.06, -0.02, 0); h.add(c);
      const cu = new T.Mesh(guardar(new T.TorusGeometry(0.46, 0.06, 8, 28)), mat(0x8C72F0, { real: true })); cu.position.set(0.46, 0.2, 0); cu.rotation.set(0, Math.PI / 2, 0); cu.rotateX(-0.5); h.add(cu);
    },
    taza() { const t = new T.Group(); enTrompa.add(t); t.position.set(0.02, 0.1, 0); const cu = new T.Mesh(guardar(new T.CylinderGeometry(0.09, 0.075, 0.15, 20)), mat(0xFFFFFF, { real: true, roughness: 0.3 })); t.add(cu); const ba = new T.Mesh(guardar(new T.CylinderGeometry(0.092, 0.088, 0.04, 20)), mat(0xE8563A, { real: true })); t.add(ba); const asa = new T.Mesh(guardar(new T.TorusGeometry(0.045, 0.015, 6, 14)), mat(0xFFFFFF, { real: true })); asa.position.set(0.09, 0, 0); t.add(asa); const cafe = new T.Mesh(guardar(new T.CircleGeometry(0.08, 18)), mat(0x5B3822, { real: true })); cafe.rotation.x = -Math.PI / 2; cafe.position.y = 0.07; t.add(cafe); },
    libro() { const t = new T.Group(); enTrompa.add(t); t.position.set(0.06, 0.1, 0); t.rotation.set(0.3, 0, -0.4); t.add(new T.Mesh(guardar(new T.BoxGeometry(0.22, 0.05, 0.3)), mat(0xE8563A, { real: true }))); const ho = new T.Mesh(guardar(new T.BoxGeometry(0.2, 0.04, 0.28)), mat(0xFFF3EC, { real: true })); ho.position.x = 0.012; t.add(ho); },
    pesa() { const t = new T.Group(); enTrompa.add(t); t.position.set(0.04, 0.04, 0); const ba = new T.Mesh(guardar(new T.CylinderGeometry(0.022, 0.022, 0.46, 10)), mat(0x6A7F95, { metalness: 0.6, roughness: 0.35, real: true })); ba.rotation.x = Math.PI / 2; t.add(ba); [1, -1].forEach(s => { const d = new T.Mesh(guardar(new T.CylinderGeometry(0.09, 0.09, 0.08, 20)), mat(0x2A2F3A, { real: true, roughness: 0.5 })); d.rotation.x = Math.PI / 2; d.position.z = s * 0.2; t.add(d); }); },
    zapatillas() { pies.forEach(p => { bola(mat(0x17C3B2, { real: true }), 0.03, 0.1, 0, 0.25, 0.12, 0.24, p); const su = new T.Mesh(guardar(new T.CylinderGeometry(0.235, 0.235, 0.05, 24)), mat(0xFFFFFF, { real: true })); su.position.set(0.03, 0.025, 0); su.scale.x = 1.08; p.add(su); bola(mat(0xFFFFFF, { real: true }), 0.2, 0.08, 0, 0.06, 0.06, 0.12, p); }); },
  };
  function lentes(hacer, m, oscuros) {
    [1, -1].forEach(s => { const n = dirOjo(s), pos = n.clone().multiplyScalar(R * 0.99 + 0.03), l = hacer(m); l.position.copy(pos); mirar(l, n); cab.add(l);
      const pa = tubo(m, 0.012, 0.012, 0.42, pos.x - 0.2, pos.y + 0.03, pos.z + s * 0.04, cab); pa.rotation.set(0, 0, Math.PI / 2); pa.rotation.y = s * 0.55;
      if (oscuros) { const br = new T.Mesh(ESF_CH, mat(0x8FE3DA, { real: true, liso: true })); br.position.copy(pos).addScaledVector(n, 0.02).add(new T.Vector3(0, rOjo * 0.45, 0)); br.scale.set(0.035, 0.012, 0.012); mirar(br, n); cab.add(br); }
    });
    const a = dirOjo(1).multiplyScalar(R * 1.0 + 0.03), b = dirOjo(-1).multiplyScalar(R * 1.0 + 0.03), puente = tubo(m, 0.013, 0.013, a.distanceTo(b) * 0.9, (a.x + b.x) / 2 + 0.03, (a.y + b.y) / 2 + 0.03, 0, cab);
    puente.rotation.x = Math.PI / 2;
  }
  Object.values(ropa).forEach(id => { if (PRENDA[id]) PRENDA[id](); });

  /* -------- Sombra de contacto y símbolos (zzz, corazones) -------- */
  const sprites = [];
  function texto(t, color) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = color; x.font = "800 46px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(t, 32, 34); const tx = guardar(new T.CanvasTexture(c)); tx.encoding = T.sRGBEncoding; return tx; }
  function simbolo(t, color, n) { const tx = texto(t, color); const l = []; for (let k = 0; k < n; k++) { const sp = new T.Sprite(guardar(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0 }))); sp.scale.setScalar(0.24 + k * 0.04); g.add(sp); l.push(sp); } return l; }
  const zzz = animo === "sueno" ? simbolo("z", "#5C7FA8", 3) : [];
  const corazones = simbolo("♥", "#F06A86", 4);

  /* ============================================================
     Vida: respira, parpadea, mueve las orejas, la cola y la trompa; reacciona al tocarlo
     ============================================================ */
  let reac = null, base = null;
  const tope = (cab.position.y + R * ETAPA.cab + 0.1);
  function vivo(t) {
    const quieto = CALMO;
    const resp = quieto ? 0 : Math.sin(t * (animo === "sueno" ? 1.2 : 2)) * (animo === "sueno" ? 0.025 : 0.015);
    cuerpo.scale.set(1, 1 + resp, 1 + resp * 0.5);
    cab.rotation.z = cabBase + (quieto ? 0 : Math.sin(t * 1.3) * 0.03);
    const aleteo = quieto ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.9)), 12);
    orejas.forEach(o => { o.piv.rotation.y = -o.s * (abre + 0.5 * aleteo); });
    const parp = !quieto && animo === "normal" && (t % 4.3) < 0.13 ? 0.15 : 1;
    ojos.forEach(o => { if (o.userData.sy === undefined) o.userData.sy = o.scale.y; o.scale.y = o.userData.sy * parp; });
    cola.rotation.x = quieto ? 0 : Math.sin(t * 2.4) * 0.35;
    // reacciones
    let salto = 0; alzar = 0;
    corazones.forEach(sp => { sp.material.opacity = 0; });
    if (reac) {
      if (reac.t0 === null) reac.t0 = t;
      const p = (t - reac.t0) / reac.dura;
      if (p >= 1) reac = null;
      else if (reac.r === "salta") { salto = Math.sin(Math.PI * Math.min(1, p * 1.25)) * 0.42; const sq = p < 0.12 ? 1 - p * 1.6 : p > 0.82 ? 1 - (1 - p) * 1.4 : 1; cuerpo.scale.y *= Math.max(0.82, sq); }
      else if (reac.r === "saluda") { alzar = Math.sin(Math.PI * p); orejas.forEach(o => { o.piv.rotation.y = -o.s * (abre + 0.55 * Math.sin(p * Math.PI)); }); }
      else if (reac.r === "corazones") corazones.forEach((sp, k) => { const q = Math.min(1, Math.max(0, p * 1.3 - k * 0.12)); sp.position.set(cab.position.x + 0.1 + Math.sin(k * 2.3) * 0.25, tope + q * 0.9, Math.cos(k * 1.7) * 0.3); sp.material.opacity = q > 0 && q < 1 ? Math.sin(q * Math.PI) : 0; });
    }
    g.position.y = (base === null ? (base = g.position.y) : base) + salto;
    ponerTrompa(t);
    enTrompa.position.copy(punta);
    zzz.forEach((sp, k) => { const f = quieto ? (k ? -1 : 0.4) : (t * 0.28 + k / 3) % 1; sp.material.opacity = f < 0 ? 0 : quieto ? 0.85 : Math.sin(f * Math.PI) * 0.9; sp.position.set(cab.position.x + 0.2 + Math.sin(f * 5 + k) * 0.08, tope + f * 0.7, 0.15); });
  }
  vivo(0);
  return {
    g, vivo, tope,
    reaccion(r) { reac = { r, t0: null, dura: r === "saluda" ? 1.3 : r === "corazones" ? 1.5 : 0.75 }; },
    ocupado() { return !!reac; },
    dispose() { usados.forEach(x => { if (x && x.dispose) x.dispose(); }); usados.clear(); },
  };
}
