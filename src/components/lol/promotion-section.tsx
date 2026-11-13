import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Check, TrendingUp, X } from "lucide-react";
import type { Championship, Match, Team } from "@/lib/lol/types";
import { useStore } from "@/lib/lol/store";
import {
  nextSeasonLabel,
  promotionOutcome,
  seriesBottomTwo,
  seriesFinalists,
} from "@/lib/lol/promotion";
import { MatchCard } from "./match-card";
import { TeamLogo } from "./team-logo";
import { ConfirmDialog } from "./confirm-dialog";
import { useConfirm } from "./use-confirm";

function TeamChip({ team, tone }: { team: Team | null; tone: "gold" | "blood" }) {
  if (!team) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 ${
        tone === "gold"
          ? "border-gold/40 bg-gold/10 text-bone"
          : "border-blood/40 bg-blood/10 text-bone"
      }`}
    >
      <TeamLogo team={team} size={18} />
      <span className="font-display text-sm uppercase tracking-wider">
        {team.tag || team.name.slice(0, 3)}
      </span>
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {team.name}
      </span>
    </span>
  );
}

/** Coluna de uma etapa da chave do play-in. */
function StageColumn({
  title,
  caption,
  accent,
  matches,
  renderMatch,
}: {
  title: string;
  caption?: string;
  accent: "gold" | "blood" | "bone";
  matches: Match[];
  renderMatch: (m: Match) => React.ReactNode;
}) {
  const text = accent === "gold" ? "text-gold" : accent === "blood" ? "text-blood" : "text-bone";
  const border =
    accent === "gold"
      ? "border-gold/40"
      : accent === "blood"
        ? "border-blood/40"
        : "border-bone/40";
  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className={`border-b-2 ${border} pb-1.5`}>
        <div className={`font-display text-sm uppercase tracking-widest ${text}`}>{title}</div>
        {caption ? (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {caption}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        {matches.map((m) => (
          <div key={m.id}>{renderMatch(m)}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * Promoção & Rebaixamento: quando as duas séries terminam, os 2 últimos da
 * Série A e os 2 finalistas da Série B se enfrentam em uma chave de eliminação
 * dupla (GSL) — cada time joga no mínimo 2 Bo5 — até sobrarem 2, que garantem
 * vaga na Série A do próximo split.
 */
export function PromotionSection({ championship }: { championship: Championship }) {
  const { setupPromotion, setPromotionResult, createNextSplit, updateChampionship } = useStore();
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();

  const serieB = championship.serieB;
  const finalistsA = useMemo(() => seriesFinalists(championship.phases), [championship.phases]);
  const finalistsB = useMemo(() => (serieB ? seriesFinalists(serieB.phases) : null), [serieB]);
  const championA = finalistsA
    ? (championship.teams.find((t) => t.id === finalistsA.championId) ?? null)
    : null;
  const championB = finalistsB
    ? (serieB?.teams.find((t) => t.id === finalistsB.championId) ?? null)
    : null;
  const runnerUpB = finalistsB
    ? (serieB?.teams.find((t) => t.id === finalistsB.runnerUpId) ?? null)
    : null;
  const bottomA = useMemo(
    () => seriesBottomTwo(championship.phases, championship.teams),
    [championship],
  );

  const bothDone = !!finalistsA && !!finalistsB;
  const promotion = championship.promotion;
  const outcome = promotion ? promotionOutcome(promotion.matches) : null;
  const promotionDone = !!outcome;

  const allTeams = [
    ...championship.teams,
    ...(serieB?.teams ?? []),
    ...(championship.formerTeams ?? []),
  ];
  const canGenerate = bothDone && bottomA.length === 2 && !!finalistsB;

  const createSplit = async () => {
    const label = nextSeasonLabel(championship.season);
    const ok = await confirm({
      title: `Criar o próximo split ("${championship.name} · ${label}")?`,
      message:
        "Série A: quem se manteve + os 2 sobreviventes do play-in\n" +
        "Série B: quem se manteve + os 2 eliminados do play-in\n\n" +
        "As fases das duas séries são recriadas com os novos times.",
      confirmLabel: "Criar split",
      tone: "gold",
    });
    if (!ok) return;
    const newId = createNextSplit(championship.id);
    if (newId) navigate({ to: "/championship/$id", params: { id: newId } });
  };

  const discardPromotion = async () => {
    const ok = await confirm({
      title: "Descartar o play-in de promoção?",
      message: "Todos os confrontos serão apagados.",
      confirmLabel: "Descartar",
    });
    if (ok) updateChampionship(championship.id, (c) => ({ ...c, promotion: undefined }));
  };

  const winners = outcome
    ? outcome.qualified.map((id) => allTeams.find((t) => t.id === id)).filter((t): t is Team => !!t)
    : [];
  const losers = outcome
    ? outcome.eliminated
        .map((id) => allTeams.find((t) => t.id === id))
        .filter((t): t is Team => !!t)
    : [];

  // Etapas da chave: rodada 1 → vaga 1 / repescagem → decisão.
  const stage1 = (promotion?.matches ?? []).filter((m) => (m.round ?? 0) === 0);
  const stage2Upper = (promotion?.matches ?? []).filter(
    (m) => (m.bracketSide ?? "upper") === "upper" && (m.round ?? 0) === 1,
  );
  const stage2Lower = (promotion?.matches ?? []).filter(
    (m) => m.bracketSide === "lower" && (m.round ?? 0) === 1,
  );
  const stage3 = (promotion?.matches ?? []).filter(
    (m) => m.bracketSide === "lower" && (m.round ?? 0) === 2,
  );

  const renderPromoMatch = (m: Match) => (
    <MatchCard
      championshipId={championship.id}
      teams={allTeams}
      phaseId=""
      match={m}
      onSetResult={(winnerId, score) => setPromotionResult(championship.id, m.id, winnerId, score)}
    />
  );

  return (
    <section className="mt-10 border-t-2 border-gold/20 pt-8">
      <ConfirmDialog {...confirmDialog} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <ArrowLeftRight className="h-5 w-5 text-gold" />
        <h2 className="font-display text-2xl uppercase tracking-widest text-gold">
          Promoção & Rebaixamento
        </h2>
        <span className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          2 últimos da Série A × 2 finalistas da Série B · chave dupla até sobrarem 2
        </span>
      </div>

      {/* Status das séries */}
      {!bothDone ? (
        <div className="border-2 border-ink bg-card/40 p-4 text-sm">
          <p className="mb-2 text-muted-foreground">
            O play-in de promoção abre quando as <span className="text-gold">duas séries</span>{" "}
            tiverem campeão definido.
          </p>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-widest">
            <span className={finalistsA ? "text-gold" : "text-muted-foreground"}>
              {finalistsA ? `✔ Série A encerrada (${championA?.name})` : "⏳ Série A em andamento"}
            </span>
            <span className={finalistsB ? "text-blood" : "text-muted-foreground"}>
              {finalistsB ? `✔ Série B encerrada (${championB?.name})` : "⏳ Série B em andamento"}
            </span>
          </div>
        </div>
      ) : null}

      {/* Prévia antes de gerar */}
      {bothDone && !promotion ? (
        <div className="border-2 border-ink bg-card/40 p-4">
          {canGenerate ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 font-display text-xs uppercase tracking-widest text-blood">
                    ⬇ Zona de rebaixamento (2 últimos da Série A)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TeamChip team={bottomA[1] ?? null} tone="gold" />
                    <TeamChip team={bottomA[0] ?? null} tone="gold" />
                  </div>
                </div>
                <div>
                  <div className="mb-2 font-display text-xs uppercase tracking-widest text-gold">
                    ⬆ Candidatos da Série B (campeão e vice)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TeamChip team={championB} tone="gold" />
                    <TeamChip team={runnerUpB} tone="gold" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Os 4 se enfrentam em <span className="text-bone">eliminação dupla (GSL)</span>, tudo
                em Bo5: <span className="text-bone">vice B × penúltimo A</span> e{" "}
                <span className="text-bone">campeão B × último A</span> na rodada 1; vencedores
                decidem a <span className="text-gold">Vaga 1</span>, perdedores fazem a{" "}
                <span className="text-blood">repescagem</span> e quem perder de novo está fora. O
                vencedor da <span className="text-bone">Decisão</span> fica com a{" "}
                <span className="text-gold">Vaga 2</span>. Cada time joga no mínimo 2 Bo5.
              </p>
              <button
                type="button"
                onClick={() => setupPromotion(championship.id)}
                className="mt-4 flex items-center gap-2 border-2 border-gold bg-gold px-4 py-2 font-display text-base uppercase tracking-widest text-ink hover:bg-gold/90"
              >
                ⚡ Gerar chave do play-in (4 times, eliminação dupla)
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Não consegui identificar os 2 últimos da Série A pela classificação. Jogue a fase de
              grupos até o fim (ou registre os resultados) e tente de novo.
            </p>
          )}
        </div>
      ) : null}

      {/* Chave gerada */}
      {promotion ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <StageColumn
              title="Rodada 1"
              caption="Bo5 · séries cruzadas"
              accent="bone"
              matches={stage1}
              renderMatch={renderPromoMatch}
            />
            <StageColumn
              title="Vaga 1 · Repescagem"
              caption="vencedores entre si · perdedores entre si"
              accent="gold"
              matches={[...stage2Upper, ...stage2Lower]}
              renderMatch={renderPromoMatch}
            />
            <StageColumn
              title="Decisão — Vaga 2"
              caption="perdedor da Vaga 1 × vencedor da repescagem"
              accent="blood"
              matches={stage3}
              renderMatch={renderPromoMatch}
            />
          </div>

          {promotionDone && outcome ? (
            <div className="border-2 border-gold/50 bg-gold/10 p-4">
              <div className="mb-2 flex items-center gap-2 font-display text-lg uppercase tracking-widest text-gold">
                <Check className="h-5 w-5" /> Chave concluída — sobraram 2
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Garantidos na Série A do próximo split
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {winners.map((t) => (
                      <TeamChip key={t.id} team={t} tone="gold" />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Na Série B do próximo split
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {losers.map((t) => (
                      <TeamChip key={t.id} team={t} tone="blood" />
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={createSplit}
                className="mt-4 flex items-center gap-2 border-2 border-gold bg-gold px-5 py-3 font-display text-lg uppercase tracking-widest text-ink transition-transform hover:-translate-y-0.5"
              >
                <TrendingUp className="h-5 w-5" /> Criar próximo split (com promoção aplicada)
              </button>
            </div>
          ) : (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Jogue a chave até a Decisão — quem perder duas vezes está fora; sobrevivem 2 para a
              Série A.
            </p>
          )}

          <button
            type="button"
            onClick={discardPromotion}
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-blood"
            title="Descartar play-in (se algo mudou nos resultados)"
          >
            <X className="h-3 w-3" /> Descartar play-in
          </button>
        </div>
      ) : null}
    </section>
  );
}
