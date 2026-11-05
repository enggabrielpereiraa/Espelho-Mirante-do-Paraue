#!/usr/bin/env node
// Renderiza os cards em PNG com fundo transparente (Playwright, omitBackground):
// abertura, lower thirds, card final e os blocos de legenda (horizontal e vertical).
//   node scripts/cards.js [--vertical]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { cfg, roteiro, p } = require('./lib/config');

const VERT = process.argv.includes('--vertical');
const SUF = VERT ? 'v' : 'h';
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const OUT = p('build', SUF, 'cards');

// Layout (px do vídeo final). Vertical: nada nos 160 px de cima nem nos 220 px de baixo.
const L = VERT
  ? { ltLeft: 56, ltBottom: 300, legBottomGap: 28, legFont: 52, legMaxW: 968, ltTitle: 44, ltLabel: 22 }
  : { ltLeft: 72, ltBottom: 72, legBottomGap: 26, legFont: 44, legMaxW: 1240, ltTitle: 34, ltLabel: 16 };

const fontFace = ['Regular:400', 'Medium:500', 'SemiBold:600', 'Bold:700', 'ExtraBold:800']
  .map(x => { const [n, w] = x.split(':'); return `@font-face{font-family:Manrope;font-weight:${w};src:url(file://${p('assets', 'fonts', `Manrope-${n}.ttf`)})}`; }).join('')
  + ['Regular:400', 'Medium:500', 'SemiBold:600'].map(x => { const [n, w] = x.split(':'); return `@font-face{font-family:'JetBrains Mono';font-weight:${w};src:url(file://${p('assets', 'fonts', `JetBrainsMono-${n}.ttf`)})}`; }).join('');

const BASE = `
${fontFace}
:root{--bg:#0F1012;--fg:#ECE9E3;--cu:#C98A5E;--line:rgba(236,233,227,.16)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent;width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Manrope,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased;position:relative}
.mono{font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:.18em}
`;

function htmlAbertura() {
  const s = VERT ? 1.25 : 1;
  return `<style>${BASE}
  .scrim{position:absolute;inset:0;background:radial-gradient(ellipse ${VERT ? '90% 45%' : '62% 58%'} at 50% 50%,rgba(15,16,18,.82),rgba(15,16,18,.55) 55%,rgba(15,16,18,.25) 100%)}
  .c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${18 * s}px}
  .lbl{font-size:${18 * s}px;color:var(--cu);font-weight:500;letter-spacing:.32em}
  h1{font-size:${132 * s}px;font-weight:700;letter-spacing:-.03em;line-height:1}
  .rule{width:${72 * s}px;height:2px;background:var(--cu);margin:${10 * s}px 0 ${4 * s}px}
  .proj{font-size:${38 * s}px;font-weight:500;opacity:.86}
  </style><div class="scrim"></div><div class="c"><div class="lbl mono">Apresentação</div><h1>${cfg.NOME_SISTEMA}</h1><div class="rule"></div><div class="proj">${cfg.NOME_PROJETO}</div></div>`;
}

function htmlLT(c, i) {
  return `<style>${BASE}
  .lt{position:absolute;left:${L.ltLeft}px;bottom:${L.ltBottom}px;background:rgba(15,16,18,.9);border:1px solid var(--line);border-radius:${VERT ? 14 : 10}px;
      padding:${VERT ? '20px 30px 22px' : '15px 24px 17px'};display:flex;flex-direction:column;gap:${VERT ? 10 : 7}px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
  .n{font-size:${L.ltLabel}px;color:var(--cu);font-weight:500}
  .t{font-size:${L.ltTitle}px;font-weight:600;letter-spacing:-.01em;line-height:1.1;white-space:nowrap}
  </style><div class="lt" id="el"><div class="n mono">${String(i + 1).padStart(2, '0')} / ${String(roteiro.length).padStart(2, '0')}</div><div class="t">${c.titulo}</div></div>`;
}

function htmlFinal() {
  const s = VERT ? 1.15 : 1;
  return `<style>${BASE}
  .dim{position:absolute;inset:0;background:rgba(0,0,0,.4)}
  .c{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .card{background:rgba(15,16,18,.92);border:1px solid var(--line);border-radius:${18 * s}px;padding:${56 * s}px ${72 * s}px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:${16 * s}px;max-width:${VERT ? 940 : 1100}px}
  .lbl{font-size:${16 * s}px;color:var(--cu);font-weight:500;letter-spacing:.3em}
  .nome{font-size:${76 * s}px;font-weight:700;letter-spacing:-.025em;line-height:1.05}
  .rule{width:${64 * s}px;height:2px;background:var(--cu);margin:${6 * s}px 0}
  .frase{font-size:${30 * s}px;font-weight:500;opacity:.9;line-height:1.3}
  .cts{display:flex;${VERT ? 'flex-direction:column;gap:' + 16 * s + 'px' : 'gap:' + 40 * s + 'px'};margin-top:${14 * s}px;justify-content:center}
  .ct{display:flex;flex-direction:column;gap:${6 * s}px;align-items:center}
  .ct span{font-family:'JetBrains Mono',monospace;font-size:${13 * s}px;color:var(--cu);letter-spacing:.24em;text-transform:uppercase}
  .ct b{font-family:'JetBrains Mono',monospace;font-weight:500;font-size:${22 * s}px;color:var(--fg);opacity:.9;letter-spacing:.01em}
  </style><div class="dim"></div><div class="c"><div class="card"><div class="lbl mono">${cfg.NOME_SISTEMA} · ${cfg.NOME_PROJETO}</div><div class="nome">${cfg.SEU_NOME}</div><div class="rule"></div>
  <div class="frase">Sistema sob medida para incorporadoras e condomínios</div>${cfg.CONTATOS ? `<div class="cts">${cfg.CONTATOS.map(x => `<div class="ct"><span>${x.rotulo}</span><b>${x.valor}</b></div>`).join('')}</div>` : `<div class="cts"><div class="ct"><b>${cfg.SEU_CONTATO}</b></div></div>`}</div></div>`;
}

