import { useState } from "react";
import { Plus, Trash2, X, Swords, UserPlus } from "lucide-react";
import type { Player, PlayerRole, Team } from "@/lib/lol/types";
import {
  ageForIgn,
  clampAttr,
  getResolvedAttrs,
  makeCustomPlayer,
  pickStarters,
  playerOverall,
  rosterStrength,
} from "@/lib/lol/players";

const ROLE_LABEL: Record<PlayerRole, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "ADC",
  support: "Suporte",
};

const ROLE_SHORT: Record<PlayerRole, string> = {
  top: "T",
  jungle: "J",
  mid: "M",
  adc: "A",
  support: "S",
};

const ROLE_COLOR: Record<PlayerRole, string> = {
  top: "border-red-500/60 text-red-400",
  jungle: "border-green-500/60 text-green-400",
  mid: "border-purple-500/60 text-purple-400",
  adc: "border-yellow-500/60 text-yellow-400",
  support: "border-sky-500/60 text-sky-400",
};

const ROLES: PlayerRole[] = ["top", "jungle", "mid", "adc", "support"];

const inputCls =
  "border-2 border-border bg-input px-2 py-1.5 font-condensed text-sm uppercase tracking-wide text-foreground outline-none focus:border-gold";

function attrBar(label: string, value: number, color: string) {
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${value}`}>
      <span className="w-8 text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 bg-black/60">
        <div className={`h-full ${color}`} style={{ width: `${clampAttr(value)}%` }} />
      </div>
      <span className="w-6 text-right text-[10px] tabular-nums text-muted-foreground">{value}</span>
    </div>
  );
}

/**
 * Editor de elenco do time: NOME + NOTA por jogador. A nota é a métrica
 * única que o usuário mexe (vira mecânica; IQ/clutch acompanham mantendo a
 * personalidade do jogador) e entra direto na força do time — trocar um
 * jogador de nota 60 por um de 95 muda a win probability do próximo jogo na
 * hora. Mudar a COMPOSIÇÃO (entrar/sair) zera a sinergia do grupo.
 */
export function RosterEditor({
  team,
  onPatch,
  onClose,
}: {
  team: Team;
  onPatch: (patch: Partial<Team>) => void;
  onClose: () => void;
}) {
  const roster = team.roster ?? [];
  const starters = pickStarters(roster);
  const strength = rosterStrength(roster);

  const [newIgn, setNewIgn] = useState("");
  const [newRole, setNewRole] = useState<PlayerRole>("mid");
  const [newOverall, setNewOverall] = useState(70);

  const updatePlayer = (id: string, patch: Partial<Player>) =>
    onPatch({ roster: roster.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  /** Nota única (0–100): move tudo junto, preservando as características do jogador. */
  const setOverall = (p: Player, raw: number) => {
    const n = Math.round(clampAttr(raw, 1, 99));
    const cur = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
    const diff = n - p.attrs.mechanics;
    const offset = (v: number) => Math.round(clampAttr(v + diff, 1, 99));
    updatePlayer(p.id, {
      attrs: {
        mechanics: n,
        gameIq: offset(cur.gameIq),
        clutch: offset(cur.clutch),
        consistency: offset(cur.consistency),
        aggression: offset(cur.aggression),
        adaptability: offset(cur.adaptability),
        intlExperience: offset(cur.intlExperience),
        mentality: offset(cur.mentality),
      },
    });
  };

  const addPlayer = () => {
    const ign = newIgn.trim();
    if (!ign) return;
    const player = makeCustomPlayer({ ign, role: newRole, overall: newOverall });
    // Composição nova: a química do grupo recomeça do zero.
    onPatch({ roster: [...roster, player], synergy: 0 });
    setNewIgn("");
  };

  const removePlayer = (id: string) => {
    onPatch({ roster: roster.filter((p) => p.id !== id), synergy: 0 });
  };

  const changeRole = (p: Player, role: PlayerRole) => {
    updatePlayer(p.id, { role });
    onPatch({ synergy: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl border-2 border-gold bg-ink p-5 shadow-[6px_6px_0_0_var(--gold)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-display text-xl uppercase tracking-widest text-gold">
            <Swords className="h-5 w-5" /> Elenco — {team.name || "sem nome"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-border p-1 text-muted-foreground hover:border-blood hover:text-blood"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------- FORÇA DO ELENCO ---------- */}
        <div className="mb-4 border-2 border-gold/40 bg-gold/5 p-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold">
                Força do elenco
              </div>
              <div className="font-display text-4xl leading-none text-bone tabular-nums">
                {strength != null ? Math.round(strength) : "—"}
              </div>
            </div>
            <div className="text-right text-[10px] uppercase tracking-widest text-muted-foreground">
              <div>{starters.length} titular(is) · sinergia {team.synergy ?? 0}</div>
              <div>cultura {team.culture ?? 50}</div>
              <div className="text-gold">
                nota alta = time forte na hora, sem esperar resultado
              </div>
            </div>
          </div>
          <div className="mt-2 h-2 bg-black/60">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${clampAttr(strength ?? 0)}%` }}
            />
          </div>
        </div>

        {/* ---------- LISTA DE JOGADORES ---------- */}
        <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
          {roster.length === 0 ? (
            <p className="border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Sem elenco. Adicione jogadores abaixo — ou importe times do Banco Global, que já
              vêm com o elenco real de 2026.
            </p>
          ) : null}

          {roster.map((p) => {
            const overall = Math.round(playerOverall(p));
            const isStarter = starters.some((s) => s.id === p.id);
            return (
              <div
                key={p.id}
                className={`border bg-black/30 p-2.5 ${isStarter ? "border-gold/50" : "border-border"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`w-10 shrink-0 border text-center font-display text-[11px] uppercase ${ROLE_COLOR[p.role]}`}
                    title={ROLE_LABEL[p.role]}
                  >
                    {ROLE_SHORT[p.role]}
                  </span>
                  <input
                    className={`${inputCls} w-32`}
                    value={p.ign}
                    maxLength={24}
                    onChange={(e) => updatePlayer(p.id, { ign: e.target.value })}
                  />
                  <select
                    className={`${inputCls} w-24`}
                    value={p.role}
                    onChange={(e) => changeRole(p, e.target.value as PlayerRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-ink text-bone">
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    idade
                    <input
                      type="number"
                      min={16}
                      max={40}
                      value={p.age ?? ageForIgn(p.ign)}
                      onChange={(e) =>
                        updatePlayer(p.id, { age: Number(e.target.value) || 16 })
                      }
                      className={`${inputCls} w-14 text-center`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => updatePlayer(p.id, { sub: !p.sub })}
                    className={`ml-auto border px-1.5 py-1 text-[9px] font-bold uppercase tracking-widest ${
                      p.sub
                        ? "border-border text-muted-foreground hover:text-bone"
                        : "border-gold/60 bg-gold/10 text-gold"
                    }`}
                    title="Sub não conta na força enquanto houver titular na função"
                  >
                    {p.sub ? "sub" : "titular"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removePlayer(p.id)}
                    className="text-blood hover:opacity-80"
                    aria-label={`Remover ${p.ign}`}
                    title="Remover do elenco"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* NOTA + atributos */}
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-gold">nota</span>
                    <input
                      type="range"
                      min={1}
                      max={99}
                      value={p.attrs.mechanics}
                      onChange={(e) => setOverall(p, Number(e.target.value))}
                      className="w-40 accent-[var(--gold)]"
                      aria-label={`Nota de ${p.ign}`}
                    />
                    <span className="w-7 text-center font-display text-lg leading-none text-gold tabular-nums">
                      {overall}
                    </span>
                  </div>
                  {(() => {
                    const res = getResolvedAttrs(p.attrs, p.ign, p.role, p.country, p.age);
                    return (
                      <div className="ml-auto hidden grid-cols-2 gap-x-3 gap-y-1 sm:grid sm:w-80">
                        <div>
                          {attrBar("mec", res.mechanics, "bg-red-400/80")}
                          {attrBar("iq", res.gameIq, "bg-sky-400/80")}
                          {attrBar("clu", res.clutch, "bg-amber-400/80")}
                        </div>
                        <div>
                          {attrBar("men", res.mentality, "bg-purple-400/80")}
                          {attrBar("int", res.intlExperience, "bg-emerald-400/80")}
                          {attrBar("con", res.consistency, "bg-teal-400/80")}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- ADICIONAR JOGADOR ---------- */}
        <div className="mt-4 border-2 border-gold/40 bg-black/40 p-3">
          <div className="mb-2 flex items-center gap-2 font-display text-sm uppercase tracking-widest text-gold">
            <UserPlus className="h-4 w-4" /> Adicionar jogador
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={`${inputCls} w-40`}
              placeholder="Nome (ex: Faker)"
              value={newIgn}
              maxLength={24}
              onChange={(e) => setNewIgn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addPlayer();
              }}
            />
            <select
              className={`${inputCls} w-28`}
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as PlayerRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="bg-ink text-bone">
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <div className="flex flex-1 items-center gap-2">
              <input
                type="range"
                min={1}
                max={99}
                value={newOverall}
                onChange={(e) => setNewOverall(Number(e.target.value))}
                className="min-w-32 flex-1 accent-[var(--gold)]"
                aria-label="Nota do novo jogador"
              />
              <span className="w-8 text-center font-display text-xl leading-none text-gold tabular-nums">
                {newOverall}
              </span>
            </div>
            <button
              type="button"
              onClick={addPlayer}
              disabled={!newIgn.trim()}
              className="flex items-center gap-1 border-2 border-gold bg-gold px-3 py-2 font-display text-xs uppercase tracking-widest text-ink hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Colocar no time
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            A nota vira a força do jogador e pesa direto na win probability: cinco titulares de
            nota 95 derrubam qualquer favorito; um suporte de nota 40 abre brecha na linha inteira.
          </p>
        </div>
      </div>
    </div>
  );
}
