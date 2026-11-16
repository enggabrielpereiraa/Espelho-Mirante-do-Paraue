---
name: cara-de-ia
description: Revisa interface, texto ou vídeo procurando o que denuncia que foi gerado por IA. Use em revisões de design ou de texto, antes de mostrar algo a um cliente, e quando pedirem para deixar o projeto com menos cara de IA.
---

# Menos cara de IA

Aplique a lista ao que mudou (ou ao que pediram para revisar) e devolva achados com arquivo e linha, do mais visível para o menos. Não corrija sem dizer o que achou.

## Código e arquivos
- Restos de ferramenta: metatags estranhas (`claude:*`), comentários que descrevem o óbvio, nomes genéricos (`data`, `item`, `handleClick`), blocos repetidos com variação mínima.
- HTML fora do lugar (`<title>` no `<body>`), dependências só por CDN, ausência de favicon e descrição.
- Dados de exemplo evidentes na tela: `example.com`, "Lorem ipsum", telefones em sequência, "Empresa X".

## Interface
- Paleta e fontes padrão de gerador: fundo quase preto com um único destaque quente, Manrope ou Inter em tudo, fonte mono em rótulos pequenos de caixa alta com espaçamento largo.
- Tudo com o mesmo peso: cartões iguais, mesma borda de 1 px, mesmo raio de canto, "pill" colorida para qualquer status.
- Gradientes sutis, brilhos e sombras sem função.
- Emoji como ícone.
- Tela sem decisão: qual é o número ou a ação principal? Se tudo chama atenção, nada chama.
- Nenhum sinal do cliente: logo, cor, nome do empreendimento, fotos reais.

## Texto
- Frase de sistema, neutra e explicativa ("Clique em um item para ver os detalhes").
- Vocabulário que não é do ofício. Aqui o ofício é incorporação e condomínio: tabela de vendas, espelho, repasse, sinal, chaves, habite-se, memorial, distrato, cota, assembleia.
- Travessão em excesso, listas de três adjetivos, "não é só X, é Y", títulos em forma de slogan.
- Mensagem vazia sem personalidade ("Nenhum item encontrado").

## Dados
- Certinhos demais: nenhuma proposta recusada, nenhum chamado reaberto, nenhum cadastro incompleto.
- Números que não fecham entre telas (VGV, contagens, ranking).
- Nomes e valores gerados por fórmula visível.

## Vídeo
- Voz sintética com entonação regular.
- Ritmo igual em todas as cenas; mesma pausa antes e depois de toda fala.
- Numeração de template no lower third ("02 / 12").
- Cursor sempre com a mesma curva, a mesma velocidade e no centro exato do botão.
- Sem trilha e sem som nenhum de ambiente.

## Como relatar
Para cada achado: onde está, por que denuncia e a correção proposta. Separe o que dá para resolver no código do que depende de material do cliente (logo, cor, modelo 3D, fotos, voz gravada).
