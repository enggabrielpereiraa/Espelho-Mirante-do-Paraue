# PROMPT: Melhorias do Espelho 3D (correções, skills e menos cara de IA)

> **Como usar:** abra o Claude Code na raiz deste repositório (branch `claude/video-apresentacao`) e cole tudo abaixo da linha. Antes, preencha a seção 1. Os itens marcados com **[verificado]** foram conferidos no código em 16/11/2026; os marcados com **[conferir]** são suspeitas que você deve confirmar antes de mexer.

---

Você é um desenvolvedor sênior de produto, com olho de designer. Este repositório tem duas coisas: o **produto** (`demo/index.html`, o Espelho 3D que a Gap Automação vende para incorporadoras e condomínios) e o **pipeline de vídeo** (`scripts/`, que grava a demo e gera os vídeos de divulgação).

Sua tarefa tem três frentes, nesta ordem de prioridade:

1. **Corrigir** o que está quebrado ou frágil.
2. **Tirar a cara de IA** do produto e dos vídeos. Um cliente de incorporadora precisa olhar e pensar "isso foi feito para a minha empresa", não "isso saiu de um gerador".
3. **Criar skills** do Claude Code para as tarefas que se repetem.

Trabalhe em fases (seção 6). Ao fim de cada fase, rode as verificações dela e faça um commit. Não me pergunte nada no meio: quando houver dúvida, tome a decisão mais sensata, anote em `DECISOES.md` e siga. Leia `README.md` e `DECISOES.md` antes de começar: lá está o porquê de cada escolha já feita.

**Regra de ouro:** não quebre o pipeline de vídeo. Ele depende dos seletores da demo (`data-act`, `data-u`, `data-v`, `#panelBody`, `#scrim`, `.mirror`, `.cota.atrasada`, `#mscroll`...). Antes de renomear ou remover qualquer um, procure o uso em `scripts/cenas.js`. Ao fim de cada fase que tocar na demo, rode `node scripts/gravar.js --seco` (ensaio rápido das 12 cenas, sem gravar) e `node scripts/gravar.js --seco --vertical`: os dois precisam passar sem nenhum "falhou".

---

## 1. Configuração (preencher)

```
CLIENTE_PILOTO   = ""     # incorporadora real para a qual a demo será adaptada (ou deixe vazio para manter fictícia)
LOGO_CLIENTE     = ""     # caminho de um SVG/PNG do logo, se houver
COR_CLIENTE      = ""     # cor principal da marca do cliente (hex), se houver
MODELO_3D        = ""     # caminho de um .glb do prédio real, se o arquiteto fornecer
FOTOS            = ""     # pasta com perspectivas/plantas reais do empreendimento, se houver
VOZ              = "kokoro"   # "kokoro" | "edge" | "elevenlabs" | "gravada" (ver 4.2)
```

Tudo o que estiver vazio continua funcionando com o conteúdo fictício atual. Nada disso pode ficar digitado no código: vai para `config.json` (vídeo) e para o objeto `CLIENTE` no topo da demo.

---

## 2. Correções

### 2.1 Demo (`demo/index.html`)

