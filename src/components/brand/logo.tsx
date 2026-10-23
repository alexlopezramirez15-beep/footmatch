import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

/**
 * Símbolo FOOTMATCH: dos trayectorias circulares que se encuentran.
 * La intersección (la "lente") es el match. Versiones: color, mono y sobre oscuro.
 */
export function LogoMark({
  size = 32,
  variant = "color",
  className,
}: {
  size?: number;
  variant?: "color" | "mono" | "on-dark";
  className?: string;
}) {
  const ring = variant === "on-dark" ? "#F9FAFB" : "currentColor";
  const lens = variant === "mono" ? "currentColor" : "url(#fm-lens)";
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="fm-lens" x1="32" y1="18" x2="32" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
        <clipPath id="fm-clip-l">
          <circle cx="24" cy="32" r="15" />
        </clipPath>
      </defs>
      <circle cx="40" cy="32" r="15" fill={lens} clipPath="url(#fm-clip-l)" />
      <circle cx="24" cy="32" r="15" stroke={ring} strokeWidth="5" />
      <circle cx="40" cy="32" r="15" stroke={ring} strokeWidth="5" />
      <circle cx="32" cy="32" r="3.2" fill={variant === "mono" ? "var(--fm-bg, #fff)" : "#F9FAFB"} />
    </svg>
  );
}

export function Logo({ className, size = 28, variant = "color" }: { className?: string; size?: number; variant?: "color" | "mono" | "on-dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} variant={variant} />
      <span className="fm-title text-[1.05em] tracking-[-0.03em]" style={{ fontWeight: 800 }}>
        {BRAND.name}
      </span>
    </span>
  );
}
