"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* Campo con etiqueta, ayuda y error accesibles */
export function GlassField({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  optional,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  optional?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="flex items-baseline justify-between px-1 text-[13px] font-semibold text-ink-2">
          <span>{label}</span>
          {optional ? <span className="text-[11px] font-normal text-ink-3">{optional}</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="px-1 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="px-1 text-[12px] text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const fieldBase =
  "glass glass-thin w-full rounded-[var(--radius-input)] px-4 text-[16px] text-ink placeholder:text-ink-3 outline-none transition-[box-shadow,border-color] duration-200 focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--fm-accent)_18%,transparent)] aria-[invalid=true]:border-danger disabled:opacity-50";

export const GlassInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; leading?: React.ReactNode }>(
  function GlassInput({ className, invalid, leading, ...rest }, ref) {
    return (
      <div className="relative">
        {leading ? <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-3">{leading}</span> : null}
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(fieldBase, "h-[52px]", leading ? "pl-11" : undefined, className)}
          {...rest}
        />
      </div>
    );
  },
);

export const GlassTextarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function GlassTextarea({ className, invalid, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(fieldBase, "resize-none py-3.5 leading-relaxed", className)} {...rest} />;
  },
);

export const GlassSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  function GlassSelect({ className, invalid, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} aria-invalid={invalid || undefined} className={cn(fieldBase, "h-[52px] appearance-none pr-10", className)} {...rest}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      </div>
    );
  },
);

/* Selector de chips (única o múltiple) */
export function GlassChips<T extends string>({
  options,
  value,
  onChange,
  multiple,
  name,
  max,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
  multiple?: boolean;
  name?: string;
  max?: number;
  ariaLabel?: string;
}) {
  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <motion.button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={active}
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              if (multiple) {
                if (active) onChange(value.filter((v) => v !== o.value));
                else if (!max || value.length < max) onChange([...value, o.value]);
              } else onChange([o.value]);
            }}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
              active ? "glass glass-tint-green" : "glass glass-thin text-ink-2 hover:text-ink",
            )}
          >
            {active ? <Check className="size-3.5" aria-hidden /> : null}
            {o.label}
          </motion.button>
        );
      })}
      {name ? value.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
    </div>
  );
}

/* Interruptor estilo iOS */
export function GlassSwitch({
  checked,
  onChange,
  label,
  description,
  name,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  name?: string;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[15px] font-medium">{label}</span>
        {description ? <span className="block text-[13px] text-ink-2">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-[31px] w-[51px] shrink-0 rounded-full p-[2px] transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-accent" : "bg-[var(--fm-hairline)] ring-1 ring-inset ring-[var(--fm-hairline)]",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 600, damping: 34 }}
          className={cn("block size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.25)]", checked && "ml-auto")}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? "on" : "off"} /> : null}
    </div>
  );
}

/* Indicador de pasos del onboarding */
export function GlassStepper({ step, total, label }: { step: number; total: number; label?: string }) {
  return (
    <div className="flex items-center gap-3" aria-label={label}>
      <div className="flex flex-1 gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="glass glass-ultra-thin h-1.5 flex-1 overflow-hidden rounded-full">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: i < step ? "100%" : i === step ? "45%" : "0%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ))}
      </div>
      <span className="text-xs font-semibold text-ink-2 tabular">
        {Math.min(step + 1, total)}/{total}
      </span>
    </div>
  );
}