1. **[verificado] HTML inválido.** O `<head>` fecha na linha 7, e o `<title>`, os `<link>` das fontes e o `<style>` principal ficam dentro do `<body>`. Reorganize: um `<head>` só, com charset, viewport, title, description, fontes e estilos.
2. **[verificado] Assinatura de ferramenta de IA.** Linha 10: `<meta name="claude:viewport-fit-sides" content="cover">`. Remova. Procure por qualquer outro resto de gerador (comentários do tipo "Layout: ...", nomes de variável genéricos, metatags estranhas).
3. **[verificado] Shader do céu não compila.** Linha ~2077: `gl_FragColor = vec4(c,1.0); #include <tonemapping_fragment>` tem a diretiva no meio da linha. Quebre a linha antes do `#include`. Depois disso, remova o remendo equivalente em `scripts/lib/browser.js` (a rota que reescreve o HTML) e confira que não há mais erro de shader no console.
4. **[verificado] Sem favicon, sem `meta description`, sem Open Graph.** Quando o link da demo é colado no WhatsApp, não aparece nada. Adicione favicon (SVG embutido), description e as tags `og:title`, `og:description`, `og:image`.
5. **[verificado] Dependências só por CDN.** Three.js vem de `cdn.jsdelivr.net` por `import()` dinâmico e o QR de `cdnjs`. Em rede corporativa bloqueada, o 3D some e cai no aviso de fallback. Empacote as duas dependências localmente (pasta `demo/vendor/`) e mantenha a CDN só como plano B.
6. **[verificado] E-mails `@example.com` e telefones em sequência** (`551190000` + número do apto) nos moradores fictícios. Gere dados que pareçam reais (ver 3.4) e mantenha o aviso de dados fictícios só no rodapé.
7. **[verificado] `backdrop-filter: blur` no fundo dos modais** sobre o canvas WebGL. Em máquina sem GPU o custo cresce a cada quadro (foi o que travou a gravação). Meça em um notebook comum; se pesar, troque por um fundo sólido um pouco mais escuro.
8. **[conferir] Arquivo único de 2.405 linhas** com CSS, dados, estado, telas e 3D. Separe em módulos ES (`dados.js`, `estado.js`, `telas/*.js`, `cena3d.js`, `estilos.css`) sem framework e sem etapa de build obrigatória. Mantenha a possibilidade de gerar um HTML único para enviar ao cliente (`npm run empacotar`).
9. **[conferir] Estado em `localStorage` com versão fixa (`v === 3`).** Confirme o que acontece com um estado salvo de versão antiga: deve migrar ou reiniciar com aviso, nunca quebrar a tela.
10. **[conferir] Acessibilidade.** Há 27 `aria-label`, `:focus-visible` e `prefers-reduced-motion`, o que é um bom começo. Falta conferir: navegação completa por teclado no espelho de vendas e no CRM (mover cartão sem mouse), foco preso dentro dos modais, contraste dos textos `--fg3` sobre `--s1` (mínimo 4,5:1) e leitura de tela dos status (cor não pode ser a única pista: verde/amarelo/vermelho precisam de texto ou ícone).
11. **[conferir] Ações que só fingem.** Liste cada botão que mostra um toast mas não muda nada de verdade ("Copiar código", "Cobrar no WhatsApp", exportações). Ou faz, ou sai da tela.
12. **Testes.** Não existe nenhum. Crie testes Playwright (`testes/`) para os fluxos que vendem o produto: reservar unidade, gerar proposta, mover cliente no funil, registrar entrega de encomenda, abrir 2ª via com Pix, trocar para o app do morador. Rodam com `npm test` em menos de 2 minutos, com o 3D ligado.

### 2.2 Pipeline de vídeo (`scripts/`)

1. **[verificado] Sem `requirements.txt`.** As dependências Python estão só no README. Crie `requirements.txt` com versões fixas (inclua `av`, que precisou de atualização manual para o `faster-whisper` funcionar) e um `npm run preparar` que instala tudo e baixa os modelos.
2. **[verificado] `build/` não vai para o repositório**, então `npm run cena` e `npm run story` só funcionam depois de um `npm run video` completo (~1h30). Guarde os clipes limpos de cada cena (`build/h/Cxx.mp4`, `build/v/Cxx.mp4`) e o `gravacao.json` em Git LFS ou num release, e faça os scripts baixarem quando faltarem.
3. **[verificado] O replay rápido falha no hover do QR da C09** (`#scrim [data-qr] >> visible=true` não fica visível a tempo no modo rápido). Não afeta o vídeo, mas suja o log. Corrija.
4. **[verificado] `freezedetect` não enxerga o cursor.** Mesmo a −80 dB, trechos em que só o cursor de 22 px se move são acusados como congelados. Troque a verificação por uma comparação de quadros que ignore a legenda e considere o cursor (por exemplo, diferença máxima por bloco em vez de média da tela).
5. **[verificado] "Pix" e "QR Code" na narração.** O transcritor ouve "peaks" e, no vídeo final, "que é recode". Resolva na fala (`roteiro.json`, campo `fala`) testando grafias, ou regrave essas duas frases com outra voz.
6. **[conferir] Marcas de sincronia erradas quando uma palavra se repete** (`S.w('mostra')` pegava a primeira ocorrência). Faça `S.w` avisar quando a palavra aparece mais de uma vez na fala e nenhum índice foi passado.
7. **[conferir] Caminhos e valores soltos no código:** posições de arrasto em pixels dentro de `cenas.js` (`CANVAS`, `CANVAS_V`), tempos de fade em `montar.py`. Leve para um arquivo de configuração por formato.
8. **Nome do repositório** está com erro de digitação ("Paraue"). Não renomeie sozinho: só registre no relatório final.

