import { useState } from "react";
import { ArrowRight, ArrowRightLeft, Lock, UserMinus, UserPlus, X, Zap } from "lucide-react";
import type { Championship, Player, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import { isInternationalChamp, useStore } from "@/lib/lol/store";
import { ensureRoster, getResolvedAttrs, pickStarters } from "@/lib/lol/players";
import {
  getTeamBaseBudget,
  isPlayerImport,
  GLOBAL_FREE_AGENT_POOL,
} from "@/lib/lol/transfers";

export function OffseasonMarketDialog({
  championship,
  onClose,
}: {
  championship: Championship;
  onUpdateTeams?: (updatedTeams: Team[], updatedSerieBTeams?: Team[]) => void;
  onClose: () => void;
}) {
  const { career } = useStore();
  const game = (championship.game ?? "lol") as "lol" | "cs2";
  const isIntl = isInternationalChamp(championship);

  const teamsA = championship.teams;
  const teamsB = championship.serieB?.teams ?? [];
  const allTeams = [...teamsA, ...teamsB];
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teamsA[0]?.id ?? "");

  const activeTeam = allTeams.find((t) => t.id === selectedTeamId) || teamsA[0];
  const transferNews = championship.transferHistory ?? [];

  // Mostra apenas agentes livres que não estão atuando em nenhum time desta liga
  const usedIgns = new Set(
    allTeams.flatMap((t) => (ensureRoster(t) ?? []).map((p) => p.ign.trim().toLowerCase())),
  );
  const availableFreeAgents: Player[] = GLOBAL_FREE_AGENT_POOL.filter(
    (fa) => !usedIgns.has(fa.ign.trim().toLowerCase()),
  ).map((fa, i) => ({ ...fa, id: `fa-${i + 1}` }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-[#0d0f14] shadow-2xl flex flex-col overflow-hidden text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-6 bg-card/20">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-2 text-gold">
              {isIntl ? <Lock className="h-6 w-6" /> : <ArrowRightLeft className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="font-display text-xl font-bold uppercase tracking-wider text-foreground">
                {isIntl
                  ? "Elencos Travados (Torneio Internacional)"
                  : "Elencos, Orçamentos & Janela de Transferências"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isIntl
                  ? "Em competições internacionais o mercado é fechado — nenhum time altera elenco."
                  : "Os clubes operam de forma 100% independente durante o split e na entressafra, sem necessidade de aprovação."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Radar de últimas movimentações */}
        {!isIntl && transferNews.length > 0 ? (
          <div className="border-b border-border/40 bg-gold/5 px-6 py-2.5 flex items-center gap-2 overflow-x-auto text-xs text-gold">
            <Zap className="h-4 w-4 shrink-0" />
            <span className="font-bold uppercase tracking-wider shrink-0">Últimas da Janela:</span>
            <div className="flex items-center gap-4 whitespace-nowrap">
              {transferNews.slice(0, 4).map((item) => (
                <span key={item.id} className="text-muted-foreground">
                  • <strong className="text-foreground">{item.playerIgn}</strong> ({item.fromTeam || "Agente Livre"} →{" "}
                  <strong className="text-gold">{item.toTeam}</strong>)
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Corpo Principal */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Coluna 1: Equipes da Liga */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Equipes da Liga ({allTeams.length})
            </span>
            <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
              {allTeams.map((t) => {
                const isSelected = t.id === activeTeam?.id;
                const budget = getTeamBaseBudget(t, championship.region, false, false, career, game);
                const starters = pickStarters(ensureRoster(t) ?? []);
                const importsCount = starters.filter((p) =>
                  isPlayerImport(p, championship.region),
                ).length;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTeamId(t.id)}
                    className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition-colors ${
                      isSelected
                        ? "border-gold bg-gold/15 text-foreground"
                        : "border-border/50 bg-card/30 text-muted-foreground hover:bg-card/60 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TeamLogo team={t} className="h-8 w-8" />
                      <div>
                        <span className="font-display text-xs font-bold block truncate max-w-[120px]">
                          {t.name}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {t.tag}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-gold block">
                        ${(budget / 1000).toFixed(1)}M
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {importsCount}/2 imp
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Elenco do Time Selecionado */}
          <div className="space-y-4">
            {activeTeam ? (
              <>
                <div className="flex items-center gap-3 border-b border-border/60 pb-3">
                  <TeamLogo team={activeTeam} className="h-10 w-10" />
                  <div>
                    <h4 className="font-display text-sm font-bold uppercase text-foreground">
                      {activeTeam.name}
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      Elenco Atual da Competição
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {(ensureRoster(activeTeam) ?? []).map((player) => {
                    const res = getResolvedAttrs(
                      player.attrs,
                      player.ign,
                      player.role,
                      player.country,
                      player.age,
                    );
                    return (
                      <div
                        key={player.id}
                        className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-center rounded bg-muted/60 px-1 py-0.5 text-[10px] font-mono font-bold uppercase text-muted-foreground">
                            {player.role}
                          </span>
                          <span className="font-display font-semibold text-foreground">
                            {player.ign}
                          </span>
                          {player.sub ? (
                            <span className="text-[9px] text-muted-foreground font-mono">
                              (reserva)
                            </span>
                          ) : null}
                        </div>
                        <span className="font-mono text-gold text-[10px]">
                          {res.mechanics} MEC · {res.clutch} CLU · {res.mentality} MEN ·{" "}
                          {res.intlExperience} INT
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          {/* Coluna 3: Extrato da Janela (ou Mercado Livre) */}
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              {isIntl
                ? "Movimentações (Bloqueadas)"
                : `Histórico da Janela (${transferNews.length})`}
            </span>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {isIntl ? (
                <div className="rounded-xl border border-border/60 bg-card/20 p-6 text-center text-xs text-muted-foreground">
                  Nenhum time pode contratar ou alterar elenco durante torneios internacionais.
                </div>
              ) : transferNews.length === 0 ? (
                <div className="space-y-2">
                  <div className="rounded-xl border border-border/60 bg-card/20 p-4 text-center text-xs text-muted-foreground">
                    Nenhuma transferência ocorreu ainda nesta edição. Abaixo, os principais agentes
                    livres disponíveis no mercado da liga:
                  </div>
                  {availableFreeAgents.slice(0, 6).map((fa) => {
                    const res = getResolvedAttrs(fa.attrs, fa.ign, fa.role, fa.country, fa.age);
                    return (
                      <div
                        key={fa.id}
                        className="flex items-center justify-between rounded-xl border border-border/40 bg-card/30 p-2 text-xs"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase text-muted-foreground">
                            {fa.role}
                          </span>
                          <span className="font-display font-bold text-foreground">{fa.ign}</span>
                          {fa.country ? (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              [{fa.country}]
                            </span>
                          ) : null}
                        </div>
                        <span className="font-mono text-[10px] text-gold">
                          {res.mechanics} MEC
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                transferNews.map((item) => {
                  const Icon =
                    item.kind === "release"
                      ? UserMinus
                      : item.kind === "trade"
                        ? ArrowRightLeft
                        : UserPlus;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/60 bg-card/40 p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 font-display font-bold text-gold">
                          <Icon className="h-3 w-3" /> {item.playerIgn} ({item.role.toUpperCase()})
                        </span>
                        {item.value ? (
                          <span className="font-mono text-[10px] text-emerald-400">
                            ${item.value}k
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span>{item.fromTeam || "Agente Livre"}</span>
                        <ArrowRight className="h-3 w-3 text-gold" />
                        <span className="font-semibold text-bone">{item.toTeam}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground/90">{item.headline}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Rodapé informativo */}
        <div className="flex items-center justify-between border-t border-border/60 p-4 bg-card/20">
          <span className="text-xs text-muted-foreground">
            {isIntl
              ? "Torneio internacional: elencos travados até o fim do evento."
              : "Janela autônoma: os clubes assinam e liberam jogadores automaticamente sem sua aprovação."}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gold px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-gold/90 transition-colors shadow-md"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
