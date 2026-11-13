import { useEffect, useRef, useState } from "react";
import { Play, Radio, Trophy, X, Zap } from "lucide-react";
import { clampAttr } from "@/lib/lol/players";
import type { CareerMatch, CareerTeam } from "@/lib/lol/manager-career";

export function LiveCareerMatchModal({
  match,
  teamA,
  teamB,
  strengthA,
  strengthB,
  onFinish,
  onClose,
}: {
  match: CareerMatch;
  teamA: CareerTeam;
  teamB: CareerTeam;
  strengthA: number;
  strengthB: number;
  onFinish: (result: { matchId: string; winnerId: string; scoreA: number; scoreB: number }) => void;
  onClose: () => void;
}) {
  const winsNeeded = Math.ceil(match.bestOf / 2);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [logs, setLogs] = useState<string[]>([
    `Transmissão ao vivo iniciada: ${teamA.name} vs ${teamB.name} (MD${match.bestOf}).`,
  ]);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pWinA = clampAttr(1 / (1 + Math.pow(10, -(strengthA - strengthB) / 14)), 0.14, 0.86);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const playNextMap = (curA = scoreA, curB = scoreB) => {
    if (curA >= winsNeeded || curB >= winsNeeded) return;
    const gameNum = curA + curB + 1;
    const aWins = Math.random() < pWinA;
    const nextA = curA + (aWins ? 1 : 0);
    const nextB = curB + (aWins ? 0 : 1);
    const winnerTag = aWins ? teamA.tag : teamB.tag;
    const minutes = 25 + Math.floor(Math.random() * 14);
    const note =
      aWins === (strengthA >= strengthB)
        ? `Jogo ${gameNum} (${minutes}min): ${winnerTag} domina controle de mapa e fecha o nexus!`
        : `Jogo ${gameNum} (${minutes}min): ${winnerTag} vira luta decisiva no Barão e garante o ponto!`;

    setScoreA(nextA);
    setScoreB(nextB);
    setLogs((prev) => [note, ...prev]);

    if (nextA >= winsNeeded || nextB >= winsNeeded) {
      setFinished(true);
      const champTag = nextA > nextB ? teamA.name : teamB.name;
      setLogs((prev) => [`SÉRIE ENCERRADA! Vitória de ${champTag} por ${nextA}–${nextB}.`, ...prev]);
    }
  };

  const autoFinishAll = () => {
    let a = scoreA;
    let b = scoreB;
    const step = () => {
      if (a >= winsNeeded || b >= winsNeeded) return;
      const aWins = Math.random() < pWinA;
      if (aWins) a++;
      else b++;
      const gameNum = a + b;
      const winnerTag = aWins ? teamA.tag : teamB.tag;
      setScoreA(a);
      setScoreB(b);
      setLogs((prev) => [`Jogo ${gameNum}: Ponto para ${winnerTag} (${a}–${b}).`, ...prev]);
      if (a >= winsNeeded || b >= winsNeeded) {
        setFinished(true);
      } else {
        timerRef.current = setTimeout(step, 550);
      }
    };
    step();
  };

  const winnerId = scoreA > scoreB ? teamA.id : teamB.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl border-2 border-gold bg-ink p-6 shadow-[0_24px_70px_rgba(0,0,0,0.95)]">
        <div className="flex items-center justify-between border-b border-gold/25 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-400">
            <Radio className="h-4 w-4 animate-pulse" /> Ao Vivo · {match.label ?? `MD${match.bestOf}`}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-bone"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Placar Ao Vivo */}
        <div className="my-5 grid grid-cols-11 items-center gap-2 border border-gold/30 bg-card/70 p-4 text-center">
          <div className="col-span-4">
            <div className="font-display text-lg uppercase tracking-wider text-bone">
              {teamA.name}
            </div>
            <div className="text-[11px] font-bold text-gold">
              {teamA.isUserTeam ? "SEU CLUBE · " : ""}
              {strengthA} OVR
            </div>
          </div>

          <div className="col-span-3 flex items-center justify-center gap-2 font-display text-4xl text-gold">
            <span>{scoreA}</span>
            <span className="text-lg text-muted-foreground">×</span>
            <span>{scoreB}</span>
          </div>

          <div className="col-span-4">
            <div className="font-display text-lg uppercase tracking-wider text-bone">
              {teamB.name}
            </div>
            <div className="text-[11px] font-bold text-gold">
              {teamB.isUserTeam ? "SEU CLUBE · " : ""}
              {strengthB} OVR
            </div>
          </div>
        </div>

        {/* Feed minuto a minuto */}
        <div className="max-h-48 space-y-1.5 overflow-y-auto border border-border/70 bg-black/60 p-3 text-xs">
          {logs.map((l, i) => (
            <div
              key={i}
              className={`border-l-2 pl-2.5 py-0.5 ${
                i === 0 ? "border-gold text-bone font-semibold" : "border-border text-muted-foreground"
              }`}
            >
              {l}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {!finished ? (
            <>
              <button
                type="button"
                onClick={() => playNextMap()}
                className="inline-flex flex-1 items-center justify-center gap-2 border border-gold bg-gold/15 px-4 py-2.5 font-display text-xs uppercase tracking-widest text-gold hover:bg-gold/25"
              >
                <Play className="h-4 w-4" /> Jogar Mapa {scoreA + scoreB + 1}
              </button>
              <button
                type="button"
                onClick={autoFinishAll}
                className="inline-flex flex-1 items-center justify-center gap-2 bg-gold px-4 py-2.5 font-display text-xs uppercase tracking-widest text-ink"
              >
                <Zap className="h-4 w-4" /> Simular Ao Vivo
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                onFinish({
                  matchId: match.id,
                  winnerId,
                  scoreA,
                  scoreB,
                })
              }
              className="inline-flex w-full items-center justify-center gap-2 bg-gold px-6 py-3 font-display text-sm uppercase tracking-widest text-ink"
            >
              <Trophy className="h-4 w-4" /> Confirmar Resultado e Avançar Rodada
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
