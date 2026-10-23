"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ChevronLeft, Film, Link2, Plus, ShieldAlert, Trash2, Copy } from "lucide-react";
import { GlassButton, GlassCard, GlassProgress } from "@/components/glass/primitives";
import { GlassChips, GlassField, GlassInput, GlassSelect, GlassStepper, GlassSwitch, GlassTextarea } from "@/components/glass/forms";
import { useToast } from "@/components/glass/overlays";
import { GlassProfileCard } from "@/components/cards/cards";
import { useFootballOptions } from "@/components/app/options";
import { useI18n } from "@/i18n/client";
import { getBrowserClient } from "@/lib/supabase/client";
import { optimizeImage } from "@/lib/image";
import { profileCompletion } from "@/domains/profile/completion";
import { ageFrom } from "@/domains/football/catalog";
import {
  addCareerAction, addVideoAction, completeOnboardingAction, removeCareerAction, removeMediaAction, requestGuardianAction,
  saveDraftAction, savePlayerStepAction, setAvatarAction,
} from "@/domains/onboarding/actions";

export type PlayerWizardInitial = {
  userId: string;
  step: number;
  values: Record<string, unknown>;
  careers: Array<{ id: string; club_name: string; season: string; category: string | null }>;
  videos: Array<{ id: string; title: string | null; external_url: string | null; kind: string }>;
  avatarUrl: string | null;
  avatarPath: string | null;
  guardian: { status: string; token: string; guardian_email: string } | null;
};

const TOTAL = 8;
const STRENGTHS = ["Velocidad", "Regate", "Visión de juego", "Juego aéreo", "Finalización", "Pase largo", "Liderazgo", "1 contra 1", "Presión", "Táctica", "Salida de balón", "Reflejos"];

