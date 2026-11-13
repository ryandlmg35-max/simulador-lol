import { useEffect, useState, useMemo, memo } from "react";
import { Check, Dices, Mic, Radio, RotateCcw, Swords, Star } from "lucide-react";
import type { Match, SwissConfig, Team } from "@/lib/lol/types";
import { TeamLogo } from "./team-logo";
import { useStore } from "@/lib/lol/store";
import { Button } from "@/components/ui/button";
import { randomResult } from "@/lib/lol/generate";
import { getMomentumState, simulateForMatch } from "@/lib/lol/momentum";
import { HeadToHeadModal } from "./head-to-head-modal";
import { TeamProfileDrawer } from "./team-profile-drawer";
import { LiveFinalModal } from "./live-final-modal";
import { PressConferenceModal } from "./press-conference-modal";

const MOOD_ICON: Record<string, string> = {
  hot: "🔥",
  cold: "❄️",
  tilted: "😤",
  rising: "⭐",
};

function MatchCardComponent({
  championshipId,
  teams,
  phaseId,
  match,
  compact = false,
  onSetResult,
  allTeams,
}: {
  championshipId: string;
  /** Times da série a que esta fase pertence — nunca mistura divisões. */
  teams: Team[];
  phaseId: string;
  match: Match;
  compact?: boolean;
  /** Se informado, registra o resultado por aqui (ex.: play-in de promoção). */
  onSetResult?: (winnerId: string | null, score?: { a: number; b: number }) => void;
  /**
   * Times adicionais apenas para exibição (ex.: arquivados que já saíram do
   * elenco) — o seletor ⇄ continua mostrando só `teams`.
   */
  allTeams?: Team[];
}) {
  const { setMatchResult, assignSlotTeam, getChampionship, career } = useStore();
  const teamById = Object.fromEntries([...teams, ...(allTeams ?? [])].map((t) => [t.id, t]));
  const teamA = match.teamAId ? teamById[match.teamAId] : null;
  const teamB = match.teamBId ? teamById[match.teamBId] : null;
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() ?? "");
  const [h2hOpen, setH2hOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [pressOpen, setPressOpen] = useState(false);
  const [profileTeam, setProfileTeam] = useState<Team | null>(null);

  useEffect(() => {
    setScoreA(match.scoreA?.toString() ?? "");
    setScoreB(match.scoreB?.toString() ?? "");
  }, [match.scoreA, match.scoreB]);

  const applyResult = (winnerId: string | null, score?: { a: number; b: number }) => {
    if (onSetResult) onSetResult(winnerId, score);
    else setMatchResult(championshipId, phaseId, match.id, winnerId, score);
  };

  const submitScore = () => {
    if (!match.teamAId || !match.teamBId) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return;
    const winnerId = a > b ? match.teamAId : match.teamBId;
    applyResult(winnerId, { a, b });
  };

  const clearScore = () => {
    setScoreA("");
    setScoreB("");
    applyResult(null);
  };

  const randomScore = () => {
    if (!match.teamAId || !match.teamBId) return;
    // O dado não é 100% aleatório: rating ELO + forma + aproveitamento
    // influenciam quem vence. O rating ELO é o NÍVEL REAL do time.
    const champ = getChampionship(championshipId);
    const ratings = champ ? career[champ.game ?? "lol"] : undefined;
    const { a, b } = champ ? simulateForMatch(champ, match, ratings) : randomResult(match.bestOf);
    setScoreA(String(a));
    setScoreB(String(b));
    const winnerId = a > b ? match.teamAId : match.teamBId;
    applyResult(winnerId, { a, b });
  };

  const winnerIsA = match.winnerId && match.winnerId === match.teamAId;
  const winnerIsB = match.winnerId && match.winnerId === match.teamBId;

  const rowClass = (isWinner: boolean, isLoser: boolean, team?: { color?: string } | null) =>
    `group relative flex items-center gap-2 border-l-4 px-3 py-2 text-sm font-semibold uppercase tracking-wide transition-all ${
      isWinner
        ? "bg-gold/95 text-ink border-l-ink"
        : isLoser
          ? "bg-black/60 text-muted-foreground/70 border-l-transparent line-through decoration-blood/70 decoration-2"
          : "bg-card/80 text-bone border-l-transparent hover:bg-blood/20 hover:border-l-blood"
    }`;

  const renderPicker = (slot: "A" | "B", current: Team | null) => (
    <select
      value={current?.id ?? ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) =>
        e.target.value && assignSlotTeam(championshipId, phaseId, match.id, slot, e.target.value)
      }
      title="Trocar time deste slot"
      className="w-6 shrink-0 cursor-pointer appearance-none border border-gold/40 bg-black/60 text-center text-[10px] text-gold/90 outline-none hover:border-gold"
    >
      <option value="">⇄</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id} className="bg-ink text-bone">
          {t.tag}
        </option>
      ))}
    </select>
  );

  const champ = getChampionship(championshipId);

  const isGrandFinalMatch = useMemo(() => {
    if (!champ) return false;
    const checkDivision = (phases: typeof champ.phases) => {
      const lastBracket = [...phases].reverse().find((p) => p.kind === "bracket");
      if (!lastBracket || lastBracket.id !== phaseId) return false;
      const decisive = [...lastBracket.matches].sort((a, b) => {
        const pA = a.bracketSide === "reset" ? 4 : a.bracketSide === "grand" ? 3 : !a.nextMatchId ? 2 : 0;
        const pB = b.bracketSide === "reset" ? 4 : b.bracketSide === "grand" ? 3 : !b.nextMatchId ? 2 : 0;
        return pB - pA || (b.round ?? 0) - (a.round ?? 0);
      })[0];
      return decisive?.id === match.id;
    };
    return checkDivision(champ.phases) || (champ.serieB ? checkDivision(champ.serieB.phases) : false);
  }, [champ, phaseId, match.id]);

  const isEliminationOrFinalMatch = useMemo(() => {
    if (!champ || !match.winnerId || !teamA || !teamB || match.bye) return false;
    if (isGrandFinalMatch) return true;
    const allPhases = [...champ.phases, ...(champ.serieB?.phases ?? [])];
    const phase = allPhases.find((p) => p.id === phaseId);
    if (!phase) return false;
    if (phase.kind === "bracket") {
      // Em chave eliminatória, se não há loserNextMatchId, o perdedor é eliminado
      return !match.loserNextMatchId;
    }
    if (phase.kind === "swiss") {
      const cfg = phase.config as SwissConfig;
      const maxLosses = cfg?.lossesToEliminate ?? 3;
      const bucketLosses = Number(match.swissBucket?.split("-")[1] ?? -1);
      return bucketLosses === maxLosses - 1;
    }
    if (phase.internationalPlayIn && match.bracketSide === "lower") {
      return !match.loserNextMatchId;
    }
    return false;
  }, [champ, isGrandFinalMatch, match.winnerId, match.loserNextMatchId, match.swissBucket, match.bracketSide, match.bye, phaseId, teamA, teamB]);

  const winnerTeam = match.winnerId === teamA?.id ? teamA : match.winnerId === teamB?.id ? teamB : null;
  const loserTeam = match.winnerId === teamA?.id ? teamB : match.winnerId === teamB?.id ? teamA : null;
  const moodIcon = (team: Team | null) => {
    if (!team || !champ?.momentum) return null;
    const mood = getMomentumState(champ.momentum, team.id).mood;
    if (!mood) return null;
    const labels: Record<string, string> = {
      hot: "Embalado — sequência de vitórias",
      cold: "Frio — fase ruim",
      tilted: "Tiltado — cabeça quente",
      rising: "Em evolução — reagiu bem",
    };
    return (
      <span className="shrink-0 text-sm" title={labels[mood]}>
        {MOOD_ICON[mood]}
      </span>
    );
  };

  return (
    <div className="noise-layer overflow-hidden border-2 border-ink bg-ink shadow-[3px_3px_0_0_var(--gold)]">
      <div className={`w-full ${rowClass(Boolean(winnerIsA), Boolean(winnerIsB), teamA)}`}>
        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => teamA && setProfileTeam(teamA)}
          title={teamA ? `Ver perfil completo de ${teamA.name}` : undefined}
        >
          <TeamLogo team={teamA} size={compact ? 22 : 28} />
          <span
            className="flex-1 truncate text-left font-display text-base tracking-wider"
            title={match.pendingA ? "Vaga reservada: classificado do play-in" : undefined}
          >
            {teamA?.tag ?? (match.pendingA ? "A CLASSIFICAR" : "TBD")}
          </span>
        </div>
        {moodIcon(teamA)}
        {renderPicker("A", teamA)}
      </div>
      <div className="h-px bg-gold/40" />
      <div className={`w-full ${rowClass(Boolean(winnerIsB), Boolean(winnerIsA), teamB)}`}>
        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => teamB && setProfileTeam(teamB)}
          title={teamB ? `Ver perfil completo de ${teamB.name}` : undefined}
        >
          <TeamLogo team={teamB} size={compact ? 22 : 28} />
          <span
            className="flex-1 truncate text-left font-display text-base tracking-wider"
            title={match.pendingB ? "Vaga reservada: classificado do play-in" : undefined}
          >
            {teamB?.tag ?? (match.pendingB ? "A CLASSIFICAR" : "TBD")}
          </span>
        </div>
        {moodIcon(teamB)}
        {renderPicker("B", teamB)}
      </div>
      {match.teamAId && match.teamBId ? (
        <form
          className="flex flex-wrap items-center justify-center gap-1.5 border-t border-gold/30 bg-black/50 px-2 py-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            submitScore();
          }}
        >
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={scoreA}
            onChange={(event) => setScoreA(event.target.value)}
            aria-label={`Placar de ${teamA?.name ?? "time A"}`}
            className="h-8 w-10 border border-gold/50 bg-input text-center font-display text-lg text-bone outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          />
          <span className="font-display text-base text-gold">×</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={scoreB}
            onChange={(event) => setScoreB(event.target.value)}
            aria-label={`Placar de ${teamB?.name ?? "time B"}`}
            className="h-8 w-10 border border-gold/50 bg-input text-center font-display text-lg text-bone outline-none focus:border-gold focus:ring-1 focus:ring-gold"
          />
          <Button
            type="submit"
            size="icon"
            disabled={scoreA === "" || scoreB === "" || scoreA === scoreB}
            className="h-8 w-8 rounded-none bg-gold text-ink hover:bg-gold/80"
            title="Salvar resultado"
            aria-label="Salvar resultado"
          >
            <Check />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={randomScore}
            className="h-8 w-8 rounded-none text-muted-foreground hover:bg-gold/30 hover:text-gold"
            title="Resultado aleatório"
            aria-label="Resultado aleatório"
          >
            <Dices />
          </Button>
          {!match.winnerId ? (
            <button
              type="button"
              onClick={() => setLiveOpen(true)}
              className={`inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap px-2 font-display text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors ${
                isGrandFinalMatch
                  ? "bg-blood text-white hover:bg-blood/85"
                  : "border border-blood/60 bg-blood/20 text-blood hover:bg-blood hover:text-white"
              }`}
              title={
                isGrandFinalMatch
                  ? "Simular a Grande Final ao vivo mapa a mapa"
                  : "Assistir e simular esta série ao vivo mapa a mapa"
              }
            >
              <Radio className="h-3 w-3 shrink-0 animate-pulse" /> Ao Vivo
            </button>
          ) : null}
          {match.winnerId ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={clearScore}
              className="h-8 w-8 rounded-none text-muted-foreground hover:bg-blood/30 hover:text-bone"
              title="Limpar resultado"
              aria-label="Limpar resultado"
            >
              <RotateCcw />
            </Button>
          ) : null}
        </form>
      ) : null}
      {/* MVP da Série */}
      {match.mvp ? (
        <div
          className="flex items-center justify-between border-t border-gold/40 bg-gold/15 px-2.5 py-1 text-[10px]"
          title={match.mvp.highlight || `Destaque: ${match.mvp.playerName}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Star className="h-3 w-3 fill-gold text-gold shrink-0" />
            <span className="font-bold text-gold font-mono uppercase">MVP</span>
            <span className="font-semibold text-foreground truncate">
              {match.mvp.playerName}
            </span>
            <span className="text-muted-foreground uppercase text-[9px] font-mono">
              ({match.mvp.role})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 font-mono text-[9px]">
            <span className="text-foreground">{match.mvp.kda}</span>
            <span className="font-bold text-gold">{match.mvp.rating}</span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between bg-gold/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-gold/80">
        <div className="flex items-center gap-2">
          <span>Bo{match.bestOf}</span>
          {teamA && teamB ? (
            <button
              type="button"
              onClick={() => setH2hOpen(true)}
              className="inline-flex items-center gap-0.5 rounded px-1 text-[8px] tracking-normal text-gold hover:bg-gold/20 transition-colors"
              title="Ver histórico de confrontos diretos (H2H)"
            >
              <Swords className="h-2.5 w-2.5" /> H2H
            </button>
          ) : null}
          {isEliminationOrFinalMatch && winnerTeam && loserTeam ? (
            <button
              type="button"
              onClick={() => setPressOpen(true)}
              className="inline-flex items-center gap-0.5 rounded border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[8px] font-extrabold tracking-normal text-gold hover:bg-gold hover:text-ink transition-colors"
              title={
                isGrandFinalMatch
                  ? "Abrir Coletiva de Imprensa Pós-Título / Vice"
                  : "Abrir Coletiva de Imprensa Pós-Eliminação"
              }
            >
              <Mic className="h-2.5 w-2.5" /> Coletiva
            </button>
          ) : null}
        </div>
        {match.roundName ? <span className="truncate">{match.roundName}</span> : null}
      </div>

      {pressOpen && winnerTeam && loserTeam && champ ? (
        <PressConferenceModal
          championship={champ}
          match={match}
          winnerTeam={winnerTeam}
          loserTeam={loserTeam}
          isGrandFinal={isGrandFinalMatch}
          initialTab={isGrandFinalMatch ? "winner" : "loser"}
          career={career[champ.game ?? "lol"]}
          onClose={() => setPressOpen(false)}
        />
      ) : null}

      {h2hOpen && teamA && teamB && champ ? (
        <HeadToHeadModal
          teamA={teamA}
          teamB={teamB}
          championship={champ}
          onClose={() => setH2hOpen(false)}
        />
      ) : null}

      {liveOpen && teamA && teamB && champ ? (
        <LiveFinalModal
          championship={champ}
          match={match}
          teamA={teamA}
          teamB={teamB}
          career={career[champ.game ?? "lol"]}
          isGrandFinal={isGrandFinalMatch}
          onFinish={(winnerId, score) => {
            setScoreA(String(score.a));
            setScoreB(String(score.b));
            applyResult(winnerId, score);
          }}
          onClose={() => setLiveOpen(false)}
        />
      ) : null}

      {profileTeam ? (
        <TeamProfileDrawer
          team={profileTeam}
          championship={champ}
          career={career}
          game={champ?.game ?? "lol"}
          onClose={() => setProfileTeam(null)}
        />
      ) : null}
    </div>
  );
}

export const MatchCard = memo(MatchCardComponent);
