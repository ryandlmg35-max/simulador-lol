/** Painel lateral da Janela de Transferências — mostra todas as movimentações autônomas da liga local. */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, Lock, Sparkles, UserMinus, UserPlus, X } from "lucide-react";
import type { Championship, TransferNews } from "@/lib/lol/types";

type FilterKind = "all" | "signing" | "trade" | "release";

const KIND_BADGE: Record<TransferNews["kind"], { label: string; cls: string }> = {
  signing: {
    label: "CONTRATAÇÃO",
    cls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  },
  trade: {
    label: "TRANSFERÊNCIA / TROCA",
    cls: "border-gold/50 bg-gold/15 text-gold",
  },
  promotion: {
    label: "BASE",
    cls: "border-sky-500/40 bg-sky-500/15 text-sky-400",
  },
  release: {
    label: "DISPENSA",
    cls: "border-blood/50 bg-blood/15 text-blood",
  },
};

export function TransferWindowFeed({
  championship,
  isInternational,
}: {
  championship: Championship;
  isInternational: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");

  // Abre automaticamente em telas largas (mesmo padrão da antiga barra lateral).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1440) {
      setOpen(true);
    }
  }, []);

  const history = championship.transferHistory ?? [];

  const filtered = useMemo(() => {
    if (filter === "all") return history;
    return history.filter((item) => item.kind === filter);
  }, [history, filter]);

  const formatDate = (iso?: string) => {
    if (!iso) return "Split atual";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Recente";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 border-2 border-gold bg-card px-3 py-2 font-display text-xs font-bold uppercase tracking-widest text-gold shadow-[4px_4px_0_0_var(--blood)] transition-colors hover:bg-gold hover:text-ink"
        title="Ver movimentações da janela de transferências"
      >
        {isInternational ? <Lock className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
        Janela de Transferências
        {!isInternational && history.length > 0 ? (
          <span className="bg-blood px-1.5 text-bone">{history.length}</span>
        ) : null}
      </button>

      {open ? (
        <aside className="fixed right-0 top-0 z-40 flex h-full w-80 max-w-[85vw] flex-col border-l-2 border-ink bg-card/95 backdrop-blur">
          <header
            className={`border-b-2 border-ink px-4 py-3 ${
              isInternational ? "bg-zinc-900" : "bg-blood"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest text-bone">
                <ArrowRightLeft className="h-4 w-4 text-gold" /> Janela de Mercado
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-bone transition-colors hover:text-gold"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em]">
              {isInternational ? (
                <span className="text-muted-foreground">
                  🔒 FECHADA · ELENCOS TRAVADOS NO INTERNACIONAL
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  ABERTA · TIMES NEGOCIAM SOZINHOS
                </span>
              )}
            </div>
          </header>

          {isInternational ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <Lock className="mb-3 h-8 w-8 text-gold/60" />
              <p className="font-display text-sm font-bold uppercase tracking-wider text-bone">
                Elencos Bloqueados
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Em campeonatos internacionais o mercado de transferências não opera. Os times
                disputam o torneio com os elencos classificados das ligas locais.
              </p>
            </div>
          ) : (
            <>
              {/* Filtros */}
              <div className="flex gap-1 border-b border-border/60 bg-black/30 px-3 py-2">
                {(
                  [
                    { id: "all", label: "Todas" },
                    { id: "signing", label: "Chegadas" },
                    { id: "trade", label: "Trocas" },
                    { id: "release", label: "Saídas" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`flex-1 rounded px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      filter === tab.id
                        ? "bg-gold text-ink"
                        : "text-muted-foreground hover:bg-white/5 hover:text-bone"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Lista de Movimentações */}
              <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
                {filtered.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-black/20 p-5 text-center">
                    <Sparkles className="mx-auto mb-2 h-5 w-5 text-gold/70" />
                    <p className="text-xs font-semibold text-bone">
                      Nenhuma movimentação registrada ainda
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      Durante os jogos desta liga local e na virada de split, os clubes contratarão,
                      trocarão e dispensarão jogadores automaticamente conforme orçamento e momento.
                    </p>
                  </div>
                ) : (
                  filtered.map((item) => {
                    const badge = KIND_BADGE[item.kind] ?? KIND_BADGE.signing;
                    const Icon =
                      item.kind === "release"
                        ? UserMinus
                        : item.kind === "trade"
                          ? ArrowRightLeft
                          : UserPlus;
                    return (
                      <article
                        key={item.id}
                        className="rounded-lg border border-border/60 bg-black/40 p-3 text-xs transition-colors hover:border-gold/40"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            {badge.label}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {formatDate(item.date)}
                          </span>
                        </div>

                        {/* Jogador + Posição */}
                        <div className="mb-1 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-sm font-bold text-bone">
                              {item.playerIgn}
                            </span>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-gold">
                              {item.role}
                            </span>
                          </div>
                          {item.value ? (
                            <span className="font-mono text-[10px] font-semibold text-emerald-400">
                              ${item.value}k/ano
                            </span>
                          ) : null}
                        </div>

                        {/* Origem -> Destino */}
                        <div className="mb-1.5 flex items-center gap-1.5 rounded bg-white/5 px-2 py-1 text-[11px]">
                          <span className="truncate text-muted-foreground">
                            {item.fromTeam || "Agente Livre"}
                          </span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-gold" />
                          <span className="truncate font-bold text-gold">{item.toTeam}</span>
                        </div>

                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {item.headline}
                        </p>
                      </article>
                    );
                  })
                )}
              </div>
            </>
          )}
        </aside>
      ) : null}
    </>
  );
}
