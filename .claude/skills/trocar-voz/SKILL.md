---
name: trocar-voz
description: Troca a voz da narração dos vídeos. Use quando pedirem outra voz, voz masculina ou feminina, voz mais natural, ou quando reclamarem que a voz parece de IA.
---

# Trocar a voz

Trocar a voz muda a duração das falas, então o vídeo inteiro precisa ser regravado (~1h30). Por isso: **amostra primeiro, regravação depois da escolha.**

1. Descubra o que está disponível:
   - `kokoro` (offline): `pf_dora` (feminina), `pm_alex` e `pm_santa` (masculinas), e misturas com `af_heart` em `VOZ_OPCOES.kokoro.mistura`.
   - `edge`: precisa de rede para `speech.platform.bing.com`. Teste com `edge-tts --voice pt-BR-FranciscaNeural --text "Teste" --write-media /tmp/t.mp3`.
   - `elevenlabs`: precisa de rede para `api.elevenlabs.io` e de `ELEVENLABS_KEY` e `ELEVENLABS_VOICE` no ambiente. Nunca peça a chave no chat nem grave em arquivo.
2. Gere 3 ou 4 amostras com o texto da C01, normalize com `voz.loudnorm`, transcreva com `voz.transcrever` para conferir a inteligibilidade, converta para mp3 e ponha em `amostras-voz/`. Envie os arquivos para a pessoa ouvir.
3. Só depois da escolha: ajuste `config.json` (`VOZ` e `VOZ_OPCOES`) e use a skill `refazer-video`.
4. Atualize a seção de voz do `DECISOES.md`.

## Franqueza
O Kokoro é limpo, mas um ouvido atento percebe que é sintético. Para não parecer IA, os caminhos são ElevenLabs, as vozes da Microsoft ou uma pessoa gravando as 12 falas. Diga isso em vez de prometer o que o motor não entrega.
