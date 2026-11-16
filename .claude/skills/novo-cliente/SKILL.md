---
name: novo-cliente
description: Adapta a demo para uma incorporadora ou um empreendimento específico. Use quando pedirem para personalizar a demo para um cliente, trocar o nome do empreendimento, da incorporadora ou os números do prédio.
---

# Adaptar a demo para um cliente

## O que pedir (uma vez só)
Nome da incorporadora e sigla curta, nome do empreendimento, bairro e cidade, mês de entrega, número de andares e de unidades por andar, tipologias (área e dormitórios) e, se houver, logo, cor da marca, modelo 3D e fotos.

## O que já dá para mudar hoje
Tudo fica no objeto `CLIENTE`, no topo do `<script>` de `demo/index.html`: `incorporadora`, `sigla`, `empreendimento`, `nomeCurto`, `local`, `entrega`, `entregaLabel`, `sindico`, `andares`, `porAndar`, `armarios`.

1. Trabalhe numa cópia: `demo/clientes/<nome>/index.html` (copie também `vendor/` e `og.png`). A demo do Mirante do Parque é a que o vídeo grava: não a altere para um cliente.
2. Preencha `CLIENTE`. Atualize `<title>`, `description` e as tags `og:` no `<head>`.
3. Mudar `andares` ou `porAndar` muda os números das unidades. Confira que as plantas (`PLANTAS`), os moradores (`MORADORES_RAW`) e as propostas ainda apontam para unidades que existem.
4. Abra a cópia e percorra todas as telas, no computador e no celular (390 px de largura). Procure o nome antigo com `grep -n "Mirante\|Vértice"`.
5. Tire um print de cada tela e mostre.

## O que ainda não existe
- **Tema por cliente** (logo, cor, fonte): as cores estão em variáveis CSS no `:root`, mas não derivam do `CLIENTE`. Trocar `--accent` já muda o destaque; logo e fonte exigem editar o HTML.
- **Prédio real**: o 3D é procedural (caixas). Não há carregamento de `.glb`.
- **Fotos e plantas reais**: as plantas são desenhadas por código.

Esses três itens estão no `PROMPT-MELHORIAS.md` (seções 3.1 e 3.2). Diga isso ao cliente em vez de prometer.

## Vídeo do cliente
O pipeline de vídeo está amarrado aos números do Mirante do Parque (aptos 602, 704, 501). Um vídeo de outro empreendimento exige ajustar `scripts/cenas.js` e `roteiro.json`.
