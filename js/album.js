/* ============================================================
   RUMBO · Álbum del mes
   Como en un bullet journal: al cerrar el mes, las fotos de los mejores momentos (hasta 9),
   cada una con una línea. Un paso del cierre de mes (ritual-mes.js), el álbum para hojear y
   la estantería del año (en el Diario), y estilos que se compran en la Tienda (cosmeticos.js).
   · Lo que va en tu documento (STATE.album.meses["YYYY-MM"]): el estilo, la portada y cada
     foto con su comentario, su fecha y dónde está (ruta "<uid>/<YYYY-MM>/<id>"). La fusión
     entre equipos es albumMerge (store.js).
   · Las fotos: se achican en el teléfono (1600 px y una miniatura de 480 px, JPEG), quedan en
     este equipo (IndexedDB "rumbo_fotos") y se suben a tu carpeta privada de Supabase Storage
     (supabase/album.sql). Sin conexión, se suben solas después (albumSubirPendientes).
   · +30 ⭐ una vez por mes (ledger "album:<YYYY-MM>") al tener 3 fotos con comentario, solo en
     el mes en curso o el que se está cerrando: los álbumes de meses viejos no dan ⭐.
   ============================================================ */

const ALBUM_MAX = 9, ALBUM_COMENTARIO = 140, ALBUM_PREMIO = 30, ALBUM_PARA_PREMIO = 3;
/* Los estilos: Clásico viene con Rumbo; los otros se compran (cos: el id en COSMETICOS) */
const ALBUM_ESTILOS = [
  { id: "clasico", nombre: "Clásico", cos: null, porPagina: 3 },
  { id: "bujo", nombre: "Bullet journal", cos: "alb-bujo", porPagina: 3 },
  { id: "polaroid", nombre: "Polaroid", cos: "alb-polaroid", porPagina: 3 },
  { id: "pelicula", nombre: "Película", cos: "alb-pelicula", porPagina: 2 },
];
/* En memoria: las direcciones de las fotos (ruta → blob: o firmada), si el servidor todavía no tiene
   el álbum, si se está subiendo y la foto que se está editando */
const ALB = { urls: {}, sinServidor: false, subiendo: false, editar: null, fuentes: false };

/* -------- Datos -------- */
function albumMes(key, crear, S) {
  S = S || STATE;
  const al = S.album = S.album && typeof S.album === "object" ? S.album : { meses: {} };
  al.meses = al.meses && typeof al.meses === "object" ? al.meses : {};
  if (!al.meses[key] && crear) al.meses[key] = { estilo: "clasico", portada: null, ts: Date.now(), fotos: [], borradas: [] };
  const a = al.meses[key] || null;
  if (a) { if (!Array.isArray(a.fotos)) a.fotos = []; if (!Array.isArray(a.borradas)) a.borradas = []; }
  return a;
}
/* Las fotos en orden: la portada primero */
function albumFotos(a) {
  const fs = (a && a.fotos) || [], p = fs.find(f => f.id === a.portada);
  return p ? [p].concat(fs.filter(f => f !== p)) : fs.slice();
}
function albumComentadas(a) { return ((a && a.fotos) || []).filter(f => String(f.comentario || "").trim()).length; }
function albumEstiloTuyo(id) {
  const e = ALBUM_ESTILOS.find(x => x.id === id);
  return !!e && (!e.cos || (typeof isOwned === "function" && isOwned(e.cos)));
}
function albumEstilo(a) { const id = a && a.estilo; return albumEstiloTuyo(id) ? id : "clasico"; }
/* ¿Da ⭐? Solo el mes en curso y el anterior (el que se está cerrando) */
function albumPremiable(key, hoy) {
  hoy = hoy || new Date();
  const ahora = mesKey(hoy.getFullYear(), hoy.getMonth()), p = mesPrev(hoy.getFullYear(), hoy.getMonth());
  return key === ahora || key === mesKey(p.y, p.m);
}
function albumPremiado(key, S) { return ((S || STATE).gamif.ledger || []).some(x => x.id === "album:" + key && !x.anulado); }
/* +30 ⭐ la primera vez que el álbum del mes tiene 3 fotos con comentario */
function albumPremio(key) {
  const a = albumMes(key);
  if (!a || albumComentadas(a) < ALBUM_PARA_PREMIO || !albumPremiable(key) || albumPremiado(key)) return false;
  const { m } = mesDeKey(key);
  return registrarMovimiento("album:" + key, ALBUM_PREMIO, ALBUM_PREMIO, "Álbum de " + MESES[m].toLowerCase());
}
/* Las páginas: de a 3 fotos (Película, de a 2) */
function albumPaginas(fotos, porPagina) {
  const out = [];
  for (let i = 0; i < fotos.length; i += porPagina) out.push(fotos.slice(i, i + porPagina));
  return out;
}
function albumFechaTxt(iso) { if (!iso) return ""; const d = agDate(iso); return `${d.getDate()} ${MESES_CORTO[d.getMonth()].toLowerCase()}`; }
function albumFechaLarga(iso) {
  if (!iso) return "";
  const d = agDate(iso), s = d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -------- La fecha de la foto (EXIF: DateTimeOriginal, o DateTime) -------- */
function albumFechaExif(buf) {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let p = 2;
    while (p + 4 <= v.byteLength) {
      const marca = v.getUint16(p), largo = v.getUint16(p + 2);
      if ((marca & 0xFF00) !== 0xFF00) return null;
      if (marca === 0xFFE1 && v.getUint32(p + 4) === 0x45786966) {   // "Exif"
        const t = p + 10, le = v.getUint16(t) === 0x4949;
        const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
        const leer = (ifd, tag) => {
          const n = u16(ifd);
          for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (u16(e) === tag) return { tipo: u16(e + 2), cuenta: u32(e + 4), valor: u32(e + 8) };
          }
          return null;
        };
        const texto = ent => { let s = ""; for (let i = 0; i < Math.min(ent.cuenta, 32); i++) { const c = v.getUint8(t + ent.valor + i); if (!c) break; s += String.fromCharCode(c); } return s; };
        const ifd0 = u32(4), exif = leer(ifd0, 0x8769);
        const ent = (exif && leer(exif.valor, 0x9003)) || leer(ifd0, 0x0132);
        const m = ent && ent.tipo === 2 && /^(\d{4}):(\d{2}):(\d{2})/.exec(texto(ent));
        return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if (marca === 0xFFDA) return null;   // empezó la imagen: no hay EXIF
      p += 2 + largo;
    }
  } catch (e) { /* una foto rara: sin fecha */ }
  return null;
}

