// Linha do tempo do vídeo: a duração de cada cena vem do áudio dela.
const fs = require('fs');
const { roteiro, p, duracoes } = require('./config');

const LEAD = { C01: 3.0 };          // C01: a abertura (3 s) roda sobre o prédio antes da fala
const LEAD_PADRAO = 0.5;            // 0,5 s de silêncio entre cenas
const TAIL = { C12: 2.2 };          // C12: o card final fica um pouco mais depois da fala
const TAIL_PADRAO = 0.8;            // 0,8 s de respiro no fim de cada cena
const XFADE = 0.3;                  // fade cruzado de 300 ms quando a rota muda
// cenas que começam numa rota diferente de onde a anterior terminou
const MUDA_ROTA = new Set(['C05', 'C06', 'C09', 'C10', 'C11', 'C12']);

function timeline() {
  const d = duracoes();
  if (!d) throw new Error('audio/duracoes.json não existe: rode a etapa de voz primeiro');
  let t = 0; const out = [];
  roteiro.forEach((c, i) => {
    const lead = LEAD[c.id] ?? LEAD_PADRAO, tail = TAIL[c.id] ?? TAIL_PADRAO;
    const dur = +(lead + d[c.id] + tail).toFixed(3);
    const xf = i > 0 && MUDA_ROTA.has(c.id);
    if (xf) t -= XFADE;
    out.push({ id: c.id, idx: i, lead, audio: d[c.id], tail, dur, xfade: xf, start: +t.toFixed(3) });
    t += dur;
  });
  return { cenas: out, total: +t.toFixed(3), XFADE };
}

function tempos(id) {
  const f = p('audio', `${id}.tempos.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

module.exports = { timeline, tempos, XFADE };
