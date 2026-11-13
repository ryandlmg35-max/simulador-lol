import type {
  CareerLedger,
  Championship,
  ChampionHistoryEntry,
  Group,
  GroupsConfig,
  Match,
  MomentumEvent,
  Phase,
  Team,
} from "./types";
import { buildPhaseMatches, generateGSLGroup, uid } from "./generate";
import { regressMomentumForSplit, seasonRecords } from "./momentum";
import { ensureRoster, evolveRoster, synergyForNewSplit, updateCulture } from "./players";
import { runAutonomousMarket } from "./transfers";

/** Prioridade de "decisão final" de um confronto (reset > grande final > última). */
const finalPriority = (m: Match) =>
  m.bracketSide === "reset" ? 4 : m.bracketSide === "grand" ? 3 : !m.nextMatchId ? 2 : 0;

/**
 * Campeão e vice de uma série: vencedor e perdedor da última partida
 * decisiva do mata-mata final. Retorna null se a série ainda não terminou.
 */
export function seriesFinalists(
  phases: Phase[],
): { championId: string; runnerUpId: string } | null {
  const finalPhase = [...phases].reverse().find((p) => p.kind === "bracket");
  if (!finalPhase) return null;
  const last = [...finalPhase.matches].sort(
    (a, b) => finalPriority(b) - finalPriority(a) || (b.round ?? 0) - (a.round ?? 0),
  )[0];
  if (!last?.winnerId) return null;
  const runnerUpId = last.winnerId === last.teamAId ? last.teamBId : last.teamAId;
  if (!runnerUpId) return null;
  return { championId: last.winnerId, runnerUpId };
}

/**
 * Dois piores times da temporada de uma série, em ordem (pior primeiro).
 * Usa a classificação da última fase de grupos (todos contra todos);
 * sem grupos, usa o retrospecto geral (vitórias) de todas as fases.
 */
export function seriesBottomTwo(phases: Phase[], teams: Team[]): Team[] {
  const byId = new Map(teams.map((t) => [t.id, t]));

  // 1) Classificação da última fase de grupos round-robin.
  const groupsPhase = [...phases]
    .reverse()
    .find(
      (p) =>
        p.kind === "groups" &&
        (p.config as GroupsConfig).format !== "gsl" &&
        (p.groups?.length ?? 0) > 0,
    );
  if (groupsPhase?.groups) {
    const rows = new Map<string, { w: number; l: number }>();
    for (const g of groupsPhase.groups) g.teamIds.forEach((id) => rows.set(id, { w: 0, l: 0 }));
    for (const m of groupsPhase.matches) {
      if (!m.winnerId || !m.teamAId || !m.teamBId) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      const w = rows.get(m.winnerId);
      const l = rows.get(loserId);
      if (w) w.w += 1;
      if (l) l.l += 1;
    }
    const ranked = Array.from(rows.entries())
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => a.w - b.w || b.l - a.l);
    const worst = ranked
      .slice(0, 2)
      .map((r) => byId.get(r.id))
      .filter((t): t is Team => !!t);
    if (worst.length === 2) return worst;
  }

  // 2) Retrospecto geral de todas as fases (vitórias/derrotas).
  const rec = new Map<string, { w: number; l: number }>();
  for (const t of teams) rec.set(t.id, { w: 0, l: 0 });
  for (const p of phases) {
    for (const m of p.matches) {
      if (!m.winnerId || !m.teamAId || !m.teamBId || m.bye) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      const w = rec.get(m.winnerId);
      const l = rec.get(loserId);
      if (w) w.w += 1;
      if (l) l.l += 1;
    }
  }
  const ranked = Array.from(rec.entries())
    .map(([id, r]) => ({ id, ...r }))
    .sort((a, b) => a.w - b.w || b.l - a.l);
  return ranked
    .slice(0, 2)
    .map((r) => byId.get(r.id))
    .filter((t): t is Team => !!t);
}

/** Rótulo da próxima temporada ("2026 Split 1" → "2026 Split 2"). */
export function nextSeasonLabel(season?: string): string {
  if (!season) return "Próximo Split";
  const split = season.match(/split\s*(\d+)/i);
  if (split) {
    const n = Number(split[1]) + 1;
    return season.replace(/split\s*\d+/i, `Split ${n}`);
  }
  // "Temporada (2)" → "Temporada (3)" (sem acumular sufixo a cada split).
  const paren = season.match(/^(.*?)\s*\((\d+)\)\s*$/);
  if (paren) return `${paren[1]} (${Number(paren[2]) + 1})`;
  return `${season} (2)`;
}

