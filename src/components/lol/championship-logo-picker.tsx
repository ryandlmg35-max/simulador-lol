import { useRef } from "react";
import { ImagePlus, X, Check } from "lucide-react";
import { LEAGUE_LOGO_PRESETS, type LeagueLogoPreset } from "@/lib/lol/official-logos";
import { fileToLogo } from "@/lib/lol/image";

interface ChampionshipLogoPickerProps {
  value?: string;
  onChange: (url?: string) => void;
  onSelectPreset?: (preset: LeagueLogoPreset) => void;
  game?: string;
}

export function ChampionshipLogoPicker({
  value,
  onChange,
  onSelectPreset,
}: ChampionshipLogoPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (preset: LeagueLogoPreset) => {
    onChange(preset.logo);
    onSelectPreset?.(preset);
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="mb-1 block font-display text-xs uppercase tracking-widest text-gold">
          Logo Oficial da Liga / Torneio
        </span>
        <p className="text-xs text-muted-foreground">
          Escolha uma liga oficial para estampar seu campeonato ou envie sua própria imagem abaixo.
        </p>
      </div>

      {/* Grid de Presets das Ligas Oficiais */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEAGUE_LOGO_PRESETS.map((preset) => {
          const isSelected = value === preset.logo;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelect(preset)}
              className={`flex items-center gap-2.5 border-2 p-2 text-left transition-all ${
                isSelected
                  ? "border-gold bg-gold/20 shadow-[0_0_12px_rgba(200,170,110,0.3)] ring-1 ring-gold"
                  : "border-border bg-black/40 hover:border-gold/50 hover:bg-black/60"
              }`}
            >
              <img
                src={preset.logo}
                alt={preset.name}
                className="h-8 w-8 shrink-0 object-contain drop-shadow"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-sm font-bold uppercase tracking-wider text-bone">
                  {preset.name}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {preset.defaultRegion}
                </div>
              </div>
              {isSelected ? (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-ink">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Preview e Upload customizado */}
      <div className="flex flex-wrap items-center gap-4 rounded-sm border border-border/80 bg-input p-3">
        {value ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-gold/40 bg-black/60 p-1">
              <img src={value} alt="Logo selecionada" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="font-display text-xs font-semibold uppercase tracking-wider text-gold">
                Logo selecionada
              </span>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="mt-0.5 flex items-center gap-1 text-xs text-blood hover:underline"
              >
                <X className="h-3 w-3" /> Remover logo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-border bg-black/40">
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            </div>
            <span>Nenhuma logo selecionada. Clique em uma liga acima ou envie uma imagem.</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const dataUrl = await fileToLogo(file);
                onChange(dataUrl);
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border border-border bg-black/40 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-bone hover:border-gold hover:text-gold"
          >
            {value ? "Trocar por arquivo do PC" : "Enviar imagem do PC"}
          </button>
        </div>
      </div>
    </div>
  );
}
