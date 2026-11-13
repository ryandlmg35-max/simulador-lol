import { useCallback, useRef, useState } from "react";
import type { ConfirmOptions } from "./confirm-dialog";

export interface ConfirmDialogProps {
  request: ConfirmOptions | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Hook de confirmação — API baseada em Promise, então o call site vira
 * `if (await confirm({ ... })) { ... }` no lugar do `if (confirm("..."))`.
 *
 * O componente precisa renderizar o diálogo uma vez na árvore:
 * `<ConfirmDialog {...confirmDialog} />`
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setRequest(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  }, []);

  const onCancel = useCallback(() => settle(false), [settle]);
  const onConfirm = useCallback(() => settle(true), [settle]);

  const confirmDialog: ConfirmDialogProps = { request, onCancel, onConfirm };

  return { confirm, confirmDialog };
}