const normalizedSplit = (label: string) =>
  label
    .replace(/\s*\(Série B\)\s*$/i, "")
    .trim()
    .toLowerCase();

/** Salva o campeão decidido antes que os resultados da edição sejam zerados. */
export function archiveCompletedChampions(c: Championship): Championship {
  const archive = (
    history: ChampionHistoryEntry[] | undefined,
    phases: Phase[],
    teams: Team[],
    suffix = "",
  ): ChampionHistoryEntry[] => {
    const finalists = seriesFinalists(phases);
    const champion = finalists ? teams.find((t) => t.id === finalists.championId) : undefined;
    if (!champion) return history ?? [];

    const splitLabel = `${c.season?.trim() || "Edição sem temporada"}${suffix}`;
    const existing = history ?? [];
    if (
      existing.some((entry) => normalizedSplit(entry.splitLabel) === normalizedSplit(splitLabel))
    ) {
      return existing;
    }
    return [
      {
        id: uid(),
        teamName: champion.name,
        teamTag: champion.tag,
        teamLogo: champion.logo,
        splitLabel,
        savedAt: new Date().toISOString(),
      },
      ...existing,
    ];
  };

  return {
    ...c,
    history: archive(c.history, c.phases, [...c.teams, ...(c.formerTeams ?? [])]),
    serieB: c.serieB
      ? {
          ...c.serieB,
          history: archive(
            c.serieB.history,
            c.serieB.phases,
            [...c.serieB.teams, ...(c.formerTeams ?? [])],
            " (Série B)",
          ),
        }
      : undefined,
  };
}

/**
 * Copia a estrutura de fases de uma série para um novo split: mesmos nomes,
 * tipos e configurações; a primeira fase já vem semeada com os novos times e
 * as demais nascem limpas (preenchidas depois com "Puxar classificados").
 *
 * PRESERVA ESTRITAMENTE:
 * - O número e nomes originais de grupos (NUNCA altera grupo único de 1 para 2!)
 * - Configurações de chave (Bo1/Bo3/Bo5, slots, single/double elim)
 * - Flags de Play-in Internacional e vagas de avanço
 */
export function buildFreshPhases(sourcePhases: Phase[], teamIds: string[]): Phase[] {
  return sourcePhases.map((p, i) => {
    const isFirst = i === 0;
    let config = { ...p.config };
    let groups: Group[] = [];

    if (config.kind === "groups") {
      // PRESERVA o número exato de grupos configurado pelo usuário!
      const groupCount = Math.max(1, config.groupCount || (p.groups?.length ?? 1));
      config = { ...config, groupCount };

      groups = Array.from({ length: groupCount }, (_, gi) => {
        const existingName = p.groups?.[gi]?.name;
        const defaultName = groupCount === 1 ? "Grupo Único" : `Grupo ${String.fromCharCode(65 + gi)}`;
        return {
          id: uid(),
          name: existingName || defaultName,
          teamIds: [] as string[],
        };
      });

      if (isFirst) {
        if (config.format === "gsl") {
          teamIds.forEach((tid, idx) => {
            const targetGroup = Math.floor(idx / 4);
            if (groups[targetGroup]) {
              groups[targetGroup].teamIds.push(tid);
            } else if (groups[groups.length - 1]) {
              groups[groups.length - 1].teamIds.push(tid);
            }
          });
        } else {
          // Distribuição serpentina entre os grupos existentes:
          let teamIndex = 0;
          for (let round = 0; teamIndex < teamIds.length; round++) {
            const order =
              round % 2 === 0
                ? Array.from({ length: groupCount }, (_, k) => k)
                : Array.from({ length: groupCount }, (_, k) => groupCount - 1 - k);
            for (const g of order) {
              if (teamIndex >= teamIds.length) break;
              groups[g]?.teamIds.push(teamIds[teamIndex]);
              teamIndex++;
            }
          }
        }
      }
    }

    const matches = isFirst ? buildPhaseMatches(config, teamIds, groups) : [];
    return {
      id: uid(),
      name: p.name,
      kind: p.kind,
      config,
      groups: config.kind === "groups" ? groups : undefined,
      matches,
      internationalPlayIn: p.internationalPlayIn,
      advanceCount: p.advanceCount,
      directTeamIds: p.directTeamIds,
      banner: p.banner,
      seededTeamIds: isFirst ? teamIds : [],
    };
  });
}

