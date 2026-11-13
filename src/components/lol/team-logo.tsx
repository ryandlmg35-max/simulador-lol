import { useState, useEffect, memo } from "react";
import type { Team } from "@/lib/lol/types";
import { getOfficialLogo } from "@/lib/lol/official-logos";

export const TeamLogo = memo(function TeamLogo({ team, size = 32 }: { team?: Team | null; size?: number }) {
  const [hasError, setHasError] = useState(false);
  const logoUrl = team ? team.logo || getOfficialLogo(team.name, team.tag) : undefined;

  // Hooks must run in the same order on every render. This effect used to sit
  // after the `!team` early return, so a slot going from TBD to a filled team
  // (e.g. advancing a playoff bracket) called one more hook than the previous
  // render and crashed the whole page.
  useEffect(() => {
    setHasError(false);
  }, [logoUrl, team?.name]);

  if (!team) {
    return (
      <div
        className="flex items-center justify-center rounded-sm border border-dashed border-border/60 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt={team.name}
        width={size}
        height={size}
        onError={() => setHasError(true)}
        className="rounded-sm object-contain"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }

  const bg = team.color ?? "var(--blood)";
  const tagText = (team.tag || team.name || "???").slice(0, 3).toUpperCase();

  return (
    <div
      className="flex items-center justify-center rounded-sm font-display font-bold text-bone shadow-inner ring-1 ring-black/40"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.max(10, size * 0.42),
        letterSpacing: "0.02em",
      }}
    >
      {tagText}
    </div>
  );
});
