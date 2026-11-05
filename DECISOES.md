# Decisões tomadas sem consulta

Registro do que foi decidido durante a produção, e por quê. Em ordem de impacto.

## 1. Voz: Kokoro (offline), feminina, no lugar do edge-tts
- A rede deste ambiente bloqueia `speech.platform.bing.com` (proxy responde 403), então o `edge-tts` não funciona aqui. A ElevenLabs (`api.elevenlabs.io`) também está bloqueada.
- Usei o **Kokoro-82M** (modelo neural, roda offline na CPU). A primeira versão saiu com a voz masculina `pm_alex`; a pedido, a narração passou a ser **feminina**: mistura de **65% `pf_dora` (pt-BR) + 35% `af_heart`**, velocidade 0,94 (amostra "D" em `amostras-voz/`). A `af_heart` é a voz mais natural do modelo; misturada em minoria, deixa a entonação mais de locutora sem tirar o sotaque brasileiro. O modelo e as vozes vêm pelo npm (`kokoro-q8-shards`, `expo-kokoro`); `scripts/baixar-modelos.sh` refaz isso e confere o SHA-256 do modelo.
- **Limite honesto:** mesmo misturada, é uma voz sintética, e um ouvido atento percebe. Para não parecer IA, os caminhos são ElevenLabs, Microsoft (Francisca/Thalita) ou uma locutora gravando as 12 falas. Os dois primeiros já estão implementados em `scripts/voz.py`: basta liberar o domínio na rede e trocar `VOZ` no `config.json`.
- A fala é sintetizada **frase a frase**, com 0,32 s de pausa depois de cada ponto final; vírgulas ficam com a pausa natural do modelo. O silêncio do começo e do fim de cada frase é aparado.

## 2. Gravação quadro a quadro (relógio virtual) no lugar do screencast em tempo real
- A máquina não tem GPU. O 3D roda em SwiftShader (CPU): parado fica a 60 fps porque a demo só redesenha quando algo muda, mas **girando cai para ~3 fps** em 1920×1080. O screencast do CDP (e o `recordVideo`, plano B) gravariam exatamente isso: vídeo travado.
- Solução: `scripts/lib/vclock.js` congela o tempo da página (`requestAnimationFrame`, `setTimeout/setInterval`, `performance.now` e as animações/transições CSS via Web Animations API) e o Node avança 1/30 s por vez, capturando cada quadro com `Page.captureScreenshot` (CDP, JPEG q92). Resultado: **30 fps exatos**, sem quadro perdido, qualquer que seja a velocidade da máquina. Custa ~10× o tempo real para renderizar.
- Fora da gravação (carregamento, preparação das cenas e modo rápido do `npm run cena`) a página anda em tempo real normalmente.
- Como o tempo é virtual, o "concat demuxer com duração por timestamp" não é necessário: os quadros já saem em ritmo constante e viram o clipe com `-framerate 30`.
- O Chromium roda em modo headless (não há tela nem GPU para o modo com janela), com `--use-angle=swiftshader`.

### 2.1 Sem o blur de 3 px atrás dos modais
- No SwiftShader, o `backdrop-filter: blur(3px)` do `.scrim` (fundo dos modais) sobre o canvas 3D fica cada vez mais caro a cada quadro (de 4 s para mais de 40 s por quadro) e trava a gravação. Durante a gravação o blur é desligado e fica só o escurecimento original do fundo (`rgba(6,7,8,.62)`). Numa máquina com GPU isso não acontece; na demo real o blur continua lá.

## 3. Dependências da demo servidas localmente
- jsDelivr (Three.js 0.160.0) e cdnjs (qrcodejs 1.0.0) estão bloqueados na rede. As mesmas versões foram instaladas pelo npm e o Playwright intercepta essas URLs e responde com os arquivos locais. As fontes do Google (Manrope e JetBrains Mono) também são servidas de `assets/fonts/`. Isso deixa a gravação determinística e independente da internet.
- `demo/index.html` **não foi alterado**.

## 4. Bug da demo corrigido só durante a gravação
- No shader do céu (`demo/index.html`, linha ~2077), o `#include <tonemapping_fragment>` está no meio de uma linha. O GLSL exige diretiva no começo da linha: o shader não compila e o céu não aparece (há erro no console do navegador). **Isso acontece em qualquer navegador, inclusive no do cliente.**
- Na gravação, a página é servida com uma quebra de linha antes do `#include` (`scripts/lib/browser.js`). O arquivo original fica intacto. **Recomendo corrigir na demo real** (trocar `gl_FragColor = vec4(c,1.0); #include` por `gl_FragColor = vec4(c,1.0);\n#include`).

## 5. Legendas como PNG em vez do filtro `subtitles`
- O libass (filtro `subtitles`) não faz caixa de fundo com cantos arredondados. Para cumprir o estilo pedido (Manrope 600, 44/52 px, fundo `rgba(15,16,18,.78)`, cantos de 8 px), cada bloco de legenda é renderizado em HTML → PNG transparente e sobreposto com fade de 120 ms. O `out/legendas.srt` é gerado à parte, com os mesmos tempos e quebras.
- Tempos das legendas: a narração final de cada cena é transcrita (Whisper small) com tempo por palavra e alinhada ao texto da legenda (`scripts/alinhar.py`); a legenda usa o texto do roteiro, nunca o texto transcrito.
- Blocos: até 2 linhas de 42 caracteres, quebrando de preferência em vírgula e evitando terminar linha em palavra de ligação ("a", "de", "que"...).