/**
 * Chave do play-in de promoção: os 4 times se enfrentam em eliminação dupla
 * (formato GSL) até sobrarem 2. Rodada 1 sempre cruza as séries:
 * vice-campeão B × penúltimo A e campeão B × último A. Quem perde duas está
 * fora; sobrevivem o vencedor da "Final da Vaga 1" e o da "Decisão da Vaga 2".
 */
export function buildPromotionBracket(
  bottomA: Team[],
  finalistsB: { championId: string; runnerUpId: string },
): Match[] {
  const ultimo = bottomA[0];
  const penultimo = bottomA[1];
  const group: Group = {
    id: uid(),
    name: "Play-in Promoção",
    teamIds: [finalistsB.runnerUpId, finalistsB.championId, ultimo.id, penultimo.id],
  };
  const raw = generateGSLGroup(group, 5, 5, 5, 5);
  const nameFor = (m: Match): string => {
    const upper = (m.bracketSide ?? "upper") === "upper";
    const round = m.round ?? 0;
    if (upper && round === 0)
      return (m.slot ?? 0) === 0
        ? "Play-in · Rodada 1 · Vice B × Penúltimo A"
        : "Play-in · Rodada 1 · Campeão B × Último A";
    if (upper && round === 1) return "Play-in · Final da Vaga 1";
    if (!upper && round === 1) return "Play-in · Repescagem";
    return "Play-in · Decisão da Vaga 2";
  };
  return raw.map((m) => ({ ...m, groupId: undefined, roundName: nameFor(m) }));
}

/**
 * Resultado do play-in: os 2 sobreviventes (garantidos na Série A) e os 2
 * eliminados (vão para a Série B). Só retorna quando a chave está decidida.
 */
export function promotionOutcome(
  matches: Match[],
): { qualified: string[]; eliminated: string[] } | null {
  const wm = matches.find((m) => (m.bracketSide ?? "upper") === "upper" && (m.round ?? 0) === 1);
  const dm = matches.find((m) => m.bracketSide === "lower" && (m.round ?? 0) === 2);
  const lm = matches.find((m) => m.bracketSide === "lower" && (m.round ?? 0) === 1);
  if (!wm?.winnerId || !dm?.winnerId || !lm) return null;
  const loserOf = (m: Match) => (m.winnerId === m.teamAId ? m.teamBId : m.teamAId);
  const dmLoser = loserOf(dm);
  const lmLoser = loserOf(lm);
  if (!dmLoser || !lmLoser) return null;
  return { qualified: [wm.winnerId, dm.winnerId], eliminated: [dmLoser, lmLoser] };
}

/**
 * Ranking completo da temporada de uma série (1º primeiro): ordem de
 * eliminação no mata-mata final (campeão, vice, semifinalistas...); times que
 * não entraram no mata-mata entram depois, pela classificação da fase de
 * grupos (ou pelo retrospecto geral, se não houver grupos).
 */
