// Abre a demo no Chromium com as dependências de CDN servidas localmente,
// injeta o cursor falso e oferece movimentos de mouse com easing.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { p, cfg } = require('./config');
const { VCLOCK_INIT, Clock } = require('./vclock');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Mapeia URLs externas da demo para arquivos locais (a rede deste ambiente
// bloqueia jsDelivr/cdnjs; servir local também deixa a gravação determinística).
const FONT_FILES = {
  'Manrope-300': 'Manrope-Regular.ttf', 'Manrope-400': 'Manrope-Regular.ttf', 'Manrope-500': 'Manrope-Medium.ttf',
  'Manrope-600': 'Manrope-SemiBold.ttf', 'Manrope-700': 'Manrope-Bold.ttf', 'Manrope-800': 'Manrope-ExtraBold.ttf',
  'JetBrains Mono-400': 'JetBrainsMono-Regular.ttf', 'JetBrains Mono-500': 'JetBrainsMono-Medium.ttf',
  'JetBrains Mono-600': 'JetBrainsMono-SemiBold.ttf', 'JetBrains Mono-700': 'JetBrainsMono-Bold.ttf',
};
function fontCss() {
  return Object.entries(FONT_FILES).map(([k, f]) => {
    const [fam, w] = k.split('-');
    return `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:block;src:url(https://fonts.gstatic.com/local/${f}) format('truetype');}`;
  }).join('\n');
}

async function rotasLocais(ctx) {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  // Correção pontual de um bug da demo: no shader do céu, o "#include <tonemapping_fragment>"
  // está no meio da linha, o GLSL não compila e o céu some. Só quebramos a linha antes dele.
  // O arquivo demo/index.html não é alterado (ver DECISOES.md).
  await ctx.route(/^http:\/\/localhost:\d+\/(index\.html)?(\?.*)?$/, async route => {
    let html = fs.readFileSync(p('demo', 'index.html'), 'utf8');
    html = html.replace('gl_FragColor = vec4(c,1.0); #include <tonemapping_fragment>', 'gl_FragColor = vec4(c,1.0);\\n#include <tonemapping_fragment>');
    route.fulfill({ body: html, contentType: 'text/html; charset=utf-8' });
  });
  await ctx.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', route => {
    const rel = new URL(route.request().url()).pathname.replace('/npm/three@0.160.0/', '');
    route.fulfill({ path: p('node_modules', 'three', rel), contentType: 'text/javascript', headers: cors });
  });
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/**', route =>
    route.fulfill({ path: p('node_modules', 'qrcodejs', 'qrcode.min.js'), contentType: 'text/javascript', headers: cors }));
  await ctx.route('https://fonts.googleapis.com/**', route =>
    route.fulfill({ body: fontCss(), contentType: 'text/css', headers: cors }));
  await ctx.route('https://fonts.gstatic.com/local/**', route => {
    const f = path.basename(new URL(route.request().url()).pathname);
    route.fulfill({ path: p('assets', 'fonts', f), contentType: 'font/ttf', headers: cors });
  });
}

// Cursor falso: seta escura com borda clara + anel cobre no clique.
const CURSOR_SCRIPT = (escala) => `
(() => {
  const S = ${escala};
  const css = '*{cursor:none !important;-webkit-user-select:none !important;user-select:none !important} input,textarea{-webkit-user-select:text !important;user-select:text !important} .scrim{backdrop-filter:none !important;-webkit-backdrop-filter:none !important} #__cur{position:fixed;left:0;top:0;width:' + (22*S) + 'px;height:' + (22*S) + 'px;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);will-change:transform}'
    + ' .__ring{position:fixed;left:0;top:0;width:' + (28*S) + 'px;height:' + (28*S) + 'px;margin:' + (-14*S) + 'px 0 0 ' + (-14*S) + 'px;border:' + (2*S) + 'px solid #C98A5E;border-radius:50%;z-index:2147483646;pointer-events:none;animation:__ring 350ms ease-out forwards}'
    + ' @keyframes __ring{from{transform:var(--p) scale(.35);opacity:.95}to{transform:var(--p) scale(1.35);opacity:0}}';
  function install() {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style'); st.textContent = css; document.documentElement.appendChild(st);
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 22 22"><path d="M3 2 L3 18 L7.2 14.2 L10 20.2 L12.8 19 L10.1 13.1 L16 13.1 Z" fill="#16181B" stroke="#ECE9E3" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const pos = window.__curPos || { x: -200, y: -200 };
    c.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
  }
  window.addEventListener('mousemove', e => {
    window.__curPos = { x: e.clientX, y: e.clientY };
    const c = document.getElementById('__cur'); if (c) c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
  }, true);
  window.addEventListener('mousedown', e => {
    const r = document.createElement('div'); r.className = '__ring';
    r.style.setProperty('--p', 'translate(' + e.clientX + 'px,' + e.clientY + 'px)');
    r.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)';
    document.documentElement.appendChild(r); setTimeout(() => r.remove(), 400);
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();`;

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class Driver {
  constructor(page, opts = {}) {
    this.page = page;
    this.x = opts.x0 ?? 960; this.y = opts.y0 ?? 540;
    this.fast = false;          // modo rápido (sem gravar): encurta esperas e movimentos
    this.clock = opts.clock;    // relógio virtual (captura quadro a quadro)
    this.mobile = !!opts.mobile;
  }
  get cap() { return this.clock && this.clock.capturing; }
  async wait(ms) {
    if (this.cap) return this.clock.advance(ms);
    await sleep(this.fast ? Math.min(ms, 60) : ms);
  }
  async moveTo(x, y, ms = 750) {
    const dist = Math.hypot(x - this.x, y - this.y);
    if (this.fast || dist < 1) { await this.page.mouse.move(x, y); this.x = x; this.y = y; return; }
    ms = Math.max(600, Math.min(900, ms));
    const steps = Math.max(25, Math.min(40, Math.round(ms / (1000 / 30))));
    const x0 = this.x, y0 = this.y;
    // leve curvatura para parecer mão humana
    const nx = -(y - y0) / (dist || 1), ny = (x - x0) / (dist || 1), bow = Math.min(36, dist * 0.06);
    for (let i = 1; i <= steps; i++) {
      const u = i / steps, t = easeInOutCubic(u), arc = Math.sin(Math.PI * u) * bow;
      await this.page.mouse.move(x0 + (x - x0) * t + nx * arc, y0 + (y - y0) * t + ny * arc);
      await this.wait(ms / steps);
    }
    this.x = x; this.y = y;
  }
  async glideTo(x, y, ms) {
    if (this.fast) { await this.page.mouse.move(x, y); this.x = x; this.y = y; return; }
    const steps = Math.max(10, Math.round(ms / (1000 / 30))), x0 = this.x, y0 = this.y;
    for (let i = 1; i <= steps; i++) { const t = easeInOutCubic(i / steps); await this.page.mouse.move(x0 + (x - x0) * t, y0 + (y - y0) * t); await this.wait(ms / steps); }
    this.x = x; this.y = y;
  }
  async box(sel, nth = 0) {
    const loc = this.page.locator(sel).nth(nth);
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    const b = await loc.boundingBox();
    if (!b) throw new Error('sem caixa: ' + sel);
    return b;
  }
  async hover(sel, { nth = 0, ms = 750, fx = 0.5, fy = 0.5 } = {}) {
    const b = await this.box(sel, nth);
    await this.moveTo(b.x + b.width * fx, b.y + b.height * fy, ms);
    return b;
  }
  async press() { await this.page.mouse.down(); await this.wait(this.fast ? 10 : 90); await this.page.mouse.up(); }
  async click(sel, opts = {}) {
    await this.hover(sel, opts);
    await this.wait(140);
    await this.press();
  }
  async drag(x1, y1, x2, y2, ms = 3000, dyCurve = 0) {
    await this.moveTo(x1, y1, 700);
    await this.page.mouse.down();
    if (this.fast) { await this.page.mouse.move(x2, y2, { steps: 4 }); await this.page.mouse.up(); this.x = x2; this.y = y2; return; }
    const steps = Math.max(8, Math.round(ms / (1000 / 30)));
    for (let i = 1; i <= steps; i++) {
      const t = easeInOutCubic(i / steps);
      await this.page.mouse.move(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * dyCurve);
      await this.wait(ms / steps);
    }
    await this.page.mouse.up();
    this.x = x2; this.y = y2;
  }
  async type(sel, text, perChar = 160) {
    for (const ch of text) { await this.page.keyboard.type(ch); await this.wait(perChar); }
  }
  async smoothScroll(sel, dy, ms = 1800, eixo = 'y') {
    const k = eixo === 'x' ? ['scrollLeft', 'scrollWidth', 'clientWidth'] : ['scrollTop', 'scrollHeight', 'clientHeight'];
    const set = v => this.page.evaluate(([s, val, p]) => { const el = document.querySelector(s); if (el) el[p] = val; }, [sel, v, k[0]]);
    const info = await this.page.evaluate(([s, k]) => { const el = document.querySelector(s); return el ? { y: el[k[0]], max: el[k[1]] - el[k[2]] } : null; }, [sel, k]);
    if (!info) return;
    const alvo = Math.max(0, Math.min(info.max, info.y + dy));
    if (this.fast) { await set(alvo); return; }
    const steps = Math.max(6, Math.round(ms / (1000 / 30)));
    for (let i = 1; i <= steps; i++) { await set(info.y + (alvo - info.y) * easeInOutCubic(i / steps)); await this.wait(ms / steps); }
  }
  async goHash(h) {
    await this.page.evaluate(x => { location.hash = x; }, h);
    await this.wait(this.fast ? 150 : 350);
  }
  async waitToastsGone(maxMs = 6000) {
    for (let t = 0; t < maxMs; t += 150) {
      if (!(await this.page.locator('.toast').count())) return;
      await this.wait(150);
    }
  }
}

async function abrir({ mobile = false, headless } = {}) {
  const useXvfb = !!process.env.DISPLAY;
  const browser = await chromium.launch({
    headless: headless ?? !useXvfb,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-features=Translate', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const ctx = mobile
    ? await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: false, hasTouch: false, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
    : await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await rotasLocais(ctx);
  await ctx.addInitScript(VCLOCK_INIT);
  await ctx.addInitScript(CURSOR_SCRIPT(1));
  // localStorage limpo no início (contexto novo já vem vazio; garantimos mesmo assim)
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('__ls_clean')) { try { localStorage.clear(); } catch (e) { } sessionStorage.setItem('__ls_clean', '1'); } });
  const page = await ctx.newPage();
  page.on('popup', pg => pg.close().catch(() => {}));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[demo]', m.type(), m.text()); });
  page.on('pageerror', e => console.log('[demo] pageerror', e.message));
  await page.goto(`http://localhost:${cfg.PORTA}/#espelho`, { waitUntil: 'networkidle' });
  await esperar3D(page);
  const clock = new Clock(page, 30);
  const drv = new Driver(page, { mobile, clock, x0: mobile ? 300 : 1500, y0: mobile ? 600 : 760 });
  await page.mouse.move(drv.x, drv.y);
  return { browser, ctx, page, drv, clock };
}

async function esperar3D(page) {
  const t = Date.now();
  while (Date.now() - t < 60000) {
    const st = await page.evaluate(() => ({ ld: !!document.querySelector('#load3d'), fb: !!document.querySelector('.fallback3d') }));
    if (st.fb) throw new Error('FALLBACK_3D: o 3D não carregou (.fallback3d apareceu). Sem 3D o vídeo não serve.');
    if (!st.ld) { await sleep(1500); return; }
    await sleep(200);
  }
  throw new Error('Tempo esgotado esperando o 3D carregar');
}

module.exports = { abrir, Driver, sleep, esperar3D };
