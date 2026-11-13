# Análise do site — Esports Sandbox

Data: 06/10/2026

## Resumo executivo

O projeto está conectado corretamente e a versão publicada abre sem erros visíveis no console. O build de produção passa e o app já tem uma base interessante: criação de campeonatos, fases de grupos, suíço, brackets, Série B, promoção/rebaixamento, ranking e persistência local.

O principal problema é de **produto e entrega**, não de compilação: o README descreve um simulador com campeonatos oficiais pré-cadastrados e persistência compartilhada, mas a versão publicada começa com **0 campeonatos de LoL** e salva tudo apenas no navegador via `localStorage`. Isso limita o uso a um dispositivo/navegador e deixa a primeira experiência mais vazia do que a proposta.

## O que está bom

- Identidade visual forte e consistente: tema escuro, vermelho/dourado, tipografia de esports e tratamento visual próprio.
- Página inicial objetiva, com CTA claro para criar campeonato.
- Assistente dividido em etapas: informações, estrutura, times, fases e revisão.
- Suporte de domínio acima da média para um protótipo: grupos, formato suíço, eliminação simples/dupla, bracket customizado e Série B.
- Registro de placar com validação básica, resultado aleatório e limpeza do resultado.
- Bracket com propagação automática do vencedor e suporte a reset de grande final.
- Persistência local implementada com migração de dados antigos.
- Build de produção concluído sem erros.
- Console da versão publicada sem mensagens de erro na inspeção realizada.

## Achados prioritários

### 1. A primeira tela de LoL está vazia

Na versão publicada, a home mostra `0 criados` e `Nenhum campeonato ainda`. Isso contradiz a intenção descrita no README de oferecer CBLoL, LCS, LEC, LCK, LPL, MSI e Worlds como base inicial.

**Impacto:** o usuário não entende imediatamente o valor do simulador e precisa montar tudo do zero.

**Recomendação:** criar seed inicial para pelo menos CBLOL, LCK, LEC, LPL, MSI e Worlds, com indicação explícita de “dados editáveis” e temporada da base. Alternativamente, colocar templates destacados na home antes de qualquer campeonato criado.

### 2. Os dados são apenas locais

O armazenamento usa `window.localStorage` (`src/lib/lol/store.tsx`, chave `lol-esports-sim:v2`). Não há integração Supabase, autenticação, conta ou sincronização.

**Impacto:** dados não acompanham o usuário em outro navegador/dispositivo; logos em Data URL podem aumentar rapidamente o tamanho do `localStorage`; quando a quota é excedida, o código ignora o erro silenciosamente.

**Recomendação:**

1. Implementar Supabase para campeonatos, times, partidas e histórico.
2. Manter localStorage apenas como cache/offline ou modo visitante.
3. Mostrar aviso quando a gravação falhar.
4. Manter exportação/importação JSON como backup imediato.

### 3. A rota `/championship/` está inacabada

`src/routes/championship..tsx` retorna apenas `Hello "/championship/"!`. A rota usada pelos cards é `/championship/$id`, que existe, mas a rota base ainda expõe conteúdo de placeholder.

**Recomendação:** remover a rota se não for necessária ou transformá-la em uma listagem/redirect para `/`.

### 4. “Importar times por IA” não é o mesmo que o importador local

O componente visível `src/components/lol/ai-team-import.tsx` usa a base estática `LOCAL_REGIONS`. Existe também `src/lib/lol/ai-teams.functions.ts`, que depende de `LOVABLE_API_KEY` e `FIRECRAWL_API_KEY` para busca web + IA.

**Impacto:** o nome “IA” pode criar expectativa de dados atualizados, mas o fluxo visível funciona principalmente como busca em catálogo local. O fluxo web pode falhar se os conectores/variáveis não estiverem disponíveis.

**Recomendação:** separar claramente os nomes:

- “Importar do catálogo” para a base local.
- “Buscar times na web com IA” para a função externa, com loading, erro, fontes e data da consulta.

### 5. O ranking tem regras fixas e pouco transparentes

`src/routes/ranking.tsx` aplica pesos fixos para vitórias, derrotas, playoffs, título e vice. As vagas de Worlds/MSI também são derivadas por posição fixa da região.

**Impacto:** o ranking parece oficial, mas é uma regra de simulação inventada e não configurável. Isso pode confundir o usuário.

