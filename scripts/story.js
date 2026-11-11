#!/usr/bin/env node
// Elementos gráficos do story do Instagram (1080x1920): fundo, moldura de navegador,
// títulos de cada função, barra de progresso e card final. HTML -> PNG (transparente).
//   node scripts/story.js   (depois: python3 scripts/story.py)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { cfg, p } = require('./lib/config');
const S = require('./story-config.json');

const W = 1080, H = 1920;
const OUT = p('build', 'story');
const L = S.layout;
const T = S.tema;

const fontFace = ['Regular:400', 'Medium:500', 'SemiBold:600', 'Bold:700', 'ExtraBold:800']
  .map(x => { const [n, w] = x.split(':'); return `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${p('assets', 'fonts', `Manrope-${n}.ttf`)})}`; }).join('')
  + ['Regular:400', 'Medium:500', 'SemiBold:600'].map(x => { const [n, w] = x.split(':'); return `@font-face{font-family:'JetBrains Mono';font-weight:${w};src:url(file://${p('assets', 'fonts', `JetBrainsMono-${n}.ttf`)})}`; }).join('');

const BASE = `${fontFace}
:root{--bg:${T.fundo};--fg:${T.texto};--cu:${T.acento};--line:${T.linha};--card:${T.cartao}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Manrope,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased;position:relative}
.mono{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.22em}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const sw = L.win.w, sh = Math.round(L.win.w * 10 / 16);

// fundo fixo: grafite com brilho cobre suave + marca no topo + @ embaixo
function htmlFundo() {
  return `<style>${BASE}
  body{background:var(--bg)}
  .marca{position:absolute;left:0;right:0;top:${L.marcaY}px;display:flex;align-items:center;justify-content:center;gap:18px}
  .marca i{display:block;width:44px;height:2px;background:var(--cu);opacity:.8}
  .marca b{font-size:24px;font-weight:600;color:var(--cu);letter-spacing:.34em}
  .rod{position:absolute;left:0;right:0;top:${L.rodapeY}px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:24px;color:var(--fg);opacity:.55;letter-spacing:.04em}
  </style>
  <div class="marca"><i></i><b class="mono">${esc(cfg.SEU_NOME)}</b><i></i></div>
  <div class="rod">${esc(S.rodape)}</div>`;
}

// moldura do navegador (barra superior), com sombra; a tela é o vídeo, por baixo
function htmlMoldura() {
  return `<style>${BASE}
  .win{position:absolute;left:${L.win.x}px;top:${L.win.y}px;width:${sw}px;height:${L.barra + sh}px;border-radius:18px;
       box-shadow:0 30px 60px rgba(23,25,28,.28),0 0 0 1px rgba(23,25,28,.18)}
  .bar{position:absolute;left:${L.win.x}px;top:${L.win.y}px;width:${sw}px;height:${L.barra}px;border-radius:18px 18px 0 0;background:#1C1E22;
       border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;padding:0 22px;gap:22px}
  .dots{display:flex;gap:10px}.dots i{width:14px;height:14px;border-radius:50%;display:block}
  .tab{display:flex;align-items:center;gap:10px;background:#0F1012;border-radius:10px 10px 0 0;height:44px;margin-top:20px;padding:0 18px;font-size:19px;font-weight:600;color:#cfccc6}
  .tab em{width:16px;height:16px;border-radius:4px;background:var(--cu);display:block}
  .url{flex:1;height:38px;border-radius:19px;background:#0F1012;display:flex;align-items:center;padding:0 18px;font-family:'JetBrains Mono',monospace;font-size:17px;color:#8f8b85;gap:10px}
  .url s{width:12px;height:12px;border:2px solid #8f8b85;border-radius:3px;display:block;text-decoration:none}
  </style><div class="win"></div><div class="bar"><div class="dots"><i style="background:#E8695E"></i><i style="background:#E5B54A"></i><i style="background:#5FBF6A"></i></div>
  <div class="tab"><em></em>${esc(cfg.NOME_SISTEMA)}</div><div class="url"><s></s>${esc(S.url)}</div></div>`;
}

// máscara da tela: só os cantos de baixo arredondados
function htmlMascara() {
  return `<style>${BASE} html,body{width:${sw}px;height:${sh}px;background:#000}
  .m{position:absolute;inset:0;background:#fff;border-radius:0 0 18px 18px}</style><div class="m"></div>`;
}

function htmlTitulo(seg) {
  return `<style>${BASE}
  .c{position:absolute;left:60px;right:60px;top:${L.tituloY}px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px}
  .n{font-size:22px;color:var(--cu);font-weight:500}
  h1{font-size:${seg.titulo.length > 24 ? 74 : 84}px;font-weight:800;letter-spacing:-.03em;line-height:1.02}
  p{font-size:36px;font-weight:500;opacity:.78;line-height:1.25}
  </style><div class="c"><div class="n mono">${esc(seg.rotulo)}</div><h1>${esc(seg.titulo)}</h1>${seg.sub ? `<p>${esc(seg.sub)}</p>` : ''}</div>`;
}

function htmlProgresso(k, n) {
  return `<style>${BASE}
  .b{position:absolute;left:${L.win.x + 120}px;right:${W - L.win.x - sw + 120}px;top:${L.progY}px;display:flex;gap:10px}
  .b i{flex:1;height:6px;border-radius:3px;background:rgba(23,25,28,.13);display:block}
  .b i.on{background:var(--cu)}.b i.ja{background:var(--cu);opacity:.45}
  </style><div class="b">${Array.from({ length: n }, (_, i) => `<i class="${i === k ? 'on' : i < k ? 'ja' : ''}"></i>`).join('')}</div>`;
}

function htmlFinal() {
  const ct = cfg.CONTATOS || [];
  return `<style>${BASE}
  .dim{position:absolute;inset:0;background:var(--bg)}
  .c{position:absolute;left:70px;right:70px;top:${L.finalY}px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:26px}
  .q{font-size:30px;color:var(--cu);font-weight:500;letter-spacing:.26em}
  h1{font-size:96px;font-weight:800;letter-spacing:-.035em;line-height:1}
  .rule{width:80px;height:3px;background:var(--cu)}
  p{font-size:40px;font-weight:600;line-height:1.25;opacity:.92}
  .cts{display:flex;flex-direction:column;gap:22px;margin-top:22px;width:100%}
  .ct{display:flex;align-items:center;justify-content:space-between;gap:20px;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:0 6px 18px rgba(23,25,28,.06);padding:24px 32px}
  .ct span{font-family:'JetBrains Mono',monospace;font-size:22px;color:var(--cu);letter-spacing:.22em;text-transform:uppercase}
  .ct b{font-family:'JetBrains Mono',monospace;font-size:34px;font-weight:500}
  .ct.d{border:2px solid var(--cu)}
  </style><div class="dim"></div><div class="c"><div class="q mono">${esc(S.final.pergunta)}</div><h1>${esc(cfg.SEU_NOME)}</h1><div class="rule"></div>
  <p>${esc(S.final.frase)}</p>
  <div class="cts">${ct.map((x, i) => `<div class="ct ${i === 0 ? 'd' : ''}"><span>${esc(x.rotulo)}</span><b>${esc(x.valor)}</b></div>`).join('')}</div></div>`;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: W, height: H } });
  const render = async (html, file, vp) => {
    if (vp) await pg.setViewportSize(vp); else await pg.setViewportSize({ width: W, height: H });
    await pg.setContent(`<!doctype html><meta charset="utf-8"><body>${html}</body>`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.screenshot({ path: path.join(OUT, file), omitBackground: true });
  };
  await render(htmlFundo(), 'fundo.png');
  await render(htmlMoldura(), 'moldura.png');
  await render(htmlMascara(), 'mascara.png', { width: sw, height: sh });
  for (const [k, seg] of S.segmentos.entries()) {
    await render(htmlTitulo(seg), `titulo_${k}.png`);
    await render(htmlProgresso(k, S.segmentos.length), `prog_${k}.png`);
  }
  await render(htmlFinal(), 'final.png');
  await b.close();
  console.log(`story: ${S.segmentos.length} segmentos, tela ${sw}x${sh}`);
})().catch(e => { console.error(e); process.exit(1); });
