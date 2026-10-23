// Respuesta háptica cuando el navegador la soporta (Android/Chrome).
// Safari en iOS no expone la Vibration API: no se promete vibración allí.
type Pattern = "light" | "success" | "match" | "warning";

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 8,
  success: [10, 30, 14],
  match: [14, 40, 22, 40, 30],
  warning: [30, 50, 30],
};

export function haptic(p: Pattern = "light") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return navigator.vibrate(PATTERNS[p]);
  } catch {
    return false;
  }
}
