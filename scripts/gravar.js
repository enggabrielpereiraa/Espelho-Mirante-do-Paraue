#!/usr/bin/env node
// Grava as cenas quadro a quadro: relógio virtual + Page.captureScreenshot (CDP) a 30 fps.
// (O screencast em tempo real não serve nesta máquina sem GPU: o 3D cai para ~3 fps. Ver DECISOES.md.)
//   node scripts/gravar.js                 -> grava as 12 cenas (horizontal) numa sessão só
//   node scripts/gravar.js --cena C08      -> refaz as anteriores em modo rápido (sem gravar) e grava só a C08
//   node scripts/gravar.js --vertical      -> mesma coisa no layout de celular (1080x1920)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { abrir, sleep } = require('./lib/browser');
const { roteiro, p } = require('./lib/config');
const { timeline, tempos } = require('./lib/timeline');
const { cenas } = require('./cenas');

const args = process.argv.slice(2);
const VERT = args.includes('--vertical');
const SO = (() => { const i = args.indexOf('--cena'); return i >= 0 ? args[i + 1].split(',') : null; })();
const SUF = VERT ? 'v' : 'h';
const SECO = args.includes('--seco');   // ensaio: roda tudo rápido, sem gravar, e tira um print no fim de cada cena
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const BUILD = p('build', SUF);

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

