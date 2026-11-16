---
name: refazer-video
description: Refaz os vídeos de apresentação do zero (voz, gravação, montagem e qualidade). Use quando pedirem para refazer o vídeo inteiro, ou depois de trocar a voz, o roteiro todo ou a demo.
---

# Refazer o vídeo inteiro

Leva cerca de 1h30 numa máquina sem GPU. Avise isso antes de começar e rode em segundo plano.

1. Confira o ambiente: `python3 -c "import kokoro_onnx, faster_whisper, cv2"` e `ls models/kokoro models/whisper-small`. Se faltar algo, `npm run preparar`.
2. Se a demo mudou desde a última gravação, rode antes `npm test` e `npm run ensaio`. Não grave com ensaio falhando.
3. Rode `npm run video > build/pipeline.log 2>&1` em segundo plano.
4. Logo depois da etapa de voz, leia as transcrições no log (`grep '"id"' build/pipeline.log`) e confira VGV, CRM, 3D, WhatsApp, Pix e QR Code. Pix costuma voltar como "peaks": os fonemas estão certos, mas avise para ouvirem.
5. No fim, leia `revisao/qualidade-h.json` e `revisao/qualidade-v.json` e conte os `✗` de `revisao/sincronia*.md`.
6. Use a skill `revisar-qualidade` antes de entregar.

## O que relatar
Duração de cada vídeo, loudness (alvo −16 LUFS ±1), trechos pretos, trechos parados, ações fora de ±0,5 s e palavras que o transcritor ouviu diferente. Diga o que você olhou e o que não olhou.

## Avisos no log
- `ações de Cxx passaram N s do fim da cena`: a fala ficou curta para as ações. Encurte pausas em `scripts/cenas.js`, nunca a fala.
- `hover falhou (...)`: seletor mudou na demo. Corrija em `scripts/cenas.js`.
- `quadro N lento`: algo pesado na tela (filtro CSS sobre o 3D). Veja o item sobre `backdrop-filter` no `DECISOES.md`.