**Recomendação:** apresentar o ranking como “ranking da simulação”, documentar a fórmula em uma ajuda acessível e permitir editar pesos ou desligar o ranking por campeonato.

## Qualidade visual e experiência

### Pontos fortes

- A home tem hierarquia visual clara: marca, proposta, CTA e lista de campeonatos.
- O hero comunica bem o conceito de comissário técnico.
- O fluxo de criação tem progressão visível por etapas.
- O bracket usa `overflow-x-auto`, o que é uma decisão correta para estruturas largas.
- Tabelas também usam contêiner com rolagem horizontal no ranking.

### Melhorias recomendadas

- Reduzir a intensidade de texturas, scanlines e ruído em áreas de formulário; eles podem competir com labels e inputs.
- No mobile, testar especificamente o header, os cinco passos do wizard e os botões de ação; o layout usa `flex-wrap`, mas ainda pode ficar apertado.
- Trocar `confirm()` nativo ao excluir campeonato por um diálogo visual com contexto e foco acessível.
- Melhorar estados vazios com templates prontos, não apenas CTA de criação manual.
- Adicionar uma pequena legenda explicando “Bo1/Bo3/Bo5”, “forma”, “Série A/B” e “reset de bracket”.
- Adicionar feedback de salvamento, importação e erro de imagem.
- Usar `alt` descritivo para logos quando elas tiverem significado; atualmente vários logos estão com `alt=""`.

## SEO e metadados

Em `src/routes/__root.tsx`:

- Há metatags `description`, `og:description` e `twitter:description` duplicadas.
- `twitter:site` ainda está como `@Lovable`, não como identidade do projeto.
- Falta canonical URL.
- O `og:image` aponta para um preview hospedado pelo Lovable; vale trocar por um asset estável do próprio projeto.
- O título e a descrição estão coerentes com a proposta, mas poderiam mencionar “simulador local/editável” e diferenciar LoL/CS2 quando necessário.

## Qualidade técnica observada

- `npm run build`: concluído sem erro.
- `npm run lint`: 0 erros e 9 avisos. Os avisos são de Fast Refresh em arquivos que exportam componentes e outros valores; não bloqueiam a execução, mas podem ser limpos separando constantes/hooks exportados dos componentes.
- A arquitetura de domínio em `src/lib/lol` está relativamente bem separada da UI.
- A lógica de bracket e Swiss é extensa e merece testes automatizados antes de novos recursos.

## Testes que eu priorizaria

1. Criar campeonato de 4 times, preencher grupo, avançar classificados e terminar a final.
2. Criar bracket de 6 e 8 times e verificar byes e propagação.
3. Testar dupla eliminação com queda da upper para lower.
4. Testar reset da grande final.
5. Testar Swiss com 8 times até 3 vitórias/3 derrotas.
6. Alterar um resultado já salvo e confirmar que o bracket e o momentum são revertidos corretamente.
7. Remover um time depois de registrar histórico e confirmar que o campeão antigo continua visível.
8. Fazer upload de logos grandes e verificar comportamento próximo do limite de armazenamento.
9. Recarregar a página em cada etapa para verificar persistência.
10. Validar navegação e leitura por teclado em todos os diálogos.

## Roadmap recomendado

### P0 — antes de divulgar

- Corrigir/remover `/championship/` placeholder.
- Disponibilizar templates iniciais de LoL ou explicar claramente que o usuário começa vazio.
- Validar o fluxo completo de criação → resultados → campeão.
- Exibir erros de persistência e importação.

### P1 — tornar o produto realmente utilizável

- Implementar Supabase/login opcional.
- Exportar/importar JSON.
- Separar catálogo local de busca por IA.
- Adicionar testes automatizados para Swiss e brackets.
- Revisar mobile e acessibilidade.

### P2 — diferenciação

- Templates oficiais por temporada.
- Compartilhamento por link.
- Histórico de splits e promoção/rebaixamento com explicação visual.
- Ranking configurável por campeonato/região.
- Fontes e data de atualização dos times importados.

## Conclusão

A base é promissora e visualmente já parece um produto de esports, não apenas um formulário. O próximo ganho mais importante não é adicionar mais efeitos ou mais opções de bracket: é **reduzir a fricção inicial, entregar campeonatos prontos e tornar os dados confiáveis/sincronizados**. Depois disso, testes automatizados no motor de formatos serão a maior proteção contra bugs de simulação.