---

## 3. Produto com menos cara de IA

O que denuncia hoje, em ordem de peso:

### 3.1 Identidade visual genérica
**Diagnóstico [verificado]:** fundo grafite `#0F1012`, destaque cobre `#C98A5E`, Manrope nos títulos e JetBrains Mono em rótulos pequenos de caixa alta com espaçamento largo. É exatamente a combinação que os geradores produzem por padrão. A marca fictícia "Vértice Incorporadora" reforça.

**O que fazer:**
- Criar um sistema de **tema por cliente**: o objeto `CLIENTE` passa a carregar logo, cor principal, cor de apoio e fonte. A interface inteira deriva dessas variáveis. Se `COR_CLIENTE` estiver vazia, use um tema neutro **claro** como padrão (incorporadoras apresentam em sala iluminada e em projetor; tema escuro fica como opção).
- Trocar a dupla Manrope + mono em caixa alta. Use **uma** família sem serifa com personalidade discreta (por exemplo, Inter Tight, Figtree ou a fonte da marca do cliente) e reserve fonte mono só para números de tabela e códigos. Rótulos em caixa normal, sem espaçamento largo.
- Remover o que é enfeite: bordas de 1 px em tudo, cantos arredondados iguais em todos os elementos, "pills" coloridas para qualquer status, gradientes sutis. Um produto feito por gente escolhe **onde** usar destaque.
- Hierarquia: hoje todos os cartões têm o mesmo peso. Em cada tela, decida qual é o número ou a ação principal e deixe o resto recuar.

### 3.2 O prédio 3D
**Diagnóstico [verificado]:** prédio e cidade são caixas (`BoxGeometry`) com textura procedural de janelas e árvores de icosaedro. É bonito, mas é claramente genérico: não é o prédio de ninguém.

**O que fazer:**
- Se `MODELO_3D` existir, carregar o `.glb` real (com `GLTFLoader` e compressão Draco) e mapear cada unidade para a malha da fachada. Documentar o formato esperado para o arquiteto (nomes de malha por unidade).
- Sem modelo real: melhorar a fachada procedural a partir de dados do empreendimento (número de pavimentos, unidades por andar, varandas, cor da fachada, térreo com pilotis) em vez de valores fixos, e trocar a cidade genérica por um entorno discreto (quadra, rua, vizinhos baixos em cinza claro) que não dispute atenção.
- Luz: os três presets são bons. Acrescente o norte real do terreno, para o sol da "tarde" bater na fachada certa. Isso é argumento de venda (sol da manhã ou da tarde em cada unidade).

### 3.3 Texto
**Diagnóstico:** os textos são corretos, mas neutros demais, com frases de sistema ("Clique em um apartamento no prédio ou no espelho para ver os detalhes").

**O que fazer:**
- Reescrever a interface com o vocabulário do mercado imobiliário brasileiro: tabela de vendas, espelho, repasse, sinal, parcelas de obra, chaves, habite-se, memorial descritivo, vaga determinada, permuta, distrato. Um corretor precisa se reconhecer.
- Mensagens vazias e de erro escritas como gente fala ("Nenhuma encomenda parada. Portaria em dia.").
- Tirar toda frase explicativa que só existe porque é uma demo.

