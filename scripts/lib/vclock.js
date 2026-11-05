// Relógio virtual: congela o tempo da página e avança quadro a quadro.
// Sem GPU, o 3D roda a ~3 fps em tempo real; com o relógio virtual cada quadro é
// renderizado com calma e capturado, e o vídeo sai em 30 fps exatos.
//
// No modo "tempo real" (bomba ligada) a página anda normalmente: usado no carregamento,
// no modo rápido e na preparação das cenas. No modo "captura", o Node chama passo().

const INIT = `(() => {
  const RS = window.setTimeout.bind(window), RSI = window.setInterval.bind(window), RCI = window.clearInterval.bind(window);
  const RRAF = window.requestAnimationFrame.bind(window);
  const rnow = performance.now.bind(performance);
  let vt = rnow();
  const timers = new Map(); let tid = 1e6;
  let raf = new Map(); let rid = 0;
  performance.now = () => vt;
  window.requestAnimationFrame = cb => { const id = ++rid; raf.set(id, cb); return id; };
  window.cancelAnimationFrame = id => { raf.delete(id); };
  window.setTimeout = (fn, d, ...a) => { const id = ++tid; timers.set(id, { fn, at: vt + Math.max(0, +d || 0), a, rep: 0 }); return id; };
  window.setInterval = (fn, d, ...a) => { const id = ++tid; const r = Math.max(4, +d || 0); timers.set(id, { fn, at: vt + r, a, rep: r }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };
  const call = (fn, a) => { try { typeof fn === 'function' ? fn(...a) : (0, eval)(fn); } catch (e) { console.error(e); } };
  function runTimers() {
    for (let guard = 0; guard < 1000; guard++) {
      let best = null, bid = null;
      for (const [id, t] of timers) if (t.at <= vt && (!best || t.at < best.at)) { best = t; bid = id; }
      if (!best) return;
      if (best.rep) best.at += best.rep; else timers.delete(bid);
      call(best.fn, best.a);
    }
  }
  function runRaf() { const q = raf; raf = new Map(); for (const cb of q.values()) { try { cb(vt); } catch (e) { console.error(e); } } }
  // animações CSS / Web Animations seguem o relógio virtual durante a captura
  const tracked = new Set();
  function syncAnims() {
    for (const an of document.getAnimations()) {
      if (!an.__v) { an.__v = { start: vt - (an.currentTime || 0) }; tracked.add(an); }
      if (an.playState === 'finished') { tracked.delete(an); continue; }
      an.pause();
      const tm = vt - an.__v.start;
      const tim = an.effect && an.effect.getComputedTiming ? an.effect.getComputedTiming() : null;
      const end = tim ? tim.endTime : Infinity;
      if (isFinite(end) && tm >= end) { try { an.finish(); } catch (e) { an.currentTime = end; } tracked.delete(an); }
      else an.currentTime = tm;
    }
  }
  let pump = null, last = rnow();
  function startPump() {
    if (pump) return;
    for (const an of tracked) { try { an.play(); } catch (e) {} } tracked.clear();
    document.getAnimations().forEach(an => { delete an.__v; });
    last = rnow();
    const tick = () => { if (!pump) return; const n = rnow(); vt += Math.min(100, n - last); last = n; runTimers(); runRaf(); pump = RRAF(tick); };
    pump = RRAF(tick);
  }
  function stopPump() { pump = null; }
  window.__vclock = {
    now: () => vt,
    pump: on => (on ? startPump() : stopPump()),
    step(ms) { vt += ms; runTimers(); syncAnims(); runRaf(); return vt; },
    debug() { const an = document.getAnimations(); return { n: an.length, dom: document.getElementsByTagName('*').length, nomes: an.slice(0, 6).map(a => (a.animationName || a.transitionProperty || '?') + ':' + a.playState + ':' + (a.effect && a.effect.target ? (a.effect.target.id || a.effect.target.className) : '')) }; },
  };
  startPump();
})();`;

class Clock {
  constructor(page, fps = 30) {
    this.page = page; this.fps = fps; this.dt = 1000 / fps;
    this.capturing = false; this.frame = 0; this.onFrame = null; this.vt0 = 0; this.carry = 0;
  }
  async startCapture(onFrame) {
    await this.page.evaluate(() => window.__vclock.pump(false));
    this.vt0 = await this.page.evaluate(() => window.__vclock.now());
    this.capturing = true; this.frame = 0; this.onFrame = onFrame; this.carry = 0;
    await this.onFrame(this.frame++);   // quadro 0
  }
  async stopCapture() {
    this.capturing = false; this.onFrame = null;
    await this.page.evaluate(() => window.__vclock.pump(true));
  }
  // tempo virtual (s) desde o início da captura
  t() { return (this.frame - 1) / this.fps + this.carry / 1000; }
  // avança o relógio em ms, capturando um quadro a cada 1/30 s
  async advance(ms) {
    if (!this.capturing) return;
    let rest = ms + this.carry;
    while (rest >= this.dt - 1e-6) {
      const a = Date.now();
      await this.page.evaluate(d => window.__vclock.step(d), this.dt);
      const b = Date.now();
      await this.onFrame(this.frame++);
      const c = Date.now();
      if (c - a > 4000) console.warn(`  ! quadro ${this.frame - 1} lento: passo ${b - a} ms, captura ${c - b} ms`);
      rest -= this.dt;
    }
    this.carry = Math.max(0, rest);
  }
  async until(tSec) { const ms = tSec * 1000 - this.t() * 1000; if (ms > 0) await this.advance(ms); }
}

module.exports = { VCLOCK_INIT: INIT, Clock };