function htmlLegenda(q) {
  return `<style>${BASE}
  .w{position:absolute;left:0;top:0;width:${W}px;display:flex;justify-content:center}
  .s{display:inline-block;background:rgba(15,16,18,.78);border-radius:8px;padding:${VERT ? '12px 26px 14px' : '10px 22px 12px'};font-weight:600;font-size:${L.legFont}px;line-height:1.28;text-align:center;color:#fff;max-width:${L.legMaxW}px}
  </style><div class="w"><div class="s" id="el">${q.linhas.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</div></div>`;
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const idx = { W, H, lt: {}, legendas: [] };
  const render = async (html, file, el) => {
    await pg.setContent(`<!doctype html><meta charset="utf-8"><body>${html}</body>`);
    await pg.evaluate(() => document.fonts.ready);
    if (!el) { await pg.screenshot({ path: file, omitBackground: true }); return null; }
    const loc = pg.locator('#el'); const bb = await loc.boundingBox();
    await loc.screenshot({ path: file, omitBackground: true });
    return { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) };
  };
  await render(htmlAbertura(), path.join(OUT, 'abertura.png'));
  await render(htmlFinal(), path.join(OUT, 'final.png'));
  if (!VERT) {
    // thumbnail 1280x720: quadro da C01 (fim de tarde) + título
    const fr = p('build', 'h', 'thumb_frame.png');
    if (fs.existsSync(fr)) {
      const tp = await b.newPage({ viewport: { width: 1280, height: 720 } });
      await tp.setContent(`<!doctype html><meta charset="utf-8"><style>${BASE}
        html,body{width:1280px;height:720px;background:#0F1012}
        .bg{position:absolute;inset:0;background:url(data:image/png;base64,${fs.readFileSync(fr).toString('base64')}) 38% 50%/cover}
        .sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,16,18,.92) 0%,rgba(15,16,18,.78) 34%,rgba(15,16,18,.15) 66%,rgba(15,16,18,0) 100%)}
        .c{position:absolute;left:72px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:16px;width:640px}
        .lbl{font-size:16px;color:var(--cu);font-weight:500;letter-spacing:.3em}
        h1{font-size:112px;font-weight:800;letter-spacing:-.035em;line-height:.95}
        .rule{width:64px;height:3px;background:var(--cu);margin:6px 0}
        .sub{font-size:34px;font-weight:600;line-height:1.2;opacity:.95}
      </style><div class="bg"></div><div class="sh"></div><div class="c"><div class="lbl mono">${cfg.NOME_PROJETO}</div><h1>${cfg.NOME_SISTEMA}</h1><div class="rule"></div><div class="sub">Vendas e condomínio<br>no mesmo prédio</div></div>`);
      await tp.evaluate(() => document.fonts.ready);
      fs.mkdirSync(p('out'), { recursive: true });
      await tp.screenshot({ path: p('out', 'thumbnail.png') });
      await tp.close();
      console.log('thumbnail: out/thumbnail.png');
    }
  }
  let ltTop = H;
  for (const [i, c] of roteiro.entries()) {
    if (!c.titulo) continue;
    const bb = await render(htmlLT(c, i), path.join(OUT, `lt_${c.id}.png`), true);
    idx.lt[c.id] = { png: path.join(OUT, `lt_${c.id}.png`), ...bb };
    ltTop = Math.min(ltTop, bb.y);
  }
  // legenda: base logo acima do lower third
  const legBottom = Math.round(ltTop - L.legBottomGap);
  const cues = JSON.parse(fs.readFileSync(p('build', 'legendas.json'), 'utf8'));
  for (const [k, q] of cues.entries()) {
    const f = path.join(OUT, `leg_${String(k).padStart(3, '0')}.png`);
    const bb = await render(htmlLegenda(q), f, true);
    idx.legendas.push({ ...q, png: f, x: bb.x, y: legBottom - bb.h, w: bb.w, h: bb.h });
  }
  idx.legBottom = legBottom;
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(idx, null, 1));
  await b.close();
  console.log(`cards ${SUF}: abertura, final, ${Object.keys(idx.lt).length} lower thirds, ${cues.length} legendas (base da legenda em y=${legBottom})`);
})().catch(e => { console.error(e); process.exit(1); });
