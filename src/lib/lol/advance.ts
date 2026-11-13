import {
  automaticPlayInAdvanceCount,
  fillPendingSlots,
  getQualifiers,
  isPhaseComplete,
  pendingSlotCount,
} from "./generate";
import { isPlayInPhase, phaseTeamIdsInOrder } from "./international";
import type { Match, Phase } from "./types";

export interface PhaseAdvancePlan {
  /**
   * "fill": o classificado ENTRA na vaga reservada da fase alvo — a chave não
   * é refeita (os resultados já jogados continuam). É o caminho do play-in
   * internacional: o play-in e o evento principal rodam em paralelo.
   * "reseed": a fase alvo é semeada de novo com diretos + classificados.
   */
  kind: "fill" | "reseed";
  /** Classificados da fase anterior (na ordem de seeding). */
  qualified: string[];
  /** Times finais da fase alvo (modo "reseed"). */
  teamIds: string[];
  /** Matches da fase alvo (modo "fill"). */
  matches: Match[];
}

/**
 * Decide como os classificados da fase anterior entram na fase alvo.
 *
 * Regras:
 * - BYE não é resultado. A fase principal já vem semeada com os diretos e os
 *   byes são auto-resolvidos; tratar bye como resultado travava o "Puxar
 *   classificados" e o campeão do play-in nunca entrava.
 * - Vaga RESERVADA (pendente) = classificado do play-in: ele preenche a vaga
 *   sem reconstruir a chave.
 * - Sem vaga reservada: a fase alvo é semeada de novo (diretos + classificados).
 */
export function planPhaseAdvance(params: {
  previous: Phase;
  target: Phase;
  /** Ids de todos os times da divisão (filtro dos diretos). */
  divisionTeamIds: Set<string>;
}): PhaseAdvancePlan | null {
  const { previous, target, divisionTeamIds } = params;
  if (!isPhaseComplete(previous)) return null;

  const previousIds = phaseTeamIdsInOrder(previous);
  // Play-in comum classifica metade automaticamente; Worlds/MSI grava a
  // quantidade calculada pelo formato internacional.
  const limit =
    previous.advanceCount ??
    (isPlayInPhase(previous) ? automaticPlayInAdvanceCount(previousIds.length) : undefined);
  const qualified = getQualifiers(previous, limit);

  const hasRealResult = target.matches.some((m) => m.winnerId && !m.bye);

  const reserved = pendingSlotCount(target.matches);
  if (reserved > 0) {
    // A fase principal pode JÁ ter resultado (os diretos jogaram em paralelo
    // ao play-in): a vaga reservada não participa de nenhum confronto jogado,
    // então preencher ela não apaga nada.
    // Se ainda faltarem classificados (play-in com menos vagas do que o
    // formato), preenche o que tem e DEIXA as vagas restantes pendentes — a
    // fase só fecha quando elas forem preenchidas. Antes isso era um
    // "return null" silencioso: o botão não fazia nada e o usuário achava
    // que o classificado não existia.
    return {
      kind: "fill",
      qualified,
      teamIds: qualified,
      matches: fillPendingSlots(target.matches, qualified),
    };
  }

  // Não reconstrói uma fase que já tem resultado registrado — isso apagaria
  // placares já jogados.
  if (hasRealResult) return null;
  if (limit !== undefined && !previous.internationalPlayIn && qualified.length < limit) return null;
  if (previous.internationalPlayIn && qualified.length === 0) return null;

  const previousIdSet = new Set(previousIds);
  const directIds =
    target.directTeamIds ??
    phaseTeamIdsInOrder(target).filter(
      (teamId) => !previousIdSet.has(teamId) && divisionTeamIds.has(teamId),
    );
  const fallbackDirectIds = Array.from(divisionTeamIds).filter((id) => !previousIdSet.has(id));
  const effectiveDirectIds = directIds.length > 0 ? directIds : fallbackDirectIds;
  const combined = Array.from(new Set([...effectiveDirectIds, ...qualified]));
  if (combined.length < 2) return null;
  return { kind: "reseed", qualified, teamIds: combined, matches: target.matches };
}
