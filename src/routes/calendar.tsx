import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  CalendarDays,
  Trophy,
  Globe,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Check,
  X,
  Plus,
  Sparkles,
  Zap,
  Flame,
  Crown,
  Shield,
  Layers,
  ArrowRight,
  CheckCircle2,
  CalendarCheck,
  Award,
} from "lucide-react";
import { useStore } from "@/lib/lol/store";
import { TeamLogo } from "@/components/lol/team-logo";
import type { Championship, GameId } from "@/lib/lol/types";
import {
  ANNUAL_CIRCUIT,
  MONTH_THEMES,
  buildChampionshipFromCircuitDef,
  matchChampionshipToCircuit,
  type CircuitEventDef,
} from "@/lib/lol/circuit";
import { toast } from "sonner";

type Search = { game?: GameId; year?: number };

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    game: s.game === "cs2" ? "cs2" : "lol",
    year: typeof s.year === "number" ? s.year : new Date().getFullYear(),
  }),
});

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTH_ABBR = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

function levelBadge(level?: string) {
  if (level === "major") {
    return (
      <span className="rounded bg-gold/20 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wider text-gold border border-gold/40 flex items-center gap-1 font-bold">
        <Crown className="h-2.5 w-2.5" /> MAJOR (2.0x)
      </span>
    );
  }
  if (level === "minor") {
    return (
      <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wider text-cyan-300 border border-cyan-400/30 flex items-center gap-1 font-bold">
        <Zap className="h-2.5 w-2.5" /> MINOR (1.35x)
      </span>
    );
  }
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-wider text-muted-foreground border border-border/30">
      LOCAL (1.0x)
    </span>
  );
}

