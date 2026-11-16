---
name: revisar-qualidade
description: Confere os vídeos antes de entregar: medições e inspeção visual dos quadros. Use antes de qualquer entrega de vídeo e sempre que disserem que algo ficou estranho no vídeo.
---

# Revisar a qualidade dos vídeos

Medição sem olhar não basta. Os dois passos são obrigatórios.

## 1. Medir
```bash
python3 scripts/qualidade.py            # horizontal
python3 scripts/qualidade.py --vertical
```
Leia `revisao/qualidade-h.json` e `revisao/qualidade-v.json`:
- `duracao`: entre 2:30 e 3:15.
- `loudness_LUFS`: −16 ±1. `true_peak_dBTP`: abaixo de −1.
- `blackdetect`: vazio (fora dos fades).
- `freezedetect`: o detector não enxerga o cursor de 22 px. Para cada trecho listado, extraia dois quadros (início e fim) e veja se o cursor andou. Se nada mudou e não é um "segurar o estado" do roteiro, é problema.
- `sincronia_fora`: vazio. Se não estiver, veja `revisao/sincronia.md` e ajuste a cena em `scripts/cenas.js`.
- `transcricao_diferencas`: liste todas no relatório.

## 2. Olhar
Monte folhas de contato com os quadros de `revisao/h/quadros/` e `revisao/v/quadros/` (18 por folha no horizontal, 27 no vertical) e leia cada uma procurando:
- tela de carregamento ou aviso de 3D indisponível;
- toast cobrindo informação;
- legenda em cima do lower third ou do card final;
- texto cortado, título em duas linhas com palavra órfã;
- tooltip aberto porque o cursor parou em cima do prédio;
- texto selecionado em azul;
- câmera colada numa parede;
- cursor parado no meio da tela por muito tempo.

Quando algo aparecer, regrave só a cena (skill `regravar-cena`).

## Relatório
Diga o que mediu, o que olhou e o que **não** olhou. Não escreva "tudo certo" se só mediu.
