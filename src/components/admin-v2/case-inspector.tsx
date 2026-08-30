"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

export type CaseInspectorProps = {
  busyCloseMessage?: string;
  children: ReactNode;
  closeLabel?: string;
  description?: string;
  discardChangesMessage?: string;
  initialTargetId?: string;
  onClose: () => void;
  open: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
  title: string;
};

function serializeInspectorFormState(container: HTMLDivElement | null) {
  if (!container) return "";
  return JSON.stringify(
    Array.from(
      container.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input, select, textarea"),
    ).map((control, index) => ({
      checked:
        control instanceof HTMLInputElement ? control.checked : undefined,
      files:
        control instanceof HTMLInputElement && control.type === "file"
          ? Array.from(control.files || []).map(
              (file) => `${file.name}:${file.size}`,
            )
          : undefined,
      index,
      name: control.name,
      value: control.value,
    })),
  );
}

/**
 * Controlled case-workspace inspector.
 *
 * Radix Dialog supplies the modal focus trap, Escape handling, focus return,
 * background inertness and body scroll lock. The timeline owns the active
 * inspector key and renders this component once, without an internal trigger.
 */
export function CaseInspector({
  busyCloseMessage,
  children,
  closeLabel = "Close",
  description,
  discardChangesMessage,
  initialTargetId,
  onClose,
  open,
  returnFocusRef,
  title,
}: CaseInspectorProps) {
  const descriptionId = useId();
  const titleId = useId();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialFormStateRef = useRef("");

  function requestClose() {
    const container = scrollContainerRef.current;
    if (container?.querySelector('[aria-busy="true"]')) {
      if (busyCloseMessage) window.alert(busyCloseMessage);
      return;
    }
    if (
      discardChangesMessage &&
      initialFormStateRef.current !==
        serializeInspectorFormState(scrollContainerRef.current) &&
      !window.confirm(discardChangesMessage)
    ) {
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) {
      initialFormStateRef.current = "";
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      initialFormStateRef.current = serializeInspectorFormState(
        scrollContainerRef.current,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open || !initialTargetId) return;

    const frame = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const target = document.getElementById(initialTargetId);
      if (!container || !target || !container.contains(target)) return;

      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      container.scrollTop = Math.max(
        0,
        container.scrollTop + targetRect.top - containerRect.top - 8,
      );

      const heading = target.matches("h1, h2, h3, h4, h5, h6, [role='heading']")
        ? target
        : target.querySelector<HTMLElement>(
            "h1, h2, h3, h4, h5, h6, [role='heading']",
          );
      const focusTarget = heading || target;
      if (!focusTarget.hasAttribute("tabindex")) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialTargetId, open]);

  return (
    <Dialog.Root
      modal
      onOpenChange={(nextOpen) => {
        if (!nextOpen) requestClose();
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-safe:transition-opacity" />
        <Dialog.Content
          aria-describedby={description ? descriptionId : undefined}
          aria-labelledby={titleId}
          aria-modal="true"
          className="bg-background-elevated text-foreground fixed inset-0 z-[130] flex h-[100dvh] w-screen flex-col overflow-hidden border-white/10 shadow-2xl shadow-black/60 outline-none data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 motion-safe:transition-transform sm:inset-y-3 sm:right-3 sm:left-auto sm:h-[calc(100dvh-1.5rem)] sm:w-[calc(100vw-1.5rem)] sm:max-w-none sm:rounded-3xl sm:border xl:inset-y-0 xl:right-0 xl:h-[100dvh] xl:w-[min(46vw,44rem)] xl:rounded-none xl:rounded-l-3xl xl:border-y-0 xl:border-r-0"
          data-case-inspector=""
          onCloseAutoFocus={(event) => {
            const trigger = returnFocusRef?.current;
            if (!trigger) return;
            event.preventDefault();
            trigger.focus({ preventScroll: true });
          }}
        >
          <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title
                className="text-xl font-bold [overflow-wrap:anywhere] sm:text-2xl"
                id={titleId}
              >
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description
                  className="text-muted-foreground mt-1 text-sm break-words"
                  id={descriptionId}
                >
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label={closeLabel}
                className="focus-visible:outline-accent hover:border-accent/45 inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/15 text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </Dialog.Close>
          </header>

          <div
            className="min-h-0 max-w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6"
            data-case-inspector-body=""
            data-case-inspector-scroll=""
            ref={scrollContainerRef}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