### 3.4 Dados
- Nomes, telefones, e-mails e valores coerentes entre si (o morador que comprou com determinado corretor aparece no ranking dele; o VGV fecha com a soma das unidades; as datas respeitam a entrega). Hoje isso é gerado por fórmula **[conferir]**.
- Imperfeições reais: uma proposta recusada com motivo, uma unidade em distrato, um chamado reaberto, um morador sem telefone cadastrado. Demo certinha demais parece falsa.
- Se `FOTOS` existir, usar as perspectivas e plantas reais no lugar das plantas desenhadas por código.

### 3.5 Funções que faltam para parecer produto
Escolha as três de maior impacto e implemente de verdade; liste as outras no relatório:
- Proposta em PDF com a identidade do cliente (hoje não há exportação nenhuma **[verificado]**).
- Tabela de vendas imprimível (o corretor leva para o plantão).
- Link de unidade para mandar no WhatsApp, com imagem de prévia.
- Simulador de pagamento (entrada, parcelas de obra, repasse).
- Histórico de quem mudou o quê (reserva feita por quem, quando).

---

## 4. Vídeos com menos cara de IA

### 4.1 Diagnóstico
- **Voz sintética.** É o que mais entrega. A mistura atual (Kokoro, 65% `pf_dora` + 35% `af_heart`) é limpa, mas tem entonação regular demais.
- **Ritmo uniforme.** Toda cena tem 0,5 s de silêncio, fala e 0,8 s de respiro. Vídeo editado por gente varia.
- **Numeração "02 / 12" no lower third** e legenda sempre no mesmo lugar dão cara de template.
- **Sem trilha, sem som de interface.**
- **Cursor perfeito demais:** sempre a mesma curva, mesma velocidade, sempre no centro do botão.

### 4.2 O que fazer
1. **Voz.** Implementar `VOZ = "gravada"`: o pipeline usa arquivos `audio/gravado/Cxx.wav` gravados por uma pessoa (ou por mim), normaliza, alinha com Whisper e ajusta a tela à duração, como já faz com as outras vozes. Documentar no README como gravar (microfone, distância, um arquivo por cena, o roteiro para ler). Manter `edge` e `elevenlabs` funcionando.
2. **Trilha.** Se `assets/musica.mp3` não existir, o relatório final deve dizer com todas as letras que o vídeo saiu sem música e indicar três fontes de trilha sem direitos autorais (YouTube Audio Library, Pixabay Music, Uppbeat), sem baixar nada sozinho.
3. **Som de interface** opcional: clique discreto (−30 LUFS) em cada marca de clique do `gravacao.json`. Desligado por padrão em `config.json`.
4. **Ritmo.** Deixar o respiro variar com o conteúdo: mais curto entre cenas da mesma tela, mais longo antes de mudar de assunto (vendas → condomínio). Abrir com 1 s do prédio girando antes do título.
5. **Lower third.** Tirar a numeração. Só o título, menor, e sumindo depois de 3 s em vez de ficar a cena inteira.
6. **Cursor.** Variar a duração do movimento com a distância (lei de Fitts), errar o centro do alvo por alguns pixels, fazer pequenas pausas antes de clicar em algo importante e nenhum movimento "de passeio" sem motivo.
7. **Abertura e fechamento com marca.** Usar o logo da Gap Automação (se eu colocar `assets/logo.svg`) no card final e na thumbnail.
8. **Story.** Manter o fundo claro chapado (decisão registrada: fundo escuro com degradê perde qualidade na recompressão do Instagram). Criar duas variações de 15 s, uma só de vendas e uma só de condomínio, além da versão completa.

---

## 5. Skills do Claude Code

Crie em `.claude/skills/<nome>/SKILL.md`, cada uma com `name`, `description` (dizendo **quando** usar) e um passo a passo curto que aponte para os scripts existentes em vez de repetir o que eles fazem. Crie também um `CLAUDE.md` na raiz com: o que é o projeto, os comandos principais, a regra de ouro dos seletores e as decisões que não devem ser desfeitas (gravação quadro a quadro, fundo claro no story, legendas como PNG).