function criarS(page, drv, cena, tl, clock) {
  const tp = tempos(cena.id);
  const falas = tp ? tp.fala : [];
  const S = {
    page, drv, v: VERT, id: cena.id, dur: tl.dur, lead: tl.lead,
    marks: [], zooms: [], fast: drv.fast,
    t() { return clock.capturing ? clock.t() : 0; },
    mark(label, extra = {}) { S.marks.push({ t: +S.t().toFixed(2), label, ...extra }); },
    // tempo (na cena) da n-ésima ocorrência de uma palavra da fala
    w(palavra, n = 1) {
      const alvo = norm(palavra); let k = 0;
      for (const x of falas) if (norm(x.w) === alvo && ++k === n) return +(S.lead + x.s).toFixed(2);
      for (const x of falas) if (norm(x.w).startsWith(alvo) && ++k === n) return +(S.lead + x.s).toFixed(2);
      console.warn(`  ! palavra "${palavra}" não encontrada na fala de ${cena.id}`);
      return S.t() + 0.5;
    },
    async at(t) { if (S.fast || !clock.capturing) return; await clock.until(t); },
    async ensureVisible(sel, nth, soMedir = false) {
      // rola o contêiner com suavidade (vertical e horizontal) se o alvo estiver fora da tela: nada de salto
      const infos = await page.locator(sel).nth(nth).evaluate((el) => {
        const out = [];
        const nav = document.querySelector('#mnav'); const navH = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
        const achar = (eixo) => {
          let sc = el.parentElement;
          const ok = n => eixo === 'y' ? (n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
                                        : (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX));
          while (sc && !ok(sc)) sc = sc.parentElement;
          return sc;
        };
        const r = el.getBoundingClientRect();
        const sx = achar('x');
        if (sx) {
          const cr = sx.getBoundingClientRect(); let d = 0;
          if (r.right > cr.right - 8) d = r.right - cr.right + 40; else if (r.left < cr.left + 8) d = r.left - cr.left - 40;
          if (d) { if (!sx.id) sx.id = '__sc' + Math.random().toString(36).slice(2, 7); out.push({ id: sx.id, d: Math.round(d), eixo: 'x' }); }
        }
        const sy = achar('y');
        if (sy) {
          const cr = sy.getBoundingClientRect();
          const top = Math.max(cr.top, 0), bot = Math.min(cr.bottom, innerHeight - navH);
          let d = 0;
          if (r.bottom > bot - 24) d = Math.min(r.bottom - bot + 60, r.top - top - 20); else if (r.top < top + 8) d = r.top - top - 60;
          if (d) { if (!sy.id) sy.id = '__sc' + Math.random().toString(36).slice(2, 7); out.push({ id: sy.id, d: Math.round(d), eixo: 'y' }); }
        }
        return out;
      }).catch(() => []);
      const durs = infos.map(i => VERT ? Math.min(750, 350 + Math.abs(i.d)) : Math.min(1200, 500 + Math.abs(i.d) * 2));
      if (soMedir) return durs.reduce((a, b) => a + b, 0) / 1000;
      for (const [k, i] of infos.entries()) await drv.smoothScroll('#' + i.id, i.d, durs[k], i.eixo);
      return 0;
    },
    async prepararAlvo(sel, t, ms, o) {
      // rola antes, descontando o tempo da rolagem, para o cursor chegar na hora da palavra
      const loc = page.locator(sel).nth(o.nth || 0);
      await loc.waitFor({ state: 'visible', timeout: 10000 });
      const precisa = await S.ensureVisible(sel, o.nth || 0, true);
      if (precisa) { await S.at(t - ms / 1000 - 0.3 - precisa); await S.ensureVisible(sel, o.nth || 0); }
      await S.at(t - ms / 1000 - (o.clique ? 0.14 : 0));
      const b = await loc.boundingBox();
      return { x: b.x + b.width * (o.fx ?? 0.5), y: b.y + b.height * (o.fy ?? 0.5) };
    },
    async hoverAt(sel, t, o = {}) {
      const ms = o.ms ?? 750;
      try {
        const p = await S.prepararAlvo(sel, t, ms, o);
        if (Math.hypot(p.x - drv.x, p.y - drv.y) < 4) await S.at(t); else await drv.moveTo(p.x, p.y, ms);
        if (o.label) S.mark(o.label, { alvo: t, livre: !!o.livre });
      } catch (e) { console.warn(`  ! hover falhou (${sel}): ${e.message.split('\n')[0]}`); S.mark('FALHOU hover ' + sel); }
    },
    async clickAt(sel, t, o = {}) {
      const ms = o.ms ?? 750;
      const p = await S.prepararAlvo(sel, t, ms, { ...o, clique: true });
      // se o cursor já está em cima do alvo, espera a hora certa em vez de clicar adiantado
      if (Math.hypot(p.x - drv.x, p.y - drv.y) < 4) await S.at(t - 0.14); else await drv.moveTo(p.x, p.y, ms);
      await drv.wait(140);
      await drv.press();
      S.mark(o.label || ('clique ' + sel), { alvo: t, clique: true, livre: !!o.livre });
    },
    // passeio lento do cursor entre dois pontos de um elemento (sem o limite de 900 ms)
    async glide(sel, t0, t1, de, para, o = {}) {
      const loc = page.locator(sel).nth(o.nth || 0);
      const b = await loc.boundingBox(); if (!b) return;
      await S.at(t0);
      if (o.label) S.mark(o.label, { alvo: t0, livre: !!o.livre });
      await drv.moveTo(b.x + b.width * de[0], b.y + b.height * de[1], 650);
      const ms = Math.max(600, (t1 - S.t()) * 1000);
      await drv.glideTo(b.x + b.width * para[0], b.y + b.height * para[1], ms);
    },
    async clickNav(rota, t, o = {}) {
      if (VERT) { await S.at(t); S.mark(o.label || rota, { alvo: t, clique: true }); await drv.goHash('#' + rota); return; }
      return S.clickAt(`#nav a[href="#${rota}"]`, t, o);
    },
    async revealHover(container, sel, t, o = {}) { return S.hoverAt(sel, t, o); },
    zoom(tIn, tOut, foco) { S.zooms.push({ in: +tIn.toFixed(2), out: tOut, foco }); },
    zoomOut(t) { const z = S.zooms[S.zooms.length - 1]; if (z && z.out == null) z.out = +t.toFixed(2); },
  };
  return S;
}

