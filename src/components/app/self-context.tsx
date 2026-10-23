"use client";

import * as React from "react";

export type SelfInfo = { id: string; name: string; avatarUrl: string | null; mode: "player" | "organization" | "professional" };
const SelfCtx = React.createContext<SelfInfo | null>(null);

export function SelfProvider({ value, children }: { value: SelfInfo; children: React.ReactNode }) {
  return <SelfCtx.Provider value={value}>{children}</SelfCtx.Provider>;
}

export function useSelf() {
  return React.useContext(SelfCtx);
}