/** mode "edit": mismo formulario para editar el perfil ya creado (navegación libre entre secciones). */
export function PlayerWizard({ initial, mode = "onboarding" }: { initial: PlayerWizardInitial; mode?: "onboarding" | "edit" }) {
  const { t } = useI18n();
  const router = useRouter();
  const editing = mode === "edit";
  const o = useFootballOptions();
  const { push } = useToast();
  const [step, setStep] = React.useState(Math.min(Math.max(initial.step, 1), TOTAL));
  const [dir, setDir] = React.useState(1);
  const [v, setV] = React.useState<Record<string, unknown>>(initial.values);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const [careers, setCareers] = React.useState(initial.careers);
  const [videos, setVideos] = React.useState(initial.videos);
  const [avatar, setAvatar] = React.useState<{ url: string | null; path: string | null }>({ url: initial.avatarUrl, path: initial.avatarPath });
  const [guardian, setGuardian] = React.useState(initial.guardian);

  const set = (k: string, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const str = (k: string) => (v[k] as string | null | undefined) ?? "";
  const arr = (k: string) => (v[k] as string[] | undefined) ?? [];
  const err = (k: string) => (errors[k] ? t("onboarding.errorSave") : null);

  const age = ageFrom(str("birth_date") || null);
  const isMinor = age != null && age < 18;

  const payloadFor = (s: number): Record<string, unknown> => {
    const pick = (...keys: string[]) => Object.fromEntries(keys.map((k) => [k, v[k] === "" ? null : v[k]]));
    switch (s) {
      case 1: return pick("full_name", "birth_date", "country", "region", "city", "nationality");
      case 2: return pick("position", "secondary_positions", "dominant_foot", "height_cm", "weight_kg", "category", "current_club", "experience_years");
      case 5: return { availability: v.availability ?? "seeking_club", mobility: v.mobility ?? "region", willing_to_relocate: Boolean(v.willing_to_relocate) };
      case 6: return { goals: v.goals || null, strengths: arr("strengths") };
      case 7: return { languages: arr("languages"), visibility: v.visibility ?? "clubs_only", allow_agent_contact: Boolean(v.allow_agent_contact) };
      default: return {};
    }
  };

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setErrors({});
    setStep(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () =>
    start(async () => {
      if (step === TOTAL) {
        if (editing) {
          router.push("/profile");
          router.refresh();
          return;
        }
        await completeOnboardingAction();
        return;
      }
      const res = await savePlayerStepAction(step, payloadFor(step));
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        push({ tone: "error", title: t(res.error) });
        return;
      }
      if (editing) push({ tone: "success", title: t("common.saved") });
      go(step + 1);
    });

  const saveDraft = () =>
    start(async () => {
      await saveDraftAction(v);
      push({ tone: "success", title: t("onboarding.draftSaved") });
    });

  const completion = profileCompletion({
    full_name: str("full_name"), birth_date: str("birth_date"), country: str("country"), city: str("city"), avatar_path: avatar.path,
    position: str("position"), category: str("category"), dominant_foot: str("dominant_foot"), height_cm: Number(v.height_cm) || null,
    current_club: str("current_club"), goals: str("goals"), languages: arr("languages"), careers: careers.length, videos: videos.length,
  });

  return (
    <div>
      {editing ? (
        <nav aria-label={t("profile.sections")} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-current={n === step ? "step" : undefined}
              onClick={() => go(n)}
              className={n === step ? "glass glass-tint-green h-9 shrink-0 rounded-full px-4 text-sm font-medium" : "glass glass-thin h-9 shrink-0 rounded-full px-4 text-sm text-ink-2"}
            >
              {t(`onboarding.p.s${n}`)}
            </button>
          ))}
        </nav>
      ) : (
        <GlassStepper step={step - 1} total={TOTAL} label={t("onboarding.stepOf", { n: step, total: TOTAL })} />
      )}
      <div className="mt-6 mb-6">
        <h1 className="fm-display text-[32px]">{t(`onboarding.p.s${step}`)}</h1>
        <p className="mt-1.5 text-[15px] text-ink-2">{t(`onboarding.p.s${step}d`)}</p>
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: dir * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -40 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard material="regular" radius="xl" className="flex flex-col gap-5 p-5 sm:p-6">
            {step === 1 && (
              <>
                <GlassField label={t("auth.fullName")} htmlFor="full_name" error={err("full_name")}>
                  <GlassInput id="full_name" value={str("full_name")} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" />
                </GlassField>
                <GlassField label={t("onboarding.birthDate")} htmlFor="birth_date" error={err("birth_date")}>
                  <GlassInput id="birth_date" type="date" value={str("birth_date")} onChange={(e) => set("birth_date", e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                </GlassField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassField label={t("onboarding.country")} htmlFor="country" error={err("country")}>
                    <GlassSelect id="country" value={str("country")} onChange={(e) => set("country", e.target.value)}>
                      <option value="">—</option>
                      {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </GlassSelect>
                  </GlassField>
                  <GlassField label={t("onboarding.nationality")} htmlFor="nationality" optional={t("common.optional")}>
                    <GlassSelect id="nationality" value={str("nationality")} onChange={(e) => set("nationality", e.target.value)}>
                      <option value="">—</option>
                      {o.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </GlassSelect>
                  </GlassField>
                  <GlassField label={t("onboarding.region")} htmlFor="region" optional={t("common.optional")}>
                    <GlassInput id="region" value={str("region")} onChange={(e) => set("region", e.target.value)} autoComplete="address-level1" />
                  </GlassField>
                  <GlassField label={t("onboarding.city")} htmlFor="city" optional={t("common.optional")}>
                    <GlassInput id="city" value={str("city")} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />
                  </GlassField>
                </div>
                {isMinor ? (
                  <div className="glass glass-tint-blue flex gap-3 rounded-2xl p-4 text-sm">
                    <ShieldAlert className="mt-0.5 size-5 shrink-0 text-info" />
                    <p className="text-ink-2">{t("onboarding.minorBody")}</p>
                  </div>
                ) : null}
              </>
            )}

            {step === 2 && (
              <>
                <GlassField label={t("onboarding.position")} error={err("position")}>
                  <GlassChips options={o.positions} value={str("position") ? [str("position")] : []} onChange={(x) => set("position", x[0])} ariaLabel={t("onboarding.position")} />
                </GlassField>
                <GlassField label={t("onboarding.secondary")} optional="máx. 3">
                  <GlassChips multiple max={3} options={o.positions.filter((p) => p.value !== str("position"))} value={arr("secondary_positions")} onChange={(x) => set("secondary_positions", x)} />
                </GlassField>
                <GlassField label={t("onboarding.foot")}>
                  <GlassChips options={o.feet} value={str("dominant_foot") ? [str("dominant_foot")] : []} onChange={(x) => set("dominant_foot", x[0])} />
                </GlassField>
                <div className="grid grid-cols-2 gap-4">
                  <GlassField label={t("onboarding.height")} htmlFor="height_cm" error={err("height_cm")}>
                    <GlassInput id="height_cm" type="number" inputMode="numeric" value={str("height_cm")} onChange={(e) => set("height_cm", e.target.value)} />
                  </GlassField>
                  <GlassField label={t("onboarding.weight")} htmlFor="weight_kg" error={err("weight_kg")}>
                    <GlassInput id="weight_kg" type="number" inputMode="numeric" value={str("weight_kg")} onChange={(e) => set("weight_kg", e.target.value)} />
                  </GlassField>
                </div>
                <GlassField label={t("onboarding.category")} htmlFor="category">
                  <GlassSelect id="category" value={str("category")} onChange={(e) => set("category", e.target.value)}>
                    <option value="">—</option>
                    {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </GlassSelect>
                </GlassField>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <GlassField label={t("onboarding.currentClub")} htmlFor="current_club" optional={t("common.optional")}>
                    <GlassInput id="current_club" value={str("current_club")} onChange={(e) => set("current_club", e.target.value)} />
                  </GlassField>
                  <GlassField label={t("onboarding.experience")} htmlFor="experience_years">
                    <GlassInput id="experience_years" type="number" inputMode="numeric" min={0} max={40} value={str("experience_years") || "0"} onChange={(e) => set("experience_years", e.target.value)} />
                  </GlassField>
                </div>
              </>
            )}

            {step === 3 && <CareerEditor careers={careers} setCareers={setCareers} />}

            {step === 4 && (
              <>
                <AvatarUploader userId={initial.userId} avatar={avatar} onChange={setAvatar} />
                <VideoEditor videos={videos} setVideos={setVideos} />
              </>
            )}

            {step === 5 && (
              <>
                <GlassField label={t("onboarding.availability")}>
                  <GlassChips options={o.availability} value={[str("availability") || "seeking_club"]} onChange={(x) => set("availability", x[0])} />
                </GlassField>
                <GlassField label={t("onboarding.mobility")}>
                  <GlassChips options={o.mobility} value={[str("mobility") || "region"]} onChange={(x) => set("mobility", x[0])} />
                </GlassField>
                <GlassSwitch label={t("onboarding.relocate")} checked={Boolean(v.willing_to_relocate)} onChange={(x) => set("willing_to_relocate", x)} />
              </>
            )}

            {step === 6 && (
              <>
                <GlassField label={t("onboarding.goals")} htmlFor="goals">
                  <GlassTextarea id="goals" value={str("goals")} placeholder={t("onboarding.goalsPh")} maxLength={1000} onChange={(e) => set("goals", e.target.value)} />
                </GlassField>
                <GlassField label={t("onboarding.strengths")}>
                  <GlassChips multiple max={5} options={STRENGTHS.map((s) => ({ value: s, label: s }))} value={arr("strengths")} onChange={(x) => set("strengths", x)} />
                </GlassField>
              </>
            )}

            {step === 7 && (
              <>
                <GlassField label={t("onboarding.languages")}>
                  <GlassChips multiple options={o.languages} value={arr("languages")} onChange={(x) => set("languages", x)} />
                </GlassField>
                <GlassField label={t("onboarding.visibility")}>
                  <div className="flex flex-col gap-2" role="radiogroup">
                    {(["clubs_only", "public", "hidden"] as const).map((vis) => (
                      <label key={vis} className={`glass flex cursor-pointer items-center gap-3 rounded-2xl p-3.5 ${str("visibility") === vis || (!str("visibility") && vis === "clubs_only") ? "glass-elevated" : "glass-thin"}`}>
                        <input type="radio" name="visibility" className="size-4 accent-[var(--fm-accent)]" checked={str("visibility") === vis || (!str("visibility") && vis === "clubs_only")} onChange={() => set("visibility", vis)} />
                        <span className="text-[15px]">{t(`onboarding.vis.${vis}`)}</span>
                      </label>
                    ))}
                  </div>
                </GlassField>
                <GlassSwitch label={t("onboarding.agentContact")} checked={Boolean(v.allow_agent_contact)} onChange={(x) => set("allow_agent_contact", x)} />
              </>
            )}

            {step === 8 && (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                    <span>{t("onboarding.completion")}</span>
                    <span className="fm-number text-lg tabular">{completion.score} %</span>
                  </div>
                  <GlassProgress value={completion.score} label={t("onboarding.completion")} />
                </div>
                <p className="fm-eyebrow">{t("onboarding.previewTitle")}</p>
                <div className="mx-auto aspect-[3/4] w-full max-w-[340px]">
                  <GlassProfileCard
                    player={{
                      id: initial.userId, name: str("full_name") || "—", age, position: str("position") || "ST",
                      nationality: str("nationality") || str("country"), country: str("country"), city: isMinor ? null : str("city"),
                      region: str("region"), currentClub: str("current_club"), category: str("category") || null,
                      availability: str("availability") || "seeking_club", photoUrl: avatar.url, isMinor,
                      heightCm: Number(v.height_cm) || null, foot: str("dominant_foot") || null,
                    }}
                  />
                </div>
                {isMinor ? <GuardianRequest guardian={guardian} onSent={setGuardian} /> : null}
              </>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      <div className="sticky bottom-0 z-10 mt-6 flex items-center gap-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step > 1 ? (
          <GlassButton size="icon" aria-label={t("common.back")} onClick={() => go(step - 1)} disabled={pending}>
            <ChevronLeft className="size-5" />
          </GlassButton>
        ) : null}
        {editing ? null : (
          <GlassButton variant="ghost" size="md" onClick={saveDraft} disabled={pending} className="hidden sm:inline-flex">
            {t("onboarding.saveDraft")}
          </GlassButton>
        )}
        <GlassButton variant="primary" size="lg" className="flex-1 justify-center" loading={pending} onClick={next}>
          {editing
            ? step === TOTAL ? t("profile.done") : t("profile.saveContinue")
            : step === TOTAL ? t("onboarding.finish") : step === 3 || step === 4 ? t("common.continue") : t("common.next")}
        </GlassButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
function CareerEditor({ careers, setCareers }: { careers: PlayerWizardInitial["careers"]; setCareers: React.Dispatch<React.SetStateAction<PlayerWizardInitial["careers"]>> }) {
  const { t } = useI18n();
  const o = useFootballOptions();
  const { push } = useToast();
  const [form, setForm] = React.useState({ club_name: "", season: "", category: "" });
  const [pending, start] = React.useTransition();
  const add = () =>
    start(async () => {
      const payload = { ...form, category: form.category || null };
      const res = await addCareerAction(payload);
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      setCareers((c) => [{ id: res.data!.id, ...payload }, ...c]);
      setForm({ club_name: "", season: "", category: "" });
    });
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GlassInput aria-label={t("onboarding.clubName")} placeholder={t("onboarding.clubName")} value={form.club_name} onChange={(e) => setForm({ ...form, club_name: e.target.value })} />
        <GlassInput aria-label={t("onboarding.season")} placeholder="2025/26" value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} />
        <GlassSelect aria-label={t("onboarding.seasonCategory")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          <option value="">{t("onboarding.seasonCategory")}</option>
          {o.categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </GlassSelect>
      </div>
      <GlassButton onClick={add} loading={pending} disabled={!form.club_name || !form.season} className="self-start">
        <Plus className="size-4" /> {t("onboarding.addSeason")}
      </GlassButton>
      <ul className="flex flex-col gap-2">
        {careers.length === 0 ? <li className="text-sm text-ink-3">{t("onboarding.noSeasons")}</li> : null}
        <AnimatePresence initial={false}>
          {careers.map((c) => (
            <motion.li key={c.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="glass glass-thin flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div>
                <p className="font-semibold">{c.club_name}</p>
                <p className="text-[13px] text-ink-2">{c.season}{c.category ? ` · ${t(`football.cat.${c.category}`)}` : ""}</p>
              </div>
              <button
                aria-label={t("common.delete")}
                onClick={() => start(async () => { await removeCareerAction(c.id); setCareers((s) => s.filter((x) => x.id !== c.id)); })}
                className="flex size-9 items-center justify-center rounded-full text-ink-3 hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </>
  );
}

export function AvatarUploader({ userId, avatar, onChange }: { userId: string; avatar: { url: string | null; path: string | null }; onChange: (a: { url: string | null; path: string | null }) => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|heic)$/.test(file.type) || file.size > 15 * 1024 * 1024) {
      push({ tone: "error", title: t("onboarding.photoHint") });
      return;
    }
    setBusy(true);
    try {
      const blob = await optimizeImage(file);
      if (blob.size > 5 * 1024 * 1024) throw new Error("size");
      const ext = blob.type === "image/webp" ? "webp" : file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const supabase = getBrowserClient();
      const { error } = await supabase.storage.from("player-media").upload(path, blob, { contentType: blob.type || file.type, upsert: false });
      if (error) throw error;
      const res = await setAvatarAction(path);
      if (!res.ok) throw new Error(res.error);
      onChange({ url: URL.createObjectURL(blob), path });
    } catch {
      push({ tone: "error", title: t("common.error"), body: t("onboarding.photoHint") });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="glass glass-thin relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-[30px]"
        aria-label={avatar.url ? t("onboarding.changePhoto") : t("onboarding.uploadPhoto")}
      >
        {avatar.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="size-8 text-ink-3" />
        )}
        {busy ? <span className="fm-skeleton absolute inset-0" /> : null}
      </button>
      <div>
        <p className="font-semibold">{t("onboarding.photo")}</p>
        <p className="mt-1 text-[13px] text-ink-2">{t("onboarding.photoHint")}</p>
        <GlassButton size="sm" className="mt-3" loading={busy} onClick={() => input.current?.click()}>
          <Camera className="size-4" /> {avatar.url ? t("onboarding.changePhoto") : t("onboarding.uploadPhoto")}
        </GlassButton>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/heic" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}

export function VideoEditor({ videos, setVideos }: { videos: PlayerWizardInitial["videos"]; setVideos: React.Dispatch<React.SetStateAction<PlayerWizardInitial["videos"]>> }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [form, setForm] = React.useState({ external_url: "", title: "", kind: "video_highlight" });
  const [pending, start] = React.useTransition();
  const add = () =>
    start(async () => {
      const res = await addVideoAction({ ...form, title: form.title || null });
      if (!res.ok) return push({ tone: "error", title: t(res.error) });
      setVideos((s) => [{ id: res.data!.id, title: form.title || null, external_url: form.external_url, kind: form.kind }, ...s]);
      setForm({ external_url: "", title: "", kind: "video_highlight" });
    });
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--fm-hairline)] pt-5">
      <GlassField label={t("onboarding.videoUrl")} htmlFor="video_url">
        <GlassInput id="video_url" type="url" inputMode="url" placeholder="https://" leading={<Link2 className="size-4" />} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} />
      </GlassField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <GlassInput aria-label={t("onboarding.videoTitle")} placeholder={t("onboarding.videoTitle")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <GlassSelect aria-label={t("onboarding.videoKind")} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="video_highlight">{t("onboarding.video.highlight")}</option>
          <option value="video_match">{t("onboarding.video.match")}</option>
          <option value="video_clip">{t("onboarding.video.clip")}</option>
        </GlassSelect>
      </div>
      <GlassButton onClick={add} loading={pending} disabled={!form.external_url.startsWith("https://")} className="self-start">
        <Film className="size-4" /> {t("onboarding.addVideo")}
      </GlassButton>
      <ul className="flex flex-col gap-2">
        {videos.map((vd) => (
          <li key={vd.id} className="glass glass-thin flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{vd.title || vd.external_url}</p>
              <p className="text-[12px] text-ink-2">{t(`onboarding.video.${vd.kind.replace("video_", "")}`)}</p>
            </div>
            <button aria-label={t("common.delete")} onClick={() => start(async () => { await removeMediaAction(vd.id); setVideos((s) => s.filter((x) => x.id !== vd.id)); })} className="flex size-9 items-center justify-center rounded-full text-ink-3 hover:text-danger">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GuardianRequest({ guardian, onSent }: { guardian: PlayerWizardInitial["guardian"]; onSent: (g: PlayerWizardInitial["guardian"]) => void }) {
  const { t } = useI18n();
  const { push } = useToast();
  const [form, setForm] = React.useState({ guardian_email: "", guardian_name: "", relationship: "mother" });
  const [pending, start] = React.useTransition();
  const link = guardian ? `${typeof window !== "undefined" ? window.location.origin : ""}/guardian/accept?token=${guardian.token}` : "";
  return (
    <div className="glass glass-tint-blue flex flex-col gap-4 rounded-[24px] p-4">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-info" />
        <div>
          <p className="font-semibold">{t("onboarding.minorTitle")}</p>
          <p className="mt-1 text-[13px] text-ink-2">{t("onboarding.minorBody")}</p>
        </div>
      </div>
      {guardian ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">{t("onboarding.guardianSent")}</p>
          <p className="text-[12px] text-ink-2">{t("onboarding.guardianLink")}</p>
          <div className="flex items-center gap-2">
            <code className="glass glass-thin flex-1 truncate rounded-xl px-3 py-2 text-[12px]">{link}</code>
            <GlassButton size="icon" aria-label={t("common.share")} onClick={() => { navigator.clipboard?.writeText(link); push({ tone: "success", title: t("common.copied") }); }}>
              <Copy className="size-4" />
            </GlassButton>
          </div>
        </div>
      ) : (
        <>
          <GlassInput type="email" aria-label={t("onboarding.guardianEmail")} placeholder={t("onboarding.guardianEmail")} value={form.guardian_email} onChange={(e) => setForm({ ...form, guardian_email: e.target.value })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GlassInput aria-label={t("onboarding.guardianName")} placeholder={t("onboarding.guardianName")} value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} />
            <GlassSelect aria-label={t("onboarding.relationship")} value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })}>
              {(["mother", "father", "legal_guardian", "other"] as const).map((r) => <option key={r} value={r}>{t(`onboarding.rel.${r}`)}</option>)}
            </GlassSelect>
          </div>
          <GlassButton
            variant="primary"
            loading={pending}
            disabled={!form.guardian_email.includes("@")}
            onClick={() =>
              start(async () => {
                const res = await requestGuardianAction({ ...form, guardian_name: form.guardian_name || null });
                if (!res.ok) return push({ tone: "error", title: t(res.error) });
                onSent({ status: "pending", token: res.data!.token, guardian_email: form.guardian_email });
              })
            }
          >
            {t("onboarding.sendGuardian")}
          </GlassButton>
        </>
      )}
    </div>
  );
}
