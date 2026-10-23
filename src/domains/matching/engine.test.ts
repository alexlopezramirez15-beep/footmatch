import { describe, expect, it } from "vitest";
import { computeMatch, MAX_SCORE_WHEN_INELIGIBLE, type CandidateFacts, type TargetSpec } from "./engine";

const marc: CandidateFacts = {
  position: "RW",
  secondaryPositions: ["LW"],
  age: 18,
  category: "u19_dh",
  experienceYears: 6,
  country: "ES",
  region: "Cataluña",
  city: "Barcelona",
  mobility: "region",
  availability: "seeking_club",
  languages: ["es", "ca"],
  foot: "left",
  heightCm: 176,
};

// Caso del documento de producto: extremo derecho, sub-19, DH, disponible, Cataluña.
const clubNeed: TargetSpec = {
  kind: "player",
  positions: ["RW"],
  ageMin: 16,
  ageMax: 19,
  category: "u19_dh",
  country: "ES",
  region: "Cataluña",
  city: "Sabadell",
  requirements: {
    position: { mandatory: true },
    age: { mandatory: true },
    availability: { mandatory: true },
  },
};

describe("computeMatch", () => {
  it("puntúa muy alto el caso de referencia y explica por qué", () => {
    const r = computeMatch(marc, clubNeed);
    expect(r.eligible).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(95);
    const reasons = r.strengths.map((s) => s.reason);
    expect(reasons).toContain("position_exact");
    expect(reasons).toContain("age_in_range");
    expect(reasons).toContain("category_compatible");
    expect(reasons).toContain("availability_ok");
  });

  it("es determinista", () => {
    expect(computeMatch(marc, clubNeed)).toEqual(computeMatch(marc, clubNeed));
  });

  it("un requisito obligatorio no cumplido excluye y limita la puntuación", () => {
    const r = computeMatch({ ...marc, age: 23 }, clubNeed);
    expect(r.eligible).toBe(false);
    expect(r.failedMandatory).toContain("age");
    expect(r.score).toBeLessThanOrEqual(MAX_SCORE_WHEN_INELIGIBLE);
  });

  it("posición secundaria puntúa menos que la principal", () => {
    const main = computeMatch(marc, { ...clubNeed, positions: ["RW"] }).score;
    const sec = computeMatch(marc, { ...clubNeed, positions: ["LW"] }).score;
    expect(sec).toBeLessThan(main);
    expect(sec).toBeGreaterThan(80);
  });

  it("un portero no encaja en una vacante de delantero", () => {
    const r = computeMatch({ ...marc, position: "GK", secondaryPositions: [] }, { ...clubNeed, positions: ["ST"] });
    expect(r.eligible).toBe(false);
    expect(r.gaps.map((g) => g.reason)).toContain("position_mismatch");
  });

  it("no evalúa criterios sin datos en la oportunidad", () => {
    const r = computeMatch(marc, { positions: ["RW"] });
    const evaluated = r.results.map((x) => x.criterion).sort();
    expect(evaluated).toEqual(["availability", "position"]);
    expect(r.score).toBe(100);
  });

  it("la movilidad y el traslado cuentan para ubicaciones lejanas", () => {
    const far: TargetSpec = { positions: ["RW"], country: "PL", city: "Kraków" };
    const stay = computeMatch({ ...marc, mobility: "region", willingToRelocate: false }, far);
    const move = computeMatch({ ...marc, mobility: "region", willingToRelocate: true }, far);
    const intl = computeMatch({ ...marc, mobility: "international" }, far);
    expect(move.score).toBeGreaterThan(stay.score);
    expect(intl.score).toBeGreaterThanOrEqual(move.score);
  });

  it("un jugador no disponible nunca aparece como encaje alto", () => {
    const r = computeMatch({ ...marc, availability: "unavailable" }, clubNeed);
    expect(r.eligible).toBe(false);
  });

  it("respeta pesos configurables y criterios desactivados", () => {
    const t: TargetSpec = { positions: ["ST"], ageMin: 16, ageMax: 19 };
    const base = computeMatch(marc, t).score;
    const ageHeavy = computeMatch(marc, t, { position: 1, age: 99, availability: 1 }).score;
    expect(ageHeavy).toBeGreaterThan(base);
    const noPos = computeMatch(marc, t, undefined, { position: false });
    expect(noPos.results.find((r) => r.criterion === "position")).toBeUndefined();
  });

  it("requisitos de altura y pie dominante", () => {
    const t: TargetSpec = {
      positions: ["RW"],
      requirements: { height: { mandatory: true, value: { min_cm: 180 } }, foot: { value: { foot: "left" } } },
    };
    const r = computeMatch(marc, t);
    expect(r.failedMandatory).toEqual(["height"]);
    expect(r.results.find((x) => x.criterion === "foot")?.passed).toBe(true);
  });
});
