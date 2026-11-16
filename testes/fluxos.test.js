// Testes dos fluxos principais da demo (os que aparecem na venda do produto).
// Rodar: npm test   (não precisa de servidor aberto nem de internet)
const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DEMO = path.resolve(__dirname, '..', 'demo');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };
let srv, base, browser, ctx, page, erros;

before(async () => {
  srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const f = path.join(DEMO, rel);
    if (!f.startsWith(DEMO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}/`;
  browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});
after(async () => { await browser.close(); srv.close(); });

beforeEach(async () => {
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  // nada de rede externa: a demo tem que funcionar só com o que está em demo/
  await ctx.route(u => !u.href.startsWith(base), r => r.abort());
  page = await ctx.newPage();
  erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  page.on('popup', p => p.close().catch(() => {}));
  await page.goto(base + '#espelho');
  await page.waitForFunction(() => !document.querySelector('#load3d'), null, { timeout: 60000 });
});
afterEach(async () => {
  const e = erros.slice();
  await ctx.close();
  assert.deepEqual(e, [], 'erros no console da demo');
});

const toast = () => page.locator('.toast').first();
const ir = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(150); };

test('o 3D carrega sem internet e sem cair no aviso de fallback', async () => {
  assert.equal(await page.locator('.fallback3d').count(), 0);
  assert.equal(await page.locator('#stage canvas').count(), 1);
  assert.equal(await page.title(), 'Espelho 3D · Mirante do Parque');
});

test('reservar uma unidade disponível muda o status no espelho e nos números', async () => {
  const antes = Number(await page.locator('.stat:has-text("Disponíveis") .v, .card:has-text("Disponíveis") .v').first().innerText().catch(() => 'NaN'));
  await page.click('.mirror button[data-u="602"]');
  await page.click('#panelBody [data-act="reservar"]');
  await page.click('#scrim button[type="submit"]');
  await assert.doesNotReject(toast().waitFor({ state: 'visible' }));
  assert.match(await toast().innerText(), /602 reservad/i);
  assert.match(await page.locator('#panelBody').innerText(), /Reservad/);
  await page.click('[data-act="unsel"]');
  const leg = await page.locator('#panelBody').innerText();
  assert.match(leg, /Reservado 2/, 'a legenda do espelho passa de 1 para 2 reservados');
  if (!Number.isNaN(antes)) assert.match(leg, new RegExp(`\\b${antes - 1}\\b`));
});

test('gerar proposta com desconto leva para a lista e a proposta aparece em primeiro', async () => {
  await ir('#propostas');
  const n0 = await page.locator('#v-page tbody tr').count();
  await ir('#espelho');
  await page.click('.mirror button[data-u="602"]');
  await page.click('#panelBody [data-act="proposta"]');
  await page.fill('#pp-desc', '3');
  assert.match(await page.locator('#pp-final').innerText(), /1\.416\.685/, 'valor com 3% de desconto');
  await page.click('#scrim button[type="submit"]');
  await page.waitForFunction(() => location.hash === '#propostas');
  assert.equal(await page.locator('#v-page tbody tr').count(), n0 + 1);
  const linha = await page.locator('#v-page tbody tr').first().innerText();
  assert.match(linha, /602/); assert.match(linha, /3,0%/); assert.match(linha, /1\.416\.685/);
});

test('mover um cliente no funil tira da etapa atual e põe na próxima', async () => {
  await ir('#clientes');
  const cont = () => page.locator('.kanban .col .col-h .mono').allInnerTexts().then(a => a.map(Number));
  const a = await cont();
  const nome = await page.locator('.kanban .col').first().locator('.kc .t').first().innerText();
  await page.locator('.kanban .col').first().locator('[data-act="avancar"]').first().click();
  const b = await cont();
  assert.equal(b[0], a[0] - 1); assert.equal(b[1], a[1] + 1);
  assert.ok((await page.locator('.kanban .col').nth(1).innerText()).includes(nome));
  assert.equal(a.reduce((x, y) => x + y), b.reduce((x, y) => x + y), 'ninguém some do funil');
});

test('registrar a entrega de uma encomenda tira ela da ficha do morador', async () => {
  await page.click('[data-act="mode"][data-v="condo"]');
  await page.click('.mirror button[data-u="501"]');
  const itens = page.locator('#panelBody [data-act="entregar"]');
  assert.equal(await itens.count(), 2);
  const wa = await page.locator('#panelBody [data-act="avisar"]').first().getAttribute('href');
  assert.match(wa, /^https:\/\/wa\.me\/55\d{10,11}\?text=/, 'o aviso abre o WhatsApp com mensagem pronta');
  await itens.first().click();
  assert.match(await toast().innerText(), /entregue/i);
  assert.equal(await itens.count(), 1);
});

test('a 2ª via de uma cota em atraso mostra QR e código Pix copia e cola', async () => {
  await ir('#financeiro');
  await page.locator('.cota.atrasada').first().click();
  await page.click('#scrim [data-act="pix"]');
  const qr = page.locator('#scrim [data-qr]');
  await qr.waitFor({ state: 'visible' });
  assert.ok(await qr.locator('canvas, img').count() > 0, 'o QR foi desenhado');
  const codigo = await page.locator('#scrim textarea').inputValue();
  assert.match(codigo, /br\.gov\.bcb\.pix/i);
  assert.match(codigo, /1132\.58/, 'o valor da cota está no código');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#scrim').count(), 0, 'Escape fecha o modal');
});

test('o app do morador mostra encomendas e consumo comparado com a média do prédio', async () => {
  await ir('#morador');
  assert.match(await page.locator('#mscroll').innerText(), /Boa tarde, Rafael/);
  await page.click('#mscroll [data-act="mtela"][data-v="correspondencias"]');
  assert.match(await page.locator('#mscroll').innerText(), /Amazon|Mercado Livre/);
  await page.click('[data-act="mtela"][data-v="inicio"]');
  await page.click('#mscroll [data-act="mtela"][data-v="consumo"]');
  assert.match(await page.locator('#mscroll').innerText(), /média do prédio/i);
});

test('o estado salvo sobrevive a recarregar e "Restaurar demo" volta ao início', async () => {
  await page.click('.mirror button[data-u="602"]');
  await page.click('#panelBody [data-act="reservar"]');
  await page.click('#scrim button[type="submit"]');
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#load3d'), null, { timeout: 60000 });
  assert.match(await page.locator('#panelBody').innerText(), /Reservado 2/);
  await page.click('[data-act="reset"]');
  await page.click('[data-act="resetok"]');
  assert.match(await page.locator('#panelBody').innerText(), /Reservado 1/);
});

test('no celular o painel vira gaveta e a barra inferior aparece', async () => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(300);
  assert.ok(await page.locator('#mnav').isVisible());
  assert.ok(!(await page.locator('#nav').isVisible()));
  await page.click('.panel-handle');
  await page.waitForTimeout(400);
  assert.ok(await page.locator('#panel').evaluate(el => el.classList.contains('open')));
});
