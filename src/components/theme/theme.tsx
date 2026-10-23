"use client";

import * as React from "react";

export type ThemePref = "light" | "dark" | "system";
export const THEME_COOKIE = "fm_theme";

const ThemeCtx = React.createContext<{ pref: ThemePref; resolved: "light" | "dark"; setPref: (p: ThemePref) => void } | null>(null);

/** Script inline que fija data-theme antes del primer pintado (sin parpadeo). */
export const themeScript = `(()=>{try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);var p=m?m[1]:'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';var meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=d?'#080B10':'#F6F8FA'}catch(e){}})()`;

const DARK_MQ = "(prefers-color-scheme: dark)";
const subscribeSystem = (cb: () => void) => {
  const mq = window.matchMedia(DARK_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function ThemeProvider({ initial, children }: { initial: ThemePref; children: React.ReactNode }) {
  const [pref, setPrefState] = React.useState<ThemePref>(initial);
  const systemDark = React.useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_MQ).matches, () => false);
  const resolved: "light" | "dark" = pref === "system" ? (systemDark ? "dark" : "light") : pref;

  React.useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#080B10" : "#F6F8FA");
  }, [resolved]);

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
