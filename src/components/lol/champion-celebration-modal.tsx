import { useEffect, useState } from "react";
import { Trophy, Award, Sparkles, X, Star, ArrowRight, ShieldCheck, Mic } from "lucide-react";
import type { Championship, MatchMvp, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import { fireConfetti } from "@/lib/lol/confetti";
import { ensureRoster, pickStarters } from "@/lib/lol/players";

export function ChampionCelebrationModal({
  champion,
  runnerUp,
  championship,
  division = 1,
  mvp,
  onSaveHistory,
  onGoToOffseason,
  onOpenPressConference,
  onClose,
}: {
  champion: Team;
  runnerUp?: Team;
  championship: Championship;
  division?: 1 | 2;
  mvp?: MatchMvp;
  onSaveHistory: (splitLabel: string) => void;
  onGoToOffseason?: () => void;
  onOpenPressConference?: () => void;
  onClose: () => void;
}) {
  const defaultLabel = `${championship.season ?? "Split Atual"}${division === 2 ? " (Série B)" : ""}`;
  const [splitLabel, setSplitLabel] = useState(defaultLabel);
  const existingHistory = division === 2 ? (championship.serieB?.history ?? []) : (championship.history ?? []);
  const norm = (s: string) =>
    s
      .replace(/\s*\(Série B\)\s*$/i, "")
      .replace(/[·\-_/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const alreadySaved = existingHistory.some(
    (h) =>
      h.teamName.trim().toLowerCase() === champion.name.trim().toLowerCase() &&
      norm(h.splitLabel || "") === norm(defaultLabel),
  );
  const [saved, setSaved] = useState(alreadySaved);

  useEffect(() => {
    // Fire festive celebratory confetti on mount
    fireConfetti({
      colors: [champion.color || "#d4af37", "#f3e5ab", "#ffffff", "#ef4444", "#3b82f6"],
      particleCount: 160,
    });
  }, [champion]);

  const roster = ensureRoster(champion) ?? [];
  const starters = pickStarters(roster);

  const handleSave = () => {
    onSaveHistory(splitLabel.trim() || "Split Sem Nome");
    setSaved(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in zoom-in-95 duration-200"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-gold/60 bg-[#0c0d12] shadow-[0_0_80px_rgba(212,175,55,0.25)] text-foreground p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fundo */}
        <div
          className="absolute -top-32 -left-32 h-72 w-72 rounded-full blur-[100px] pointer-events-none opacity-40"
          style={{ background: champion.color || "var(--gold)" }}
        />
        <div
          className="absolute -bottom-32 -right-32 h-72 w-72 rounded-full blur-[100px] pointer-events-none opacity-30 bg-gold"
        />

        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header de Campeão */}
        <div className="flex flex-col items-center text-center">
          <div className="relative inline-flex items-center justify-center">
            <Trophy className="h-16 w-16 text-gold animate-bounce" />
            <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-gold animate-pulse" />
          </div>

          <span className="mt-2 text-xs font-extrabold uppercase tracking-[0.25em] text-gold">
            {division === 1 ? "Grande Campeão da Série A" : "Campeão da Série B — Acesso Garantido!"}
          </span>

          <h2 className="mt-1 font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-foreground drop-shadow-md">
            {champion.name}
          </h2>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {championship.name} · {championship.season}
            </span>
            {champion.region ? (
              <span className="rounded bg-muted/60 px-2 py-0.5 text-xs font-mono uppercase text-muted-foreground">
                {champion.region}
              </span>
            ) : null}
          </div>
        </div>

        {/* Logo do Campeão & Vice */}
        <div className="mt-6 flex items-center justify-center gap-8 border-y border-border/60 py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative rounded-2xl border-2 border-gold bg-gold/10 p-3 shadow-lg shadow-gold/10">
              <TeamLogo team={champion} className="h-20 w-20" />
              <div className="absolute -top-3 -right-3 rounded-full bg-gold p-1 text-ink shadow">
                <Trophy className="h-4 w-4" />
              </div>
            </div>
            <span className="font-display text-base font-bold text-gold">1º Lugar</span>
            <span className="text-xs text-muted-foreground font-mono">{champion.tag}</span>
          </div>

          {runnerUp ? (
            <div className="flex flex-col items-center gap-2 opacity-80">
              <div className="rounded-xl border border-border bg-card/60 p-2.5">
                <TeamLogo team={runnerUp} className="h-14 w-14" />
              </div>
              <span className="font-display text-sm font-semibold text-muted-foreground">
                Vice-Campeão
              </span>
              <span className="text-xs text-muted-foreground font-mono">{runnerUp.name}</span>
            </div>
          ) : null}
        </div>

        {/* MVP da Final */}
        {mvp ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 p-3.5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-gold p-2 text-ink">
                <Star className="h-5 w-5 fill-current" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold">
                  MVP da Grande Final
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-foreground">
                    {mvp.playerName}
                  </span>
                  <span className="rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                    {mvp.role}
                  </span>
                  {mvp.champion ? (
                    <span className="text-xs text-muted-foreground font-medium">
                      ({mvp.champion})
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-display text-lg font-black text-gold">
                {mvp.rating}
              </span>
              <div className="text-[11px] text-muted-foreground font-mono">
                KDA: {mvp.kda}
              </div>
            </div>
          </div>
        ) : null}

        {/* Elenco Campeão */}
        {starters.length > 0 ? (
          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-4 w-4 text-gold" />
              Line-up Campeã
            </span>
            <div className="grid grid-cols-5 gap-2">
              {starters.map((player) => (
                <div
                  key={player.id}
                  className="flex flex-col items-center rounded-lg border border-border/60 bg-card/40 p-2 text-center"
                >
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {player.role}
                  </span>
                  <span className="font-display text-xs font-bold text-foreground truncate w-full mt-0.5">
                    {player.ign}
                  </span>
                  <span className="text-[10px] font-mono text-gold mt-1">
                    {player.attrs.mechanics} MEC
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Form de Salvar no Histórico */}
        <div className="mt-6 rounded-xl border border-border/80 bg-card/60 p-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Nome do Split / Edição no Histórico
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={splitLabel}
              onChange={(e) => setSplitLabel(e.target.value)}
              disabled={saved}
              placeholder="Ex: 2026 Split 1"
              className="flex-1 rounded-lg border border-border bg-input px-3.5 py-2 text-sm text-foreground focus:border-gold focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saved}
              className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                saved
                  ? "bg-emerald-600/20 border border-emerald-500 text-emerald-400 cursor-default"
                  : "bg-gold text-ink hover:bg-gold/90 shadow-md"
              }`}
            >
              {saved ? "✓ Salvo no Hall da Fama" : "Salvar Título"}
            </button>
          </div>
        </div>

        {/* Ações Finais */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-input px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            Fechar
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenPressConference ? (
              <button
                type="button"
                onClick={onOpenPressConference}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink hover:bg-gold/90 transition-colors shadow-md"
              >
                <Mic className="h-3.5 w-3.5" /> Coletiva Pós-Título
              </button>
            ) : null}

            {onGoToOffseason ? (
              <button
                type="button"
                onClick={onGoToOffseason}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gold/60 bg-gold/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gold hover:bg-gold/30 transition-colors"
              >
                Ver Elencos &amp; Janela <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
