import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { registry } from "./registry";
import { LOCALES } from "./config";

type Ns = Record<string, Record<string, string>>;

describe("i18n", () => {
  it("cada idioma tiene exactamente las mismas claves que el español", () => {
    const problems: string[] = [];
    for (const [ns, m] of Object.entries(registry as unknown as Record<string, Ns>)) {
      const ref = Object.keys(m.es).sort();
      for (const l of LOCALES) {
        const keys = Object.keys(m[l] ?? {});
        for (const k of ref) if (!keys.includes(k)) problems.push(`${l}: falta ${ns}.${k}`);
        for (const k of keys) if (!ref.includes(k)) problems.push(`${l}: sobra ${ns}.${k}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("todas las claves literales usadas en src existen", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !p.includes("/i18n/messages") && !f.endsWith(".test.ts")) files.push(p);
      }
    };
    walk("src");
    const nsNames = Object.keys(registry).join("|");
    const NS = new RegExp(`^(${nsNames})\\.`);
    const have = new Set<string>();
    for (const [ns, m] of Object.entries(registry as unknown as Record<string, Ns>)) for (const k of Object.keys(m.es)) have.add(`${ns}.${k}`);
    const missing = new Set<string>();
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      for (const m of s.matchAll(/["'`]([a-z]+\.[A-Za-z0-9_.]+)["'`]/g)) {
        if (NS.test(m[1]) && !m[1].endsWith(".") && !have.has(m[1])) missing.add(m[1]);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
