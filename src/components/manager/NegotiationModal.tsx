import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  Handshake,
  MessageSquareQuote,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import {
  evaluateTransferOffer,
  formatMoneyK,
  type CareerPlayer,
  type ManagerCareerState,
  type TransferEvaluationResult,
} from "@/lib/lol/manager-career";

export function NegotiationModal({
  state,
  player,
  onSubmitOffer,
  onClose,
}: {
  state: ManagerCareerState;
  player: CareerPlayer;
  onSubmitOffer: (params: {
    playerId: string;
    offeredFeeK: number;
    offeredSalaryK: number;
    promisedRole: "franchise_star" | "starter" | "sub";
  }) => TransferEvaluationResult;
  onClose: () => void;
}) {
  const isFreeAgent = player.league === "FREE_AGENT" || !player.teamId;
  const [feeK, setFeeK] = useState<number>(isFreeAgent ? 0 : player.marketValueK);
  const [salaryK, setSalaryK] = useState<number>(Math.max(8, player.salaryPerRoundK + 2));
  const [promisedRole, setPromisedRole] = useState<"franchise_star" | "starter" | "sub">("starter");
  const [submittedResult, setSubmittedResult] = useState<TransferEvaluationResult | null>(null);

  const preview = useMemo(
    () =>
      evaluateTransferOffer({
        state,
        player,
        offeredFeeK: isFreeAgent ? 0 : feeK,
        offeredSalaryK: salaryK,
        promisedRole,
      }),
    [state, player, feeK, salaryK, promisedRole, isFreeAgent],
  );

  const signingBonusK = Math.round(salaryK * 0.5);
  const immediateOutK = (isFreeAgent ? 0 : feeK) + signingBonusK;
  const hasScout = state.staff.some((s) => s.role === "scout");

  const handleSend = () => {
    const res = onSubmitOffer({
      playerId: player.id,
      offeredFeeK: isFreeAgent ? 0 : feeK,
      offeredSalaryK: salaryK,
      promisedRole,
    });
    setSubmittedResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-2 border-gold bg-ink p-6 shadow-[0_24px_60px_rgba(0,0,0,0.9)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gold/25 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
              Mesa de Negociação Oficial ·{" "}
              {isFreeAgent ? "Agente Livre" : `${player.teamName} (${player.league})`}
            </span>
            <h3 className="mt-1 flex items-center gap-2 font-display text-2xl uppercase tracking-wider text-bone">
              <Handshake className="h-6 w-6 text-gold" />
              {player.ign}
              <span className="border border-gold/50 bg-gold/15 px-2 py-0.5 text-xs text-gold">
                {player.role.toUpperCase()} · {player.overall} OVR
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {player.real ? `${player.real} · ` : ""}
              {player.country ?? "INTL"} · {player.age ?? 21} anos · Valor de Mercado:{" "}
              <strong className="text-bone">
                {isFreeAgent ? "Sem Multa (Livre)" : formatMoneyK(player.marketValueK)}
              </strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border p-1.5 text-muted-foreground hover:border-gold hover:text-bone"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resultado enviado se já clicou em Enviar */}
        {submittedResult ? (
          <div className="mt-5 space-y-4">
            <div
              className={`border-2 p-4 ${
                submittedResult.clubAccepted &&
                submittedResult.playerAccepted &&
                submittedResult.canAfford &&
                !submittedResult.inCooldown
                  ? "border-emerald-500/70 bg-emerald-950/30"
                  : "border-blood/70 bg-blood/15"
              }`}
            >
              <div className="flex items-center gap-2 font-display text-lg uppercase tracking-wider text-bone">
                {submittedResult.clubAccepted &&
                submittedResult.playerAccepted &&
                submittedResult.canAfford &&
                !submittedResult.inCooldown ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                {submittedResult.headline}
              </div>
              <div className="mt-2 flex items-start gap-2 text-sm italic text-bone/90">
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>{submittedResult.quote}</span>
              </div>
            </div>

            {submittedResult.clubAccepted && submittedResult.playerAccepted && submittedResult.canAfford && !submittedResult.inCooldown ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full bg-gold py-3 font-display text-sm uppercase tracking-widest text-ink"
              >
                Concluir Contratação
              </button>
            ) : (
              <div className="flex flex-wrap gap-3">
                {submittedResult.counterSuggestion && !submittedResult.inCooldown ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFeeK(submittedResult.counterSuggestion!.feeK);
                      setSalaryK(submittedResult.counterSuggestion!.salaryK);
                      setSubmittedResult(null);
                    }}
                    className="flex-1 border border-gold bg-gold/15 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gold hover:bg-gold/25"
                  >
                    Aplicar Contraproposta ({formatMoneyK(submittedResult.counterSuggestion.feeK)} /{" "}
                    {formatMoneyK(submittedResult.counterSuggestion.salaryK)} por rodada)
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSubmittedResult(null)}
                  className="border border-border bg-black/50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-bone hover:border-gold"
                >
                  Ajustar Valores
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-border bg-black/50 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-bone"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Parâmetros da Proposta */}
            <div className="grid gap-4 sm:grid-cols-2">
              {!isFreeAgent ? (
                <div className="border border-border bg-card/60 p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-gold">
                      Taxa de Transferência
                    </span>
                    <strong className="font-display text-base text-bone">
                      {formatMoneyK(feeK)}
                    </strong>
                  </div>
                  <input
                    type="range"
                    min={Math.round(player.marketValueK * 0.5)}
                    max={Math.max(500, Math.round(player.marketValueK * 2.2))}
                    step={25}
                    value={feeK}
                    onChange={(e) => setFeeK(Number(e.target.value))}
                    className="mt-2 w-full accent-amber-400"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>Pedida clube (~{formatMoneyK(preview.minClubFeeK)})</span>
                    <span>Mercado: {formatMoneyK(player.marketValueK)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col justify-center border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs">
                  <strong className="font-display text-sm uppercase tracking-wider text-emerald-300">
                    Passe Livre ($0 de multa)
                  </strong>
                  <span className="mt-1 text-muted-foreground">
                    Você paga apenas luvas (50% do salário) + contrato por rodada.
                  </span>
                </div>
              )}

              <div className="border border-border bg-card/60 p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-gold">
                    Salário por Rodada
                  </span>
                  <strong className="font-display text-base text-bone">
                    {formatMoneyK(salaryK)}
                  </strong>
                </div>
                <input
                  type="range"
                  min={5}
                  max={Math.max(120, Math.round(preview.expectedSalaryK * 2.5))}
                  step={1}
                  value={salaryK}
                  onChange={(e) => setSalaryK(Number(e.target.value))}
                  className="mt-2 w-full accent-amber-400"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {hasScout
                      ? `Olheiro estima: ${formatMoneyK(preview.expectedSalaryK)}/rod.`
                      : `Atual: ${formatMoneyK(player.salaryPerRoundK)}/rod.`}
                  </span>
                  <span>Luvas: {formatMoneyK(signingBonusK)}</span>
                </div>
              </div>
            </div>

            {/* Papel Prometido */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                Papel Prometido no Projeto
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "franchise_star", label: "Estrela da Franquia", desc: "Centro do projeto" },
                    { id: "starter", label: "Titular Garantido", desc: "Vaga na line principal" },
                    { id: "sub", label: "Reserva / Rotação", desc: "Disputa posição" },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPromisedRole(r.id)}
                    className={`border p-2.5 text-left transition-colors ${
                      promisedRole === r.id
                        ? "border-gold bg-gold/15 text-bone"
                        : "border-border bg-black/40 text-muted-foreground hover:text-bone"
                    }`}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider">{r.label}</div>
                    <div className="text-[10px] opacity-80">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Análise Realista de Decisão */}
            <div className="border border-gold/30 bg-card/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gold">
                  Análise do Jogador (Liga, Time e Proposta)
                </span>
                <span
                  className={`border px-2.5 py-0.5 text-xs font-bold ${
                    preview.overallChancePct >= 65 && preview.clubAccepted
                      ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300"
                      : preview.overallChancePct >= 45
                        ? "border-amber-500/60 bg-amber-950/40 text-amber-300"
                        : "border-red-500/60 bg-red-950/40 text-red-300"
                  }`}
                >
                  Chance de Aceitar: {preview.overallChancePct}%
                </span>
              </div>

              <div className="space-y-2">
                {preview.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 border border-border/50 bg-black/40 px-3 py-2 text-xs"
                  >
                    <div className="flex items-start gap-2">
                      {reason.impact === "positive" ? (
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : reason.impact === "negative" ? (
                        <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                      <div>
                        <strong className="text-bone">{reason.label}: </strong>
                        <span className="text-muted-foreground">{reason.detail}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 font-bold ${
                        reason.points > 0
                          ? "text-emerald-400"
                          : reason.points < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {reason.points > 0 ? `+${reason.points}` : reason.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Custo Total + Botão */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-gold/25 pt-4">
              <div className="text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Coins className="h-4 w-4 text-gold" />
                  Custo imediato (Multa + Luvas):{" "}
                  <strong className="text-bone">{formatMoneyK(immediateOutK)}</strong>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Caixa disponível: <strong className="text-emerald-400">{formatMoneyK(state.cashK)}</strong>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-border bg-black/60 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-bone"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!preview.canAfford || preview.inCooldown}
                  onClick={handleSend}
                  className="bg-gold px-6 py-2.5 font-display text-sm uppercase tracking-widest text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {preview.inCooldown
                    ? "Aguardando Cooldown"
                    : !preview.canAfford
                      ? "Saldo Insuficiente"
                      : "Enviar Proposta Oficial"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