export function seriesRanking(phases: Phase[], teams: Team[]): Team[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const ranked: string[] = [];
  const seen = new Set<string>();
  const push = (id?: string | null) => {
    if (id && !seen.has(id) && byId.has(id)) {
      seen.add(id);
      ranked.push(id);
    }
  };

  const finalPhase = [...phases].reverse().find((p) => p.kind === "bracket");
  if (finalPhase) {
    const finalMatch = [...finalPhase.matches].sort(
      (a, b) => finalPriority(b) - finalPriority(a) || (b.round ?? 0) - (a.round ?? 0),
    )[0];
    if (finalMatch?.winnerId) {
      push(finalMatch.winnerId);
      push(finalMatch.winnerId === finalMatch.teamAId ? finalMatch.teamBId : finalMatch.teamAId);
    }
    // Profundidade da eliminação: rodada da última derrota de cada time.
    const lossDepth = new Map<string, number>();
    const lossOrder = new Map<string, number>();
    finalPhase.matches.forEach((m, idx) => {
      if (!m.winnerId || !m.teamAId || !m.teamBId) return;
      const loser = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      if (loser === finalMatch?.winnerId) return;
      const depth = lossDepth.get(loser);
      if (depth === undefined || (m.round ?? 0) > depth) {
        lossDepth.set(loser, m.round ?? 0);
        lossOrder.set(loser, idx);
      }
    });
    Array.from(lossDepth.entries())
      .sort((a, b) => b[1] - a[1] || (lossOrder.get(b[0]) ?? 0) - (lossOrder.get(a[0]) ?? 0))
      .forEach(([id]) => push(id));
    // Times que apareceram no mata-mata mas nunca perderam (chave incompleta).
    finalPhase.matches.forEach((m) => {
      push(m.teamAId);
      push(m.teamBId);
    });
  }

  // Quem não entrou no mata-mata: classificação da última fase de grupos
  // (turno único) ou, sem grupos, retrospecto geral da temporada.
  const rest = teams.filter((t) => !seen.has(t.id));
  if (rest.length > 0) {
    const rec = new Map<string, { w: number; l: number }>();
    const ensure = (id: string) => {
      if (!rec.has(id)) rec.set(id, { w: 0, l: 0 });
      return rec.get(id)!;
    };
    const groupsPhase = [...phases]
      .reverse()
      .find(
        (p) =>
          p.kind === "groups" &&
          (p.config as GroupsConfig).format !== "gsl" &&
          (p.groups?.length ?? 0) > 0,
      );
    const scan = groupsPhase ? groupsPhase.matches : phases.flatMap((p) => p.matches);
    for (const m of scan) {
      if (!m.winnerId || !m.teamAId || !m.teamBId || m.bye) continue;
      const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId;
      ensure(m.winnerId).w += 1;
      ensure(loserId).l += 1;
    }
    rest
      .slice()
      .sort((a, b) => {
        const ra = rec.get(a.id) ?? { w: 0, l: 0 };
        const rb = rec.get(b.id) ?? { w: 0, l: 0 };
        return rb.w - ra.w || ra.l - rb.l;
      })
      .forEach((t) => push(t.id));
  }

  return ranked.map((id) => byId.get(id)).filter((t): t is Team => !!t);
}

/**
 * Monta o campeonato do próximo split aplicando a promoção/rebaixamento:
 * sobreviventes do play-in → Série A; eliminados → Série B; os demais ficam.
 * Preserva 100% das fases, formato, histórico de campeões e metadados.
 */
