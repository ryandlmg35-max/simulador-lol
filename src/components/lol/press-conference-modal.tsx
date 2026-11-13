import { useMemo, useState } from "react";
import {
  Mic,
  Trophy,
  HeartCrack,
  X,
  Newspaper,
  BarChart3,
  MessageSquareQuote,
  Sparkles,
  ShieldAlert,
  Globe,
} from "lucide-react";
import type { CareerTeam, Championship, Match, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import { buildPressConference, type PressQuestion } from "@/lib/lol/press-conference";

const TONE_CLASSES: Record<PressQuestion["speakerTone"], string> = {
  gold: "border-gold/50 bg-gold/15 text-gold",
  emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  blood: "border-blood/50 bg-blood/15 text-red-300",
  blue: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  purple: "border-purple-500/40 bg-purple-500/15 text-purple-300",
};

export function PressConferenceModal({
  championship,
  match,
  winnerTeam,
  loserTeam,
  isGrandFinal = false,
  initialTab,
  career,
  onClose,
}: {
  championship: Championship;
  match: Match;
  winnerTeam: Team;
  loserTeam: Team;
  isGrandFinal?: boolean;
  initialTab?: "winner" | "loser";
  career?: Record<string, CareerTeam>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"winner" | "loser">(
    initialTab ?? (isGrandFinal ? "winner" : "loser"),
  );
  const [showXRay, setShowXRay] = useState(true);

  const data = useMemo(
    () =>
      buildPressConference({
        championship,
        match,
        winnerTeam,
        loserTeam,
        isGrandFinal,
        career,
      }),
    [championship, match, winnerTeam, loserTeam, isGrandFinal, career],
  );

  const questions = activeTab === "winner" ? data.winnerQuestions : data.loserQuestions;
  const activeTeam = activeTab === "winner" ? winnerTeam : loserTeam;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border-2 border-gold/50 bg-[#0b0d13] text-bone shadow-[0_0_70px_rgba(0,0,0,0.9)]"
      >
        {/* Top Broadcast Bar */}
        <div className="flex items-center justify-between border-b border-gold/30 bg-gradient-to-r from-black via-[#131622] to-black px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/50 bg-gold/15 text-gold">
              <Mic className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xs font-extrabold uppercase tracking-[0.2em] text-gold">
                  Sala de Imprensa Oficial
                </span>
                <span className="rounded border border-gold/40 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gold">
                  {data.storylineBadge}
                </span>
                {data.isInternational ? (
                  <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-sky-300">
                    <Globe className="h-2.5 w-2.5" /> Palco Internacional
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {championship.name} · {championship.season ?? "Temporada Atual"} ·{" "}
                {isGrandFinal ? "Grande Final" : match.roundName ?? "Fase Eliminatória"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border/60 bg-black/50 p-1.5 text-muted-foreground transition-colors hover:border-gold/50 hover:text-bone"
            title="Fechar coletiva"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Headline & Match Banner */}
          <div className="rounded-xl border border-gold/30 bg-gradient-to-b from-[#131722] to-[#0d1018] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1.5 flex-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold">
                  <Newspaper className="h-3.5 w-3.5" /> Manchete Pós-Série
                </div>
                <h2 className="font-display text-xl sm:text-2xl font-black uppercase tracking-wide text-bone leading-tight">
                  {data.headline}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {data.subheadline}
                </p>
              </div>

              {/* Placar da Série */}
              <div className="flex items-center justify-center gap-3 rounded-xl border border-gold/30 bg-black/60 px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <TeamLogo team={winnerTeam} size={34} />
                  <div className="text-left">
                    <div className="font-display text-sm font-bold uppercase text-gold">
                      {winnerTeam.tag}
                    </div>
                    <div className="text-[10px] font-mono uppercase text-emerald-400">
                      {isGrandFinal ? "Campeão" : "Classificado"}
                    </div>
                  </div>
                </div>

                <div className="px-2 font-display text-2xl font-black tracking-wider text-bone">
                  <span className="text-gold">{data.winnerScore}</span>
                  <span className="mx-1 text-muted-foreground text-base">×</span>
                  <span className="text-muted-foreground">{data.loserScore}</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-display text-sm font-bold uppercase text-bone/80">
                      {loserTeam.tag}
                    </div>
                    <div className="text-[10px] font-mono uppercase text-red-400">
                      {isGrandFinal ? "Vice-Campeão" : "Eliminado"}
                    </div>
                  </div>
                  <TeamLogo team={loserTeam} size={34} />
                </div>
              </div>
            </div>

            {/* Radiografia Técnica */}
            <div className="mt-4 border-t border-border/50 pt-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gold/90">
                  <BarChart3 className="h-3.5 w-3.5" /> Radiografia Técnica &amp; Fatores Decisivos
                </span>
                <button
                  type="button"
                  onClick={() => setShowXRay((v) => !v)}
                  className="text-[11px] font-mono uppercase text-muted-foreground hover:text-gold transition-colors"
                >
                  {showXRay ? "Ocultar detalhes ▲" : "Mostrar detalhes ▼"}
                </button>
              </div>

              {showXRay ? (
                <div className="mt-2.5 space-y-3">
                  <p className="text-xs text-bone/85 leading-relaxed bg-black/40 border border-border/50 rounded-lg p-3">
                    {data.tacticalSummary}
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {data.keyFactors.map((f) => (
                      <div
                        key={f.label}
                        className="rounded-lg border border-border/60 bg-black/50 p-2.5 flex flex-col justify-between"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {f.label}
                        </span>
                        <div className="my-1 flex items-baseline justify-between font-mono text-xs">
                          <span
                            className={
                              f.advantage === "winner"
                                ? "font-extrabold text-gold"
                                : "text-bone/80"
                            }
                          >
                            {winnerTeam.tag}: {f.winnerVal}
                          </span>
                          <span className="text-[10px] text-muted-foreground">vs</span>
                          <span
                            className={
                              f.advantage === "loser"
                                ? "font-extrabold text-emerald-400"
                                : "text-muted-foreground"
                            }
                          >
                            {loserTeam.tag}: {f.loserVal}
                          </span>
                        </div>
                        <span className="text-[9px] text-muted-foreground leading-tight">
                          {f.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Seletor de Bancada (Time Campeão/Vencedor vs Time Eliminado/Vice) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab("winner")}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                activeTab === "winner"
                  ? "border-gold bg-gold/15 shadow-[0_0_25px_rgba(212,175,55,0.2)]"
                  : "border-border/60 bg-black/40 opacity-70 hover:opacity-100 hover:border-gold/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <TeamLogo team={winnerTeam} size={32} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span className="font-display text-xs font-extrabold uppercase tracking-wider text-gold">
                      {isGrandFinal ? "Coletiva do Campeão" : "Coletiva da Vitória"}
                    </span>
                  </div>
                  <div className="font-display text-sm font-bold text-bone">
                    {winnerTeam.name}
                  </div>
                </div>
              </div>
              <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] font-bold text-gold">
                5 Perguntas
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("loser")}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                activeTab === "loser"
                  ? "border-blood bg-blood/15 shadow-[0_0_25px_rgba(220,38,38,0.2)]"
                  : "border-border/60 bg-black/40 opacity-70 hover:opacity-100 hover:border-blood/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <TeamLogo team={loserTeam} size={32} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <HeartCrack className="h-3.5 w-3.5 text-red-400" />
                    <span className="font-display text-xs font-extrabold uppercase tracking-wider text-red-400">
                      {isGrandFinal
                        ? "Coletiva Pós-Vice (Derrota)"
                        : "Coletiva Pós-Eliminação"}
                    </span>
                  </div>
                  <div className="font-display text-sm font-bold text-bone">
                    {loserTeam.name}
                  </div>
                </div>
              </div>
              <span className="rounded bg-blood/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">
                5 Perguntas
              </span>
            </button>
          </div>

          {/* Lista Organizada de Perguntas e Respostas */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="h-4 w-4 text-gold" />
                <span className="font-display text-xs font-bold uppercase tracking-widest text-bone">
                  Bancada de Entrevistas — {activeTeam.name}
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                Respostas baseadas nos atributos e desempenho real da série
              </span>
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="rounded-xl border border-border/70 bg-[#10131c] p-4 transition-colors hover:border-gold/40"
              >
                {/* Cabeçalho da Pergunta: Veículo + Tópico + Entrevistado */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-mono font-bold text-bone">
                      {idx + 1}
                    </span>
                    <span className="rounded bg-black/60 border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                      {q.outlet}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      por <strong className="text-bone/90">{q.journalist}</strong>
                    </span>
                    <span className="hidden sm:inline-block text-muted-foreground">·</span>
                    <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {q.topicTag}
                    </span>
                  </div>

                  {/* Badge do Jogador / Coach */}
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="font-display text-xs font-bold text-bone">
                        {q.speakerName}
                      </span>
                      <span className="ml-1.5 text-[10px] font-mono uppercase text-muted-foreground">
                        ({q.speakerRole})
                      </span>
                    </div>
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${TONE_CLASSES[q.speakerTone]}`}
                    >
                      {q.speakerBadge}
                    </span>
                  </div>
                </div>

                {/* Pergunta do Jornalista */}
                <div className="mt-3">
                  <p className="text-xs sm:text-sm font-semibold text-gold/95 leading-snug">
                    “{q.question}”
                  </p>
                </div>

                {/* Resposta Detalhada do Jogador / Coach */}
                <div className="mt-2.5 rounded-lg border-l-2 border-gold/60 bg-black/40 p-3">
                  <p className="text-xs sm:text-sm text-bone/90 leading-relaxed">
                    {q.answer}
                  </p>
                </div>

                {/* Rodapé de Contexto Real / Atributo */}
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                  {activeTab === "winner" ? (
                    <Sparkles className="h-3 w-3 text-gold shrink-0" />
                  ) : (
                    <ShieldAlert className="h-3 w-3 text-red-400 shrink-0" />
                  )}
                  <span>Contexto da Simulação: {q.statCallout}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gold/30 bg-black/80 px-5 py-3">
          <span className="text-[11px] text-muted-foreground">
            Dica: Alterne entre as abas acima para ouvir tanto o lado vencedor quanto o time eliminado.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gold bg-gold px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-ink transition-colors hover:bg-gold/90"
          >
            Fechar Coletiva
          </button>
        </div>
      </div>
    </div>
  );
}
