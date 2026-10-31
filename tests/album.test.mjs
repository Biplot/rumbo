/* Tests del álbum del mes (album.js y albumMerge en store.js): la fusión entre equipos, la fecha de la foto
   (EXIF), las páginas, la portada y cuándo dan ⭐ */
export default async function ({ G, test, assert, clone }) {
  console.log("\nÁlbum del mes");
  const merge = G("albumMerge"), mergeStates = G("mergeStates"), exif = G("albumFechaExif"), paginas = G("albumPaginas");
  const fotos = G("albumFotos"), comentadas = G("albumComentadas"), premiable = G("albumPremiable"), mes = G("albumMes");
  const migrate = G("migrate"), defaultState = G("defaultState");
  const f = (id, ts, o = {}) => Object.assign({ id, ruta: "u/2026-10/" + id, comentario: "", fecha: "2026-10-18", ts }, o);

  test("un álbum nuevo: vacío y migrado en estados viejos", () => {
    const s = defaultState(); delete s.album; migrate(s);
    assert.deepEqual(clone(s.album), { meses: {} });
    const a = mes("2026-10", true, s);
    assert.equal(a.estilo, "clasico"); assert.deepEqual(clone(a.fotos), []); assert.equal(mes("2026-09", false, s), null);
  });

  test("dos equipos: se juntan las fotos, gana el comentario más nuevo y lo borrado no revive", () => {
    const tel = { meses: { "2026-10": { estilo: "bujo", portada: "a", ts: 20, fotos: [f("a", 5, { comentario: "viejo" }), f("b", 6)], borradas: ["c"] } } };
    const pc = { meses: { "2026-10": { estilo: "clasico", portada: "c", ts: 10, fotos: [f("c", 1), f("a", 9, { comentario: "nuevo" }), f("d", 7)], borradas: [] },
      "2026-09": { estilo: "clasico", portada: "x", ts: 3, fotos: [f("x", 3)], borradas: [] } } };
    const r = clone(merge(tel, pc)), o = r.meses["2026-10"];
    assert.deepEqual(o.fotos.map(x => x.id), ["a", "b", "d"], "c se borró en el teléfono: no vuelve");
    assert.equal(o.fotos[0].comentario, "nuevo", "gana el comentario con ts más nuevo");
    assert.equal(o.estilo, "bujo"); assert.equal(o.portada, "a"); assert.deepEqual(o.borradas, ["c"]);
    assert.equal(r.meses["2026-09"].fotos.length, 1, "un mes que solo está en un equipo se conserva");
    const s = mergeStates({ album: pc, gamif: {} }, { album: tel, gamif: {} });
    assert.deepEqual(clone(s.album.meses["2026-10"].fotos.map(x => x.id)), ["a", "b", "d"], "mergeStates usa la misma fusión");
  });

  // Un JPEG mínimo con EXIF: FFD8, APP1 "Exif", TIFF (II o MM), IFD0 → ExifIFD → DateTimeOriginal (0x9003)
  const jpeg = (le, fecha, tag = 0x9003) => {
    const tiff = [], u16 = n => le ? [n & 255, n >> 8] : [n >> 8, n & 255], u32 = n => le ? [n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24] : [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    tiff.push(...(le ? [0x49, 0x49] : [0x4D, 0x4D]), ...u16(42), ...u32(8));
    tiff.push(...u16(1), ...u16(0x8769), ...u16(4), ...u32(1), ...u32(26), ...u32(0));        // IFD0 (en 8): 1 entrada → ExifIFD en 26
    tiff.push(...u16(1), ...u16(tag), ...u16(2), ...u32(20), ...u32(44), ...u32(0));          // ExifIFD (en 26): la fecha en 44
    tiff.push(...[...fecha].map(c => c.charCodeAt(0)), 0);
    const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff], largo = app1.length + 2;
    return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1, largo >> 8, largo & 255, ...app1, 0xFF, 0xDA, 0, 2]).buffer;
  };
  test("la fecha de la foto: EXIF (Intel y Motorola), y sin EXIF no inventa", () => {
    assert.equal(exif(jpeg(true, "2026:10:18 17:42:05")), "2026-10-18");
    assert.equal(exif(jpeg(false, "2025:12:31 23:59:59")), "2025-12-31");
    assert.equal(exif(jpeg(true, "2026:10:18 17:42:05", 0x9004)), null, "otra etiqueta: sin fecha");
    assert.equal(exif(jpeg(true, "0000:00:00 00:00:00")), null, "una fecha en cero no sirve");
    assert.equal(exif(new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer), null, "un PNG: sin fecha");
    assert.equal(exif(new Uint8Array([0xFF, 0xD8, 0xFF, 0xDA, 0, 2]).buffer), null, "un JPEG sin EXIF");
  });

  test("las páginas: de a 3 (Película, de a 2), con la portada primero", () => {
    const a = { portada: "c", fotos: [f("a", 1, { comentario: "uno" }), f("b", 1), f("c", 1, { comentario: "tres" }), f("d", 1), f("e", 1)] };
    assert.deepEqual(clone(fotos(a).map(x => x.id)), ["c", "a", "b", "d", "e"]);
    assert.deepEqual(clone(paginas(fotos(a), 3).map(p => p.map(x => x.id))), [["c", "a", "b"], ["d", "e"]]);
    assert.equal(paginas(fotos(a), 2).length, 3);
    assert.equal(comentadas(a), 2);
    assert.deepEqual(clone(fotos({ portada: null, fotos: [f("a", 1)] }).map(x => x.id)), ["a"]);
  });

  test("el encuadre: sin tocar, como viene; con zoom y punto, object-position y scale desde ese punto", () => {
    const enc = G("albumEnc"), estilo = G("albumEncEstilo"), paso = G("albumEncPaso");
    assert.deepEqual(clone(enc({})), { x: 0.5, y: 0.5, z: 1 });
    assert.deepEqual(clone(enc({ encuadre: { x: "2", y: -1, z: 9 } })), { x: 1, y: 0, z: 4 }, "lo que llega se acota");
    assert.equal(estilo(enc({})), "");
    assert.equal(estilo({ x: 0.25, y: 0.5, z: 2 }), "object-position:25% 50%;transform-origin:25% 50%;transform:scale(2)");
    // arrastrar sigue al dedo: px que se corre la foto por cada unidad de x / y
    assert.deepEqual(clone(paso(400, 300, 800, 600, 1)), { x: 0, y: 0 }, "misma forma que el marco y sin zoom: no hay qué mover");
    assert.deepEqual(clone(paso(400, 300, 800, 600, 2)), { x: 400, y: 300 }, "con 2×, lo que agrega el zoom");
    const v = clone(paso(400, 300, 600, 800, 1));
    assert.equal(v.x, 0); assert.ok(Math.abs(v.y - 233.33) < 0.01, "una foto vertical en un marco apaisado: sobra alto");
  });
  test("dan ⭐ el mes en curso y el que se está cerrando; los meses viejos, no", () => {
    const hoy = new Date(2026, 10, 2);   // 2 de noviembre: se puede cerrar octubre
    assert.equal(premiable("2026-11", hoy), true); assert.equal(premiable("2026-10", hoy), true);
    assert.equal(premiable("2026-09", hoy), false);
    assert.equal(premiable("2025-12", new Date(2026, 0, 2)), true, "el 2 de enero, diciembre del año anterior");
  });
}