function ChampCard({
  c,
  onSetMonth,
}: {
  c: Championship;
  onSetMonth: (id: string, month: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(c.scheduledMonth ?? ""));
  const color = c.accentColor ?? "#c8aa6e";

  const save = () => {
    const v = parseInt(draft, 10);
    onSetMonth(c.id, Number.isFinite(v) && v >= 1 && v <= 12 ? v : undefined);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(String(c.scheduledMonth ?? ""));
    setEditing(false);
  };

  return (
    <div
      className="flex items-start gap-3 rounded border border-gold/20 bg-card/85 p-3 hover:border-gold/50 transition-all shadow-sm"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      {c.logo ? (
        <img src={c.logo} alt="" className="h-9 w-9 flex-shrink-0 object-contain drop-shadow" />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-gold/10">
          <Trophy className="h-4 w-4 text-gold" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-display text-sm uppercase tracking-wide text-bone truncate font-semibold">
            {c.name}
          </span>
          {levelBadge(c.internationalLevel)}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {c.region ? (
            <span className="text-[11px] text-muted-foreground">{c.region}</span>
          ) : null}
          {c.season ? (
            <span className="text-[11px] font-semibold text-gold/90">· {c.season}</span>
          ) : null}
          <div className="flex -space-x-1 ml-1">
            {c.teams.slice(0, 6).map((t) => (
              <div key={t.id} className="ring-1 ring-card">
                <TeamLogo team={t} size={18} />
              </div>
            ))}
            {c.teams.length > 6 && (
              <div className="flex h-[18px] w-[18px] items-center justify-center bg-black text-[8px] font-bold text-gold ring-1 ring-card">
                +{c.teams.length - 6}
              </div>
            )}
          </div>
        </div>

        {/* Mês scheduler */}
        {editing ? (
          <div className="mt-2 flex items-center gap-2">
            <select
              autoFocus
              className="bg-ink border border-gold/50 text-bone text-xs px-2 py-1 font-display uppercase tracking-wider focus:outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            >
              <option value="">— Sem mês —</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={i + 1} value={i + 1}>
                  {MONTH_ABBR[i]} – {m}
                </option>
              ))}
            </select>
            <button
              onClick={save}
              className="p-1 text-green-400 hover:text-green-300"
              title="Confirmar"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancel}
              className="p-1 text-muted-foreground hover:text-blood"
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-display text-[10px] uppercase tracking-widest text-gold/80">
              📅 {c.scheduledMonth ? MONTH_NAMES[c.scheduledMonth - 1] : "Sem mês"}
            </span>
            <button
              onClick={() => {
                setDraft(String(c.scheduledMonth ?? ""));
                setEditing(true);
              }}
              className="p-0.5 text-muted-foreground hover:text-gold transition-colors"
              title="Alterar mês no calendário"
            >
              <Edit3 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <Link
        to="/championship/$id"
        params={{ id: c.id }}
        className="ml-auto flex-shrink-0 self-start border border-gold/40 bg-black/50 px-2.5 py-1 font-display text-[10px] uppercase tracking-widest text-gold hover:bg-gold/20 transition-all shadow-[1px_1px_0_0_var(--gold)]"
      >
        Abrir
      </Link>
    </div>
  );
}

function CircuitPlannedCard({
  event,
  year,
  onGenerate,
}: {
  event: CircuitEventDef;
  year: number;
  onGenerate: (def: CircuitEventDef) => void;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded border-2 border-dashed bg-black/50 p-3 transition-all hover:bg-black/70"
      style={{ borderColor: `${event.accentColor}70` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={event.logo} alt="" className="h-8 w-8 flex-shrink-0 object-contain drop-shadow" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-display text-sm uppercase tracking-wide font-bold" style={{ color: event.accentColor }}>
                {event.name}
              </span>
              {levelBadge(event.level)}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {event.description}
            </div>
          </div>
        </div>
      </div>

      {/* Critério de classificação do Split anterior */}
      <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded text-[11px]">
        <Award className="h-3.5 w-3.5 shrink-0" style={{ color: event.accentColor }} />
        <span className="text-muted-foreground">Classificados:</span>
        <span className="font-semibold text-bone">{event.qualifiesFrom}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground/80 font-mono truncate max-w-[210px]" title={event.formatSummary}>
          📋 {event.formatSummary}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to="/create"
            search={{ template: event.id, month: event.month, season: `${year}` }}
            className="border border-border/60 bg-black/50 px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-bone hover:border-gold hover:text-gold transition-all"
            title="Abrir no criador com o template carregado"
          >
            Configurar
          </Link>
          <button
            type="button"
            onClick={() => onGenerate(event)}
            className="border px-2 py-0.5 font-display text-[10px] uppercase tracking-wider text-ink font-bold transition-all hover:opacity-90 flex items-center gap-1 shadow-sm"
            style={{ background: event.accentColor, borderColor: event.accentColor }}
            title={`Adicionar ao simulador com os classificados (${event.qualifiesFrom})`}
          >
            <Sparkles className="h-3 w-3" /> Gerar com Classificados
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarPage() {
  const { championships, hydrated, updateChampionship, addChampionship, career } = useStore();
  const { game = "lol", year = new Date().getFullYear() } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [filterMode, setFilterMode] = useState<"all" | "active" | "intl" | "c1" | "c2" | "c3">("all");

  const setYear = (y: number) => navigate({ search: (s) => ({ ...s, year: y }) });

  const visible = championships
    .filter((c) => (c.game ?? "lol") === game)
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  const handleSetMonth = (id: string, month: number | undefined) => {
    updateChampionship(id, (c) => ({ ...c, scheduledMonth: month }));
    toast.success("Mês atualizado no calendário!");
  };

  // Campeonatos do usuário por mês
  const byMonth = useMemo(() => {
    const grid: Championship[][] = Array.from({ length: 12 }, () => []);
    for (const c of visible) {
      if (c.scheduledMonth && c.scheduledMonth >= 1 && c.scheduledMonth <= 12) {
        grid[c.scheduledMonth - 1].push(c);
      }
    }
    return grid;
  }, [visible]);

  // Eventos oficiais do circuito por mês
  const circuitByMonth = useMemo(() => {
    const grid: CircuitEventDef[][] = Array.from({ length: 12 }, () => []);
    for (const event of ANNUAL_CIRCUIT) {
      if (event.month >= 1 && event.month <= 12) {
        grid[event.month - 1].push(event);
      }
    }
    return grid;
  }, []);

  // Verifica quais eventos do circuito já têm campeonato criado
  const isCircuitEventCreated = (def: CircuitEventDef): boolean => {
    return visible.some((c) => {
      const match = matchChampionshipToCircuit(c);
      return match?.id === def.id;
    });
  };

  // Gerar um torneio específico do circuito
  const handleGenerateCircuitEvent = (def: CircuitEventDef) => {
    const champ = buildChampionshipFromCircuitDef(def, year, visible, career);
    addChampionship(champ);
    toast.success(`Torneio "${champ.name}" criado com os classificados de ${def.qualifiesFrom}!`);
  };

  // Gerar todos os torneios oficiais faltantes com 1 clique
  const handleGenerateAllMissingCircuit = () => {
    const missing = ANNUAL_CIRCUIT.filter((event) => !isCircuitEventCreated(event));
    if (missing.length === 0) {
      toast.info("Todos os torneios internacionais da temporada já estão criados!");
      return;
    }

    let addedCount = 0;
    for (const def of missing) {
      const champ = buildChampionshipFromCircuitDef(def, year, visible, career);
      addChampionship(champ);
      addedCount++;
    }

    toast.success(`${addedCount} torneios internacionais gerados com os classificados dos 3 Splits!`);
  };

  const unscheduled = visible.filter(
    (c) => !c.scheduledMonth || c.scheduledMonth < 1 || c.scheduledMonth > 12,
  );

  const missingCircuitEvents = ANNUAL_CIRCUIT.filter((e) => !isCircuitEventCreated(e));
  const totalCreatedCount = visible.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-ink bg-ink">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              search={{ game }}
              className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-muted-foreground hover:text-bone"
            >
              ← Campeonatos
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <div className="flex items-center gap-2 font-display text-sm uppercase tracking-widest text-gold font-bold">
              <CalendarDays className="h-4 w-4" />
              Calendário da Temporada
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/ranking"
              search={{ game }}
              className="flex items-center gap-2 border border-gold/40 bg-black/50 px-4 py-2 font-display text-sm uppercase tracking-[0.25em] text-gold hover:bg-gold/10"
            >
              <Trophy className="h-4 w-4" /> Hall da Fama
            </Link>
            <Link
              to="/create"
              search={{ game }}
              className="flex items-center gap-2 bg-gold px-4 py-2 font-display text-sm uppercase tracking-widest text-ink font-bold hover:-translate-y-0.5 transition-transform"
            >
              <Plus className="h-4 w-4" /> Novo Torneio
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* Banner de título + controles */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-6 border-b-2 border-gold/30 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-display uppercase tracking-widest text-gold mb-1 font-bold">
              <span>Circuito Oficial de 3 Splits</span> · <span>Temporada {year}</span>
            </div>
            <h1 className="font-display text-5xl uppercase tracking-tight text-bone drop-shadow">
              Calendário <span className="text-gold">Anual {year}</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Estrutura de <strong>3 Splits regionais por ano</strong>. Cada torneio internacional acontece imediatamente após a sua respectiva etapa regional, recebendo os times classificados.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Seletor de Ano */}
            <div className="flex items-center border-2 border-gold/40 bg-black/60">
              <button
                onClick={() => setYear(year - 1)}
                className="px-3 py-2 text-bone hover:bg-gold/20 hover:text-gold transition-colors"
                title="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-display text-xl uppercase tracking-widest text-gold min-w-[70px] text-center font-bold px-2">
                {year}
              </span>
              <button
                onClick={() => setYear(year + 1)}
                className="px-3 py-2 text-bone hover:bg-gold/20 hover:text-gold transition-colors"
                title="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Ação rápida para gerar todos os torneios do circuito */}
            {missingCircuitEvents.length > 0 && (
              <button
                type="button"
                onClick={handleGenerateAllMissingCircuit}
                className="flex items-center justify-center gap-2 border-2 border-gold bg-gold/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-gold hover:bg-gold hover:text-ink transition-all font-bold shadow-[2px_2px_0_0_var(--gold)]"
                title="Gera todos os torneios internacionais pós-split com os times qualificados das ligas"
              >
                <Sparkles className="h-4 w-4" />
                Preencher Circuito ({missingCircuitEvents.length} internacionais)
              </button>
            )}
          </div>
        </div>

        {/* MAPA DOS 3 SPLITS DA TEMPORADA (Resumo Visual dos Ciclos) */}
        <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Ciclo 1 */}
          <div className="border-2 border-cyan-400/50 bg-cyan-400/5 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-xs uppercase tracking-widest font-bold text-cyan-300">
                ⚡ CICLO 1: SPLIT 1 → FIRST STAND
              </span>
              <span className="text-[10px] bg-cyan-400/20 px-2 py-0.5 rounded text-cyan-300 font-mono">
                JAN - MAR
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• <strong>Jan/Fev</strong>: Ligas Regionais (Split 1)</div>
              <div>• <strong>Março</strong>: ⚡ <strong>First Stand Tournament</strong></div>
              <div className="text-[11px] text-cyan-300 mt-1 font-semibold">
                🎯 Classificam-se: Campeões do Split 1 de cada região.
              </div>
            </div>
          </div>

          {/* Ciclo 2 */}
          <div className="border-2 border-amber-400/50 bg-amber-400/5 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-xs uppercase tracking-widest font-bold text-amber-300">
                👑 CICLO 2: SPLIT 2 → MSI & RIFT RIVALS
              </span>
              <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded text-amber-300 font-mono">
                ABR - JUL
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• <strong>Abr/Mai</strong>: Ligas Regionais (Split 2)</div>
              <div>• <strong>Junho</strong>: 👑 <strong>Mid-Season Invitational (MSI)</strong></div>
              <div>• <strong>Julho</strong>: ⚔️ <strong>Rift Rivals: Batalha Continental</strong></div>
              <div className="text-[11px] text-amber-300 mt-1 font-semibold">
                🎯 Classificam-se: Top 1 e 2 do Split 2 para o MSI.
              </div>
            </div>
          </div>

          {/* Ciclo 3 */}
          <div className="border-2 border-gold/60 bg-gold/5 p-4 rounded shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-display text-xs uppercase tracking-widest font-bold text-gold">
                🏆 CICLO 3: SPLIT 3 → MUNDIAL (WORLDS)
              </span>
              <span className="text-[10px] bg-gold/20 px-2 py-0.5 rounded text-gold font-mono">
                JUL - NOV
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• <strong>Jul/Ago</strong>: Ligas Regionais (Split 3 - Decisão)</div>
              <div>• <strong>Agosto</strong>: 🌐 <strong>Global Masters & Supercopa</strong></div>
              <div>• <strong>Setembro</strong>: 🛡️ <strong>Copa dos Desafiantes</strong></div>
              <div>• <strong>Out/Nov</strong>: 🏆 <strong>Mundial (Worlds)</strong></div>
              <div className="text-[11px] text-gold mt-1 font-semibold">
                🎯 Classificam-se: Melhores dos 3 Splits & Vagas Globais.
              </div>
            </div>
          </div>
        </section>

        {/* Timeline visual dos 12 meses (Barra Superior) */}
        <section className="mb-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-xs uppercase tracking-widest text-gold font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-gold" /> Visão Geral dos 12 Meses
            </span>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-1 border border-border/60 bg-black/40 p-1 text-xs">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-3 py-1 font-display uppercase tracking-wider transition-colors ${
                  filterMode === "all" ? "bg-gold text-ink font-bold" : "text-muted-foreground hover:text-bone"
                }`}
              >
                Todos os 12 Meses
              </button>
              <button
                onClick={() => setFilterMode("c1")}
                className={`px-2.5 py-1 font-display uppercase tracking-wider transition-colors ${
                  filterMode === "c1" ? "bg-cyan-400 text-ink font-bold" : "text-muted-foreground hover:text-cyan-300"
                }`}
              >
                Split 1 + First Stand
              </button>
              <button
                onClick={() => setFilterMode("c2")}
                className={`px-2.5 py-1 font-display uppercase tracking-wider transition-colors ${
                  filterMode === "c2" ? "bg-amber-400 text-ink font-bold" : "text-muted-foreground hover:text-amber-300"
                }`}
              >
                Split 2 + MSI
              </button>
              <button
                onClick={() => setFilterMode("c3")}
                className={`px-2.5 py-1 font-display uppercase tracking-wider transition-colors ${
                  filterMode === "c3" ? "bg-gold text-ink font-bold" : "text-muted-foreground hover:text-gold"
                }`}
              >
                Split 3 + Worlds
              </button>
              <button
                onClick={() => setFilterMode("intl")}
                className={`px-2.5 py-1 font-display uppercase tracking-wider transition-colors ${
                  filterMode === "intl" ? "bg-white text-ink font-bold" : "text-muted-foreground hover:text-bone"
                }`}
              >
                Só Internacionais
              </button>
            </div>
          </div>

          {/* Barra de 12 Meses estilo Esports */}
          <div className="border-2 border-gold/40 bg-black/60 p-4 shadow-lg">
            <div className="grid grid-cols-12 gap-1.5">
              {MONTH_ABBR.map((abbr, idx) => {
                const monthNum = idx + 1;
                const userChamps = byMonth[idx];
                const circuitEvents = circuitByMonth[idx];
                const hasMajor =
                  userChamps.some((c) => c.internationalLevel === "major") ||
                  circuitEvents.some((e) => e.level === "major");
                const hasMinor =
                  userChamps.some((c) => c.internationalLevel === "minor") ||
                  circuitEvents.some((e) => e.level === "minor");
                const totalCount = userChamps.length;

                return (
                  <a
                    key={idx}
                    href={`#month-${monthNum}`}
                    className="flex flex-col items-center gap-1 p-1 rounded hover:bg-white/5 transition-colors group cursor-pointer"
                  >
                    {/* Indicador de altura da barra */}
                    <div className="relative flex h-16 w-full flex-col-reverse justify-start items-center">
                      <div
                        className="w-full transition-all duration-300 rounded-t-sm"
                        style={{
                          height: totalCount > 0 ? `${Math.min(100, Math.max(25, totalCount * 22))}%` : "6px",
                          background: hasMajor
                            ? "var(--gold)"
                            : hasMinor
                              ? "#00e5ff"
                              : totalCount > 0
                                ? "#6b7280"
                                : "rgba(255,255,255,0.1)",
                        }}
                      />
                    </div>
                    {/* Contagem */}
                    <span
                      className="font-display text-[11px] font-bold"
                      style={{
                        color: hasMajor
                          ? "var(--gold)"
                          : hasMinor
                            ? "#00e5ff"
                            : totalCount > 0
                              ? "#e5e7eb"
                              : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {totalCount > 0 ? totalCount : "—"}
                    </span>
                    {/* Mês */}
                    <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground group-hover:text-gold transition-colors">
                      {abbr}
                    </span>
                  </a>
                );
              })}
            </div>

            {/* Legenda explicativa */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border/30 pt-3 text-[11px]">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 bg-gold" />
                  <span className="font-display uppercase tracking-wider text-gold font-bold">
                    Major (Worlds & MSI · 2.0x)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 bg-cyan-400" />
                  <span className="font-display uppercase tracking-wider text-cyan-300 font-bold">
                    Minor Internacional (First Stand, Rift Rivals, etc. · 1.35x)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 bg-gray-500" />
                  <span className="font-display uppercase tracking-wider text-muted-foreground">
                    Ligas Regionais (Split 1, Split 2, Split 3 · 1.0x)
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground">
                <span className="text-gold font-bold">{totalCreatedCount}</span> campeonatos cadastrados no simulador
              </div>
            </div>
          </div>
        </section>

        {/* GRADE COMPLETA DOS 12 MESES */}
        <section className="space-y-8">
          <div className="flex items-center justify-between border-b-2 border-gold/30 pb-2">
            <h2 className="font-display text-3xl uppercase tracking-widest text-bone flex items-center gap-3">
              <CalendarDays className="h-7 w-7 text-gold" />
              Roteiro dos 12 Meses do Ano
            </h2>
            <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">
              3 Splits Regionais + Torneios Internacionais Pós-Split
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {MONTH_NAMES.map((monthName, idx) => {
              const monthNum = idx + 1;
              const userChamps = byMonth[idx];
              const circuitEvents = circuitByMonth[idx];
              const theme = MONTH_THEMES[monthNum];

              // Filtros
              if (filterMode === "active" && userChamps.length === 0) return null;
              if (filterMode === "c1" && theme.cycleNumber !== 1) return null;
              if (filterMode === "c2" && theme.cycleNumber !== 2) return null;
              if (filterMode === "c3" && theme.cycleNumber !== 3) return null;
              if (
                filterMode === "intl" &&
                !circuitEvents.some((e) => e.level === "major" || e.level === "minor") &&
                !userChamps.some((c) => c.internationalLevel === "major" || c.internationalLevel === "minor")
              ) {
                return null;
              }

              const hasMajor =
                userChamps.some((c) => c.internationalLevel === "major") ||
                circuitEvents.some((e) => e.level === "major");
              const hasMinor =
                userChamps.some((c) => c.internationalLevel === "minor") ||
                circuitEvents.some((e) => e.level === "minor");

              return (
                <div
                  key={monthNum}
                  id={`month-${monthNum}`}
                  className="flex flex-col border-2 bg-card/65 transition-all hover:border-gold/60 shadow-md"
                  style={{
                    borderColor: hasMajor
                      ? "rgba(201,170,110,0.7)"
                      : hasMinor
                        ? "rgba(0,229,255,0.5)"
                        : "rgba(255,255,255,0.12)",
                  }}
                >
                  {/* Cabeçalho do Mês */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{
                      borderColor: hasMajor
                        ? "rgba(201,170,110,0.4)"
                        : hasMinor
                          ? "rgba(0,229,255,0.3)"
                          : "rgba(255,255,255,0.1)",
                      background: hasMajor
                        ? "rgba(201,170,110,0.12)"
                        : hasMinor
                          ? "rgba(0,229,255,0.08)"
                          : "rgba(0,0,0,0.4)",
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{theme?.icon}</span>
                        <span
                          className="font-display text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-black/40 border border-white/10"
                          style={{ color: hasMajor ? "var(--gold)" : hasMinor ? "#00e5ff" : "#9ca3af" }}
                        >
                          {theme?.cycleBadge}
                        </span>
                      </div>
                      <div
                        className="font-display text-2xl uppercase tracking-wide font-bold mt-1"
                        style={{ color: hasMajor ? "var(--gold)" : hasMinor ? "#00e5ff" : "#f3f4f6" }}
                      >
                        {monthName}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {theme?.title}
                      </div>
                    </div>

                    <span
                      className="font-display text-4xl font-extrabold opacity-25"
                      style={{ color: hasMajor ? "var(--gold)" : hasMinor ? "#00e5ff" : "#ffffff" }}
                    >
                      {String(monthNum).padStart(2, "0")}
                    </span>
                  </div>

                  {/* Conteúdo do Mês */}
                  <div className="flex flex-col gap-3 p-4 flex-1">
                    {/* Descrição temática do mês */}
                    <div className="text-[11px] text-muted-foreground/80 italic border-l-2 border-border/40 pl-2">
                      {theme?.subtitle}
                    </div>

                    {/* 1. Campeonatos já criados pelo usuário neste mês */}
                    {userChamps.length > 0 && (
                      <div className="space-y-2">
                        <span className="font-display text-[10px] uppercase tracking-wider text-gold/90 font-bold block">
                          Ativos no Simulador ({userChamps.length}):
                        </span>
                        {userChamps.map((c) => (
                          <ChampCard key={c.id} c={c} onSetMonth={handleSetMonth} />
                        ))}
                      </div>
                    )}

                    {/* 2. Eventos oficiais do circuito previstos para este mês */}
                    {circuitEvents.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-border/30">
                        <span className="font-display text-[10px] uppercase tracking-wider text-cyan-400 font-bold block">
                          Circuito Internacional Pós-Split:
                        </span>
                        {circuitEvents.map((event) => {
                          const alreadyCreated = isCircuitEventCreated(event);
                          if (alreadyCreated) {
                            return (
                              <div
                                key={event.id}
                                className="flex items-center justify-between gap-2 rounded border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs text-green-300"
                              >
                                <div className="flex items-center gap-2">
                                  <img src={event.logo} alt="" className="h-5 w-5 object-contain" />
                                  <span className="font-display uppercase tracking-wider font-bold">
                                    {event.shortName}
                                  </span>
                                </div>
                                <span className="font-display text-[10px] uppercase tracking-wider bg-green-500/20 px-2 py-0.5 rounded text-green-400">
                                  ✓ Criado
                                </span>
                              </div>
                            );
                          }

                          return (
                            <CircuitPlannedCard
                              key={event.id}
                              event={event}
                              year={year}
                              onGenerate={handleGenerateCircuitEvent}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Informação sobre split regional daquele mês se for etapa regular */}
                    {theme.isSplitStage && (
                      <div className="bg-black/30 border border-border/30 p-2.5 rounded text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>🏛️ {theme.splitLabel}</span>
                        <Link
                          to="/create"
                          search={{ game, month: monthNum, season: `${year} ${theme.splitLabel?.split(" ")[0]}` }}
                          className="font-display text-[10px] uppercase tracking-wider text-gold hover:underline"
                        >
                          + Criar Liga neste Split
                        </Link>
                      </div>
                    )}

                    {/* Mês sem campeonatos criados */}
                    {userChamps.length === 0 && circuitEvents.length === 0 && !theme.isSplitStage && (
                      <div className="border border-dashed border-border/30 bg-black/20 p-4 text-center text-xs text-muted-foreground/60 rounded flex-1 flex flex-col justify-center items-center">
                        <span>Nenhum campeonato agendado</span>
                        <span className="text-[10px] mt-1 text-muted-foreground/40">
                          Use o botão abaixo para criar
                        </span>
                      </div>
                    )}

                    {/* Botão de adicionar campeonato customizado neste mês */}
                    <div className="pt-2 mt-auto">
                      <Link
                        to="/create"
                        search={{ game, month: monthNum, season: `${year}` }}
                        className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border/50 py-1.5 text-[10px] font-display uppercase tracking-widest text-muted-foreground hover:border-gold hover:text-gold transition-colors rounded"
                      >
                        <Plus className="h-3 w-3" /> Adicionar Campeonato em {MONTH_ABBR[idx]}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Campeonatos sem mês agendado (se houver) */}
        {unscheduled.length > 0 && (
          <section className="mt-12 border-t-2 border-border/40 pt-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl uppercase tracking-widest text-bone flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-gold" />
                  Campeonatos Sem Data Definida ({unscheduled.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estes campeonatos existem no seu simulador mas ainda não foram atribuídos a nenhum mês do calendário.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {unscheduled.map((c) => (
                <ChampCard key={c.id} c={c} onSetMonth={handleSetMonth} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-border/60 py-8 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground bg-ink">
        Simulador de Campeonatos de Esports · Temporada Oficial de 3 Splits {year}
      </footer>
    </div>
  );
}