| Skill | Quando usar | O que faz |
|---|---|---|
| `refazer-video` | "refaz o vídeo", troca de voz ou de roteiro inteiro | Confere ambiente e modelos, roda `npm run video`, lê `revisao/qualidade-*.json` e devolve duração, loudness, pretos, congelamentos e ações fora de sincronia. |
| `regravar-cena` | "muda o texto da C08", "a cena tal ficou estranha" | Edita `roteiro.json` se preciso, roda `npm run cena -- Cxx [--voz]`, confere a sincronia só daquela cena e mostra 3 quadros dela. |
| `story-instagram` | "faz um story", "muda o story" | Edita `scripts/story-config.json`, roda `npm run story`, mostra um quadro por função e o card final. Lembra do fundo claro e dos 10 Mbps. |
| `trocar-voz` | "quero outra voz" | Gera amostras da C01 com as vozes disponíveis, manda os arquivos e só regrava depois da escolha. Explica com franqueza o limite de cada motor. |
| `revisar-qualidade` | antes de qualquer entrega | Roda `scripts/qualidade.py` nos dois formatos, extrai os quadros de revisão e **olha** cada folha de contato procurando: tela de carregamento, toast cobrindo informação, legenda sobre o lower third, texto cortado, 3D faltando. |
| `ensaio-demo` | depois de qualquer mudança em `demo/` | Roda `node scripts/gravar.js --seco` nos dois formatos e os testes Playwright. Falha se houver qualquer "falhou" ou seletor ausente. |
| `cara-de-ia` | revisão de interface, texto ou vídeo | Lista de verificação das seções 3 e 4 deste prompt, aplicada ao que mudou: paleta e fontes padrão de gerador, rótulos mono em caixa alta, pills em excesso, texto neutro de sistema, dados certinhos demais, ritmo uniforme, restos de ferramenta no código. Devolve achados com arquivo e linha. |
| `novo-cliente` | "adapta para a incorporadora X" | Recebe nome, logo, cor, número de andares e unidades por andar; preenche `CLIENTE`, gera o tema, ajusta o prédio procedural e roda `ensaio-demo`. |

---

## 6. Fases

0. **Leitura e linha de base.** Leia README, DECISOES e os scripts. Rode os dois ensaios `--seco` e guarde a saída como referência. Tire um print de cada tela da demo (desktop e celular) em `revisao/antes/`.
1. **Correções da demo** (2.1, itens 1 a 7). Ensaio precisa passar.
2. **Testes** (2.1, item 12).
3. **Skills e CLAUDE.md** (seção 5). A partir daqui, use as skills que você criou.
4. **Modularização** (2.1, item 8) e demais itens **[conferir]** da 2.1.
5. **Identidade e texto** (3.1, 3.3, 3.4). Print de cada tela em `revisao/depois/`.
6. **Prédio 3D** (3.2).
7. **Funções novas** (3.5, as três escolhidas).
8. **Pipeline** (2.2).
9. **Vídeos** (seção 4). Como a demo mudou, ajuste `scripts/cenas.js`, regrave tudo e rode `revisar-qualidade`.
10. **Entrega.** Atualize README e DECISOES.

Se o tempo acabar, pare ao fim de uma fase, nunca no meio.

---

## 7. Relatório final

Responda em português, curto:
- o que foi corrigido, por item das seções 2.1 e 2.2 (feito / não feito / não era problema);
- antes e depois de três telas (caminhos dos prints);
- as skills criadas e um exemplo de frase que dispara cada uma;
- o que continua com cara de IA e por quê (voz, modelo 3D genérico, falta de fotos reais...), sem suavizar;
- o que depende de mim: logo, cor, modelo 3D, fotos, gravação de voz, trilha, liberação de rede;
- resultado dos testes, dos dois ensaios e das medições de qualidade dos vídeos novos.