/* -------- Achicar la foto en el teléfono -------- */
async function albumImagen(file) {
  if (typeof createImageBitmap === "function") { try { return await createImageBitmap(file); } catch (e) { /* abajo, con <img> */ } }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagen")); };
    img.src = url;
  });
}
function albumAchicar(img, max, calidad) {
  const w0 = img.width, h0 = img.height, k = Math.min(1, max / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h);
  return new Promise((res, rej) => cv.toBlob(b => (b ? res({ blob: b, w, h }) : rej(new Error("jpeg"))), "image/jpeg", calidad));
}
async function albumPreparar(file) {
  const [buf, img] = await Promise.all([file.slice(0, 256 * 1024).arrayBuffer(), albumImagen(file)]);
  const full = await albumAchicar(img, 1600, 0.82), mini = await albumAchicar(img, 480, 0.76);
  if (img.close) img.close();
  const exif = albumFechaExif(buf);
  return { full: full.blob, mini: mini.blob, w: full.w, h: full.h, fecha: exif || (file.lastModified ? isoLocal(new Date(file.lastModified)) : ""), deFoto: !!exif };
}

/* -------- Las fotos en este equipo (IndexedDB): { full, mini, pendiente, uid } por ruta; y lo que falta borrar -------- */
const FOTOS_DB = {
  _db: null,
  abrir() {
    if (!this._db) {
      this._db = new Promise((res, rej) => {
        if (typeof indexedDB === "undefined") return rej(new Error("sin-indexeddb"));
        const r = indexedDB.open("rumbo_fotos", 1);
        r.onupgradeneeded = () => { const db = r.result; ["fotos", "borrar"].forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
      this._db.catch(() => { this._db = null; });
    }
    return this._db;
  },
  async _tx(store, modo, fn) {
    const db = await this.abrir();
    return new Promise((res, rej) => {
      const t = db.transaction(store, modo), r = fn(t.objectStore(store));
      t.oncomplete = () => res(r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(k, store = "fotos") { return this._tx(store, "readonly", s => s.get(k)).catch(() => null); },
  put(k, v, store = "fotos") { return this._tx(store, "readwrite", s => s.put(v, k)); },
  del(k, store = "fotos") { return this._tx(store, "readwrite", s => s.delete(k)).catch(() => {}); },
  async lista(store = "fotos") {
    try {
      const db = await this.abrir();
      return await new Promise((res, rej) => {
        const out = [], r = db.transaction(store, "readonly").objectStore(store).openCursor();
        r.onsuccess = () => { const c = r.result; if (c) { out.push({ k: c.key, v: c.value }); c.continue(); } else res(out); };
        r.onerror = () => rej(r.error);
      });
    } catch (e) { return []; }
  },
};

/* -------- Subir lo que falta (al entrar, al volver la conexión y al agregar fotos) -------- */
async function albumSubirPendientes() {
  if (ALB.subiendo || !CURRENT_USER || !BACKEND.albumSubir) return;
  ALB.subiendo = true;
  try {
    const uid = CURRENT_USER.id;
    for (const { k, v } of await FOTOS_DB.lista("fotos")) {
      if (!v || !v.pendiente || v.uid !== uid) continue;
      const a = await BACKEND.albumSubir(k + ".jpg", v.full), b = a.error ? a : await BACKEND.albumSubir(k + "-m.jpg", v.mini);
      if (b.error) { if (b.error === "sin-servidor") ALB.sinServidor = true; break; }
      ALB.sinServidor = false;
      await FOTOS_DB.put(k, Object.assign({}, v, { pendiente: false }));
    }
    for (const { k, v } of await FOTOS_DB.lista("borrar")) {
      if (!v || v.uid !== uid) continue;
      const r = await BACKEND.albumBorrar([k + ".jpg", k + "-m.jpg"]);
      if (r && r.error) break;
      await FOTOS_DB.del(k, "borrar");
    }
  } catch (e) { /* se intenta de nuevo la próxima vez */ }
  finally { ALB.subiendo = false; }
}
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", () => { if (CURRENT_USER && STATE) albumSubirPendientes(); });
/* Al salir de la cuenta: se sueltan las direcciones (las fotos siguen en este equipo, a nombre de su dueño) */
function albumOlvidar() {
  Object.values(ALB.urls).forEach(u => { if (u && u.url && u.url.startsWith("blob:")) { try { URL.revokeObjectURL(u.url); } catch (e) {} } });
  Object.assign(ALB, { urls: {}, sinServidor: false, editar: null });
}

/* -------- Mostrar las fotos: <img data-foto="ruta" data-mini> se llenan solas (de este equipo o firmadas) -------- */
async function albumPintar(raiz) {
  raiz = raiz || document;
  const imgs = [...raiz.querySelectorAll("img[data-foto]:not([data-ok])")];
  if (!imgs.length) return;
  const falta = [], ahora = Date.now();
  for (const img of imgs) {
    img.dataset.ok = "1";
    const k = img.dataset.foto + (img.dataset.mini ? "-m" : ""), u = ALB.urls[k];
    if (u && (!u.hasta || u.hasta > ahora)) { img.src = u.url; continue; }
    const loc = await FOTOS_DB.get(img.dataset.foto), blob = loc && (img.dataset.mini ? loc.mini : loc.full);
    if (blob) { ALB.urls[k] = { url: URL.createObjectURL(blob) }; img.src = ALB.urls[k].url; continue; }
    falta.push([img, k]);
  }
  if (!falta.length || !BACKEND.albumUrls) return;
  const r = await BACKEND.albumUrls([...new Set(falta.map(x => x[1] + ".jpg"))]);
  falta.forEach(([img, k]) => {
    const url = r && !r.error && r[k + ".jpg"];
    if (url) { ALB.urls[k] = { url, hasta: ahora + 50 * 60000 }; img.src = url; } else img.classList.add("is-sin");
  });
}
if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  let t = null;
  new MutationObserver(() => {
    if (t) return;
    t = setTimeout(() => { t = null; if (STATE && document.querySelector("img[data-foto]:not([data-ok])")) albumPintar(); }, 30);
  }).observe(document.documentElement, { childList: true, subtree: true });
}
function albumImg(f, mini, cls) { return `<img class="${cls || "ft"}" data-foto="${escapeHtml(f.ruta)}"${mini ? " data-mini=\"1\"" : ""} alt="" loading="lazy">`; }
/* Las letras de los estilos (a mano y a máquina): se piden la primera vez que se ve un álbum */
function albumFuentes() {
  if (ALB.fuentes || typeof document === "undefined") return;
  ALB.fuentes = true;
  const l = document.createElement("link"); l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Special+Elite&display=swap";
  document.head.appendChild(l);
}

/* -------- Agregar, comentar, portada, quitar -------- */
async function albumAgregar(key, input, desde) {
  const files = [...((input && input.files) || [])].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || ""));
  if (input) input.value = "";
  if (!files.length || !CURRENT_USER) return;
  const a = albumMes(key, true), libres = ALBUM_MAX - a.fotos.length;
  if (libres <= 0) return toast(`El álbum tiene hasta ${ALBUM_MAX} fotos. Quita una para poner otra.`, true);
  if (files.length > libres) toast(`Caben ${libres} más: el álbum tiene hasta ${ALBUM_MAX} fotos`, true);
  let listas = [];
  for (const f of files.slice(0, libres)) { try { listas.push(await albumPreparar(f)); } catch (e) { /* esa no se pudo abrir */ } }
  if (!listas.length) return toast("No pude abrir esas fotos. Prueba con fotos JPG o PNG.", true);
  const { m } = mesDeKey(key), otro = listas.filter(p => p.deFoto && p.fecha && p.fecha.slice(0, 7) !== key);
  if (otro.length && !confirm(otro.length === 1
    ? `Esta foto es del ${albumFechaLarga(otro[0].fecha).toLowerCase()}. ¿La pones igual en el álbum de ${MESES[m].toLowerCase()}?`
    : `${otro.length} fotos son de otro mes. ¿Las pones igual en el álbum de ${MESES[m].toLowerCase()}?`)) listas = listas.filter(p => !otro.includes(p));
  if (!listas.length) return albumVolver(key, desde);
  const uid = CURRENT_USER.id, ahora = Date.now();
  for (const p of listas) {
    const id = "f" + ahora.toString(36) + Math.random().toString(36).slice(2, 7), ruta = `${uid}/${key}/${id}`;
    try { await FOTOS_DB.put(ruta, { full: p.full, mini: p.mini, pendiente: true, uid }); }
    catch (e) { toast("No pude guardar la foto en este equipo.", true); break; }
    a.fotos.push({ id, ruta, comentario: "", fecha: p.fecha || "", w: p.w, h: p.h, ts: ahora });
  }
  if (!a.portada && a.fotos.length) a.portada = a.fotos[0].id;
  a.ts = ahora; saveState();
  albumSubirPendientes();
  vibrar(10);
  albumVolver(key, desde);
}
/* Vuelve a donde estabas: el paso del cierre de mes, el álbum o la pantalla */
function albumVolver(key, desde) {
  ALB.editar = null;
  if (desde === "wiz" && typeof MES_WIZ !== "undefined" && MES_WIZ) return renderMesWiz();
  if (desde === "album") return openAlbum(key);
  closeModal(); rerender();
}
function albumGuardarComentario() {
  const e = ALB.editar; if (!e) return;
  const a = albumMes(e.key), f = a && a.fotos.find(x => x.id === e.id), t = document.getElementById("alb-com");
  if (!f || !t) return;
  const c = t.value.trim().slice(0, ALBUM_COMENTARIO);
  if (c !== (f.comentario || "")) { f.comentario = c; f.ts = Date.now(); saveState(); }
}
function albumListo() {
  const e = ALB.editar; if (!e) return;
  albumGuardarComentario();
  if (albumPremio(e.key)) toast(`📷 +${ALBUM_PREMIO} ⭐ por tu álbum de ${MESES[mesDeKey(e.key).m].toLowerCase()}`);
  albumVolver(e.key, e.desde);
}
function albumPortada() {
  const e = ALB.editar; if (!e) return;
  albumGuardarComentario();
  const a = albumMes(e.key); if (!a) return;
  a.portada = e.id; a.ts = Date.now(); saveState();
  openAlbumFoto(e.key, e.id, e.desde);
}
async function albumQuitar() {
  const e = ALB.editar; if (!e) return;
  if (!confirm("¿Quitar esta foto del álbum? Se borra de verdad.")) return;
  const a = albumMes(e.key), f = a && a.fotos.find(x => x.id === e.id); if (!f) return;
  a.fotos = a.fotos.filter(x => x !== f);
  if (!a.borradas.includes(f.id)) a.borradas.push(f.id);
  if (a.portada === f.id) a.portada = a.fotos.length ? a.fotos[0].id : null;
  a.ts = Date.now(); saveState();
  await FOTOS_DB.del(f.ruta);
  const r = BACKEND.albumBorrar ? await BACKEND.albumBorrar([f.ruta + ".jpg", f.ruta + "-m.jpg"]) : { ok: true };
  if (r && r.error) { try { await FOTOS_DB.put(f.ruta, { uid: CURRENT_USER.id }, "borrar"); } catch (x) {} }
  toast("Foto quitada");
  albumVolver(e.key, e.desde);
}
function albumEstiloElegir(key, id, desde) {
  if (!albumEstiloTuyo(id)) return;
  const a = albumMes(key, true); a.estilo = id; a.ts = Date.now(); saveState();
  if (desde === "wiz" && typeof MES_WIZ !== "undefined" && MES_WIZ) return renderMesWiz();
  openAlbum(key);
}

/* -------- Ideas para tus fotos: lo que pasó en el mes -------- */
function albumIdeas(y, m, mejor) {
  const key = mesKey(y, m), out = [];
  if (mejor) out.push(["sparkles", "Lo mejor: " + (mejor.length > 34 ? mejor.slice(0, 33) + "…" : mejor)]);
  if (typeof PLAN !== "undefined" && PLAN.lista) {
    PLAN.lista.filter(p => plVa(p) && p.fecha && p.fecha.startsWith(key))
      .map(p => ({ p, r: plMiRecuerdo(p) })).sort((a, b) => ((b.r && b.r.estrellas) || 0) - ((a.r && a.r.estrellas) || 0)).slice(0, 1)
      .forEach(({ p, r }) => out.push(["ticket", `«${p.titulo}»${r ? " · " + r.estrellas + " ★" : ""}`]));
  }
  const dias = daysInMonth(y, m), habs = (STATE.habitos.defs || []).map(h => {
    let n = 0; for (let d = 1; d <= dias; d++) if (hmDone(h, `${key}-${String(d).padStart(2, "0")}`)) n++;
    return { h, n };
  }).filter(x => x.n >= 5).sort((a, b) => b.n - a.n);
  if (habs[0]) out.push(["hecho", `${habs[0].h.nombre}: ${habs[0].n} días`]);
  (STATE.lecturas || []).filter(l => l.estado === "terminado" && String(l.fin || "").startsWith(key)).slice(0, 1)
    .forEach(l => out.push(["book-open", `Terminaste «${l.titulo}»`]));
  ((typeof datosAnio === "function" ? datosAnio(STATE, y).metas.mensuales[m] : []) || []).filter(o => o.done).slice(0, 1)
    .forEach(o => out.push(["mision", `Cumpliste «${o.texto}»`]));
  let mejorDia = null;
  (STATE.vida.diario || []).forEach(e => { if (e.mood && e.fecha && e.fecha.startsWith(key) && (!mejorDia || e.mood > mejorDia.mood)) mejorDia = e; });
  if (mejorDia && mejorDia.mood >= 4) out.push(["sol", "Tu mejor día: " + albumFechaTxt(mejorDia.fecha)]);
  return out.slice(0, 4);
}

/* -------- Dibujo: las páginas de cada estilo (todo escala con el ancho de la página) -------- */
function albumCap(x, cls) { return `<figcaption class="${cls || ""}">${escapeHtml(x.comentario || "")}</figcaption>`; }
const ALBUM_PAGINA = {
  clasico(items, o) {
    const [a, ...r] = items, fig = (x, cls) => `<figure class="${cls}">${x.img}<figcaption>${x.fecha ? `<i>${x.fecha}</i>` : ""}${escapeHtml(x.comentario || "")}</figcaption></figure>`;
    return `<div class="alb__in alb--clasico"><div class="ac-cab"><b>${o.primera ? o.mes : o.mes + " · " + o.n}</b><span>${o.anio}</span></div>
      ${a ? fig(a, "ac-g") : ""}${r.length ? `<div class="ac-2">${r.map(x => fig(x, "")).join("")}</div>` : ""}</div>`;
  },
  bujo(items, o) {
    const fila = (x, i) => `<div class="bj-f${i % 2 ? " bj-f--inv" : ""}"><figure class="bj-foto" style="--r:${["-2deg", "3deg", "-1deg"][i % 3]}">${x.img}<span class="washi w${i % 3 + 1}"></span></figure>
      <p>${escapeHtml(x.comentario || "")}${x.fecha ? `<em>${x.fecha}</em>` : ""}</p></div>`;
    return `<div class="alb__in alb--bujo"><div class="bj-cab"><b>${o.mes}</b><span>${o.primera ? "lo mejor del mes" : o.n}</span></div>${items.map(fila).join("")}</div>`;
  },
  polaroid(items, o) {
    const pos = [["5%", "7%", "-5deg", "52%"], ["52%", "33%", "4deg", "44%"], ["6%", "58%", "-2deg", "50%"]];
    return `<div class="alb__in alb--polaroid"><span class="po-tit">${o.mes.toLowerCase()} ’${String(o.anio).slice(2)}</span>
      ${items.map((x, i) => { const [l, t, r, w] = pos[i]; return `<figure class="pol" style="left:${l};top:${t};--r:${r};width:${w}">${x.img}${albumCap(x)}</figure>`; }).join("")}</div>`;
  },
  pelicula(items, o) {
    return `<div class="alb__in alb--pelicula"><span class="pe-tit">${o.mes.toUpperCase()} · ${o.anio} · RUMBO 400</span>
      ${items.map((x, i) => `<figure class="pe-f">${x.img}<figcaption><b>${o.cuadro + i}A</b>${escapeHtml(x.comentario || "")}</figcaption></figure>`).join("")}</div>`;
  },
};
/* Una página: items = [{ img, comentario, fecha }] */
function albumPaginaHtml(estilo, items, o) {
  const fn = ALBUM_PAGINA[estilo] || ALBUM_PAGINA.clasico;
  return `<div class="alb">${fn(items, o)}</div>`;
}
function albumPaginasHtml(key) {
  const a = albumMes(key); if (!a) return "";
  const { y, m } = mesDeKey(key), estilo = albumEstilo(a), e = ALBUM_ESTILOS.find(x => x.id === estilo);
  const pags = albumPaginas(albumFotos(a), e.porPagina);
  return pags.map((p, i) => albumPaginaHtml(estilo, p.map(f => ({ img: albumImg(f), comentario: f.comentario, fecha: albumFechaTxt(f.fecha) })),
    { mes: MESES[m], anio: y, primera: i === 0, n: `${i + 1} de ${pags.length}`, cuadro: 12 + i * e.porPagina })).join("");
}
/* Muestras dibujadas (para la Tienda, sin fotos tuyas) */
let ALBUM_MUESTRA_N = 0;
function albumMuestraSvg(n) {
  const k = "am" + (++ALBUM_MUESTRA_N);
  const S = [
    `<defs><linearGradient id="${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F9B26B"/><stop offset=".55" stop-color="#EE6F7E"/><stop offset="1" stop-color="#7D4F9E"/></linearGradient></defs><rect width="120" height="90" fill="url(#${k})"/><circle cx="80" cy="44" r="12" fill="#FFE6AE"/><path d="M0 60 L20 43 L38 55 L60 34 L83 53 L101 42 L120 54 V90 H0Z" fill="#553A7C"/><path d="M0 71 L17 61 L37 69 L58 57 L81 69 L103 60 L120 66 V90 H0Z" fill="#33264F"/>`,
    `<rect width="120" height="90" fill="#FFC9A6"/><rect y="70" width="120" height="20" fill="#B9774A"/><rect x="34" y="50" width="52" height="22" rx="3" fill="#F7F0F4"/><rect x="34" y="50" width="52" height="7" rx="3" fill="#F28CB0"/><rect x="40" y="36" width="40" height="16" rx="3" fill="#FCE7EF"/><rect x="49" y="26" width="2.4" height="11" fill="#6E7FE0"/><rect x="59" y="24" width="2.4" height="13" fill="#F4AE3D"/><rect x="69" y="26" width="2.4" height="11" fill="#2F9E74"/><ellipse cx="50.2" cy="23.5" rx="1.8" ry="3" fill="#FFC94D"/><ellipse cx="60.2" cy="21.5" rx="1.8" ry="3" fill="#FFC94D"/><ellipse cx="70.2" cy="23.5" rx="1.8" ry="3" fill="#FFC94D"/>`,
    `<rect width="120" height="90" fill="#BFE2D2"/><rect x="8" y="44" width="104" height="38" rx="9" fill="#6C7FD8"/><ellipse cx="44" cy="44" rx="7" ry="13" transform="rotate(20 44 44)" fill="#8A5A2B"/><ellipse cx="76" cy="44" rx="7" ry="13" transform="rotate(-20 76 44)" fill="#8A5A2B"/><circle cx="60" cy="50" r="17" fill="#C98A4B"/><ellipse cx="60" cy="58" rx="9.5" ry="7" fill="#F1D3B0"/><ellipse cx="60" cy="54.5" rx="3.6" ry="2.6" fill="#2A1E14"/><circle cx="53" cy="46" r="2.2" fill="#2A1E14"/><circle cx="67" cy="46" r="2.2" fill="#2A1E14"/>`,
  ];
  return `<svg class="ft" viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${S[n % 3]}</svg>`;
}
function albumMuestraHtml(estilo) {
  albumFuentes();
  const items = [["10 km sin parar, y este atardecer.", "18 oct"], ["El cumpleaños de Ana bajo la lluvia.", "24 oct"], ["Llegó Canela.", "9 oct"]]
    .slice(0, (ALBUM_ESTILOS.find(e => e.id === estilo) || {}).porPagina || 3)
    .map(([comentario, fecha], i) => ({ img: albumMuestraSvg(i), comentario, fecha }));
  return albumPaginaHtml(estilo, items, { mes: "Octubre", anio: 2026, primera: true, n: "", cuadro: 12 });
}

/* La grilla de fotos (en el paso del cierre y en el álbum): miniaturas y «Agregar» */
function albumGridHtml(key, desde) {
  const a = albumMes(key), fotos = a ? albumFotos(a) : [], k = escapeHtml(key);
  return `<div class="alb-grid">${fotos.map(f => `<button type="button" class="alb-t${f.id === a.portada ? " is-portada" : ""}" data-action="alb-foto" data-key="${k}" data-id="${escapeHtml(f.id)}" data-desde="${desde}"
      aria-label="${escapeHtml(f.comentario || "Foto sin comentario")}">${albumImg(f, true)}${f.id === a.portada ? `<b>${icoUI("estrella")} Portada</b>` : ""}
      <i class="${String(f.comentario || "").trim() ? "is-ok" : ""}" title="${String(f.comentario || "").trim() ? "Tiene comentario" : "Falta el comentario"}">${icoUI(String(f.comentario || "").trim() ? "hecho" : "pencil")}</i></button>`).join("")}
    ${fotos.length < ALBUM_MAX ? `<label class="alb-t alb-t--mas">${icoUI("plus")}<small>Agregar</small>
      <input type="file" accept="image/*" multiple hidden onchange="albumAgregar('${k}', this, '${desde}')"></label>` : ""}</div>`;
}
function albumEstilosHtml(key, desde) {
  const a = albumMes(key), actual = albumEstilo(a), k = escapeHtml(key);
  const tuyos = ALBUM_ESTILOS.filter(e => albumEstiloTuyo(e.id)), faltan = ALBUM_ESTILOS.length - tuyos.length;
  return `<div class="alb-estilos"><span class="text-xs muted">Estilo</span>${tuyos.map(e => `<button type="button" class="chip${e.id === actual ? " chip--cian" : ""}" data-action="alb-estilo" data-key="${k}" data-v="${e.id}" data-desde="${desde}">${e.nombre}</button>`).join("")}
    ${faltan ? `<button type="button" class="btn-link" data-action="alb-tienda">${faltan === 1 ? "1 estilo más" : faltan + " estilos más"} en la Tienda</button>` : ""}</div>`;
}
function albumAvisoServidor() {
  return ALB.sinServidor ? `<p class="alb-aviso">${icoUI("cloud")} Tus fotos quedan en este equipo hasta que el álbum se active en el servidor.</p>` : "";
}

/* El paso del cierre de mes («Álbum del mes») */
function albumPasoHtml(w) {
  albumFuentes();
  const a = albumMes(w.key), n = a ? a.fotos.length : 0, com = albumComentadas(a);
  const premio = albumPremiable(w.key) ? (albumPremiado(w.key) ? `<span class="alb-premio is-ok">${icoUI("hecho")} +${ALBUM_PREMIO} ⭐ por tu álbum</span>`
    : `<span class="alb-premio">Con ${ALBUM_PARA_PREMIO} fotos comentadas: +${ALBUM_PREMIO} ⭐ · llevas ${com}</span>`) : "";
  const ideas = albumIdeas(w.y, w.m, w.draft && w.draft.mejor);
  return `<div class="alb-paso">
    <p class="text-sm muted" style="margin:0">Hasta ${ALBUM_MAX} fotos de los mejores momentos de ${MESES[w.m].toLowerCase()}, con una línea para cada una. Si este mes no quieres, toca «Siguiente».</p>
    ${albumGridHtml(w.key, "wiz")}
    <div class="alb-paso__est">${n ? `${n} de ${ALBUM_MAX} · ${com === n ? "todas con comentario" : com + " con comentario"}` : ""}${premio}</div>
    ${n ? albumEstilosHtml(w.key, "wiz") : ""}
    ${ideas.length ? `<div class="alb-ideas"><span class="cj-sub">Ideas para tus fotos</span><div>${ideas.map(([i, t]) => `<span>${icoUI(i)} ${escapeHtml(t)}</span>`).join("")}</div></div>` : ""}
    ${albumAvisoServidor()}</div>`;
}
/* Una foto: verla grande, su fecha y su comentario; portada o quitarla */
function openAlbumFoto(key, id, desde) {
  const a = albumMes(key), fotos = a ? albumFotos(a) : [], f = fotos.find(x => x.id === id); if (!f) return;
  if (typeof MES_WIZ !== "undefined" && MES_WIZ && desde === "wiz") mesWizLeer();
  ALB.editar = { key, id, desde };
  const n = (f.comentario || "").length, portada = a.portada === f.id;
  openModal(`Foto ${fotos.indexOf(f) + 1} de ${fotos.length}`, `<div class="alb-ed">
    <div class="alb-ed__foto">${albumImg(f, false)}</div>
    ${f.fecha ? `<div class="alb-ed__fecha">${icoUI("camera")} ${escapeHtml(albumFechaLarga(f.fecha))}</div>` : ""}
    <div class="field" style="margin:0"><label for="alb-com">¿Qué pasó aquí?</label>
      <textarea class="input" id="alb-com" maxlength="${ALBUM_COMENTARIO}" rows="3" placeholder="Ej: El cumpleaños de Ana: llovió y lo celebramos igual en la terraza." oninput="albumContar(this)">${escapeHtml(f.comentario || "")}</textarea>
      <span class="alb-ed__n" id="alb-com-n">${n} / ${ALBUM_COMENTARIO}</span></div>
    <div class="alb-ed__acc"><button class="btn btn--soft${portada ? " is-on" : ""}" data-action="alb-portada" ${portada ? "disabled" : ""}>${icoUI("estrella")} ${portada ? "Es la portada" : "Portada"}</button>
      <button class="btn-ghost" data-action="alb-quitar">${icoUI("trash-2")} Quitar</button>
      <button class="btn btn--primary" data-action="alb-listo">Listo</button></div></div>`);
  setTimeout(() => { const t = document.getElementById("alb-com"); if (t && !t.value) t.focus(); }, 80);
}
function albumContar(t) { const n = document.getElementById("alb-com-n"); if (n) n.textContent = `${t.value.length} / ${ALBUM_COMENTARIO}`; }
/* El álbum de un mes: sus páginas, el estilo y las fotos para editar */
function openAlbum(key) {
  albumFuentes();
  const { y, m } = mesDeKey(key), a = albumMes(key), fotos = a ? albumFotos(a) : [];
  ALB.editar = null;
  openModal(`Álbum de ${nombreMes(y, m).toLowerCase()}`, `<div class="alb-ver">
    ${fotos.length ? `${albumEstilosHtml(key, "album")}<div class="alb-paginas">${albumPaginasHtml(key)}</div>`
      : `<p class="text-sm muted" style="margin:0">Las fotos de los mejores momentos de ${MESES[m].toLowerCase()}, con una línea para cada una. Agrega la primera.</p>`}
    <div class="cj-sub">Fotos · ${fotos.length} de ${ALBUM_MAX}</div>
    ${albumGridHtml(key, "album")}
    ${albumAvisoServidor()}
    <div class="row-wrap" style="gap:8px"><button class="btn-ghost" data-action="alb-estante" data-y="${y}">${icoUI("library")} Tus álbumes</button></div></div>`, { ancho: true });
}
/* La estantería: un año, la portada de cada mes */
function openAlbumes(y) {
  albumFuentes();
  const ahora = new Date(), hoyKey = mesKey(ahora.getFullYear(), ahora.getMonth()), meses = (STATE.album && STATE.album.meses) || {};
  y = +y || ahora.getFullYear();
  const anios = [...new Set([ahora.getFullYear(), y, ...Object.keys(meses).filter(k => (meses[k].fotos || []).length).map(k => +k.slice(0, 4))])].sort();
  let total = 0;
  const tapas = MESES.map((nom, i) => {
    const key = mesKey(y, i), a = meses[key], fs = a ? albumFotos(a) : [], futuro = key > hoyKey;
    total += fs.length;
    if (futuro) return `<span class="alb-tapa is-vacia"><b>${MESES_CORTO[i]}</b></span>`;
    if (!fs.length) return `<button type="button" class="alb-tapa is-vacia" data-action="alb-ver" data-key="${key}"><b>${MESES_CORTO[i]}</b><i>${key === hoyKey ? "Al cerrar" : "Armar"}</i></button>`;
    return `<button type="button" class="alb-tapa alb-tapa--${albumEstilo(a)}" data-action="alb-ver" data-key="${key}">${albumImg(fs[0], true)}<b>${MESES_CORTO[i]}</b><i>${fs.length === 1 ? "1 foto" : fs.length + " fotos"}</i></button>`;
  }).join("");
  openModal("Tus álbumes", `<div class="alb-est">
    ${anios.length > 1 ? `<div class="seg">${anios.map(a => `<button type="button" class="${a === y ? "is-active" : ""}" data-action="alb-estante" data-y="${a}">${a}</button>`).join("")}</div>` : ""}
    <div class="alb-est__g">${tapas}</div>
    <p class="alb-est__t">${icoUI("camera")} ${total === 1 ? "1 momento" : total + " momentos"} en ${y}</p></div>`);
}
/* Diario: el álbum del mes que estás mirando */
function albumDiarioHtml(key) {
  if (!STATE) return "";
  const ahora = new Date(); if (key > mesKey(ahora.getFullYear(), ahora.getMonth())) return "";
  const a = albumMes(key), fs = a ? albumFotos(a) : [], { m } = mesDeKey(key);
  const hay = Object.values((STATE.album && STATE.album.meses) || {}).some(x => (x.fotos || []).length);
  if (!fs.length) return `<div class="card alb-diario alb-diario--vacio"><span>${icoUI("camera")}</span><div><b>Álbum de ${MESES[m].toLowerCase()}</b>
      <span class="text-xs muted">Las fotos de los mejores momentos, con una línea cada una.</span></div>
    <div class="alb-diario__b"><button class="btn btn--soft" data-action="alb-ver" data-key="${key}">${icoUI("plus")} Fotos</button>${hay ? `<button class="btn-ghost" data-action="alb-estante" data-y="${key.slice(0, 4)}">Tus álbumes</button>` : ""}</div></div>`;
  return `<div class="card alb-diario"><button type="button" class="alb-diario__fotos" data-action="alb-ver" data-key="${key}" aria-label="Ver el álbum de ${MESES[m].toLowerCase()}">
      ${fs.slice(0, 4).map(f => albumImg(f, true)).join("")}</button>
    <div class="alb-diario__t"><b>Álbum de ${MESES[m].toLowerCase()}</b><span class="text-xs muted">${fs.length === 1 ? "1 foto" : fs.length + " fotos"}${fs[0].comentario ? " · «" + escapeHtml(fs[0].comentario.slice(0, 60)) + (fs[0].comentario.length > 60 ? "…" : "") + "»" : ""}</span></div>
    <div class="alb-diario__b"><button class="btn btn--soft" data-action="alb-ver" data-key="${key}">Ver álbum</button><button class="btn-ghost" data-action="alb-estante" data-y="${key.slice(0, 4)}">Tus álbumes</button></div></div>`;
}
/* Ritual › Mes: la miniatura de la portada en «Meses anteriores» */
function albumMiniHtml(key) {
  const a = STATE && albumMes(key), f = a && albumFotos(a)[0];
  return f ? `<button type="button" class="alb-mini" data-action="alb-ver" data-key="${escapeHtml(key)}" aria-label="Ver el álbum">${albumImg(f, true)}</button>` : "";
}

/* -------- Acciones (data-action="alb-…", ver onClick en app.js) -------- */
function albumAccion(a, d) {
  if (a === "alb-foto") return openAlbumFoto(d.key, d.id, d.desde);
  if (a === "alb-listo") return albumListo();
  if (a === "alb-portada") return albumPortada();
  if (a === "alb-quitar") return albumQuitar();
  if (a === "alb-estilo") return albumEstiloElegir(d.key, d.v, d.desde);
  if (a === "alb-ver") { if (typeof MES_WIZ !== "undefined") MES_WIZ = null; return openAlbum(d.key); }
  if (a === "alb-estante") return openAlbumes(d.y);
  if (a === "alb-tienda") { closeModal(); if (typeof MES_WIZ !== "undefined") MES_WIZ = null; return go("recompensas"); }
}