export function buildNextSplitChampionship(
  c: Championship,
  career?: CareerLedger,
  allChampionships?: Championship[],
): Championship | null {
  let teamA = c.teams;
  let teamB: Team[] | null = null;
  // Quem caiu da Série A para a Série B neste recesso (abala a cultura).
  let relegatedIds = new Set<string>();

  if (c.serieB) {
    if (c.promotion) {
      const outcome = promotionOutcome(c.promotion.matches);
      if (outcome && outcome.qualified.length === 2) {
        const participantIds = new Set(
          c.promotion.matches.flatMap((m) => [m.teamAId, m.teamBId]).filter((id): id is string => !!id),
        );
        const allTeams = [...c.teams, ...c.serieB.teams];
        const byId = new Map(allTeams.map((t) => [t.id, t]));
        teamA = [
          ...c.teams.filter((t) => !participantIds.has(t.id)),
          ...outcome.qualified.map((id) => byId.get(id)).filter((t): t is Team => !!t),
        ];
        teamB = [
          ...c.serieB.teams.filter((t) => !participantIds.has(t.id)),
          ...outcome.eliminated.map((id) => byId.get(id)).filter((t): t is Team => !!t),
        ];
        relegatedIds = new Set(outcome.eliminated.filter((id) => c.teams.some((t) => t.id === id)));
      } else {
        teamB = c.serieB.teams;
      }
    } else {
      teamB = c.serieB.teams;
    }
  }

  // ---------- RECESSO: os elencos EVOLUEM de verdade ----------
  const championId = seriesFinalists(c.phases)?.championId ?? null;
  const recordsA = seasonRecords(c.phases);
  const recordsB = seasonRecords(c.serieB?.phases ?? []);
  const nextLabel = nextSeasonLabel(c.season) ?? "Próximo split";
  const offseasonLog: MomentumEvent[] = [];

  const evolveTeam = (t: Team, division: 1 | 2): Team => {
    const roster = ensureRoster(t);
    if (!roster || roster.length === 0) return t;
    const rec = (division === 1 ? recordsA : recordsB).get(t.id);
    const ctx = {
      splitLabel: nextLabel,
      winRate: rec ? rec.winRate : null,
      champion: t.id === championId,
      relegated: relegatedIds.has(t.id),
    };
    const evolved = evolveRoster(roster, ctx);
    if (evolved.notes.length > 0) {
      const rose = evolved.notes.some((n) => n.includes("evoluiu"));
      offseasonLog.push({
        id: uid(),
        at: new Date().toISOString(),
        division,
        teamId: t.id,
        title: ctx.champion
          ? "Recesso de campeão 🏆"
          : ctx.relegated
            ? "Rebaixamento corrói o vestiário 💧"
            : rose
              ? "Recesso: elenco evoluiu 📈"
              : "Recesso: elenco despencou 📉",
        detail: evolved.notes.join(" · "),
        delta: 0,
      });
    }
    return {
      ...t,
      roster: evolved.roster,
      synergy: synergyForNewSplit(t.synergy, true),
      culture: updateCulture(t.culture, ctx),
    };
  };

  teamA = teamA.map((t) => evolveTeam(t, 1));
  if (teamB) teamB = teamB.map((t) => evolveTeam(t, 2));

  // ---------- JANELA DE TRANSFERÊNCIAS AUTÔNOMA ----------
  // Os times são 100% independentes: avaliam carências, orçamento da região,
  // dispensam atletas em declínio e contratam reforços sem precisar de aprovação.
  const marketResult = runAutonomousMarket({
    championship: {
      ...c,
      teams: teamA,
      serieB: teamB ? { ...(c.serieB ?? { history: [], phases: [], teams: [] }), teams: teamB } : undefined,
    },
    career,
    allChampionships,
  });

  teamA = marketResult.updatedTeams;
  if (teamB && marketResult.updatedSerieBTeams) {
    teamB = marketResult.updatedSerieBTeams;
  }

  // Converte as notícias de transferências para eventos narrativos do log
  for (const item of marketResult.news) {
    offseasonLog.push({
      id: item.id,
      at: item.date ?? new Date().toISOString(),
      division: 1,
      teamId: item.toTeam,
      title: "Mercado da Entressafra 🔄",
      detail: item.headline,
      delta: 0,
    });
  }

  return {
    ...c,
    id: uid(),
    name: c.name,
    game: c.game,
    region: c.region,
    season: nextSeasonLabel(c.season),
    logo: c.logo,
    accentColor: c.accentColor,
    countsTowardsRanking: c.countsTowardsRanking,
    internationalLevel: c.internationalLevel,
    isInternational: c.isInternational,
    circuitId: c.circuitId,
    format: c.format,
    formerTeams: c.formerTeams,
    hasSecondDivision: teamB !== null,
    teams: teamA,
    transferHistory: marketResult.news,
    phases: buildFreshPhases(
      c.phases,
      teamA.map((t) => t.id),
    ),
    serieB:
      teamB && c.serieB
        ? {
            ...c.serieB,
            teams: teamB,
            phases: buildFreshPhases(
              c.serieB.phases,
              teamB.map((t) => t.id),
            ),
            history: c.serieB.history ?? [],
          }
        : undefined,
    // PRESERVA TODO O HISTÓRICO DE CAMPEÕES ACUMULADO!
    history: c.history ?? [],
    momentum: regressMomentumForSplit(c.momentum),
    momentumLog: offseasonLog.length > 0 ? offseasonLog : undefined,
    promotion: undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Avança o campeonato ATUAL para o próximo split/temporada no mesmo lugar,
 * mantendo o mesmo id, acumulando o campeão no histórico e evitando duplicar cards na tela inicial.
 */
export function advanceChampionshipToNextSplit(
  c: Championship,
  career?: CareerLedger,
  allChampionships?: Championship[],
): Championship | null {
  const next = buildNextSplitChampionship(c, career, allChampionships);
  if (!next) return null;
  return {
    ...next,
    id: c.id, // Mantém o ID original do campeonato!
  };
}
