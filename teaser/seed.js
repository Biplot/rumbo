/* ============================================================
   RUMBO · Teaser — datos de demostración
   Se ejecuta DENTRO de la app, sobre su propio STATE, reusando
   `seedDemo()` del repo y añadiendo el historial de ánimo que
   alimenta los Descubrimientos. Determinista: misma corrida,
   mismos números en pantalla.
   ============================================================ */
window.__rumboSeed = function () {
  const S = STATE;
  seedDemo(S);

  S.profile.name = "Chris";
  S.profile.birthDate = "1992-04-18";
  S.profile.motto = "Un día a la vez, pero todos los días";
  S.settings.onboarded = true;
  S.settings.theme = "claro";
  S.settings.metaLibros = 12;

  const hoy = todayISO();
  const deporte = S.habitos.defs.find(h => h.nombre === "Deporte");
  const lectura = S.habitos.defs.find(h => h.nombre === "Lectura");

  /* -------- Marca/desmarca un hábito en una fecha concreta -------- */
  const setHabito = (hab, d, on) => {
    const k = monthKey(d.getFullYear(), d.getMonth());
    S.habitos.log[k] = S.habitos.log[k] || {};
    S.habitos.log[k][hab.id] = S.habitos.log[k][hab.id] || {};
    if (on) S.habitos.log[k][hab.id][d.getDate()] = true;
    else delete S.habitos.log[k][hab.id][d.getDate()];
  };

  /* -------- Historial: 70 días de ritual, ánimo y gratitud --------
     El ánimo sigue a los días de entrenamiento (lun/mar/jue/vie).
     De ahí sale el descubrimiento que la app calcula sola. */
  const MISIONES = [
    "Cerrar la propuesta de Andes", "Dejar el informe listo para revisión",
    "Terminar el módulo de reportes", "Preparar la reunión con el equipo",
    "Avanzar la planificación del trimestre", "Dejar la bandeja en cero",
    "Escribir el resumen del proyecto", "Ordenar los números del mes",
  ];
  const SAPOS = [
    "Llamar al banco", "Responder el correo de Marcela", "Revisar el contrato",
    "Cuadrar las boletas del mes", "Agendar el control médico",
    "Terminar la presentación", "Pedir la cotización del seguro",
  ];
  const GRATITUDES = [
    "Salí a correr con el cerro despejado.", "Almorcé con la Ignacia sin apuro.",
    "Terminé algo que venía arrastrando hace semanas.", "Mi mamá llamó justo cuando la necesitaba.",
    "El equipo se la jugó y salió bien.", "Dormí ocho horas seguidas.",
    "Una conversación que no esperaba y me dejó pensando.", "Leí veinte páginas antes de dormir.",
    "Cociné en vez de pedir delivery.", "Un café tranquilo mirando por la ventana.",
  ];
  const MANANAS = [
    "Salir a correr temprano", "Empezar por lo difícil", "Llamar a la Fran",
    "Dejar el escritorio ordenado", "Cerrar el tema pendiente del informe",
  ];
  const NOTAS_CIERRE = [
    "Día denso pero salió lo importante.", "Me costó arrancar, terminé bien.",
    "Mucha reunión, poco foco. Mañana bloqueo la mañana.",
    "Buen ritmo. El SAPO primero funciona.", "Cansado, pero cerré lo que importaba.",
  ];
  const PILARES_L = ["Psicología", "Fisiología", "Productividad", "Magnetismo", "Presencia", "Propósito"];

  /* Ánimo alto los días de deporte, más bajo el resto: la proporción
     está calibrada para que el insight salga en 30%. */
  const MOOD_ENTRENA = [4, 4, 5, 4, 4, 5, 4];
  const MOOD_DESCANSA = [3, 3, 4, 3, 3, 4, 3];

  S.vida.diario = [];
  let iEnt = 0, iDes = 0;

  for (let off = 70; off >= 1; off--) {
    const d = new Date(); d.setDate(d.getDate() - off);
    const iso = isoLocal(d);
    const dow = d.getDay();
    const entrena = dow === 1 || dow === 2 || dow === 4 || dow === 5;
    const mood = entrena ? MOOD_ENTRENA[iEnt++ % 7] : MOOD_DESCANSA[iDes++ % 7];

    setHabito(deporte, d, entrena);
    if (off % 3 !== 0) setHabito(lectura, d, true);

    /* La racha visible es de 18 días: el día 19 quedó abierto sin cerrar,
       y más atrás hay un par de huecos. Un historial humano, no perfecto. */
    const cerrado = off <= 18 || (off !== 19 && off !== 27 && off !== 40);

    S.ritual.dias[iso] = {
      hecho: true,
      cerrado,
      mision: MISIONES[off % MISIONES.length],
      sapo: SAPOS[off % SAPOS.length],
      pilar: PILARES_L[off % PILARES_L.length],
      energia: entrena ? 4 : 3,
      servir: off % 2 ? "Mi equipo" : "La Ignacia",
      proyectos: off % 2 ? ["Andes", "Rumbo"] : ["Rumbo"],
      ts: d.getTime(),
      cierre: cerrado ? {
        mision: mood >= 4 ? "si" : (off % 3 === 0 ? "parcial" : "si"),
        /* El SAPO se cumple más seguido en los días buenos, pero no siempre. */
        sapo: entrena ? (off % 10 !== 0) : (off % 5 === 0),
        energia: entrena ? 4 : 3,
        mejor: GRATITUDES[off % GRATITUDES.length],
        manana: MANANAS[off % MANANAS.length],
        nota: NOTAS_CIERRE[off % NOTAS_CIERRE.length],
      } : undefined,
    };
    if (!cerrado) delete S.ritual.dias[iso].cierre;

    S.vida.diario.push({
      id: uid(), fecha: iso, fromRitual: cerrado, mood,
      texto: cerrado ? NOTAS_CIERRE[off % NOTAS_CIERRE.length] : "Día suelto, sin ritual.",
      gratitud: cerrado ? GRATITUDES[off % GRATITUDES.length] : "",
      ts: d.getTime(),
    });
  }

  /* HOY queda sin abrir: el teaser muestra el ritual en vivo. */
  delete S.ritual.dias[hoy];
  S.vida.diario = S.vida.diario.filter(e => e.fecha !== hoy);
  S.habitos.defs.forEach(h => setHabito(h, new Date(), false));

  /* Pilares acumulados, coherentes con 70 días de ritual */
  S.ritual.pilares = { "Psicología": 14, "Fisiología": 12, "Productividad": 16, "Magnetismo": 8, "Presencia": 11, "Propósito": 9 };

  /* -------- Planificador de hoy: vacío, lo llena el ritual en cámara -------- */
  S.semana.weekOf = currentMondayISO();
  S.semana.premio = "Cine el domingo";
  const wd = (new Date().getDay() + 6) % 7;
  S.semana.dias = [[], [], [], [], [], [], []];
  S.semana.dias.forEach((_, i) => {
    if (i < wd) S.semana.dias[i] = [{ id: uid(), txt: "Revisar pendientes", done: true }];
  });

  /* -------- Metas -------- */
  S.metas.trimestres = [
    [{ id: uid(), texto: "Correr 10K sin parar", done: true }, { id: uid(), texto: "Leer 3 libros", done: true }],
    [{ id: uid(), texto: "Ahorrar $1.500.000", done: true }, { id: uid(), texto: "Curso de finanzas", done: true }],
    [{ id: uid(), texto: "Bajar a 78 kg", done: true }, { id: uid(), texto: "Lanzar Rumbo", done: false }, { id: uid(), texto: "Viaje al sur", done: true }],
    [{ id: uid(), texto: "Cerrar el año sin deudas", done: false }, { id: uid(), texto: "Media maratón", done: false }],
  ];
  S.metas.mensuales[8] = [{ id: uid(), texto: "Rutina de 5 días", done: true }, { id: uid(), texto: "Terminar 'Hábitos atómicos'", done: true }, { id: uid(), texto: "Ordenar los gastos fijos", done: false }];
  S.metas.mensuales[9] = [{ id: uid(), texto: "Retomar la guitarra", done: false }];

  /* -------- Lecturas -------- */
  const L = (titulo, autor, estado, valoracion, pagina, paginas, i) => ({
    id: uid(), titulo, autor, estado, valoracion, pagina, paginas, nota: "",
    color: LECT_COLORS[i % LECT_COLORS.length], portada: "",
    inicio: "", fin: estado === "terminado" ? "2026-08-12" : "",
  });
  S.lecturas = [
    L("Hábitos atómicos", "James Clear", "terminado", 5, 320, 320, 0),
    L("El poder del ahora", "Eckhart Tolle", "terminado", 4, 236, 236, 1),
    L("Deep Work", "Cal Newport", "leyendo", 0, 148, 304, 2),
    L("Sapiens", "Yuval N. Harari", "terminado", 5, 496, 496, 3),
    L("Los hombres me explican cosas", "Rebecca Solnit", "terminado", 4, 160, 160, 4),
    L("Mindset", "Carol Dweck", "por-leer", 0, 0, 288, 5),
    L("La tregua", "Mario Benedetti", "terminado", 5, 192, 192, 6),
    L("Range", "David Epstein", "por-leer", 0, 0, 352, 7),
  ];

  /* -------- Ideas (captura rápida) -------- */
  S.vida.ideas = [
    { id: uid(), texto: "Idea: newsletter mensual del proyecto", hecha: false },
    { id: uid(), texto: "Preguntar por el arriendo de la oficina", hecha: false },
    { id: uid(), texto: "Regalo cumpleaños Ignacia", hecha: false },
    { id: uid(), texto: "Cambiar las zapatillas de running", hecha: true },
  ];

  /* -------- Relaciones -------- */
  const rel = (nombre, vinculo, cumple, frecuencia, diasSinHablar, notas) => {
    const u = new Date(); u.setDate(u.getDate() - diasSinHablar);
    return { id: uid(), nombre, vinculo, cumple, frecuencia, notas, ultimoContacto: isoLocal(u) };
  };
  S.vida.relaciones = [
    rel("Ignacia", "Pareja", "1993-10-02", 1, 0, "Le gusta el cine coreano."),
    rel("Mamá", "Familia", "1964-06-11", 7, 9, "Llamarla los domingos."),
    rel("Fran", "Mejor amigo", "1992-09-29", 14, 22, "Pendiente el asado que quedó en nada."),
    rel("Rodrigo", "Socio", "1988-01-24", 7, 3, ""),
    rel("Tía Marta", "Familia", "1959-11-05", 30, 41, ""),
  ];

  /* -------- Listas -------- */
  const item = (txt, done) => ({ id: uid(), txt, done: !!done });
  S.vida.listas = [
    { id: uid(), nombre: "Supermercado", tipo: "compras", icon: "🛒", items: [item("Avena", true), item("Café"), item("Palta"), item("Detergente")] },
    { id: uid(), nombre: "Películas", tipo: "otra", icon: "🎬", items: [item("Perfect Days"), item("La sociedad de la nieve", true), item("Dune II")] },
    { id: uid(), nombre: "Viaje al sur", tipo: "otra", icon: "🧳", items: [item("Reservar cabaña", true), item("Revisar el auto"), item("Comprar bencina")] },
  ];

  /* -------- Notas -------- */
  S.notas = [
    { id: uid(), nombre: "Trabajo", items: [{ id: uid(), titulo: "Reunión con Andes", texto: "Piden el informe el día 30." }, { id: uid(), titulo: "Ideas producto", texto: "Modo semanal en Rumbo." }] },
    { id: uid(), nombre: "Personal", items: [{ id: uid(), titulo: "Receta pastel de choclo", texto: "Maíz, albahaca, pino." }] },
  ];

  /* -------- Calendario -------- */
  const evt = (offset, ...txt) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    S.eventos[isoLocal(d)] = txt;
  };
  evt(0, "Reunión con Andes 10:00", "Gimnasio 19:00");
  evt(1, "Control dentista 16:30");
  evt(3, "Asado en casa de Fran");
  evt(7, "Cumpleaños Fran 🎂");
  evt(10, "Pago arriendo");
  evt(-2, "Entrega informe");

  /* -------- Finanzas, salud y rueda: cierre coherente del año -------- */
  S.finanzas.metaAnual = 4200000;
  S.finanzas.metaMensual = 350000;
  S.finanzas.porque = "El pie del departamento.";
  S.finanzas.gastos = [
    { id: uid(), nombre: "Arriendo", monto: 480000 }, { id: uid(), nombre: "Supermercado", monto: 260000 },
    { id: uid(), nombre: "Gimnasio", monto: 35000 }, { id: uid(), nombre: "Suscripciones", monto: 28000 },
    { id: uid(), nombre: "Transporte", monto: 65000 },
  ];
  S.salud.pesoObjetivo = 76;
  S.salud.meses[8].objetivo = "Cinco entrenamientos por semana";
  S.salud.meses[8].recetaNombre = "Pastel de choclo liviano";
  S.salud.meses[8].recetaHecha = true;
  S.rueda.meses[8] = [8, 9, 7, 6, 7, 8, 7, 6];

  /* -------- Recompensas -------- */
  S.gamif.puntos = 1840;
  S.gamif.xp = 7260;

  saveState();
  return {
    nombre: S.profile.name,
    racha: computeClosedStreak(),
    insights: computeInsights().map(i => i.text.replace(/<[^>]+>/g, "")),
  };
};
