import { useState } from "react";
import { getPlayerPhoto } from "@/lib/lol/player-photos";
import type { PlayerRole } from "@/lib/lol/types";

const ROLE_COLORS: Record<PlayerRole, string> = {
  top: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  jungle: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  mid: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  adc: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  support: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

export function PlayerAvatar({
  ign,
  role,
  size = "md",
  highlight = false,
  className = "",
}: {
  ign: string;
  role?: PlayerRole;
  size?: "xs" | "sm" | "md" | "lg";
  highlight?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const photoUrl = getPlayerPhoto(ign);

  const dims =
    size === "xs"
      ? "h-7 w-7 text-[10px]"
      : size === "sm"
        ? "h-10 w-10 text-xs"
        : size === "lg"
          ? "h-16 w-16 text-base"
          : "h-12 w-12 text-sm";

  const initials = ign.trim().slice(0, 2).toUpperCase();
  const roleCls = role ? ROLE_COLORS[role] : "border-border bg-black/50 text-gold";
  const borderCls = highlight
    ? "border-2 border-gold shadow-[0_0_12px_rgba(212,175,55,0.35)]"
    : "border border-border/80";

  if (!photoUrl || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg font-display font-bold uppercase tracking-wider ${dims} ${borderCls} ${roleCls} ${className}`}
        title={ign}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-black/60 ${dims} ${borderCls} ${className}`}
      title={ign}
    >
      <img
        src={photoUrl}
        alt={ign}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}
