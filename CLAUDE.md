# Espelho 3D · Mirante do Parque

Produto da Gap Automação para incorporadoras e condomínios. O repositório tem duas partes:

- **`demo/`**: o produto. Uma página só (`index.html`), sem build, com Three.js, qrcodejs e as fontes (IBM Plex) em `demo/vendor/`. Tema claro por padrão; `?tema=escuro` liga o escuro. A cor de destaque é `--accent` no `:root`. Dados fictícios, estado em `localStorage`, data fixa (04/11/2026, 15:20).
- **`scripts/`**: o pipeline que grava a demo e gera os vídeos de divulgação (`out/`).

Leia `README.md` (como usar) e `DECISOES.md` (por que cada coisa é como é) antes de mudar algo grande. O plano de melhorias está em `PROMPT-MELHORIAS.md`.

## Comandos

| Comando | O que faz | Tempo |
|---|---|---|
| `npm run preparar` | Instala dependências e baixa os modelos de voz e transcrição | ~5 min |
| `npm test` | Testes dos fluxos da demo (Playwright, sem internet) | ~25 s |
| `npm run ensaio` | Passa as 12 cenas do vídeo em modo rápido, nos dois formatos, sem gravar | ~4 min |
| `npm run video` | Refaz tudo: voz, gravação, montagem e qualidade (horizontal + vertical) | ~1h30 |
| `npm run cena -- C08 [--voz]` | Regrava só uma cena e remonta | ~10 min |
| `npm run montar` | Só remonta (trocou contato, música, cards) | ~10 min |
| `npm run story` | Story do Instagram a partir das cenas já gravadas | ~1 min |

`npm run cena`, `montar` e `story` precisam de `build/`, que não vai para o Git. Numa máquina nova, rode `npm run video` antes.

## Regra de ouro

O vídeo depende dos seletores da demo: `data-act`, `data-u`, `data-v`, `#panelBody`, `#scrim`, `.mirror`, `.cota.atrasada`, `#mscroll`, `.panel-handle`, `.lk.oc`, `.lk.par`, `.enc-grid`. Antes de renomear ou remover qualquer um, procure em `scripts/cenas.js` e em `testes/`. Depois de qualquer mudança em `demo/`, rode `npm test` e `npm run ensaio`: os dois têm que passar sem nenhum "falhou".

## Decisões que não devem ser desfeitas sem motivo

- **Gravação quadro a quadro com relógio virtual** (`scripts/lib/vclock.js`). Sem GPU, o 3D cai para ~3 fps e a gravação em tempo real sai travada.
- **Sem `backdrop-filter` sobre o canvas 3D.** O custo cresce a cada quadro em renderização por software.
- **Legendas como PNG sobreposto**, não pelo filtro `subtitles` (ele não faz cantos arredondados).
- **Story com fundo claro e chapado, exportado a 10 Mbps.** Fundo escuro com degradê perde qualidade na recompressão do Instagram.
- **A tela se ajusta ao áudio, nunca o contrário.** As ações de cada cena são casadas com as palavras da fala (`S.w('palavra')`).
- **Telefones e e-mails fictícios ficam em faixas que não pertencem a ninguém** (`(11) 90000-xxxx`, `@example.com`): os botões de WhatsApp da demo abrem conversa de verdade.

## Convenções

- Tudo em português do Brasil: código, comentários, mensagens de commit e documentação.
- Nenhum valor de configuração digitado no código: `config.json` (vídeo), `scripts/story-config.json` (story), objeto `CLIENTE` no topo da demo.
- Chaves de API só por variável de ambiente.
- Decisão tomada sem consulta vai para `DECISOES.md`, com o porquê.
- Antes de entregar vídeo, olhe os quadros de `revisao/` (skill `revisar-qualidade`). Medição sem olhar não basta.