async function capturador(page) {
  const cdp = await page.context().newCDPSession(page);
  let dir = null, pend = [];
  return {
    begin(d) { dir = d; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); pend = []; },
    async frame(n) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true, captureBeyondViewport: false });
      pend.push(fs.promises.writeFile(path.join(dir, String(n).padStart(5, '0') + '.jpg'), Buffer.from(data, 'base64')));
      if (pend.length > 64) { await Promise.all(pend); pend = []; }
    },
    async end() { await Promise.all(pend); pend = []; },
  };
}

function montarClipe(dir, dur, out) {
  const n = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).length;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(dir, '%05d.jpg'),
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-t', dur.toFixed(3),
    '-c:v', 'libx264', '-crf', '12', '-preset', 'veryfast', '-r', '30', out]);
  return { quadros: n };
}

(async () => {
  const { cenas: TL } = timeline();
  fs.mkdirSync(BUILD, { recursive: true });
  const { browser, page, drv, clock } = await abrir({ mobile: VERT });
  const cap = await capturador(page);
  const relatorio = fs.existsSync(path.join(BUILD, 'gravacao.json')) ? JSON.parse(fs.readFileSync(path.join(BUILD, 'gravacao.json'))) : {};
  const ultimo = SO ? Math.max(...SO.map(id => roteiro.findIndex(c => c.id === id))) : roteiro.length - 1;
  try {
    for (const c of roteiro.slice(0, ultimo + 1)) {
      const tl = TL.find(x => x.id === c.id);
      const grava = !SECO && (!SO || SO.includes(c.id));
      drv.fast = !grava;
      const sc = cenas[c.id];
      let S = criarS(page, drv, c, tl, clock);
      if (sc.prep) await sc.prep(S);
      if (!grava) {
        await sc.run(S); await sleep(300);
        if (SECO) { fs.mkdirSync(path.join(BUILD, 'seco'), { recursive: true }); await page.screenshot({ path: path.join(BUILD, 'seco', c.id + '.png') }); console.log('ensaio', c.id, 'ok'); }
        continue;
      }
      process.stdout.write(`gravando ${c.id} (${tl.dur.toFixed(2)} s)... `);
      await sleep(400);
      const t0 = Date.now();
      const dirF = path.join(BUILD, 'frames', c.id);
      cap.begin(dirF);
      S = criarS(page, drv, c, tl, clock);
      await clock.startCapture(n => cap.frame(n));
      await sc.run(S);
      const sobra = tl.dur - S.t();
      if (sobra < -0.05) console.warn(`\n  ! ações de ${c.id} passaram ${(-sobra).toFixed(2)} s do fim da cena`);
      // nenhum toast atravessa o corte: se houver, sai com fade no fim da cena
      await clock.until(Math.max(S.t(), tl.dur - 0.5));
      if (await page.locator('.toast').count()) {
        await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => { t.style.transition = 'opacity 250ms ease'; t.style.opacity = '0'; }));
        S.mark('toast sai com fade');
      }
      await clock.until(tl.dur + 0.1);
      await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
      await clock.stopCapture();
      await cap.end();
      const out = path.join(BUILD, `${c.id}.mp4`);
      const info = montarClipe(dirF, tl.dur, out);
      if (!args.includes('--manter-quadros')) fs.rmSync(dirF, { recursive: true, force: true });
      relatorio[c.id] = { dur: tl.dur, ...info, sobra: +sobra.toFixed(2), marks: S.marks, zooms: S.zooms.map(z => ({ ...z, out: z.out ?? tl.dur })) };
      fs.writeFileSync(path.join(BUILD, 'gravacao.json'), JSON.stringify(relatorio, null, 1));
      console.log(`${info.quadros} quadros, folga ${sobra.toFixed(2)} s, ${((Date.now() - t0) / 1000).toFixed(0)} s de render`);
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
