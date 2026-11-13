import { useState } from "react";

const COUNTRY_NAMES_PT: Record<string, string> = {
  KR: "Coreia do Sul",
  CN: "China",
  BR: "Brasil",
  US: "Estados Unidos",
  CA: "Canadá",
  BE: "Bélgica",
  DK: "Dinamarca",
  DE: "Alemanha",
  FR: "França",
  ES: "Espanha",
  PL: "Polônia",
  SE: "Suécia",
  NL: "Holanda",
  GB: "Reino Unido",
  UK: "Reino Unido",
  CZ: "República Tcheca",
  SI: "Eslovênia",
  HR: "Croácia",
  RO: "Romênia",
  GR: "Grécia",
  TR: "Turquia",
  TW: "Taiwan",
  HK: "Hong Kong",
  VN: "Vietnã",
  JP: "Japão",
  AU: "Austrália",
  NZ: "Nova Zelândia",
  AR: "Argentina",
  CL: "Chile",
  PE: "Peru",
  MX: "México",
  CO: "Colômbia",
  EU: "Europa",
};

function normalizeIso(code: string): string {
  const up = code.trim().toUpperCase();
  if (up === "UK") return "gb";
  if (up === "USA") return "us";
  return up.toLowerCase();
}

export function CountryFlag({
  code,
  size = "sm",
  showCode = false,
}: {
  code?: string | null;
  size?: "xs" | "sm" | "md";
  showCode?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!code || !code.trim()) return null;

  const upper = code.trim().toUpperCase();
  const iso = normalizeIso(upper);
  const label = COUNTRY_NAMES_PT[upper] ?? upper;
  const dims =
    size === "xs"
      ? "h-3 w-4"
      : size === "md"
        ? "h-4 w-6"
        : "h-3.5 w-5";

  if (failed || iso.length !== 2) {
    return (
      <span
        title={label}
        className="inline-flex items-center rounded border border-border/70 bg-black/50 px-1 py-0.5 font-mono text-[9px] font-bold uppercase leading-none text-muted-foreground"
      >
        {upper}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <img
        src={`https://flagcdn.com/w40/${iso}.png`}
        alt={label}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${dims} shrink-0 rounded-[2px] border border-white/15 object-cover shadow-sm`}
      />
      {showCode ? (
        <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
          {upper}
        </span>
      ) : null}
    </span>
  );
}
