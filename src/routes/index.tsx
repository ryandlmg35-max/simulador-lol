import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trophy, Trash2, CalendarDays, Briefcase, Database, Download, Upload, X } from "lucide-react";
import { useStore } from "@/lib/lol/store";
import { loadManagerCareer } from "@/lib/lol/manager-career";
import { TeamLogo } from "@/components/lol/team-logo";
import { ConfirmDialog } from "@/components/lol/confirm-dialog";
import { useConfirm } from "@/components/lol/use-confirm";
import type { GameId } from "@/lib/lol/types";

type Search = { game?: GameId };

export const Route = createFileRoute("/")({
  component: Index,
  validateSearch: (s: Record<string, unknown>): Search => ({
    game: s.game === "cs2" ? "cs2" : "lol",
  }),
});

const GAMES: Array<{ id: GameId; label: string; accent: string; badge: string }> = [
  { id: "lol", label: "League of Legends", accent: "var(--blood)", badge: "L" },
  { id: "cs2", label: "Counter-Strike 2", accent: "#f59e0b", badge: "CS" },
];

function Index() {
  const { championships, career, hydrated, removeChampionship, resetChampionship } = useStore();
  // Reset em massa: modo seleção na home — marca quantas ligas quiser e zera
  // os resultados delas de uma vez (arquivo, elencos e carreira intactos).
  const [resetMode, setResetMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"clubs" | "worldcup">("clubs");
  const [superBackupOpen, setSuperBackupOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { confirm, confirmDialog } = useConfirm();

  const handleExportSuperBackup = () => {
    try {
      const managerCareer = loadManagerCareer();
      const payload = {
        kind: "esports-sandbox-super-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        championships,
        career,
        managerCareer,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `esports-super-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Super Backup completo exportado com sucesso!");
    } catch {
      toast.error("Não foi possível exportar o Super Backup.");
    }
  };

  const handleImportSuperBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        championships?: unknown;
        career?: unknown;
        managerCareer?: unknown;
      };
      if (
        !Array.isArray(parsed.championships) &&
        !parsed.career &&
        !parsed.managerCareer
      ) {
        toast.error("Arquivo inválido: não é um Super Backup reconhecido.");
        return;
      }
      if (Array.isArray(parsed.championships)) {
        window.localStorage.setItem(
          "lol-esports-sim:v2",
          JSON.stringify(parsed.championships),
        );
        window.localStorage.setItem("lol-esports-sim:cs2-seeded", "1");
      }
      if (parsed.career && typeof parsed.career === "object") {
        window.localStorage.setItem(
          "lol-esports-sim:career:v1",
          JSON.stringify(parsed.career),
        );
        window.localStorage.setItem("lol-esports-sim:career-seeded:v1", "1");
      }
      if (parsed.managerCareer && typeof parsed.managerCareer === "object") {
        window.localStorage.setItem(
          "esports-manager-career-v1",
          JSON.stringify(parsed.managerCareer),
        );
      }
      toast.success("Super Backup restaurado! Recarregando simulador...");
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch {
      toast.error("Falha ao ler o arquivo JSON de Super Backup.");
    }
  };
  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const exitResetMode = () => {
    setResetMode(false);
    setSelected([]);
  };
  const confirmReset = async () => {
    const names = visible.filter((c) => selected.includes(c.id)).map((c) => c.name);
    const ok = await confirm({
      title: `Zerar o placar de ${names.length} liga(s)?`,
      message:
        `${names.join(", ")}\n\n` +
        "Só os resultados: fases e confrontos voltam ao início para você\n" +
        "simular de novo. A evolução dos jogadores e a forma/momentum\n" +
        "deste split também voltam ao ponto de partida — o split é\n" +
        "simulado do zero, sem acúmulo.\n" +
        "Times, elencos, histórico de campeões e ranking não mudam.",
      confirmLabel: "Zerar resultados",
    });
    if (!ok) return;
    selected.forEach((id) => resetChampionship(id));
    exitResetMode();
  };
  const { game = "lol" } = Route.useSearch();
  const activeGame = GAMES.find((g) => g.id === game) ?? GAMES[0];
  // Mais recentes primeiro: o split/edição que você acabou de usar fica no
  // topo — sem confundir com a edição antiga de mesmo nome.
  const isWorldCupChamp = (c: { name?: string; logo?: string }) =>
    /copa do mundo|world cup|seleções|selecoes/i.test(c.name ?? "") ||
    c.logo === "/logos/world-cup-lol.jpg";
  const allVisible = championships
    .filter((c) => (c.game ?? "lol") === game)
    .slice()
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  const clubVisible = allVisible.filter((c) => !isWorldCupChamp(c));
  const worldCupVisible = allVisible.filter((c) => isWorldCupChamp(c));
  const visible = activeTab === "worldcup" ? worldCupVisible : clubVisible;
  const championshipGroups = Array.from(
    visible.reduce((groups, championship) => {
      const key = championship.name.trim().toLowerCase();
      const editions = groups.get(key) ?? [];
      editions.push(championship);
      groups.set(key, editions);
      return groups;
    }, new Map<string, typeof visible>()),
  ).map(([, editions]) => ({ current: editions[0], editions }));
  const isCs2 = game === "cs2";

  return (
    <div className="min-h-screen">
      <ConfirmDialog {...confirmDialog} />
      <header className="sticky top-0 z-40 border-b border-gold/25 bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="notch-tl flex h-11 w-11 items-center justify-center font-display text-xl text-bone shadow-[0_8px_24px_-10px_rgba(0,0,0,0.9)]"
              style={{ background: activeGame.accent }}
            >
              {activeGame.badge}
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-2xl uppercase tracking-[0.15em] text-bone">
                Esports Sandbox
              </span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.3em] text-gold">
                {activeGame.label} · Championship Simulator
              </span>
            </div>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/manager"
              className="flex items-center gap-2 border border-gold bg-gold/15 px-4 py-2 font-display text-sm uppercase tracking-[0.22em] text-gold transition-all hover:bg-gold hover:text-ink"
            >
              <Briefcase className="h-4 w-4" /> Modo Carreira
            </Link>
            <Link
              to="/calendar"
              search={{ game }}
              className="flex items-center gap-2 border border-gold/40 bg-black/50 px-4 py-2 font-display text-sm uppercase tracking-[0.25em] text-gold transition-all hover:bg-gold/10"
            >
              <CalendarDays className="h-4 w-4" /> Calendário
            </Link>
            <Link
              to="/ranking"
              search={{ game }}
              className="flex items-center gap-2 border border-gold/40 bg-black/50 px-4 py-2 font-display text-sm uppercase tracking-[0.25em] text-gold transition-all hover:bg-gold/10"
            >
              <Trophy className="h-4 w-4" /> Hall da Fama
            </Link>
            <button
              type="button"
              onClick={() => setSuperBackupOpen(true)}
              className="flex items-center gap-2 border border-gold/40 bg-black/50 px-4 py-2 font-display text-sm uppercase tracking-[0.22em] text-gold transition-all hover:bg-gold/10"
              title="Exportar ou importar todos os campeonatos, Hall da Fama e Modo Carreira em um único arquivo JSON"
            >
              <Database className="h-4 w-4" /> Super Backup
            </button>
            <div className="flex overflow-hidden border border-gold/40 bg-black/50 p-0.5">
              {GAMES.map((g) => {
                const active = g.id === game;
                return (
                  <Link
                    key={g.id}
                    to="/"
                    search={{ game: g.id }}
                    className={`px-4 py-2 font-display text-sm uppercase tracking-[0.25em] transition-all ${
                      active
                        ? "bg-gold text-ink shadow-[0_6px_20px_-8px_var(--gold)]"
                        : "text-gold/60 hover:bg-gold/10 hover:text-gold"
                    }`}
                    style={active ? { background: g.accent, color: "var(--ink)" } : undefined}
                  >
                    {g.id === "lol" ? "LoL" : "CS2"}
                  </Link>
                );
              })}
            </div>
            <Link
              to="/create"
              search={{ game }}
              className="slant-r sheen relative flex items-center gap-2 overflow-hidden px-5 py-2.5 font-display text-base uppercase tracking-widest text-ink transition-transform hover:-translate-y-0.5"
              style={{ background: activeGame.accent }}
            >
              <Plus className="h-4 w-4" strokeWidth={3} />
              Novo Campeonato
            </Link>
          </div>
        </div>
      </header>

      <section className="noise-layer scanlines relative overflow-hidden border-b border-gold/25">
        <div className="arena-light absolute inset-0 opacity-70" />
        <div className="grunge absolute inset-0 opacity-40" />
        <div className="tech-grid absolute inset-0 opacity-70" />
        <div className="stripes-strong absolute -right-48 top-0 h-full w-80 -rotate-12 opacity-[0.12]" />
        <div
          className="text-outline pointer-events-none absolute -bottom-10 right-8 hidden select-none font-display text-[9rem] leading-none tracking-tighter opacity-[0.09] lg:block"
          aria-hidden="true"
        >
          {isCs2 ? "CS2" : "LOL"}
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <div
            className="inline-flex items-center gap-2 border bg-ink/80 px-3 py-1 font-display text-xs uppercase tracking-[0.35em] backdrop-blur"
            style={{ borderColor: activeGame.accent, color: activeGame.accent }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: activeGame.accent }}
            />
            Modo Sandbox · {activeGame.label}
          </div>
          <h1 className="mt-5 max-w-4xl font-display text-6xl uppercase leading-[0.85] tracking-tight text-bone drop-shadow-[0_6px_0_rgba(0,0,0,0.55)] md:text-8xl">
            Você é o
            <br />
            <span
              style={{
                color: activeGame.accent,
                textShadow: `0 0 42px color-mix(in oklab, ${activeGame.accent} 55%, transparent)`,
              }}
            >
              comissário técnico
            </span>
            <br />
            do próximo <span className="text-gold">torneio</span>.
          </h1>
          <div className="hairline-gold mt-7 h-px w-56" />
          <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-muted-foreground">
            Monte qualquer campeonato de {isCs2 ? "Counter-Strike 2" : "League of Legends"} do zero.
            Escolha times, formato de fases, número de vagas — e simule até a final.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Abas separadas: Ligas & Torneios de Clubes vs Copa do Mundo de Seleções */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("clubs");
              if (resetMode) exitResetMode();
            }}
            className={`flex items-center gap-2 border-2 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] transition-all ${
              activeTab === "clubs"
                ? "border-gold bg-gold/15 text-gold shadow-[3px_3px_0_0_var(--gold)]"
                : "border-gold/25 bg-black/40 text-muted-foreground hover:border-gold/50 hover:text-bone"
            }`}
          >
            <span>🏛️ Ligas & Torneios</span>
            <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px]">
              {hydrated ? clubVisible.length : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("worldcup");
              if (resetMode) exitResetMode();
            }}
            className={`flex items-center gap-2 border-2 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] transition-all ${
              activeTab === "worldcup"
                ? "border-sky-400 bg-sky-500/15 text-sky-300 shadow-[3px_3px_0_0_#38bdf8]"
                : "border-sky-400/25 bg-black/40 text-muted-foreground hover:border-sky-400/50 hover:text-bone"
            }`}
          >
            <span>🌍 Copa do Mundo de Seleções</span>
            <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[10px]">
              {hydrated ? worldCupVisible.length : "—"}
            </span>
          </button>
        </div>

        <div className="mb-8 flex items-end justify-between border-b border-gold/30 pb-3">
          <div className="flex items-center gap-4">
            <span
              className="h-8 w-1.5"
              style={{ background: activeTab === "worldcup" ? "#38bdf8" : activeGame.accent }}
            />
            <h2 className="font-display text-3xl uppercase tracking-[0.18em] text-bone">
              {activeTab === "worldcup"
                ? `Copa do Mundo de Seleções ${isCs2 ? "CS2" : "LoL"}`
                : `Campeonatos ${isCs2 ? "CS2" : "LoL"}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="border border-gold/30 bg-gold/10 px-2.5 py-1 font-display text-xs uppercase tracking-[0.25em] text-gold">
              {hydrated
                ? `${championshipGroups.length} campeonatos · ${visible.length} edições`
                : "—"}
            </span>
            {visible.length > 0 ? (
              <button
                type="button"
                onClick={() => (resetMode ? exitResetMode() : setResetMode(true))}
                className={`flex items-center gap-2 rounded-full border px-4 py-1.5 font-display text-xs uppercase tracking-[0.2em] transition-colors ${
                  resetMode
                    ? "border-blood bg-blood text-white"
                    : "border-gold/40 bg-black/50 text-gold hover:bg-gold/10"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {resetMode ? "Cancelar reset" : "Resetar ligas"}
              </button>
            ) : null}
          </div>
        </div>

        {!hydrated ? null : visible.length === 0 ? (
          <div className="noise-layer tech-grid relative overflow-hidden border border-dashed border-gold/40 bg-card/30 p-16 text-center">
            <div className="pointer-events-none absolute left-0 top-0 h-20 w-20 border-l-2 border-t-2 border-gold/40" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-20 border-b-2 border-r-2 border-gold/40" />
            <div className="mx-auto flex h-20 w-20 rotate-45 items-center justify-center border border-gold/30 bg-black/40">
              <Trophy className="h-9 w-9 -rotate-45 text-gold" strokeWidth={1.5} />
            </div>
            <h3 className="mt-6 font-display text-3xl uppercase tracking-[0.18em] text-bone">
              {activeTab === "worldcup"
                ? "Nenhuma Copa do Mundo criada ainda"
                : "Nenhum campeonato ainda"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {activeTab === "worldcup"
                ? "Torneio de elite de fim de ano entre seleções nacionais, com convocação automática por desempenho e 100% de jogadores nativos."
                : "Você define nome, times, fases, formato de jogo — tudo do zero."}
            </p>
            <Link
              to="/create"
              search={{ game }}
              className="slant-r sheen relative mt-8 inline-flex items-center gap-2 overflow-hidden px-8 py-4 font-display text-xl uppercase tracking-widest text-bone transition-transform hover:-translate-y-0.5"
              style={{ background: activeTab === "worldcup" ? "#0284c7" : activeGame.accent }}
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
              {activeTab === "worldcup"
                ? "Criar Copa do Mundo de Seleções"
                : "Criar meu primeiro campeonato"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {championshipGroups.map(({ current: c, editions }) => (
              <div key={c.id} className="group relative">
                <Link
                  to="/championship/$id"
                  params={{ id: c.id }}
                  onClick={(e) => {
                    // No modo reset o clique MARCA em vez de navegar.
                    if (resetMode) {
                      e.preventDefault();
                      toggleSelect(c.id);
                    }
                  }}
                  className={`noise-layer sheen relative block overflow-hidden border bg-card shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)] transition-all duration-300 ${
                    resetMode
                      ? selected.includes(c.id)
                        ? "border-blood ring-2 ring-blood/70"
                        : "border-gold/20 hover:border-gold/60"
                      : "border-gold/20 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_24px_50px_-20px_color-mix(in_oklab,var(--gold)_45%,transparent)]"
                  }`}
                >
                  {resetMode ? (
                    <div
                      className={`absolute left-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 font-display text-xs ${
                        selected.includes(c.id)
                          ? "border-blood bg-blood text-white"
                          : "border-gold/60 bg-ink/80 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </div>
                  ) : null}
                  <div
                    className="stripes relative h-28 border-b border-gold/25"
                    style={{
                      background: c.accentColor
                        ? `linear-gradient(135deg, ${c.accentColor}, oklch(0.11 0.008 40))`
                        : `linear-gradient(135deg, ${activeGame.accent}, var(--ink))`,
                    }}
                  >
                    <div className="splatter absolute inset-0 opacity-40" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-2 left-4">
                      <div className="font-display text-4xl uppercase leading-none tracking-tight text-bone drop-shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
                        {c.name}
                      </div>
                    </div>
                    {c.logo ? (
                      <img
                        src={c.logo}
                        alt=""
                        className="absolute right-3 top-3 h-16 w-16 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      <span>{c.region || "—"}</span>
                      <div className="flex items-center gap-2">
                        {c.scheduledMonth ? (
                          <span className="text-gold">
                            📅 {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][c.scheduledMonth - 1]}
                          </span>
                        ) : null}
                        <span>{c.season || ""}</span>
                      </div>
                    </div>
                    <div className="mt-3 flex -space-x-1">
                      {c.teams.slice(0, 8).map((t) => (
                        <div key={t.id} className="ring-2 ring-card">
                          <TeamLogo team={t} size={26} />
                        </div>
                      ))}
                      {c.teams.length > 8 ? (
                        <div className="flex h-[26px] w-[26px] items-center justify-center bg-black text-[10px] font-bold text-gold ring-2 ring-card">
                          +{c.teams.length - 8}
                        </div>
                      ) : null}
                      {c.teams.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem times</span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.phases.map((p) => (
                        <span
                          key={p.id}
                          className="border border-gold/40 bg-black/40 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-gold"
                        >
                          {p.name}
                        </span>
                      ))}
                      {editions.length > 1 ? (
                        <span className="border border-blood/50 bg-blood/10 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-blood">
                          {editions.length} edições
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
                {editions.length > 1 ? (
                  <div className="border-x border-b border-gold/20 bg-black/30 px-4 py-3">
                    <div className="mb-2 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                      Edições arquivadas — confrontos preservados
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editions.slice(1).map((edition) => (
                        <Link
                          key={edition.id}
                          to="/championship/$id"
                          params={{ id: edition.id }}
                          className="border border-border bg-card px-2.5 py-1 font-display text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-gold hover:text-gold"
                        >
                          Arquivo · {edition.season || "Edição anterior"}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    const ok = await confirm({
                      title:
                        editions.length > 1
                          ? `Excluir "${c.name}" e suas ${editions.length} edições?`
                          : `Excluir "${c.name}"?`,
                      message:
                        "O campeonato, os resultados e o histórico de campeões dessa edição serão removidos. O ranking de carreira permanece.",
                      confirmLabel: "Excluir",
                    });
                    if (ok) editions.forEach((edition) => removeChampionship(edition.id));
                  }}
                  className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center border border-ink bg-ink/80 text-muted-foreground backdrop-blur transition-opacity hover:text-blood ${
                    resetMode ? "hidden" : "opacity-0 group-hover:opacity-100"
                  }`}
                  aria-label="Excluir campeonato"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {resetMode ? (
          <div className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-blood bg-ink/95 px-6 py-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
              <div className="font-display text-sm uppercase tracking-[0.2em] text-bone">
                <span className="text-blood">{selected.length}</span> liga(s) marcada(s) —{" "}
                <span className="text-muted-foreground">clique nos campeonatos para marcar</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelected(championshipGroups.map((g) => g.current.id))}
                  className="rounded-full border border-gold/40 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold/10"
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="rounded-full border border-gold/40 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold/10"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={confirmReset}
                  className="flex items-center gap-2 rounded-full border-2 border-blood bg-blood px-5 py-2 font-display text-sm uppercase tracking-[0.2em] text-white transition-colors hover:bg-blood/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetar {selected.length > 0 ? `${selected.length} liga(s)` : ""}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {superBackupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setSuperBackupOpen(false)}
        >
          <div
            className="w-full max-w-lg border-2 border-gold bg-ink p-6 shadow-[8px_8px_0_0_var(--gold)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold/30 pb-3">
              <div className="flex items-center gap-2.5">
                <Database className="h-5 w-5 text-gold" />
                <h3 className="font-display text-2xl uppercase tracking-wider text-gold">
                  Super Backup Global (.JSON)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSuperBackupOpen(false)}
                className="p-1 text-muted-foreground hover:text-bone"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Salve ou restaure <strong>100% do seu progresso</strong> em um único arquivo{" "}
              <code className="text-gold">.json</code>: todos os Campeonatos (LoL e CS2), elencos,
              histórico de splits, <strong>Hall da Fama</strong> permanente e o seu save do{" "}
              <strong>Modo Carreira Manager</strong>.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleExportSuperBackup}
                className="flex flex-col items-center justify-center gap-2 border-2 border-gold bg-gold p-4 font-display text-sm uppercase tracking-widest text-ink transition-transform hover:scale-[1.01]"
              >
                <Download className="h-6 w-6" />
                <span>Baixar Super Backup</span>
                <span className="font-sans text-[10px] font-normal normal-case text-ink/80">
                  Exporta {championships.length} campeonatos + Hall da Fama + Manager
                </span>
              </button>

              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 border-2 border-gold/50 bg-black/60 p-4 font-display text-sm uppercase tracking-widest text-gold transition-colors hover:bg-gold/15"
              >
                <Upload className="h-6 w-6" />
                <span>Restaurar de Arquivo</span>
                <span className="font-sans text-[10px] font-normal normal-case text-muted-foreground">
                  Importa um arquivo .json salvo anteriormente
                </span>
              </button>
            </div>

            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportSuperBackup(file);
              }}
            />
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-border/60 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Simulador não oficial · LoL é marca da Riot Games · CS2 é marca da Valve
      </footer>
    </div>
  );
}
