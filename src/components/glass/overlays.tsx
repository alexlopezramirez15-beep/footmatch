"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { springSheet } from "./tokens";
import { useMounted } from "@/lib/hooks";


/** Bloquea el scroll del body y gestiona Escape + foco inicial / devolución de foco. */
function useOverlayBehaviour(open: boolean, onClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      target?.focus();
    }, 40);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose, panel]);
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] bg-black/25 backdrop-blur-[6px] dark:bg-black/50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------------ */
/* GlassModal                                                          */
/* ------------------------------------------------------------------ */
export function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
}) {
  const mounted = useMounted();
  const panel = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useOverlayBehaviour(open, onClose, panel);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClick={onClose} />
          <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={cn("glass glass-elevated pointer-events-auto w-full max-w-md rounded-[var(--radius-xl)] p-6 outline-none", className)}
            >
              {title || !hideClose ? (
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    {title ? <h2 className="fm-title text-xl">{title}</h2> : null}
                    {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
                  </div>
                  {!hideClose ? (
                    <button onClick={onClose} aria-label="Cerrar" className="glass glass-thin -mt-1 -mr-1 flex size-9 items-center justify-center rounded-full">
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {children}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* GlassBottomSheet (GlassSheet): arrastrar para cerrar                */
/* ------------------------------------------------------------------ */
export function GlassBottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  const panel = React.useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panel);
  if (!mounted) return null;
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={springSheet}
            className={cn(
              "glass glass-elevated fixed inset-x-0 bottom-0 z-[90] mx-auto max-h-[88dvh] w-full max-w-xl overflow-hidden rounded-t-[var(--radius-xl)] outline-none sm:bottom-4 sm:rounded-[var(--radius-xl)]",
              className,
            )}
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="h-1.5 w-10 rounded-full bg-[var(--fm-text-3)]/50" aria-hidden />
            </div>
            {title ? <h2 className="fm-title px-6 pt-2 pb-3 text-lg">{title}</h2> : null}
            <div className="max-h-[calc(88dvh-60px)] overflow-y-auto overscroll-contain px-6 pb-4">{children}</div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
export const GlassSheet = GlassBottomSheet;

/* ------------------------------------------------------------------ */
/* GlassDrawer (lateral, escritorio)                                   */
/* ------------------------------------------------------------------ */
export function GlassDrawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  const mounted = useMounted();
  const panel = React.useRef<HTMLDivElement>(null);
  useOverlayBehaviour(open, onClose, panel);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <Backdrop onClick={onClose} />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ x: side === "right" ? "105%" : "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: side === "right" ? "105%" : "-105%" }}
            transition={springSheet}
            className={cn(
              "glass glass-elevated fixed top-3 bottom-3 z-[90] flex w-[min(460px,calc(100vw-24px))] flex-col rounded-[var(--radius-xl)] outline-none",
              side === "right" ? "right-3" : "left-3",
              className,
            )}
          >
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              {title ? <h2 className="fm-title text-lg">{title}</h2> : <span />}
              <button onClick={onClose} aria-label="Cerrar" className="glass glass-thin flex size-9 items-center justify-center rounded-full">
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* GlassToast / GlassNotification                                     */
/* ------------------------------------------------------------------ */
type ToastTone = "success" | "error" | "info" | "warning";
type Toast = { id: number; title: string; body?: string; tone: ToastTone; href?: string };
const ToastCtx = React.createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  return ctx ?? { push: () => {} };
}

const toneIcon: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 className="size-5 text-accent" />,
  error: <XCircle className="size-5 text-danger" />,
  info: <Info className="size-5 text-info" />,
  warning: <TriangleAlert className="size-5 text-warn" />,
};

export function GlassNotification({ title, body, tone = "info", onClose }: { title: string; body?: string; tone?: ToastTone; onClose?: () => void }) {
  return (
    <div className="glass glass-elevated flex w-full items-start gap-3 rounded-[24px] p-3.5 pr-2">
      <div className="glass glass-thin flex size-9 shrink-0 items-center justify-center rounded-full">{toneIcon[tone]}</div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-[15px] leading-snug font-semibold">{title}</p>
        {body ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{body}</p> : null}
      </div>
      {onClose ? (
        <button onClick={onClose} aria-label="Cerrar" className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink">
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function GlassToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((s) => [...s.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4200);
  }, []);
  const value = React.useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex flex-col items-center gap-2 px-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 12px)" }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="pointer-events-auto w-full max-w-sm"
            >
              <GlassNotification title={t.title} body={t.body} tone={t.tone} onClose={() => setToasts((s) => s.filter((x) => x.id !== t.id))} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
