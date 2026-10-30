/* Tests de Íconos Norte (iconos.js): los emojis de la interfaz pasan a íconos; lo que escribes tú, no */
import fs from "fs";
import path from "path";
import vm from "vm";
export default async function ({ G, test, assert }) {
  console.log("\nÍconos Norte");
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const leer = f => fs.readFileSync(path.join(root, f), "utf8");
  // Lo justo para iconos.js: los íconos del menú y escapeHtml (que viven en navegacion.js y app.js, con el DOM)
  const ctx = vm.createContext({});
  vm.runInContext(leer("js/navegacion.js").match(/const ICONOS_LINEA = \{[\s\S]*?\n\};/)[0], ctx);
  vm.runInContext(leer("js/app.js").match(/function escapeHtml\(s\) \{.*\}/)[0], ctx);
  vm.runInContext(leer("js/iconos.js"), ctx);
  const I = n => vm.runInContext(n, ctx);
  const iconizar = I("iconizar"), iconizarTexto = I("iconizarTexto"), icoUI = I("icoUI"), EMOJI_UI = I("EMOJI_UI"), escapeHtml = I("escapeHtml");
  const sinSvg = h => h.replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, m => `[${(m.match(/ico-(moneda|racha)/) || ["", "ico"])[1]}]`);

  test("cada emoji de la interfaz tiene su dibujo (del menú, de Lucide o propio)", () => {
    const sin = Object.keys(EMOJI_UI).filter(e => !icoUI(EMOJI_UI[e]));
    assert.deepEqual(sin, []);
    ["bocado", "elefante", "moneda"].forEach(n => assert.ok(icoUI(n).startsWith('<svg class="ico-n'), n));
  });

  test("iconizar: el texto de la app pasa a íconos; la estrella es la moneda y la llama, la racha", () => {
    const h = iconizar(`<h2>🧭 Abre el trimestre</h2><span>600 ⭐</span><b>🔥 3 días</b><button>⚡️ Express</button>`);
    assert.equal(sinSvg(h), `<h2>[ico] Abre el trimestre</h2><span>600 [moneda]</span><b>[racha] 3 días</b><button>[ico] Express</button>`);
  });

  test("lo que escribes tú queda como emoji: escapeHtml lo deja como entidad y iconizar no lo toca", () => {
    const tuyo = escapeHtml("🎯 Llamar a mamá ⭐");
    assert.ok(!/\p{Extended_Pictographic}/u.test(tuyo) && tuyo.includes("&#x1f3af;"));
    assert.equal(iconizar(`<p>${tuyo}</p>`), `<p>${tuyo}</p>`);
    assert.equal(escapeHtml(`<a href="x">"🙂"</a>`), "&lt;a href=&quot;x&quot;&gt;&quot;&#x1f642;&quot;&lt;/a&gt;");
  });

  test("en atributos, opciones y títulos se quitan; en un textarea y en el texto de un SVG quedan", () => {
    const h = iconizar(`<button title="🗑 Borrar" aria-label="⭐ Monedas" data-v="🌅">x</button><select><option>🌅 Mañana</option></select><textarea>⭐ mi nota</textarea><svg><text>🔥</text></svg>`);
    assert.equal(h, `<button title="Borrar" aria-label="Monedas" data-v="🌅">x</button><select><option>Mañana</option></select><textarea>⭐ mi nota</textarea><svg><text>🔥</text></svg>`);
  });

  test("iconizarTexto (avisos y títulos): escapa el texto y cambia los emojis", () => {
    assert.equal(sinSvg(iconizarTexto("🐘 Tu <b>elefante</b> · +50 ⭐")), "[ico] Tu &lt;b&gt;elefante&lt;/b&gt; · +50 [moneda]");
    assert.equal(iconizarTexto(""), "");
  });

  test("el primer bocado se dibuja con el bocado del logo; lo de tu elefante, con su silueta", () => {
    assert.equal(G("BOCADO").emoji, "🍪");
    assert.equal(EMOJI_UI["🍪"], "bocado");
    assert.equal(EMOJI_UI["🐘"], "elefante");
  });

  test("las caritas del diario no se tocan (las eliges tú)", () => {
    ["😞", "😕", "😐", "🙂", "😄"].forEach(e => assert.equal(EMOJI_UI[e], undefined, e));
  });
}
