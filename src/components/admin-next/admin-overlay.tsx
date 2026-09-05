"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { PanelLocale } from "@/lib/panel-i18n";

type DismissReason = "browser_back" | "close_button" | "escape" | "outside" | "programmatic";

const OverlayDepthContext = createContext(0);

export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function AdminOverlay({
  children,
  description,
  dirty = false,
  footer,
  locale = "lt",
  onBlockedDismiss,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  dirty?: boolean;
  footer?: React.ReactNode;
  locale?: PanelLocale;
  onBlockedDismiss?: (reason: DismissReason) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const copy = {
    nb: { close: "Lukk", unsaved: "Det finnes ulagrede endringer. Lagre eller forkast utkastet uttrykkelig." },
    lt: { close: "Uždaryti", unsaved: "Yra neišsaugotų pakeitimų. Išsaugokite arba aiškiai atšaukite juodraštį." },
    en: { close: "Close", unsaved: "There are unsaved changes. Save or explicitly discard the draft." },
  }[locale];
  const depth = useContext(OverlayDepthContext);
  const descriptionId = useId();
  const historyMarkerId = useId();
  const historyMarkerActive = useRef(false);
  const dirtyRef = useRef(dirty);
  const onBlockedDismissRef = useRef(onBlockedDismiss);
  const onOpenChangeRef = useRef(onOpenChange);
  const [dismissNotice, setDismissNotice] = useState(false);
  useUnsavedChangesGuard(open && dirty);

  useEffect(() => {
    dirtyRef.current = dirty;
    onBlockedDismissRef.current = onBlockedDismiss;
    onOpenChangeRef.current = onOpenChange;
  }, [dirty, onBlockedDismiss, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ ...(window.history.state || {}), adminOverlay: historyMarkerId }, "", window.location.href);
    historyMarkerActive.current = true;
    const onPopState = (event: PopStateEvent) => {
      if (event.state?.adminOverlay === historyMarkerId) {
        historyMarkerActive.current = true;
        return;
      }
      historyMarkerActive.current = false;
      if (dirtyRef.current) {
        setDismissNotice(true);
        onBlockedDismissRef.current?.("browser_back");
        window.history.forward();
        return;
      }
      onOpenChangeRef.current(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [historyMarkerId, open]);

  const requestClose = (reason: DismissReason) => {
    if (dirty) {
      setDismissNotice(true);
      onBlockedDismiss?.(reason);
      return;
    }
    setDismissNotice(false);
    if (historyMarkerActive.current) {
      historyMarkerActive.current = false;
      window.history.back();
    }
    onOpenChange(false);
  };

  if (depth > 0 && open) {
    throw new Error("Nested AdminOverlay instances are not supported");
  }

  return (
    <Dialog.Root
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose("programmatic");
        else onOpenChange(true);
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          className="admin-next-theme fixed inset-x-3 top-1/2 z-[71] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--an-border-strong)] bg-[var(--an-surface-raised)] p-5 text-[var(--an-text-primary)] shadow-[var(--an-shadow)] sm:left-1/2 sm:right-auto sm:w-[min(42rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:p-6"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose("escape");
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
            requestClose("outside");
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm leading-6 text-[var(--an-text-muted)]" id={descriptionId}>
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <button
              aria-label={copy.close}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--an-border)] text-[var(--an-text-muted)] hover:bg-[var(--an-surface-soft)] hover:text-[var(--an-text-primary)]"
              onClick={() => requestClose("close_button")}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          {dismissNotice ? (
            <p className="mt-4 rounded-xl border border-[var(--an-danger)] bg-[var(--an-danger-soft)] p-3 text-sm text-[var(--an-danger)]" role="alert">
              {copy.unsaved}
            </p>
          ) : null}
          <OverlayDepthContext.Provider value={depth + 1}>
            <div className="mt-5">{children}</div>
          </OverlayDepthContext.Provider>
          {footer ? <div className="mt-6 border-t border-[var(--an-border)] pt-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
