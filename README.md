# Vídeo de apresentação · Espelho 3D (Mirante do Parque)

O vídeo comercial é gerado por código, de ponta a ponta: voz, gravação da demo funcionando de verdade, cards, legendas, montagem e controle de qualidade. Nenhuma etapa é editada à mão.

## O que sai em `out/`

| Arquivo | O que é |
|---|---|
| `apresentacao-1080p.mp4` | 1920×1080, 30 fps, H.264 (CRF 18, preset slow), AAC 192 kbps 48 kHz |
| `apresentacao-vertical.mp4` | 1080×1920 para Reels/TikTok, mesma narração e legendas |
| `legendas.srt` | Legendas em arquivo separado |
| `thumbnail.png` | 1280×720 |
| `roteiro-final.txt` | Roteiro com os tempos de cada cena |

O controle de qualidade fica em `revisao/`: `sincronia.md` (cada clique × a palavra da fala), `qualidade-h.json` / `qualidade-v.json` (loudness, blackdetect, freezedetect, diferenças da transcrição) e um quadro a cada 3 s em `revisao/h/quadros/` e `revisao/v/quadros/`.

## Requisitos

- Node 20+ e Python 3.10+
- ffmpeg e ffprobe no PATH
- Playwright com Chromium (`npx playwright install chromium`, se ainda não tiver)
- Pacotes Python: `pip install kokoro-onnx soundfile faster-whisper opencv-python-headless numpy` (e `edge-tts` se for usar a voz da Microsoft)
- `npm install` nesta pasta

Os modelos de voz e de transcrição (cerca de 330 MB) são baixados pelo npm na primeira execução (`npm run modelos`) e ficam em `models/`. Não precisa de GPU.

## Refazer o vídeo inteiro

```bash
npm install
npm run video
```

Isso gera os 12 áudios, alinha as legendas, grava as 12 cenas numa sessão só (horizontal e, se `VERTICAL` estiver `true`, vertical), monta, exporta e roda as verificações. O servidor HTTP da demo (`localhost:8080`) é aberto e fechado automaticamente.

Tempo aproximado numa máquina de 4 núcleos sem GPU: 6 min de voz, ~35 min de gravação horizontal, ~35 min de gravação vertical e ~10 min de montagem. A gravação é quadro a quadro (ver `DECISOES.md`), por isso o vídeo sai liso mesmo numa máquina lenta.

## Trocar o texto de uma cena e regravar só ela

1. Edite a cena em `roteiro.json`:
   - `fala`: o que a voz lê (pode ter a pronúncia ajustada, como "três dê" ou "vê gê vê");
   - `legenda`: o que aparece escrito;
   - `titulo`: o lower third.
2. Rode:

```bash
npm run cena -- C08 --voz
```

`--voz` gera de novo o áudio da cena. Sem ele, só a tela é regravada (útil quando o problema é visual). Dá para passar mais de uma cena: `npm run cena -- C03 C08 --voz`.

O comando abre uma sessão limpa, refaz as cenas anteriores em modo rápido e sem gravar (para a demo chegar no mesmo estado), grava só a cena pedida e remonta o vídeo. Se o tamanho da fala mudar muito, confira se as ações da cena ainda cabem: as ações ficam em `scripts/cenas.js` e são casadas com as palavras da fala (`S.w('palavra')`).

Para só remontar (por exemplo, depois de trocar o `SEU_CONTATO` no `config.json`), use `npm run montar`.

## Trocar a voz

Em `config.json`, campo `VOZ`:

- `"kokoro"` (padrão): offline, voz masculina pt-BR `pm_alex`. Ajuste a velocidade em `VOZ_OPCOES.kokoro.velocidade` (1,0 = normal).
- `"edge"`: `pt-BR-AntonioNeural`, grátis, precisa de internet com acesso a `speech.platform.bing.com`.
- `"elevenlabs"`: melhor qualidade. Defina a chave e a voz **no ambiente**, nunca em arquivo:

```bash
export ELEVENLABS_KEY=...      # sua chave
export ELEVENLABS_VOICE=...    # ID de uma voz masculina pt-BR da sua conta
```

Depois de trocar a voz, gere tudo de novo com `npm run video` (as durações mudam, e a tela acompanha o áudio).

## Música

Coloque uma trilha sem direitos autorais em `assets/musica.mp3` e rode `npm run montar`. Ela entra a −28 LUFS, com fade de 2 s na entrada, 3 s na saída e ducking automático sob a voz. Sem o arquivo, o vídeo sai só com a voz.

## Estrutura

```
config.json          configuração (nome, contato, voz, vertical)
roteiro.json         texto de cada cena: fala, legenda, título, ações
demo/index.html      a demo (não é alterada)
scripts/
  pipeline.js        orquestra as etapas (npm run video / cena / montar)
  voz.py             um áudio por cena, loudnorm em duas passadas (−16 LUFS, −1,5 dBTP)
  alinhar.py         tempo de cada palavra (Whisper) alinhado ao roteiro
  legendas.py        blocos de legenda + out/legendas.srt
  cenas.js           ações de cada cena, casadas com a fala
  gravar.js          gravação quadro a quadro (relógio virtual + CDP)
  cards.js           abertura, lower thirds, card final, legendas e thumbnail (HTML → PNG)
  montar.py          zoom, cortes, fades, cards, legendas, áudio e exportação
  qualidade.py       loudness, blackdetect, freezedetect, quadros de revisão, sincronia, transcrição
  lib/               navegador (cursor falso, movimentos com easing), relógio virtual, linha do tempo
```

As decisões tomadas durante a produção estão em `DECISOES.md`.
