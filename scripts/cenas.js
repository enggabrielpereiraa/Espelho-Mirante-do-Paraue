// Ações de cada cena. Cada cena tem:
//   prep(S): roda ANTES de ligar o screencast (fora do vídeo)
//   run(S):  roda gravando; os cliques são casados com as palavras da narração (S.w)
// Horizontal (1920x1080) e vertical (432x768 @2.5) compartilham a lógica; S.v indica o vertical.

const CANVAS = { x0: 330, x1: 1450, y: 560 };      // área do prédio no horizontal
const CANVAS_V = { x0: 120, x1: 320, y: 300 };     // área do prédio no vertical (gaveta recolhida)

// No vertical, o painel é uma gaveta: abre/recolhe pelo .panel-handle
async function gaveta(S, aberta, t) {
  if (!S.v) return;
  const st = await S.page.evaluate(() => document.querySelector('#panel')?.classList.contains('open'));
  if (!!st === aberta) return;
  if (t != null) await S.clickAt('.panel-handle', t); else await S.drv.click('.panel-handle');
  await S.drv.wait(450);
}

const cenas = {
  C01: {
    async run(S) {
      const c = S.v ? CANVAS_V : CANVAS;
      await S.at(1.5);
      // arrasto lento da esquerda para a direita (~260 px em 3 s)
      const dx = S.v ? 120 : 260, x = S.v ? 150 : 700;
      await S.drv.drag(x, c.y, x + dx, c.y, 3000, 6);
      S.mark('giro do prédio');
      await S.drv.moveTo(S.v ? 330 : 1700, S.v ? 700 : 860, 900);
      // "...depois da entrega, cuidar do prédio. Tudo começa aqui, no prédio em 3D":
      // volta devagar no sentido contrário (o alvo da câmera depende só do deslocamento total)
      // e termina de frente para a fachada com as janelas, pronta para a C02
      await S.at(S.w('depois') - 0.3);
      await S.drv.drag(S.v ? 290 : 980, c.y + 20, S.v ? 200 : 780, c.y + 10, Math.max(2600, (S.w('aqui') - S.t()) * 1000), 4);
      S.mark('prédio em 3D (volta de frente)');
      await S.drv.moveTo(S.v ? 340 : 1720, S.v ? 700 : 880, 900);
    },
  },

  C02: {
    async prep(S) { await gaveta(S, true); },
    async run(S) {
      await S.hoverAt('.mirror button[data-u="602"]', S.w('Verde') + 0.1, { label: '602 verde' });
      await S.hoverAt('.mirror button[data-u="704"]', S.w('amarelo') + 0.1, { label: '704 amarelo' });
      await S.hoverAt('.mirror button[data-u="501"]', S.w('vermelho') + 0.1, { label: '501 vermelho' });
      await S.hoverAt('.mirror', S.w('espelho') + 0.2, { fx: 0.12, fy: 0.1, label: 'espelho de vendas' });
      // "mostra a mesma coisa em forma de tabela": passeia devagar pela tabela
      await S.glide('.mirror', S.w('mostra', 2), S.w('Passou') - 1.0, [0.12, 0.1], [0.9, 0.86], { label: 'percorre a tabela' });
      await S.hoverAt('.mirror button[data-u="602"]', S.w('Passou') + 0.3, { label: 'volta ao 602 (acende no prédio)' });
    },
  },

  C03: {
    async run(S) {
      await S.clickAt('.mirror button[data-u="602"]', S.w('Clicando') + 0.35, { label: 'clique no 602' });
      if (!S.v) S.zoom(S.t() + 0.3, null, 'painel');
      await gaveta(S, true);
      await S.hoverAt('#panelBody .price', S.w('preço'), { fx: 0.3, label: 'preço' });
      if (!S.v) await S.hoverAt('#panelBody .p-sub', S.w('metro'), { fx: 0.35, label: 'valor do m²' });
      await S.hoverAt('#panelBody .plan-card', S.w('planta'), { fx: 0.42, fy: 0.45, label: 'planta humanizada' });
      if (!S.v) S.zoomOut(S.w('abrir') - 1.4);
      await S.clickAt('#panelBody [data-act="apto3d"]', S.w('abrir') + 0.2, { fx: 0.85, fy: 0.88, label: 'abrir apartamento em 3D' });
      await S.drv.moveTo(S.v ? 360 : 1640, S.v ? 120 : 470, 800);
      // gira sozinho e, perto do fim, uma inclinação suave
      const fim = S.dur - 0.3;
      const tTilt = Math.min(S.t() + 3.5, fim - 2.6);
      await S.at(tTilt);
      const cx = S.v ? 216 : 760, cy = S.v ? 330 : 520;
      await S.drv.drag(cx, cy, cx + 30, cy - (S.v ? 40 : 70), 1200, 0);
      S.mark('inclina o apartamento');
      await S.clickAt('#apto-fechar', Math.max(S.t() + 0.95, fim - 0.6), { label: 'fecha o apartamento', livre: true });
    },
  },

  C04: {
    async run(S) {
      await gaveta(S, true);
      await S.clickAt('#panelBody [data-act="reservar"]', S.w('reserva') + 0.2, { label: 'reservar' });
      await S.drv.wait(450);
      await S.clickAt('#scrim button[type="submit"]', S.t() + (S.v ? 0.62 : 0.7), { ms: S.v ? 600 : 750, label: 'confirma a reserva (602 fica amarelo)' });
      await S.clickAt('#panelBody [data-act="proposta"]', S.w('proposta') + 0.15, { ms: S.v ? 600 : 750, label: 'gerar proposta' });
      await S.drv.wait(450);
      await S.clickAt('#pp-desc', S.t() + 0.8, { label: 'campo desconto' });
      await S.page.keyboard.press('Control+A'); await S.drv.wait(180);
      await S.drv.type('#pp-desc', '3', 200);
      await S.drv.wait(350);
      await S.clickAt('#scrim button[type="submit"]', S.t() + 0.8, { label: 'envia a proposta -> #propostas' });
      // "e a proposta já aparece na lista": percorre devagar a proposta nova (primeira linha)
      await S.drv.wait(500);
      await S.glide('#v-page tbody tr, #v-page .tbl tr', S.t() + 0.1, Math.min(S.dur - 0.5, S.w('comercial') + 0.6), [0.08, 0.5], [0.72, 0.5], { nth: 1, label: 'proposta nova na lista', livre: true });
    },
  },

  C05: {
    async prep(S) { await S.drv.waitToastsGone(); await S.drv.goHash('#geral'); await S.drv.moveTo(S.v ? 300 : 1250, S.v ? 500 : 300, 300); },
    async run(S) {
      if (S.v) {
        await S.hoverAt('#v-page .kpi', S.w('vê') + 0.1, { label: 'VGV vendido' });
        await S.drv.smoothScroll('#v-page', 520, 1600);
        await S.at(S.w('vendas') - 0.2);
        await S.drv.smoothScroll('#v-page', 9999 /* até o fim: ranking */, 2000);
        S.mark('ranking');
      } else {
        // "Na visão geral, a diretoria acompanha...": o cursor desce devagar até o VGV
        await S.glide('#v-page .kpi', 0.5, S.w('vê') - 0.75, [0.9, -0.6], [0.55, 0.2], { livre: true });
        await S.hoverAt('#v-page .kpi', S.w('vê') + 0.1, { fx: 0.3, label: 'VGV vendido' });
        await S.hoverAt('#v-page .card:has(> .card-h h2:text("Vendas por mês"))', S.w('vendas'), { fx: 0.55, fy: 0.55, label: 'vendas por mês' });
        await S.hoverAt('#v-page .card:has(h2:text("Ranking de corretores"))', S.w('ranking'), { fx: 0.3, fy: 0.42, label: 'ranking dos corretores' });
      }
      await S.clickNav('clientes', S.w('cê') + 0.25, { label: 'abre o CRM' });
      await S.drv.wait(400);
      await S.hoverAt('#v-page [data-act="avancar"]', S.w('etapa'), { label: 'cartão do funil' });
      await S.clickAt('#v-page [data-act="avancar"]', S.w('mover') + 0.25, { label: 'move o cartão de etapa' });
      await S.drv.moveTo(S.drv.x + (S.v ? 40 : 140), S.drv.y + (S.v ? 60 : 90), 800);
    },
  },

  C06: {
    async prep(S) { await S.drv.waitToastsGone(); await S.drv.goHash('#espelho'); await S.drv.wait(400); if (S.v) await gaveta(S, false); },
    async run(S) {
      await S.clickAt('[data-act="luz"][data-v="dia"]', S.w('dia') + 0.05, { label: 'luz: dia' });
      await S.clickAt('[data-act="luz"][data-v="tarde"]', S.w('tarde') + 0.05, { label: 'luz: fim de tarde' });
      await S.clickAt('[data-act="luz"][data-v="noite"]', S.w('noite') + 0.05, { label: 'luz: noite' });
      const c = S.v ? CANVAS_V : CANVAS;
      const x = S.v ? 140 : 820;
      await S.drv.drag(x, c.y, x + (S.v ? 70 : 150), c.y - 6, Math.max(900, Math.min(2000, (S.dur - 0.6 - S.t() - 0.7) * 1000)), 3);
      S.mark('gira à noite');
    },
  },

  C07: {
    async run(S) {
      const c = S.v ? CANVAS_V : CANVAS;
      const x = S.v ? 230 : 980;
      await S.at(0.6);
      await S.drv.drag(x, c.y, x - (S.v ? 70 : 170), c.y, 2600, 4);
      await S.drv.moveTo(S.v ? 300 : 700, S.v ? 200 : 300, 800);
      await S.clickAt('[data-act="mode"][data-v="condo"]', S.w('modo') + 0.25, { label: 'modo condomínio' });
      await S.clickAt('[data-act="ctab"][data-v="encomendas"]', S.w('encomendas') + 0.1, { label: 'aba encomendas' });
      await S.clickAt('[data-act="ctab"][data-v="chamados"]', S.w('chamados') + 0.1, { label: 'aba chamados' });
      await S.clickAt('[data-act="ctab"][data-v="financeiro"]', S.w('contas') + 0.1, { label: 'aba contas em atraso' });
      await S.clickAt('[data-act="ctab"][data-v="encomendas"]', Math.max(S.t() + 1.5, S.dur - 1.0), { label: 'volta para encomendas', livre: true });
    },
  },

  C08: {
    async prep(S) {
      if (!S.v) return;
      await gaveta(S, true);
      await S.page.locator('.mirror button[data-u="501"]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await S.drv.wait(400);
    },
    async run(S) {
      await S.clickAt('.mirror button[data-u="501"]', S.w('Rafael') + 0.1, { label: 'apto do Rafael (501)' });
      if (!S.v) S.zoom(S.t() + 0.3, null, 'painel');
      await gaveta(S, true);
      await S.hoverAt('#panelBody .item', S.w('ficha'), { nth: 0, fx: 0.3, fy: 0.3, label: 'ficha do morador' });
      await S.hoverAt('#panelBody .sect:has-text("Encomendas na portaria") .item', S.w('encomendas'), { nth: 0, fx: 0.35, fy: 0.3, label: 'duas encomendas na portaria' });
      await S.hoverAt('#panelBody .sect:has-text("Encomendas na portaria") .item', S.w('portaria') + 0.1, { nth: 1, fx: 0.35, fy: 0.3, ms: 650 });
      await S.revealHover('#panelBody', '#panelBody .sect:has-text("Chamados") .item', S.w('vazamento'), { nth: 0, fx: 0.35, fy: 0.3, label: 'vazamento na cozinha' });
      await S.revealHover('#panelBody', '#panelBody .contas .ln', S.w('cota'), { nth: 0, fx: 0.55, fy: 0.3, label: 'cota de outubro em atraso' });
      await S.revealHover('#panelBody', '#panelBody [data-act="avisar"]', S.w('WhatsApp') - 0.1, { nth: 0, fx: 0.45, label: 'Avisar no WhatsApp (hover, sem clicar)' });
      await S.clickAt('#panelBody [data-act="entregar"]', S.w('registra') + 0.3, { label: 'registra a entrega' });
      await S.drv.moveTo(S.drv.x + (S.v ? -30 : -60), S.drv.y + (S.v ? 80 : 120), 800);
    },
  },

  C09: {
    async prep(S) { await S.drv.waitToastsGone(); if (S.v) await gaveta(S, false); await S.drv.goHash('#portaria'); await S.drv.moveTo(S.v ? 330 : 1320, S.v ? 200 : 260, 300); },
    async run(S) {
      await S.hoverAt('.lk.oc', S.w('ocupado') - 0.05, { nth: 2, label: 'armário ocupado' });
      await S.hoverAt('.lk.par', S.w('parado'), { nth: 0, label: 'armário parado (amarelo)' });
      if (!S.v) await S.hoverAt('.lk.par', S.w('dias') + 0.1, { nth: 1, ms: 650 });
      await S.clickAt('.enc-grid [data-act="encdet"]', S.w('volume') + 0.15, { nth: 0, fy: 0.35, label: 'abre a encomenda (foto, código, QR)' });
      await S.drv.wait(500);
      await S.hoverAt('#scrim [data-qr] >> visible=true', S.w('QR') - 0.1, { fx: 0.85, fy: 0.85, label: 'QR code' });
      await S.at(S.dur - 0.55);
      await S.page.keyboard.press('Escape'); S.mark('Escape');
    },
  },

  C10: {
    async prep(S) { await S.drv.goHash('#chamados'); await S.drv.moveTo(S.v ? 330 : 1300, S.v ? 160 : 140, 300); },
    async run(S) {
      await S.hoverAt('#v-page :text("fora do prazo há")', S.w('passou'), { nth: 0, label: 'chamado fora do prazo' });
      await S.hoverAt('#v-page :text("fora do prazo há")', S.w('vermelho') + 0.1, { nth: 1, ms: 650, label: 'em vermelho' });
      await S.hoverAt('#v-page .card:has-text("Garantia da construtora")', S.w('garantia'), { nth: 0, fx: 0.4, fy: 0.25, label: 'garantia da construtora' });
      await S.clickNav('financeiro', S.w('financeiro') + 0.1, { label: 'financeiro' });
      if (S.v) {
        // no celular a tabela rola na horizontal: ela já abre posicionada na coluna das cotas (na troca de tela, sem salto visível)
        await S.page.locator('.cota.atrasada').first().evaluate(el => { let p = el.parentElement; while (p && !(p.scrollWidth > p.clientWidth + 2)) p = p.parentElement; if (p) p.scrollLeft = p.scrollWidth; });
      }
      await S.drv.wait(300);
      await S.hoverAt('#v-page .kpi', S.w('inadimplência'), { nth: 1, fx: 0.3, ms: S.v ? 600 : 750, label: 'inadimplência' });
      await S.clickAt('.cota.atrasada', S.w(S.v ? 'sozinha' : 'calculada') + 0.3, { nth: 0, ms: S.v ? 600 : 750, label: 'cota em atraso' });
      if (!S.v) S.zoom(S.t() + 0.2, null, 'centro');
      await S.clickAt('#scrim [data-act="pix"]', S.w('segunda') + 0.2, { label: '2ª via com Pix' });
      await S.drv.wait(400);
      if (!S.v) await S.hoverAt('#scrim [data-qr] >> visible=true', S.w('Pix') - 0.2, { fx: 0.9, fy: 0.9, label: 'QR do Pix' });
    },
  },

  C11: {
    async prep(S) { await S.page.keyboard.press('Escape'); await S.drv.wait(300); await S.page.keyboard.press('Escape'); await S.drv.goHash('#morador'); await S.drv.moveTo(S.v ? 330 : 1350, S.v ? 650 : 720, 300); },
    async run(S) {
      await S.at(S.w('celular') + 0.3);
      await S.clickAt('#mscroll [data-act="mtela"][data-v="correspondencias"]', S.w('encomendas') + 0.1, { label: 'encomendas do morador' });
      await S.clickAt('#mscroll [data-act="mtela"][data-v="inicio"], .mscroll [data-act="mtela"][data-v="inicio"], [data-act="mtela"][data-v="inicio"]', S.w('contas') + 0.2, { label: 'volta ao início (contas e chamados)' });
      if (!S.v) await S.hoverAt('#mscroll [data-act="mtela"][data-v="consumo"]', S.w('chamados') + 0.2, { fx: 0.5 });
      await S.clickAt('#mscroll [data-act="mtela"][data-v="consumo"]', S.w('quanto') + 0.1, { ms: S.v ? 600 : 750, label: 'consumo (água)' });
      await S.drv.wait(250);
      await S.clickAt('#mscroll [data-act="mcons"]:has-text("Gás")', S.w('gás') + 0.1, { ms: 600, label: 'gás' });
      await S.hoverAt('#mscroll .mcard:has(.dim), #mscroll .mcard', S.w('média') + 0.1, { nth: 1, fx: 0.7, fy: 0.45, label: 'comparado com a média do prédio' });
    },
  },

  C12: {
    async prep(S) {
      await S.drv.goHash('#espelho'); await S.drv.wait(400);
      if (S.v) await gaveta(S, true);
      if (await S.page.locator('[data-act="unsel"]').count()) await S.drv.click('[data-act="unsel"]');
      await S.drv.click('[data-act="mode"][data-v="vendas"]');
      await S.drv.click('[data-act="luz"][data-v="tarde"]');
      if (S.v) { await gaveta(S, false); await S.drv.click('[data-act="recentrar"]'); }
      await S.drv.moveTo(S.v ? 180 : 760, S.v ? 300 : 560, 300);
      await S.drv.wait(1800);
    },
    async run(S) {
      const c = S.v ? CANVAS_V : CANVAS;
      const x = S.v ? 160 : 760;
      await S.at(0.3);
      await S.drv.drag(x, c.y, x + (S.v ? 60 : 130), c.y, 4500, 3);
      await S.drv.moveTo(S.v ? 400 : 1520, S.v ? 720 : 1000, 900);   // tira o cursor de cena antes do card final
    },
  },
};

module.exports = { cenas };
