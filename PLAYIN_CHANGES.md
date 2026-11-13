# Play-in Internacional guiado pelo Hall da Fama

## Regra central
As vagas por região vêm da **mesma fórmula da tabela "Força das Regiões"** do Hall da Fama:
`ratio = pontos_internacionais / média` · `worlds = clamp(1..8, round(4·ratio²))` · `msi = clamp(1..5, round(2.2·ratio²))`.

Exemplo com os dados atuais:
| Região | Intl pts | Vagas Worlds | Vagas MSI |
|--------|---------:|:------------:|:---------:|
| CBLOL  | 5912 | 8 | 5 |
| LCS    | 4768 | 6 | 3 |
| LPL    | 4122 | 4 | 2 |
| LCK    | 3471 | 3 | 2 |
| LEC    | 3215 | 3 | 1 |
| LCP    | 2245 | 1 | 1 |

## O que o planejador faz
1. **Classifica** os primeiros N times de cada região, onde N = vagas Worlds ou MSI da tabela (o tipo é detectado pelo nome do campeonato: "MSI" → MSI; "Worlds/Mundial" → Worlds; sem palavra-chave, fase suíça = Worlds, senão MSI).
2. **Distribui as vagas diretas** proporcionalmente entre as regiões fortes (nunca acima das vagas de cada uma).
3. **Manda pro play-in** os seeds menores das regiões fortes + as regiões fracas.
4. **Sobrevivem do play-in 4 times** (padrão internacional). O resto é eliminado.
5. A fase principal recebe **diretos + 4 sobreviventes**.

### MSI (exemplo com 8 times por região)
- Vagas: CBLOL 5, LCS 3, LPL 2, LCK 2, LEC 1, LCP 1 = **14 classificados**.
- Diretos (4): CBLOL#1, LCS#1, LPL#1, LCK#1.
- Play-in (10): CBLOL#2-5, LCS#2-3, LPL#2, LCK#2, LEC#1, LCP#1.
- Play-in duplo → top 4 → Bracket Stage com 8 times (4 diretos + 4).
- Fora: CBLOL#6-8, LCS#4-8, LPL#3-8, LCK#3-8, LEC#2-8, LCP#2-8.

### Worlds (exemplo com 8 times por região)
- Vagas: CBLOL 8, LCS 6, LPL 4, LCK 3, LEC 3, LCP 1 = **25 classificados**.
- Diretos (12): CBLOL#1-4, LCS#1-3, LPL#1-2, LCK#1-2, LEC#1.
- Play-in (13): CBLOL#5-8, LCS#4-6, LPL#3-4, LCK#3, LEC#2-3, LCP#1.
- Play-in duplo → top 4 → Fase Suíça com 16 times (12 diretos + 4).
- Fora: seeds além das vagas de cada região.

## Arquivos
- `src/lib/lol/international.ts` — `computeRegionSlots` (fórmula do ranking), `planInternationalField` (classificação + distribuição direta proporcional + play-in), `detectTournamentType`, `regionProfile`.
- `src/routes/ranking.tsx` — passa a usar `computeRegionSlots`; a tabela e o play-in compartilham a mesma fonte de verdade. Bug do resetGame corrigido (`"game"` → `game`).
- `src/routes/create.tsx` — preview no passo 5 mostra "classificados pelas vagas • play-in • direto • fora" e quantos sobrevivem do play-in; grava `advanceCount` na fase de play-in.
- `src/lib/lol/store.tsx` — `seedPhaseTeams` usa o planejador (conserta campeonatos antigos com "Reorganizar play-in"); `advanceToPhase` mescla diretos + top `advanceCount` do play-in.
- `src/routes/championship.$id.tsx` — botão "Reorganizar play-in"; `needsSeeding` acende quando faltam classificados.
- `src/lib/lol/types.ts` — `Phase.seededTeamIds` e `Phase.advanceCount`.
- `src/lib/lol/generate.ts` — `createGroupsForTeams`, `getBracketStandings` (ordem campeão→vice→eliminados), `getQualifiers(phase, limit?)`.

## Verificação
- `npx tsc --noEmit` limpo.
- `npm run build` ok.
- Teste com os dados da tabela: vagas batem 8/5, 6/3, 4/2, 3/2, 3/1, 1/1; MSI gera 14 classificados (4 diretos + 10 play-in, 4 sobrevivem); Worlds gera 25 (12 diretos + 13 play-in, 4 sobrevivem).
- Chaves com bye (10 e 13 times) classificam corretamente o top 4.