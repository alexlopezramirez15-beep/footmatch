"use client";

import * as React from "react";

export type ThemePref = "light" | "dark" | "system";
export const THEME_COOKIE = "fm_theme";

const ThemeCtx = React.createContext<{ pref: ThemePref; resolved: "light" | "dark"; setPref: (p: ThemePref) => void } | null>(null);

function resolve(p: ThemePref): "light" | "dark" {
  if (p !== "system") return p;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Script inline que fija data-theme antes del primer pintado (sin parpadeo). */
export const themeScript = `(()=>{try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=d?'#080B10':'#F6F8FA'}catch(e){}})()`;

export function ThemeProvider({ initial, children }: { initial: ThemePref; children: React.ReactNode }) {
  const [pref, setPrefState] = React.useState<ThemePref>(initial);
  const [resolved, setResolved] = React.useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );

  const apply = React.useCallback((p: ThemePref) => {
    const r = resolve(p);
    document.documentElement.dataset.theme = r;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", r === "dark" ? "#080B10" : "#F6F8FA");
    setResolved(r);
  }, []);

  React.useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [pref, apply]);

  const setPref = React.useCallback((p: ThemePref) => {
    document.cookie = `${THEME_COOKIE}=${p};path=/;max-age=31536000;samesite=lax`;
    setPrefState(p);
  }, []);

  const value = React.useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme fuera de ThemeProvider");
  return ctx;
}
