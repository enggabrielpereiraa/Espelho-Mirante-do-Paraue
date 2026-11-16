---
name: story-instagram
description: Gera ou altera o story vertical do Instagram da Gap Automação. Use quando pedirem um story, uma variação dele, ou mudança de texto, cor, ordem ou duração do story.
---

# Story do Instagram

Reaproveita as cenas já gravadas em `build/h/`. Não regrava nada e leva cerca de 1 minuto.

1. Edite `scripts/story-config.json`:
   - `tema`: cores e bitrate.
   - `segmentos`: uma função por item, com `rotulo`, `titulo` (até ~24 caracteres para caber em uma linha), `sub`, `cena`, `inicio` e `dur` em segundos da cena, e `corte` `[x, y, largura]` em pixels da tela 1920×1080 (a altura é largura × 0,625 e tem que caber em 1080).
   - `final`: pergunta, frase e a cena de fundo. Os contatos vêm de `config.json` (`CONTATOS`).
2. Para achar o trecho certo de uma cena, veja os tempos das ações em `build/h/gravacao.json`.
3. Rode `npm run story`.
4. Extraia um quadro por função e o card final de `out/story-instagram.mp4` e olhe: título em uma linha, nada cortado, nada no topo (barra do story) nem embaixo (campo de resposta).

## Não mude sem motivo
- Fundo claro e chapado, sem degradê, e exportação a 10 Mbps. Fundo escuro com degradê vira faixas e blocos depois que o Instagram recomprime.
- Sem narração: story é visto sem som. A faixa de áudio é silenciosa de propósito.

## Dicas para quem posta
Enviar o arquivo original (sem passar pelo WhatsApp) e ativar "Enviar com a mais alta qualidade" no app do Instagram.
