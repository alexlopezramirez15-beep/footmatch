import { describe, expect, it } from "vitest";
import { profileCompletion } from "./completion";

describe("profileCompletion", () => {
  it("perfil vacío", () => {
    expect(profileCompletion({ careers: 0, videos: 0 }).score).toBe(0);
  });
  it("sugiere la acción de más peso pendiente", () => {
    const r = profileCompletion({ full_name: "A", birth_date: "2008-01-01", country: "ES", position: "ST", category: "u19_dh", avatar_path: "x", careers: 1, videos: 0 });
    expect(r.score).toBe(55);
    expect(r.next).toBe("video");
  });
  it("perfil completo = 100", () => {
    const r = profileCompletion({
      full_name: "A", birth_date: "2008-01-01", country: "ES", city: "B", avatar_path: "x", position: "ST", category: "u19_dh",
      dominant_foot: "left", height_cm: 180, current_club: "C", goals: "Quiero jugar en DH", languages: ["es"], careers: 1, videos: 1,
    });
    expect(r).toEqual({ score: 100, next: null });
  });
});
