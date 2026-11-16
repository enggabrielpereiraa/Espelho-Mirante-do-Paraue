---
name: ensaio-demo
description: Verifica que a demo continua funcionando e que o vídeo ainda consegue ser gravado. Use depois de qualquer mudança em demo/, em scripts/cenas.js ou em seletores, e antes de gravar.
---

# Ensaio da demo

```bash
npm test          # fluxos da demo, sem internet (~25 s)
npm run ensaio    # as 12 cenas do vídeo em modo rápido, horizontal e vertical (~4 min)
```

Passa quando:
- `npm test` termina com `fail 0`;
- o ensaio imprime `ensaio C01 ok` até `C12 ok` nos dois formatos, sem nenhuma linha com `falhou`, `Timeout` ou `Error`;
- não há erro da demo no console (linhas `[demo] error` ou `[demo] pageerror`).

O ensaio deixa um print do fim de cada cena em `build/h/seco/` e `build/v/seco/`. Olhe os das cenas que você mexeu.

## Quando falha
- `hover falhou (seletor)` ou `Timeout ... waiting for locator`: o seletor mudou. Veja a regra de ouro no `CLAUDE.md`; corrija a demo ou `scripts/cenas.js`, o que fizer mais sentido.
- Teste de fluxo falhando: leia a mensagem. Os testes conferem números (contagens, valor com desconto), então uma mudança nos dados fictícios pode exigir atualizar o teste. Mude o teste só se a mudança no dado foi de propósito.
- `.fallback3d` apareceu: o 3D não carregou. Confira `demo/vendor/three.module.min.js`.
