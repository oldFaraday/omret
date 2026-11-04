# omret

Clone de **termo**, **dueto** e **quarteto** feito com as **palavras de cinco letras** da [`biblioteca.json`](biblioteca.json). O nome é "termo" ao contrário.

O jogo é 100% estático: HTML, CSS e JavaScript puro, sem dependências e sem build.

## Rodar

```bash
npm start
# abre em http://localhost:4173
```

Também funciona abrindo `index.html` direto no navegador. O servidor local é recomendado porque a API de área de transferência (botão "Compartilhar") exige um contexto seguro.

## Modalidades

| modalidade | palavras | tentativas |
| --- | --- | --- |
| termo | 1 | 6 |
| dueto | 2 | 7 |
| quarteto | 4 | 9 |

Cada palpite vale para **todos os tabuleiros que ainda estão em jogo**. Quando uma palavra é descoberta, o tabuleiro dela para de receber palpites e mostra a linha vencedora. O teclado combina as dicas de todos os tabuleiros (verde > amarelo > cinza).

Há dois tipos de rodada:

- **Diário:** uma rodada por dia e modalidade, com a mesma palavra para todo mundo que tem o mesmo histórico local.
- **Prática:** não muda com a data. A rodada continua até ser concluída; ao terminar, o contador de acertos e erros é atualizado e uma nova prática começa.

## Regras e detalhes

- Depois de cada palpite, verde = letra certa na posição certa; amarelo = letra existe em outra posição; cinza = letra ausente.
- Acentos e cedilha são preenchidos automaticamente e não contam nas dicas: `açude` vale como `acude`.
- Palavras podem ter letras repetidas.
- No **diário**, **uma palavra nunca é sorteada duas vezes na mesma modalidade**. Os sorteios são distintos dentro da rodada e as palavras já sorteadas ficam registradas no `localStorage`; só voltam a aparecer quando a biblioteca inteira dá a volta (novo ciclo).
- No **modo prática**, cada palavra tem um intervalo de **90 dias** antes de poder ser sorteada de novo. Dentro da mesma prática não há repetição.
- O modo prática tem um contador próprio por modalidade: **palavras certas**, **palavras erradas** e práticas concluídas. Em dueto e quarteto, cada palavra resolvida conta como acerto e cada palavra não resolvida conta como erro.
- Os palpites precisam estar na biblioteca do jogo. A lista completa pode ser consultada em **Como jogar → Ver as palavras aceitas**.
- O **diário** usa uma semente determinística baseada na data e na modalidade. O link "modo prática" mantém o diário salvo e acessível pelo link "voltar ao diário".
- Estatísticas (jogos, vitórias, sequência, recorde e distribuição de tentativas) são guardadas por modalidade. O painel também mostra o contador do modo prática.
- O resultado pode ser compartilhado como uma grade de emojis.
- O tema claro/escuro acompanha o sistema e pode ser alternado no botão de sol/lua.

## Estrutura

```
index.html                    interface
css/estilo.css                estilos, temas e animações
js/palavras.js                palavras geradas a partir da biblioteca
js/jogo.js                    regras, sorteio, persistência e interface
ferramentas/gerar-palavras.mjs  gerador de js/palavras.js
servidor.mjs                  servidor estático mínimo (sem dependências)
biblioteca.json               fonte das palavras
```

## Atualizar a biblioteca

Se `biblioteca.json` mudar, regenere a lista usada pelo jogo:

```bash
npm run palavras
```

O gerador valida cada entrada (cinco letras `a-z` depois de remover acentos), remove duplicatas e ordena as palavras.

## Observação sobre o "diário"

Como o jogo não tem back-end, a palavra do dia é determinística para um histórico local limpo, mas a garantia de não repetição depende das palavras já usadas guardadas no navegador. Dois navegadores com históricos diferentes podem chegar a diários diferentes depois de alguns dias. Essa é a troca necessária para cumprir a regra de não repetir palavras sem um servidor.

O modo prática também é inteiramente local: os sorteios, o contador e a data de liberação de cada palavra ficam no `localStorage`. Limpar os dados do navegador apaga esse histórico.
