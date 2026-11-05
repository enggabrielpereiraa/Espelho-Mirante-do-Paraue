const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const roteiro = JSON.parse(fs.readFileSync(path.join(ROOT, 'roteiro.json'), 'utf8'));
const p = (...a) => path.join(ROOT, ...a);
function duracoes() {
  const f = p('audio', 'duracoes.json');
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
module.exports = { ROOT, cfg, roteiro, p, duracoes };
