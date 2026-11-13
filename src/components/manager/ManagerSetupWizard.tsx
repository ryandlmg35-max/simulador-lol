import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  Crown,
  Globe,
  Search,
  Shield,
  Sparkles,
  UserCheck,
  Wallet,
} from "lucide-react";
import {
  ALL_LEAGUES,
  LEAGUE_META,
  MANAGER_STYLES,
  formatMoneyK,
  getRealTeamsCatalog,
  type LeagueId,
  type ManagerStyle,
  type NewCareerConfig,
} from "@/lib/lol/manager-career";

const COUNTRIES = ["BR", "KR", "CN", "US", "DE", "FR", "ES", "DK", "TW", "VN", "JP", "CA", "AR"];
const COLORS = [
  "#e11d48",
  "#d97706",
  "#2563eb",
  "#16a34a",
  "#9333ea",
  "#0891b2",
  "#dc2626",
  "#ca8a04",
];

export function ManagerSetupWizard({
  onStartCareer,
}: {
  onStartCareer: (config: NewCareerConfig) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  // Passo 1: Personagem Manager
  const [managerName, setManagerName] = useState("Ryan");
  const [managerCountry, setManagerCountry] = useState("BR");
  const [managerAge, setManagerAge] = useState(27);
  const [managerStyle, setManagerStyle] = useState<ManagerStyle>("tactical");

  // Passo 2: Time Real ou Clube Próprio
  const [clubMode, setClubMode] = useState<"existing" | "custom">("existing");
  const [leagueFilter, setLeagueFilter] = useState<LeagueId | "ALL">("CBLOL");
  const [search, setSearch] = useState("");
  const realCatalog = useMemo(() => getRealTeamsCatalog(), []);
  const [selectedReal, setSelectedReal] = useState<{ name: string; league: LeagueId }>(() => {
    const first = realCatalog.find((t) => t.league === "CBLOL") ?? realCatalog[0];
    return { name: first?.name ?? "paiN Gaming", league: first?.league ?? "CBLOL" };
  });

  // Custom team fields
  const [customTeamName, setCustomTeamName] = useState("Imperial Kings");
  const [customTeamTag, setCustomTeamTag] = useState("IMP");
  const [customTeamColor, setCustomTeamColor] = useState("#d97706");
  const [customLeague, setCustomLeague] = useState<LeagueId>("CBLOL");

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return realCatalog
      .filter((t) => (leagueFilter === "ALL" ? true : t.league === leagueFilter))
      .filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.tag.toLowerCase().includes(q) ||
          t.players.some((p) => p.ign.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.ovr - a.ovr);
  }, [realCatalog, leagueFilter, search]);

  const activePreviewTeam = useMemo(
    () =>
      realCatalog.find(
        (t) => t.name === selectedReal.name && t.league === selectedReal.league,
      ) ?? realCatalog[0],
    [realCatalog, selectedReal],
  );

  const chosenLeague = clubMode === "existing" ? selectedReal.league : customLeague;
  const baseCash = LEAGUE_META[chosenLeague].baseCashK;
  const startingCash =
    managerStyle === "tycoon" ? Math.round(baseCash * 1.35) : baseCash;

  const handleLaunch = () => {
    onStartCareer({
      managerName: managerName.trim() || "Manager",
      managerCountry,
      managerAge: Math.max(18, Math.min(80, managerAge)),
      managerStyle,
      mode: clubMode,
      existingTeamName: selectedReal.name,
      existingLeague: selectedReal.league,
      customTeamName: customTeamName.trim() || "Nova Organização",
      customTeamTag: customTeamTag.trim().toUpperCase().slice(0, 4) || "ORG",
      customTeamColor,
      customLeague,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.09),transparent_60%)] pb-16">
      <header className="sticky top-0 z-30 border-b border-gold/25 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="notch-tl flex h-10 w-10 items-center justify-center bg-gold text-ink">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl uppercase tracking-[0.15em] text-bone">
                Modo Carreira Manager
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gold">
                Save 100% Isolado · Gestão Executiva de Clube
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 border border-gold/40 bg-black/60 px-4 py-2 font-display text-xs uppercase tracking-[0.2em] text-gold transition-colors hover:bg-gold/10"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Simulador Normal
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-6xl px-6">
        {/* Stepper */}
        <div className="mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 border px-4 py-2.5 font-display text-sm uppercase tracking-widest transition-all ${
              step === 1
                ? "border-gold bg-gold text-ink shadow-[0_6px_20px_-8px_var(--gold)]"
                : "border-gold/30 bg-card/60 text-gold hover:border-gold/60"
            }`}
          >
            <UserCheck className="h-4 w-4" /> 1. Seu Personagem
          </button>
          <div className="h-px flex-1 bg-gold/20" />
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 border px-4 py-2.5 font-display text-sm uppercase tracking-widest transition-all ${
              step === 2
                ? "border-gold bg-gold text-ink shadow-[0_6px_20px_-8px_var(--gold)]"
                : "border-gold/30 bg-card/60 text-gold hover:border-gold/60"
            }`}
          >
            <Building2 className="h-4 w-4" /> 2. Escolher ou Criar Clube
          </button>
        </div>

        {step === 1 ? (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 border-2 border-gold/30 bg-card/85 p-6 lg:col-span-7">
              <div>
                <h2 className="font-display text-2xl uppercase tracking-wider text-gold">
                  Perfil do Manager / Dono
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Seu perfil define sua reputação inicial e bônus de gestão dentro do clube.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                    Nome do Manager
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="Ex: Ryan Silva"
                    className="w-full border border-gold/35 bg-black/60 px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                    Idade
                  </label>
                  <input
                    type="number"
                    min={18}
                    max={80}
                    value={managerAge}
                    onChange={(e) => setManagerAge(Number(e.target.value))}
                    className="w-full border border-gold/35 bg-black/60 px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                  Nacionalidade
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTRIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setManagerCountry(c)}
                      className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                        managerCountry === c
                          ? "border-gold bg-gold text-ink"
                          : "border-border bg-black/50 text-muted-foreground hover:border-gold/50 hover:text-bone"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                  Estilo de Gestão (Especialização)
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(MANAGER_STYLES) as ManagerStyle[]).map((key) => {
                    const st = MANAGER_STYLES[key];
                    const active = managerStyle === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setManagerStyle(key)}
                        className={`flex flex-col items-start border p-4 text-left transition-all ${
                          active
                            ? "border-gold bg-gold/15 shadow-[0_0_0_1px_var(--gold)]"
                            : "border-border bg-black/45 hover:border-gold/40"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="font-display text-base uppercase tracking-wider text-bone">
                            {st.label}
                          </span>
                          {active && <Check className="h-4 w-4 text-gold" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{st.subtitle}</p>
                        <span className="mt-2 inline-block border border-gold/30 bg-black/50 px-2 py-0.5 text-[10px] font-bold text-gold">
                          {st.perk}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 bg-gold px-6 py-3 font-display text-sm uppercase tracking-widest text-ink transition-transform hover:scale-[1.01]"
                >
                  Avançar para Escolha do Clube →
                </button>
              </div>
            </div>

            {/* Card resumo do Manager */}
            <div className="flex flex-col justify-between border-2 border-gold/25 bg-black/60 p-6 lg:col-span-5">
              <div>
                <div className="flex items-center gap-3 border-b border-gold/20 pb-4">
                  <div className="flex h-16 w-16 items-center justify-center border-2 border-gold bg-gold/15 font-display text-2xl text-gold">
                    {(managerName || "M").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">
                      Carteira de Manager Oficial
                    </span>
                    <h3 className="font-display text-2xl uppercase tracking-wider text-bone">
                      {managerName || "Sem Nome"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {managerCountry} · {managerAge} anos · {MANAGER_STYLES[managerStyle].label}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-xs">
                  <div className="flex items-start gap-2.5 border border-border/70 bg-card/50 p-3">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                    <div>
                      <strong className="block text-bone">Bônus do Perfil</strong>
                      <span className="text-muted-foreground">
                        {MANAGER_STYLES[managerStyle].perk}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 border border-border/70 bg-card/50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <div>
                      <strong className="block text-bone">Totalmente Independente</strong>
                      <span className="text-muted-foreground">
                        Suas ligas normais, elos do Hall da Fama e elencos do simulador tradicional
                        permanecem 100% intactos.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-gold/20 pt-4 text-[11px] text-muted-foreground">
                No próximo passo, você decide se quer assumir qualquer organização real do circuito
                mundial ou fundar a sua do zero.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Switch Existente vs Criar Time */}
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setClubMode("existing")}
                className={`flex items-center gap-4 border-2 p-5 text-left transition-all ${
                  clubMode === "existing"
                    ? "border-gold bg-gold/15"
                    : "border-border bg-card/70 hover:border-gold/40"
                }`}
              >
                <Globe className="h-8 w-8 shrink-0 text-gold" />
                <div>
                  <h3 className="font-display text-xl uppercase tracking-wider text-bone">
                    Assumir Time Real do Mundo
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Torne-se dono de T1, Gen.G, paiN, LOUD, G2, BLG, C9 ou qualquer time real.
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setClubMode("custom")}
                className={`flex items-center gap-4 border-2 p-5 text-left transition-all ${
                  clubMode === "custom"
                    ? "border-gold bg-gold/15"
                    : "border-border bg-card/70 hover:border-gold/40"
                }`}
              >
                <Crown className="h-8 w-8 shrink-0 text-gold" />
                <div>
                  <h3 className="font-display text-xl uppercase tracking-wider text-bone">
                    Criar Minha Organização
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Escolha nome, sigla, cor e liga para construir uma dinastia do zero.
                  </p>
                </div>
              </button>
            </div>

            {clubMode === "existing" ? (
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-4 border-2 border-gold/30 bg-card/85 p-5 lg:col-span-7">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLeagueFilter("ALL")}
                      className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                        leagueFilter === "ALL"
                          ? "border-gold bg-gold text-ink"
                          : "border-border bg-black/50 text-muted-foreground"
                      }`}
                    >
                      Todas
                    </button>
                    {ALL_LEAGUES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLeagueFilter(l)}
                        className={`border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                          leagueFilter === l
                            ? "border-gold bg-gold text-ink"
                            : "border-border bg-black/50 text-muted-foreground hover:text-bone"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar time ou jogador (ex: T1, paiN, Faker, Tinowns)..."
                      className="w-full border border-gold/30 bg-black/60 py-2 pl-9 pr-3 text-sm text-bone outline-none focus:border-gold"
                    />
                  </div>

                  <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {filteredTeams.map((t) => {
                      const active =
                        selectedReal.name === t.name && selectedReal.league === t.league;
                      return (
                        <button
                          key={`${t.league}:${t.name}`}
                          type="button"
                          onClick={() =>
                            setSelectedReal({ name: t.name, league: t.league })
                          }
                          className={`flex items-center justify-between border p-3 text-left transition-all ${
                            active
                              ? "border-gold bg-gold/15"
                              : "border-border/70 bg-black/45 hover:border-gold/40"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {t.logo ? (
                              <img
                                src={t.logo}
                                alt={t.name}
                                className="h-9 w-9 shrink-0 rounded-sm object-contain"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-blood/40 font-display text-xs font-bold text-bone">
                                {t.tag}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-display text-sm uppercase tracking-wide text-bone">
                                {t.name}
                              </div>
                              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {t.league} · Elenco {t.players.length}p
                              </div>
                            </div>
                          </div>
                          <div className="ml-2 shrink-0 border border-gold/40 bg-black/70 px-2 py-0.5 text-xs font-bold text-gold">
                            {t.ovr} OVR
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview do time selecionado */}
                <div className="flex flex-col justify-between border-2 border-gold/30 bg-black/65 p-6 lg:col-span-5">
                  {activePreviewTeam ? (
                    <div>
                      <div className="flex items-center gap-4 border-b border-gold/20 pb-4">
                        {activePreviewTeam.logo ? (
                          <img
                            src={activePreviewTeam.logo}
                            alt={activePreviewTeam.name}
                            className="h-14 w-14 object-contain"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center bg-gold/20 font-display text-lg text-gold">
                            {activePreviewTeam.tag}
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                            {activePreviewTeam.league} · {LEAGUE_META[activePreviewTeam.league].fullName}
                          </span>
                          <h3 className="font-display text-2xl uppercase tracking-wider text-bone">
                            {activePreviewTeam.name}
                          </h3>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Força Elenco: <strong className="text-gold">{activePreviewTeam.ovr}</strong></span>
                            <span>Prestígio Liga: <strong className="text-bone">{LEAGUE_META[activePreviewTeam.league].prestige}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gold/80">
                          Elenco Atual (Titulares & Reservas)
                        </div>
                        <div className="space-y-1.5">
                          {activePreviewTeam.players.slice(0, 7).map((p, idx) => (
                            <div
                              key={`${p.ign}-${idx}`}
                              className="flex items-center justify-between border border-border/60 bg-card/50 px-3 py-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-[10px] font-bold uppercase text-gold">
                                  {p.role}
                                </span>
                                <span className="font-semibold text-bone">{p.ign}</span>
                                <span className="text-[10px] text-muted-foreground">({p.country})</span>
                                {p.sub && (
                                  <span className="border border-border px-1 text-[9px] uppercase text-muted-foreground">
                                    Sub
                                  </span>
                                )}
                              </div>
                              <span className="font-bold text-gold">{p.ovr}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5 text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-300">
                          <Wallet className="h-4 w-4" /> Caixa Inicial Definido
                        </span>
                        <strong className="font-display text-base text-emerald-300">
                          {formatMoneyK(startingCash)}
                        </strong>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="border border-border bg-black/50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-bone"
                    >
                      ← Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="flex-1 bg-gold px-6 py-3 font-display text-sm uppercase tracking-widest text-ink shadow-[0_8px_24px_-8px_var(--gold)] transition-transform hover:scale-[1.01]"
                    >
                      Iniciar Carreira na {selectedReal.league}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-12">
                <div className="space-y-5 border-2 border-gold/30 bg-card/85 p-6 lg:col-span-7">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                        Nome do Clube
                      </label>
                      <input
                        type="text"
                        value={customTeamName}
                        onChange={(e) => setCustomTeamName(e.target.value)}
                        placeholder="Ex: Nova Ordem Gaming"
                        className="w-full border border-gold/35 bg-black/60 px-3 py-2.5 text-sm text-bone outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                        Tag (2-4 letras)
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={customTeamTag}
                        onChange={(e) => setCustomTeamTag(e.target.value.toUpperCase())}
                        className="w-full border border-gold/35 bg-black/60 px-3 py-2.5 text-sm uppercase text-bone outline-none focus:border-gold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                      Cor Principal da Organização
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCustomTeamColor(c)}
                          className={`h-8 w-8 rounded-sm border-2 transition-transform ${
                            customTeamColor === c ? "scale-110 border-white" : "border-transparent"
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gold/80">
                      Liga de Estreia
                    </label>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {ALL_LEAGUES.map((l) => {
                        const meta = LEAGUE_META[l];
                        const active = customLeague === l;
                        return (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setCustomLeague(l)}
                            className={`border p-3 text-left transition-all ${
                              active
                                ? "border-gold bg-gold/15"
                                : "border-border bg-black/50 hover:border-gold/40"
                            }`}
                          >
                            <div className="font-display text-base uppercase tracking-wider text-bone">
                              {l}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Prestígio {meta.prestige} · Caixa {formatMoneyK(meta.baseCashK)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-between border-2 border-gold/30 bg-black/65 p-6 lg:col-span-5">
                  <div>
                    <div className="flex items-center gap-4 border-b border-gold/20 pb-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-sm font-display text-xl font-bold text-bone shadow-lg"
                        style={{ background: customTeamColor }}
                      >
                        {(customTeamTag || "ORG").slice(0, 4)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">
                          Clube Fundado · {customLeague}
                        </span>
                        <h3 className="font-display text-2xl uppercase tracking-wider text-bone">
                          {customTeamName || "Nova Organização"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Manager: {managerName} ({MANAGER_STYLES[managerStyle].label})
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-xs">
                      <div className="flex items-center justify-between border border-emerald-500/30 bg-emerald-950/20 px-3 py-2.5">
                        <span className="text-emerald-300">Caixa Inicial do Clube</span>
                        <strong className="font-display text-base text-emerald-300">
                          {formatMoneyK(startingCash)}
                        </strong>
                      </div>
                      <p className="leading-relaxed text-muted-foreground">
                        Seu clube estreará com um elenco inicial de 5 jogadores jovens da região e
                        poderá usar o caixa imediatamente para contratar estrelas globais ou equipe
                        técnica de ponta.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="border border-border bg-black/50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-bone"
                    >
                      ← Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleLaunch}
                      className="flex-1 bg-gold px-6 py-3 font-display text-sm uppercase tracking-widest text-ink shadow-[0_8px_24px_-8px_var(--gold)] transition-transform hover:scale-[1.01]"
                    >
                      Fundar Clube na {customLeague}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