## 6. Linha do tempo
- Cada cena = 0,5 s de silêncio + fala + 0,8 s de respiro. Assim, entre duas falas há 1,3 s.
- **C01** começa com 3 s de abertura (o card entra e sai sobre o prédio já girando) antes da primeira palavra. O lower third da C01 só entra depois que o card de abertura sai, para não repetir "Espelho 3D" duas vezes na tela.
- **C12**: respiro de 2,2 s depois da fala. O card final entra aos 3 s da cena e fica até o fim (≈10 s, mais que os 5 s mínimos), com fade para preto de 0,8 s no último quadro.
- Fade cruzado de 300 ms quando a cena começa numa rota diferente (C05, C06, C09, C10, C11, C12). A troca de rota é feita fora do trecho gravado, para a cena já abrir na tela certa; dentro das cenas, a navegação é feita clicando no menu lateral (C05 → Clientes, C10 → Financeiro), como um usuário faria.

## 7. Sincronia: ações casadas com as palavras
- Os cliques e passagens de mouse são agendados pelo tempo da palavra que os descreve (`S.w('palavra')` em `scripts/cenas.js`), e não por pausas fixas. Quando as pausas do roteiro (0,9 s, 1,5 s, 1,8 s…) não cabiam no áudio, prevaleceu a sincronia com a fala, como pede a seção 6.3.
- C01: o segundo arrasto volta no sentido contrário, para o prédio terminar de frente (com as janelas à vista) e o "acende no outro" da C02 aparecer. Na demo, o alvo da câmera depende só do deslocamento total do arrasto, então o resultado é sempre o mesmo.
- C05: em 1920×1080 a Visão geral cabe inteira na tela (`#v-page` não rola). Em vez de rolar, o cursor passa pelo VGV vendido, pelas vendas por mês e pelo ranking no momento em que a fala cita cada um. No vertical, a rolagem existe e é feita.
- C10: o fechamento do Pix com `Escape` acontece no corte para a C11 (fora do trecho gravado), para o QR ficar na tela até o fim da fala.
- Toasts: se algum ainda estiver na tela no fim da cena, ele sai com fade nos últimos 0,5 s.
- "Avisar no WhatsApp" só recebe hover, nunca clique.

## 8. Zoom
- C03, C08 e C10: zoom de 1,00 → 1,08 em 2,5 s (ease-in-out), feito em Python/OpenCV com transformação afim subpixel (sem o tremor do `zoompan` e sem o arredondamento para pixel inteiro do `crop`). Na C03 e na C08 o centro é o painel da direita (limitado para não mostrar borda); na C10 não há painel lateral, então o centro é o modal do Pix. Na C03 o zoom volta a 1,00 antes de abrir o apartamento em 3D, que ocupa a tela toda.

## 9. Controle de qualidade
- **freezedetect** roda com `n=-80dB` (e não o padrão de −60 dB): a −60 dB, um cursor de 22 px andando numa tela de 2 megapixels conta como "congelado" (a diferença média fica perto de −74 dB), e isso acusava praticamente todo trecho em que só o cursor se move. Mesmo a −80 dB sobram dois trechos de ~3 s no horizontal (lista de propostas no fim da C04 e painel no começo da C05), em que o cursor anda devagar pela tela e a página fica parada de propósito, porque são os momentos de "segurar o estado" previstos no roteiro.
- **Sincronia** (`revisao/sincronia.md`): cada ação descrita pela fala é comparada com o início da palavra correspondente. Ações que a fala não descreve (fechar o apartamento, voltar para Encomendas, percorrer listas) aparecem com "—".
- **Transcrição final**: o Whisper small ouve a narração do vídeo pronto e o resultado é comparado com as legendas.

## 10. Vertical
- Mesmo roteiro e mesmo áudio, gravado com viewport 432×768 a 2,5× (sai 1080×1920 nativo). O painel é a gaveta da demo: ela é aberta pelo `.panel-handle` quando a cena precisa (C02–C04, C08). Na C08 a gaveta já começa aberta, com o espelho à vista: é um corte seco, e assim o clique no 501 cai na hora da fala.
- Rotas que não estão na barra inferior (Clientes, Financeiro etc.) são abertas pelo hash, no instante da palavra.
- Rolagem: além da vertical, a tabela do financeiro rola na horizontal no celular (a cota em atraso fica fora da tela); a rolagem suave trata os dois eixos.
- C12: antes de gravar, a câmera é recentralizada (`recentrar`), porque o foco no 501 deixa a câmera colada num prédio vizinho no celular.
- Lower third a 300 px da base (acima da área de 220 px e acima dos toasts da demo, que no celular ficam logo acima da barra inferior); legenda 28 px acima do lower third, a 52 px.
- Sem zoom no vertical: a tela já é estreita e o zoom cortaria a gaveta.

## 11. Pronúncia
- Teste feito com Whisper small (CTranslate2 int8, também obtido pelo npm, já que o Hugging Face está bloqueado), sem dica de vocabulário para não enviesar.
- "VGV", "CRM", "3D", "WhatsApp" e "QR Code" voltaram reconhecíveis com as grafias previstas no roteiro. Nenhum ajuste necessário.
- **"Pix"**: os fonemas gerados são os corretos do português (`[ˈpiks]`), mas o Whisper small transcreve como "piques"/"peaks" em qualquer grafia testada ("Pix", "píquis", "pix", "o Pix", "pixe"). Com "com o Pix" o transcritor acertou uma vez e errou na outra. Mantive o texto original do roteiro. **Ouça a C10 (`audio/C10.wav`, últimos 2 s).**

## 12. Música
- `assets/musica.mp3` não existe, então o vídeo sai só com voz. A mixagem com música (−28 LUFS, fades de 2 s e 3 s, ducking com `sidechaincompress` threshold 0.02 / ratio 8 / attack 20 / release 400) está implementada em `scripts/montar.py` e entra automaticamente quando o arquivo existir.
