#!/usr/bin/env node
// Orquestra tudo.
//   npm run video                 -> voz, legendas, cards, gravação, montagem e qualidade (horizontal + vertical)
//   npm run cena -- C08           -> regrava só a C08 (horizontal e, se ativado, vertical) e remonta
//   npm run cena -- C08 --voz     -> idem, mas gera de novo o áudio da C08 (depois de mudar o texto)
//   npm run montar                -> só remonta a partir das cenas já gravadas
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const args = process.argv.slice(2);
const MODO = args[0];
const CENAS = args.slice(1).filter(a => /^C\d\d$/i.test(a)).map(a => a.toUpperCase());

const run = (cmd, a, opt = {}) => {
  console.log(`\n$ ${cmd} ${a.join(' ')}`);
  execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit', ...opt });
};

function servidorNoAr() {
  return new Promise(r => { http.get(`http://localhost:${cfg.PORTA}/`, res => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)); });
}
async function subirServidor() {
  if (await servidorNoAr()) return null;
  const bin = path.join(ROOT, 'node_modules', '.bin', 'http-server');
  const srv = spawn(bin, ['demo', '-p', String(cfg.PORTA), '-s', '-c-1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await servidorNoAr()); i++) await new Promise(r => setTimeout(r, 200));
  return srv;
}

function timeline() {
  delete require.cache[require.resolve('./lib/config')]; delete require.cache[require.resolve('./lib/timeline')];
  const { timeline } = require('./lib/timeline');
  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'timeline.json'), JSON.stringify(timeline(), null, 1));
}

function roteiroFinal() {
  const rot = JSON.parse(fs.readFileSync(path.join(ROOT, 'roteiro.json'), 'utf8'));
  const tl = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json'), 'utf8'));
  const tc = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  const L = [`${cfg.NOME_SISTEMA} · ${cfg.NOME_PROJETO} — roteiro final`, `Duração: ${tc(tl.total)}`, ''];
  for (const c of rot) {
    const t = tl.cenas.find(x => x.id === c.id);
    L.push(`[${tc(t.start)} – ${tc(t.start + t.dur)}] ${c.id} · ${c.titulo || 'Fechamento (card final)'}`);
    L.push(`  Legenda: ${c.legenda}`);
    if (c.fala !== c.legenda) L.push(`  Fala (pronúncia): ${c.fala}`);
    L.push(`  Tela: ${c.acoes.join('; ')}`, '');
  }
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'roteiro-final.txt'), L.join('\n'));
}

function thumbFrame() {
  // quadro da C01 com o prédio ao fim da tarde (luz padrão da demo)
  run('ffmpeg', ['-y', '-v', 'error', '-ss', '7.5', '-i', path.join('build', 'h', 'C01.mp4'), '-frames:v', '1', path.join('build', 'h', 'thumb_frame.png')]);
}

(async () => {
  const srv = await subirServidor();
  try {
    const formatos = cfg.VERTICAL ? ['h', 'v'] : ['h'];
    const flag = f => (f === 'v' ? ['--vertical'] : []);
    if (MODO === 'video') {
      run('bash', ['scripts/baixar-modelos.sh']);
      run('python3', ['scripts/voz.py', '--transcrever']);
      run('python3', ['scripts/alinhar.py']);
      timeline();
      run('python3', ['scripts/legendas.py', 'build/timeline.json']);
      for (const f of formatos) {
        run('node', ['scripts/gravar.js', ...flag(f)]);
        if (f === 'h') thumbFrame();
        run('node', ['scripts/cards.js', ...flag(f)]);
        run('python3', ['scripts/montar.py', ...flag(f)]);
        run('python3', ['scripts/qualidade.py', ...flag(f)]);
      }
      roteiroFinal();
    } else if (MODO === 'cena') {
      if (!CENAS.length) throw new Error('uso: npm run cena -- C08 [--voz]');
      if (args.includes('--voz')) {
        run('python3', ['scripts/voz.py', '--transcrever', '--cenas', CENAS.join(',')]);
        run('python3', ['scripts/alinhar.py']);
      }
      timeline();
      run('python3', ['scripts/legendas.py', 'build/timeline.json']);
      for (const f of formatos) {
        run('node', ['scripts/gravar.js', '--cena', CENAS.join(','), ...flag(f)]);
        if (f === 'h' && CENAS.includes('C01')) thumbFrame();
        run('node', ['scripts/cards.js', ...flag(f)]);
        run('python3', ['scripts/montar.py', ...flag(f)]);
      }
      roteiroFinal();
    } else if (MODO === 'roteiro') {
      timeline(); roteiroFinal();
    } else if (MODO === 'montar') {
      timeline();
      run('python3', ['scripts/legendas.py', 'build/timeline.json']);
      for (const f of formatos) { run('node', ['scripts/cards.js', ...flag(f)]); run('python3', ['scripts/montar.py', ...flag(f)]); }
      roteiroFinal();
    } else {
      console.log('uso: node scripts/pipeline.js video | cena C08 [--voz] | montar');
    }
  } finally {
    if (srv) srv.kill();
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
