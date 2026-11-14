import { ensureRoster, getResolvedAttrs, playerOverall } from "@/lib/lol/players";
import type { Player, PlayerRole, Team } from "@/lib/lol/types";
import { CountryFlag } from "./country-flag";
import { PlayerAvatar } from "./player-avatar";

const ROLE_ORDER: Record<PlayerRole, number> = {
  top: 0,
  jungle: 1,
  mid: 2,
  adc: 3,
  support: 4,
};

const ROLE_LABEL: Record<PlayerRole, string> = {
  top: "TOP",
  jungle: "JG",
  mid: "MID",
  adc: "ADC",
  support: "SUP",
};

function PlayerRowCard({ player }: { player: Player }) {
  const attrs = getResolvedAttrs(
    player.attrs,
    player.ign,
    player.role,
    player.country,
    player.age,
  );
  const ovr = Math.round(playerOverall(player));

  return (
    <div
      className={`flex items-center justify-between gap-2.5 border px-2.5 py-2 ${
        player.sub
          ? "border-border/50 bg-black/30 opacity-90"
          : "border-gold/25 bg-black/50"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <PlayerAvatar
          ign={player.ign}
          role={player.role}
          size="sm"
          highlight={!player.sub}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="border border-border/70 bg-black/60 px-1 py-0.5 font-mono text-[9px] font-bold uppercase text-gold">
              {ROLE_LABEL[player.role]}
            </span>
            {player.sub ? (
              <span className="border border-border/60 bg-muted/30 px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                SUB
              </span>
            ) : null}
            <span className="truncate font-display text-sm uppercase tracking-wider text-bone">
              {player.ign}
            </span>
            <CountryFlag code={player.country} size="xs" showCode />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {player.real ? <span className="truncate">{player.real}</span> : null}
            {player.age ? (
              <span className="inline-flex items-center gap-1">
                · {player.age} anos
                {player.age >= 30 ? (
                  <span className="border border-amber-500/40 bg-amber-500/10 px-1 py-0.2 font-mono text-[8px] uppercase text-amber-300">
                    Reta final
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-display text-base leading-none text-gold">{ovr}</div>
        <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
          M{attrs.mechanics} Q{attrs.gameIq} C{attrs.clutch}
        </div>
      </div>
    </div>
  );
}

/**
 * Painel compacto e completo com todo o elenco do time (foto, IGN, nome real,
 * bandeira do país, rota, idade e atributos).
 */
export function TeamRosterInline({ team }: { team?: Team | null }) {
  if (!team) return null;
  const roster = ensureRoster(team) ?? [];
  const starters = roster
    .filter((p) => !p.sub)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const subs = roster
    .filter((p) => p.sub)
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  if (roster.length === 0) {
    return (
      <div className="border border-dashed border-border/60 bg-black/40 p-3 text-center text-xs text-muted-foreground">
        Nenhum jogador cadastrado neste elenco ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-ink/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/20 pb-2 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="font-display uppercase tracking-widest text-gold">
            Elenco Completo · {team.name}
          </span>
          {team.region ? (
            <span className="border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {team.region}
            </span>
          ) : null}
        </div>
        {team.coach ? (
          <span className="text-muted-foreground">
            Técnico: <strong className="text-bone">{team.coach}</strong>
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {starters.map((p) => (
          <PlayerRowCard key={p.id} player={p} />
        ))}
      </div>

      {subs.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            Reservas ({subs.length})
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subs.map((p) => (
              <PlayerRowCard key={p.id} player={p} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
