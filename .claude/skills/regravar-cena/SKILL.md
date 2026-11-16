---
name: regravar-cena
description: Regrava uma ou mais cenas do vídeo sem refazer tudo. Use quando pedirem para mudar o texto ou a tela de uma cena específica (C01 a C12) ou quando uma cena ficou estranha.
---

# Regravar uma cena

Precisa de `build/` de uma gravação completa anterior. Se `ls build/h/C01.mp4` falhar, só a skill `refazer-video` resolve.

1. Texto: edite a cena em `roteiro.json`. `fala` é o que a voz lê (pronúncia ajustada: "três dê", "vê gê vê"); `legenda` é o que aparece; `titulo` é o lower third. Nunca ajuste a legenda para consertar pronúncia.
2. Tela: as ações ficam em `scripts/cenas.js`, uma função por cena, casadas com palavras da fala por `S.w('palavra')`. Se a palavra aparece mais de uma vez na fala, passe o índice: `S.w('mostra', 2)`.
3. Rode `npm run cena -- C08 --voz` (com `--voz` só se o texto mudou). Aceita várias cenas: `npm run cena -- C03 C08`.
4. Confira no log a linha da cena: `folga` positiva e nenhum "falhou".
5. Rode `python3 scripts/qualidade.py --sem-transcricao` e veja as linhas da cena em `revisao/sincronia.md`.
6. Extraia 3 quadros da cena do vídeo final e olhe.

## Cuidados
- O comando refaz as cenas anteriores em modo rápido para a demo chegar no mesmo estado. A câmera do 3D chega no mesmo ângulo porque depende só do deslocamento total dos arrastos: não troque a distância de um arrasto sem regravar as cenas seguintes da mesma tela (C01–C04, C06–C08).
- Se a duração da fala mudar, as legendas e o `roteiro-final.txt` são refeitos sozinhos.
- O vertical é regravado junto quando `VERTICAL` é `true` em `config.json`.
