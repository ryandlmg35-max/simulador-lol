# LoL Bracket Builder

Quero criar um site chamado LOL Esports, um simulador de tabelas de campeonatos de League of Legends. A ideia central: o usuário escolhe um campeonato (real, oficial da Riot, tipo CBLoL, LCS, LCK, LPL, LEC, Worlds, MSI, etc.), vê a tabela/chave daquele campeonato com os times reais, e pode simular o campeonato inteiro sozinho: inserir resultados de partidas, avançar times de fase, definir o campeão, etc. Tudo local/editável, como um "modo sandbox" de torneio.

1. Estrutura geral do app

Página inicial: lista de campeonatos disponíveis, em cards (logo do campeonato, nome, região, temporada/split). Botão para "Criar novo campeonato" também.

Página do campeonato: mostra a tabela/chave daquele campeonato specific, com abas se ele tiver múltiplas fases (ex: Fase de Grupos + Playoffs).

Modo de edição: em cada campeonato, o usuário pode entrar em "modo editor" para:

Editar nome e logo do campeonato

Editar nome, sigla e logo de cada time

Adicionar/remover times

Resetar a simulação (zerar todos os resultados)

2. Formatos de tabela/fase que o sistema precisa suportar

O sistema deve ter um "motor de formatos" reutilizável, pois um campeonato pode ter uma ou mais fases, cada uma com um formato diferente:

a) Fase de Grupos (Round Robin)

Times divididos em grupos (1 grupo ou múltiplos grupos)

Todos jogam contra todos (turno único ou ida e volta)

Tabela de classificação automática: V, D, saldo de sets/games, pontos, critérios de desempate

Ao clicar numa partida, o usuário escolhe o vencedor (e opcionalmente o placar, ex: 2-1, 3-2 em Bo3/Bo5)

A tabela reordena automaticamente conforme os resultados

b) Fase Suíça (Swiss Stage) — como o formato usado hoje no MSI/Worlds

Times começam com 0-0

Cada rodada, times com o mesmo retrospecto (ex: 1-0 contra 1-0) são pareados

Sistema de vitórias/derrotas necessárias para classificar (ex: 3 vitórias classifica, 3 derrotas elimina)

Precisa gerar os confrontos da próxima rodada automaticamente com base nos resultados (pareamento por recorde), com opção de ajuste manual pelo usuário

Exibir visualmente como um "bracket suíço" (colunas por rodada/recorde, ex: 0-0 → 1-0/0-1 → 2-0/1-1/0-2 → eliminados/classificados)

c) Playoffs / Mata-mata

Eliminação simples: chave tradicional (quartas, semis, final)

Eliminação dupla: com chave superior (upper bracket) e chave inferior (lower bracket), incluindo:

Times caem da chave superior para a inferior ao perder

Chave inferior converge de volta pra Grande Final

Opção de "reset de bracket" (se o time da chave inferior vence a Grande Final, joga um segundo jogo decisivo) — comum em formatos tipo LCS/CBLoL

Exibição visual em formato de bracket/árvore, com linhas conectando os confrontos, ao estilo de site esportivo (Liquipedia/Bracket Genie)

Usuário clica no vencedor de cada confronto e o time avança automaticamente pra próxima fase da chave

d) Combinações

O sistema deve permitir montar um campeonato com múltiplas fases em sequência, por exemplo:

Fase de grupos → Playoffs (eliminação simples)

Fase suíça → Playoffs com chave dupla

Ida direto para playoffs (formato só de mata-mata)

Os classificados de uma fase devem poder ser "puxados" automaticamente para a fase seguinte (ex: top 4 do grupo avançam pro playoff)

3. Edição de dados

Campeonato: nome, logo (upload de imagem), região, temporada/ano, formato (montado a partir dos blocos de fase acima)

Times: nome, sigla/tag, logo (upload de imagem), cor (opcional, pra customizar visual da tabela)

Upload de imagem deve funcionar bem (logos em PNG/SVG com fundo transparente)

Tudo editável a qualquer momento, mesmo depois de criado

4. Persistência de dados

Os dados (campeonatos, times, resultados, estado da simulação) precisam ser salvos, para não se perder ao atualizar a página

Sugiro usar Supabase (integração nativa do Lovable) como banco de dados, para guardar: campeonatos, times, partidas, resultados e configurações de cada usuário

Se possível, permitir exportar/importar o estado de um campeonato (JSON) pra fazer backup ou compartilhar

5. Estilo visual

Visual inspirado em sites de esports (tipo Liquipedia, Leaguepedia, ou o hub oficial da Riot/LoL Esports)

Tema escuro como padrão, com cores de destaque (dourado/azul, referência à identidade visual do LoL)

Logos dos campeonatos e times em destaque

Tabelas de classificação bem legíveis (com zebra striping, cores de destaque para zona de classificação/eliminação)

Brackets de playoff visualmente claros, com linhas conectando os jogos

6. Campeonatos que devem vir pré-cadastrados (dados iniciais)

Pra já vir com uma base pronta (o usuário pode editar/adicionar depois), cadastre como exemplo (com times reais do cenário competitivo, mesmo que os nomes/logos sejam só placeholder editável):

CBLoL (Brasil)

LCS (América do Norte)

LEC (Europa)

LCK (Coreia)

LPL (China)

MSI e Worlds (formato de fase suíça + playoffs)

BLOCOS DE REFINAMENTO (mande depois, um de cada vez)

Depois que o Lovable gerar a primeira versão, vá refinando com mensagens assim:

"Agora implemente o motor de fase suíça com pareamento automático por recorde, mostrando visualmente as rodadas em colunas."

"Implemente o bracket de playoff com chave superior e inferior (eliminação dupla), incluindo o rebaixamento de times perdedores da chave superior para a inferior."

"Adicione a tela de edição de time, com upload de logo, nome e sigla, e um botão de reset da simulação do campeonato."

"Conecte tudo ao Supabase para persistir os dados dos campeonatos, times e resultados."

"Melhore o visual das tabelas de classificação, com cores para zona de classificação e eliminação, no estilo Liquipedia."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://esports-bracket-builder.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cdc94875-36ce-4d0a-adc5-5a9c2f4af4bf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```