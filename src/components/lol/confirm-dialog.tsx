import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` = ação destrutiva (vermelho), `gold` = ação normal (dourado). */
  tone?: "danger" | "gold";
}

/**
 * Diálogo de confirmação no MESMO estilo do modal de reset do Hall da Fama
 * (ranking.tsx) — substitui o `confirm()` nativo do navegador, que trava a
 * thread, não é estilizável e some no screenshot.
 */
export function ConfirmDialog({
  request,
  onCancel,
  onConfirm,
}: {
  request: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onCancel]);

  if (!request) return null;
  const danger = (request.tone ?? "danger") === "danger";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={request.title}
        className={`w-full max-w-md border-2 bg-ink p-6 ${
          danger
            ? "border-blood shadow-[8px_8px_0_0_var(--blood)]"
            : "border-gold shadow-[8px_8px_0_0_var(--gold)]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div
            className={`flex items-center gap-2.5 font-display text-lg uppercase tracking-wider ${
              danger ? "text-blood" : "text-gold"
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
            {request.title}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-bone"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{request.message}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border bg-black/40 px-4 py-2 font-display text-xs uppercase tracking-widest text-bone hover:bg-black/60"
          >
            {request.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`border-2 px-4 py-2 font-display text-xs uppercase tracking-widest text-white shadow-md ${
              danger
                ? "border-blood bg-blood hover:bg-blood/90"
                : "border-gold bg-gold text-ink hover:bg-gold/80"
            }`}
          >
            {request.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
