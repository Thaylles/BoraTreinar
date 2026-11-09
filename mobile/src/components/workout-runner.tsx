import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, CloudOff, Droplets, History, Minus, Pause, Play, Plus, SkipForward, TrendingUp, Trophy, X } from "lucide-react-native";
import { equipmentImageSrc, groupLabel } from "@/lib/catalog";
import { formatKg, formatRest, techniqueInfo } from "@/lib/plans";
import { suggestProgression } from "@/lib/progression";
import type { SessionPayload } from "@/lib/outbox";
import { cardioSetLine, type IntensityUnit } from "@/lib/cardio";
import { guessBar, warmupSets } from "@/lib/plates";
import { cardioOnlyMinutes, sessionWindow } from "@/lib/session-window";
import { EFFORT } from "@/lib/effort";
import { bottleLabel, liters } from "@/lib/water";
import type { BackdateInfo, RunnerExercise, SwapOption } from "@/components/workout/workout-runner";
import { callAction, callOrQueue } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { draftStore } from "~/lib/drafts";
import { cancelAlarm, scheduleAlarm } from "~/lib/notify";
import { queryClient } from "~/lib/query";
import { Alert, Button, inputClass, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Checkbox } from "~/ui/forms";
import { useWaterToday, WaterButtons } from "./widgets";

export type { BackdateInfo, RunnerExercise, SwapOption };
type SwapSource = "personal" | "ia" | "regras";
type SetState = {
  load: string;
  reps: string;
  done: boolean | null;
  km?: string;
  speed?: string;
  incline?: string;
  level?: string;
  clock?: { total: number; endsAt?: number; left?: number; alarm?: string | null };
};
type ExerciseState = { rest: number; sets: SetState[]; swap?: { id: string; source: SwapSource } };
type Draft = { v: 1; clientId: string; startedAt: string; exercises: ExerciseState[]; title?: string; href?: string };
type Timer = { endsAt: number; total: number; exercise: number; alarm?: string | null } | null;
type Summary = { duration: number; doneSets: number; volume: number; prs: string[]; offline: boolean; sessionId?: string };

const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const parseNum = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const optNum = (s: string | undefined) => (s == null || s.trim() === "" ? null : parseNum(s));
const str = (n: number | null | undefined) => (n == null ? "" : fmtNum(n));
const isCardioEx = (ex: RunnerExercise) => ex.equipment.muscle_group === "cardio";
const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

export const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

const initialExercises = (list: RunnerExercise[]): ExerciseState[] => list.map((ex) => ({ rest: ex.restSeconds, sets: initialSets(ex) }));

function effectiveExercise(ex: RunnerExercise, state: ExerciseState | undefined): RunnerExercise {
  const id = state?.swap?.id;
  if (!id) return ex;
  const opt = [ex.substitute, ...(ex.alternatives ?? [])].find((o) => o?.equipment.id === id);
  return opt ? { ...ex, equipment: opt.equipment, history: opt.history, suggestedLoad: null } : ex;
}

function initialSets(ex: RunnerExercise): SetState[] {
  const last = ex.history.last?.sets ?? [];
  const count = Math.max(1, ex.targetSets);
  return Array.from({ length: count }, (_, i) => {
    const prev = last[i] ?? last[last.length - 1];
    if (isCardioEx(ex)) {
      const minutes = prev?.minutes ?? prev?.reps ?? ex.repsMin ?? null;
      return { load: "0", reps: minutes == null ? "" : fmtNum(minutes), km: str(prev?.km), speed: str(prev?.speed), incline: str(prev?.incline), level: str(prev?.level), done: null };
    }
    const load = prev?.load ?? ex.suggestedLoad ?? (ex.equipment.is_bodyweight ? 0 : null);
    const reps = ex.repsMin ?? prev?.reps ?? null;
    return { load: load == null ? "" : fmtNum(load), reps: reps == null ? "" : String(reps), done: null };
  });
}

/** Fim do descanso com o app aberto: vibra forte (o aviso agendado cobre o app no fundo). */
const buzz = () => {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 350);
  setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 700);
};
const tap = () => Platform.OS !== "web" && void Haptics.selectionAsync();

function EmptyWorkoutWarning({ onDiscard }: { onDiscard: () => void }) {
  return (
    <View accessibilityRole="alert" className="mb-4 rounded-2xl border-2 border-pitanga-500/50 bg-pitanga-500/10 px-4 py-3">
      <Text className="font-display font-bold text-pitanga-600">Nenhuma série marcada como feita</Text>
      <Text className="mt-1 text-sm text-muted">
        Toque em ✓ nas séries que você fez para salvar o treino. Se não treinou, descarte para não ficar um treino vazio no histórico.
      </Text>
      <Pressable onPress={onDiscard} className="mt-2">
        <Text className="text-sm font-semibold text-pitanga-600 underline">Descartar treino</Text>
      </Pressable>
    </View>
  );
}

export function WorkoutRunner({
  studentId,
  planId,
  planName,
  kind,
  exercises,
  storageKey,
  backHref,
  selfHref,
  loggedByInstructor = false,
  backdate = null,
}: {
  studentId: string;
  planId: string | null;
  planName: string;
  kind: "ficha" | "livre";
  exercises: RunnerExercise[];
  storageKey: string;
  backHref: string;
  /** Rota desta tela (para "Treino em aberto" retomar). */
  selfHref: string;
  loggedByInstructor?: boolean;
  backdate?: BackdateInfo | null;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resumed, setResumed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [timer, setTimer] = useState<Timer>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyWarn, setEmptyWarn] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [water, setWater] = useState(false);
  const buzzedFor = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void draftStore.get<Draft>(storageKey).then((saved) => {
      if (!alive) return;
      if (saved?.v === 1 && saved.exercises.length === exercises.length) {
        setDraft(saved);
        setResumed(true);
      } else setDraft({ v: 1, clientId: uuid(), startedAt: new Date().toISOString(), exercises: initialExercises(exercises) });
    });
    return () => {
      alive = false;
    };
  }, [storageKey, exercises]);

  useEffect(() => {
    if (draft && !summary) draftStore.set(storageKey, { ...draft, title: planName, href: selfHref });
  }, [draft, storageKey, summary, planName, selfHref]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Tela ligada durante o treino.
  const active = Boolean(draft) && !summary;
  useEffect(() => {
    if (!active || Platform.OS === "web") return;
    void activateKeepAwakeAsync("treino").catch(() => {});
    return () => {
      void deactivateKeepAwake("treino");
    };
  }, [active]);

  const remaining = timer ? (timer.endsAt - now) / 1000 : 0;
  useEffect(() => {
    if (timer && remaining <= 0 && buzzedFor.current !== timer.endsAt) {
      buzzedFor.current = timer.endsAt;
      buzz();
      const id = setTimeout(() => setTimer(null), 3000);
      return () => clearTimeout(id);
    }
  }, [timer, remaining]);

  /** Troca o descanso atual, reagendando o aviso do celular. */
  const replaceTimer = useCallback((next: Timer, label?: string) => {
    setTimer((prev) => {
      void cancelAlarm(prev?.alarm);
      return next;
    });
    if (next) {
      const endsAt = next.endsAt;
      void scheduleAlarm((endsAt - Date.now()) / 1000, "Bora! Próxima série 💪", label ? `Descanso de ${label} terminou.` : "O descanso terminou.").then((alarm) =>
        setTimer((t) => (t && t.endsAt === endsAt ? { ...t, alarm } : (void cancelAlarm(alarm), t))),
      );
    }
  }, []);

  const updateSet = (ei: number, si: number, patch: Partial<SetState>) =>
    setDraft((d) => d && { ...d, exercises: d.exercises.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })) });
  const updateExercise = (ei: number, patch: Partial<ExerciseState>) =>
    setDraft((d) => d && { ...d, exercises: d.exercises.map((ex, i) => (i === ei ? { ...ex, ...patch } : ex)) });

  function markSet(ei: number, si: number, done: boolean) {
    tap();
    const cur = draft?.exercises[ei].sets[si];
    const next = cur?.done === done ? null : done;
    void cancelAlarm(cur?.clock?.alarm);
    updateSet(ei, si, { done: next, clock: undefined });
    if (next === true) setEmptyWarn(false);
    const rest = draft?.exercises[ei].rest ?? 0;
    if (next === true && rest > 0 && !exercises[ei].groupedNext && !backdate) {
      replaceTimer({ endsAt: Date.now() + rest * 1000, total: rest, exercise: ei }, effectiveExercise(exercises[ei], draft?.exercises[ei]).equipment.name);
    }
  }

  function addSet(ei: number) {
    const ex = draft!.exercises[ei];
    const last = ex.sets[ex.sets.length - 1];
    if (ex.sets.length >= 20) return;
    updateExercise(ei, { sets: [...ex.sets, { ...(last ?? { load: "", reps: "" }), clock: undefined, done: null }] });
  }
  function swapExercise(ei: number, opt: SwapOption | null, source: SwapSource = "regras") {
    const base = exercises[ei];
    const next = opt ? { ...base, equipment: opt.equipment, history: opt.history, suggestedLoad: null } : base;
    updateExercise(ei, { swap: opt ? { id: opt.equipment.id, source } : undefined, sets: initialSets(next) });
  }
  function removeSet(ei: number) {
    const ex = draft!.exercises[ei];
    if (ex.sets.length <= 1) return;
    updateExercise(ei, { sets: ex.sets.slice(0, -1) });
  }

  // ─── Cronômetro do cardio ─────────────────────────────────────
  const setAt = (ei: number, si: number) => draft?.exercises[ei]?.sets[si];
  function startClock(ei: number, si: number) {
    tap();
    const s = setAt(ei, si);
    const total = s?.clock?.total ?? Math.round(parseNum(s?.reps ?? "") * 60);
    if (!s || total <= 0) return;
    const left = s.clock?.left ?? total;
    const endsAt = Date.now() + left * 1000;
    updateSet(ei, si, { clock: { total, endsAt } });
    void scheduleAlarm(left, "Cardio concluído ✅", `${effectiveExercise(exercises[ei], draft?.exercises[ei]).equipment.name}: tempo encerrado.`).then((alarm) =>
      setDraft((d) => {
        const c = d?.exercises[ei]?.sets[si]?.clock;
        if (!d || !c || c.endsAt !== endsAt) {
          void cancelAlarm(alarm);
          return d;
        }
        return { ...d, exercises: d.exercises.map((ex, i) => (i !== ei ? ex : { ...ex, sets: ex.sets.map((x, j) => (j === si ? { ...x, clock: { ...c, alarm } } : x)) })) };
      }),
    );
  }
  function pauseClock(ei: number, si: number) {
    const c = setAt(ei, si)?.clock;
    if (!c?.endsAt) return;
    void cancelAlarm(c.alarm);
    updateSet(ei, si, { clock: { total: c.total, left: Math.max(0, (c.endsAt - Date.now()) / 1000) } });
  }
  function stopClock(ei: number, si: number) {
    const c = setAt(ei, si)?.clock;
    if (!c) return;
    void cancelAlarm(c.alarm);
    const left = c.endsAt ? Math.max(0, (c.endsAt - Date.now()) / 1000) : (c.left ?? 0);
    const minutes = Math.max(0.1, Math.round((c.total - left) / 6) / 10);
    updateSet(ei, si, { clock: undefined, done: true, reps: fmtNum(minutes) });
  }
  useEffect(() => {
    draft?.exercises.forEach((ex, ei) =>
      ex.sets.forEach((s, si) => {
        if (s.clock?.endsAt && s.clock.endsAt <= now) {
          updateSet(ei, si, { clock: undefined, done: true });
          buzz();
        }
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- confere a cada "tique" do relógio
  }, [now]);

  const stats = useMemo(() => {
    if (!draft) return { done: 0, total: 0, pending: 0, volume: 0 };
    const all = draft.exercises.flatMap((e) => e.sets);
    return {
      done: all.filter((s) => s.done === true).length,
      total: all.length,
      pending: all.filter((s) => s.done === null).length,
      volume: all.filter((s) => s.done).reduce((acc, s) => acc + parseNum(s.load) * parseNum(s.reps), 0),
    };
  }, [draft]);

  async function finish() {
    if (!draft) return;
    if (stats.done === 0) return setEmptyWarn(true);
    setEmptyWarn(false);
    if (stats.pending > 0 && !(await confirmAsk(`${stats.pending} série(s) sem marcação serão salvas como "não feita". Finalizar?`, { ok: "Finalizar" }))) return;

    const flat = draft.exercises.flatMap((ex, i) => {
      const cardio = isCardioEx(effectiveExercise(exercises[i], ex));
      return ex.sets.map((st) => ({ cardio, done: st.done === true, minutes: cardio ? parseNum(st.reps) : 0 }));
    });
    const win = sessionWindow({ startedAt: draft.startedAt, now: new Date().toISOString(), cardioOnlyMinutes: cardioOnlyMinutes(flat), backdate });
    const payload: SessionPayload = {
      client_id: draft.clientId,
      student_id: studentId,
      plan_id: planId,
      plan_name: planName,
      kind,
      started_at: win.started_at,
      finished_at: win.finished_at,
      exercises: draft.exercises.map((ex, i) => ({
        equipment_id: effectiveExercise(exercises[i], ex).equipment.id,
        sets: ex.sets.map((s) => ({
          ...(isCardioEx(effectiveExercise(exercises[i], ex))
            ? {
                load_kg: 0,
                reps: Math.round(parseNum(s.reps)),
                done: s.done === true,
                duration_min: optNum(s.reps),
                distance_km: optNum(s.km),
                speed_kmh: optNum(s.speed),
                incline_pct: optNum(s.incline),
                level: s.level ? Math.round(parseNum(s.level)) : null,
              }
            : { load_kg: parseNum(s.load), reps: Math.round(parseNum(s.reps)), done: s.done === true }),
          ...(ex.swap && { replaced_equipment_id: exercises[i].equipment.id }),
        })),
      })),
    };
    const base = { duration: (Date.parse(win.finished_at) - Date.parse(win.started_at)) / 1000, doneSets: stats.done, volume: stats.volume };

    setSaving(true);
    setError(null);
    try {
      // Sem internet: fica na fila do aparelho e sobe sozinho quando a conexão voltar.
      const res = await callOrQueue<{ id: string; prs: string[] }>(`Treino ${planName}`, "rpc:save_workout_session", { p: payload });
      if (res.error) return setError(res.error);
      draftStore.remove(storageKey);
      replaceTimer(null);
      void queryClient.invalidateQueries();
      setSummary({
        ...base,
        offline: res.queued,
        sessionId: res.result?.id,
        prs: (res.result?.prs ?? []).map((id) => exercises.find((e) => e.equipment.id === id)?.equipment.name ?? "").filter(Boolean),
      });
    } catch (e) {
      setError((e as Error).message || "Não deu para salvar. Tenta de novo?");
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    if (!(await confirmAsk("Descartar este treino? O que foi marcado será perdido.", { ok: "Descartar", destructive: true }))) return;
    draftStore.remove(storageKey);
    replaceTimer(null);
    router.replace(backHref as never);
  }

  if (summary) return <WorkoutSummary summary={summary} backHref={backHref} canRate={!loggedByInstructor} />;
  if (!draft) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator size="large" /></View>;

  const elapsed = (now - Date.parse(draft.startedAt)) / 1000;

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: insets.top }} className="border-b border-border bg-background">
        <View className="flex-row items-center gap-3 px-4 py-3">
          <View className="min-w-0 flex-1">
            <Text className="font-display text-lg font-bold leading-tight" numberOfLines={1}>
              {planName}
            </Text>
            <Text className="text-xs text-muted">
              {backdate ? `📅 Treino de ${backdate.label}` : `⏱ ${clock(elapsed)}`} · {stats.done}/{stats.total} séries
              {loggedByInstructor ? " · registro do instrutor" : ""}
            </Text>
          </View>
          {!backdate && !loggedByInstructor ? <WaterToggle open={water} onPress={() => setWater((o) => !o)} /> : null}
          <Button size="sm" icon={Check} onPress={finish} loading={saving}>
            Finalizar
          </Button>
        </View>
        {water ? <WaterPanel userId={studentId} onClose={() => setWater(false)} /> : null}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-4" contentContainerStyle={{ paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
        {backdate ? (
          <Alert kind="info" className="mb-4">
            {`Registrando um treino que já aconteceu (${backdate.label}, ${backdate.minutes} min). Marque o que ${loggedByInstructor ? "o aluno" : "você"} fez e finalize.`}
          </Alert>
        ) : null}
        {resumed ? <Alert kind="info" className="mb-4">Treino retomado de onde você parou. 💪</Alert> : null}
        {error ? <Alert className="mb-4">{error}</Alert> : null}
        {emptyWarn ? <EmptyWorkoutWarning onDiscard={discard} /> : null}

        <View className="gap-4">
          {exercises.map((ex, ei) => (
            <ExerciseCard
              key={ex.equipment.id + ei}
              index={ei}
              exercise={effectiveExercise(ex, draft.exercises[ei])}
              original={ex}
              studentId={studentId}
              onSwap={(opt, source) => swapExercise(ei, opt, source)}
              state={draft.exercises[ei]}
              onSet={(si, patch) => updateSet(ei, si, patch)}
              onMark={(si, done) => markSet(ei, si, done)}
              onAdd={() => addSet(ei)}
              onRemove={() => removeSet(ei)}
              onRest={(rest) => updateExercise(ei, { rest })}
              now={now}
              live={!backdate}
              onClock={(si, a) => (a === "start" ? startClock(ei, si) : a === "pause" ? pauseClock(ei, si) : stopClock(ei, si))}
              onUseLoad={(load) => updateExercise(ei, { sets: draft.exercises[ei].sets.map((s) => (s.done === null ? { ...s, load: fmtNum(load) } : s)) })}
            />
          ))}
        </View>

        <View className="mt-8 gap-3">
          {emptyWarn ? <EmptyWorkoutWarning onDiscard={discard} /> : null}
          <Button size="lg" onPress={finish} loading={saving}>
            Finalizar treino
          </Button>
          <Pressable onPress={discard} className="items-center py-2">
            <Text className="text-sm font-semibold text-muted">Descartar treino</Text>
          </Pressable>
        </View>
      </ScrollView>

      {timer ? (
        <RestTimer
          remaining={remaining}
          total={timer.total}
          bottom={insets.bottom}
          label={effectiveExercise(exercises[timer.exercise], draft.exercises[timer.exercise])?.equipment.name}
          onAdjust={(delta) =>
            replaceTimer(
              { ...timer, alarm: null, endsAt: Math.max(Date.now(), timer.endsAt + delta * 1000), total: Math.max(1, timer.total + delta) },
              effectiveExercise(exercises[timer.exercise], draft.exercises[timer.exercise])?.equipment.name,
            )
          }
          onSkip={() => replaceTimer(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function WaterToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel="Registrar água" accessibilityState={{ expanded: open }} className="size-9 items-center justify-center rounded-xl border border-border">
      <Droplets color={t.anil500} size={20} />
    </Pressable>
  );
}

function WaterPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { data: water } = useWaterToday(userId);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = useTheme();
  async function add(ml: number) {
    setPending(true);
    try {
      const r = await callOrQueue<{ ok: boolean; error?: string }>(`Água ${bottleLabel(ml)}`, "agua-actions#addWater", ml);
      if (r.result && !r.result.ok) setMsg(r.result.error ?? "Não deu para registrar.");
      else setMsg(r.queued ? `+${bottleLabel(ml)} guardado; envia quando a internet voltar 💧` : `+${bottleLabel(ml)} registrado 💧`);
      void queryClient.invalidateQueries({ queryKey: ["water", userId] });
    } finally {
      setPending(false);
    }
  }
  return (
    <View className="border-t border-border px-4 py-3">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold">
          Quanto você bebeu?
          {water ? <Text className="text-sm text-muted">{`  Hoje: ${liters(water.totalMl)}${water.goalMl ? ` de ${liters(water.goalMl)}` : ""}`}</Text> : null}
        </Text>
        <Pressable onPress={onClose} accessibilityLabel="Fechar" className="rounded-lg p-1">
          <X color={t.muted} size={16} />
        </Pressable>
      </View>
      <WaterButtons disabled={pending} onAdd={add} />
      {msg ? <Text className="mt-2 text-center text-sm text-muted">{msg}</Text> : null}
    </View>
  );
}

const setInput = "flex-1 rounded-xl border border-border bg-background px-2 py-2.5 text-center text-lg text-foreground";

function NumInput({ value, onChange, label, decimal = true, disabled, className }: { value: string; onChange: (v: string) => void; label: string; decimal?: boolean; disabled?: boolean; className?: string }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      placeholder="0"
      placeholderTextColor={t.muted}
      accessibilityLabel={label}
      selectTextOnFocus
      className={cn(setInput, disabled && "opacity-60", className)}
      style={{ fontFamily: "Inter_600SemiBold" }}
    />
  );
}

function MarkButton({ done, value, onPress, label, wide }: { done: boolean | null; value: boolean; onPress: () => void; label: string; wide?: boolean }) {
  const on = done === value;
  const Icon = value ? Check : X;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      className={cn(
        "h-11 flex-1 flex-row items-center justify-center gap-1 rounded-xl border-2",
        on ? (value ? "border-bandeira-500 bg-bandeira-500" : "border-pitanga-500 bg-pitanga-500") : "border-border",
      )}
    >
      <Icon color={on ? "#fff" : "#8a8a8a"} size={20} />
      {wide ? <Text className={cn("text-sm font-bold", on ? "text-white" : "text-muted")}>{value ? "Feito" : "Não fiz"}</Text> : null}
    </Pressable>
  );
}

function ExerciseCard({
  index,
  exercise,
  original,
  studentId,
  onSwap,
  state,
  onSet,
  onMark,
  onAdd,
  onRemove,
  onRest,
  onUseLoad,
  now,
  live,
  onClock,
}: {
  index: number;
  exercise: RunnerExercise;
  original: RunnerExercise;
  studentId: string;
  onSwap: (opt: SwapOption | null, source?: SwapSource) => void;
  state: ExerciseState;
  onSet: (si: number, patch: Partial<SetState>) => void;
  onMark: (si: number, done: boolean) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRest: (rest: number) => void;
  onUseLoad: (load: number) => void;
  now: number;
  live: boolean;
  onClock: (si: number, action: "start" | "pause" | "stop") => void;
}) {
  const t = useTheme();
  const src = equipmentImageSrc(exercise.equipment);
  const { last, best } = exercise.history;
  const technique = techniqueInfo(exercise.technique);
  const isCardio = exercise.equipment.muscle_group === "cardio";
  const progression = suggestProgression({ lastSets: last?.sets ?? null, targetSets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, cardio: isCardio });
  const usingSuggestion = progression != null && state.sets.every((s) => s.done !== null || parseNum(s.load) === progression.to);
  const allDone = state.sets.every((s) => s.done !== null);

  return (
    <View className={cn("rounded-3xl border bg-surface p-4", allDone ? "border-bandeira-500/60" : "border-border")}>
      <View className="flex-row gap-3">
        {src ? (
          <Image source={src} style={{ width: 80, height: 80, borderRadius: 16 }} contentFit="cover" accessibilityLabel={exercise.equipment.name} />
        ) : (
          <View className="size-20 items-center justify-center rounded-2xl bg-anil-700/5">
            <Text className="text-center text-xs font-semibold text-muted">{groupLabel(exercise.equipment.muscle_group)}</Text>
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text className="font-display text-lg font-bold leading-tight">
            <Text className="font-display text-lg font-bold text-bandeira-600 dark:text-bandeira-100">{index + 1}.</Text> {exercise.equipment.name}
          </Text>
          {last ? (
            <View className="mt-1 flex-row items-start gap-1">
              <History color={t.muted} size={14} style={{ marginTop: 2 }} />
              <Text className="flex-1 text-xs text-muted">
                {`Última vez (${new Date(last.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}): `}
                {isCardio
                  ? last.sets.map((s) => cardioSetLine({ minutes: s.minutes ?? s.reps, km: s.km ?? null, speed: s.speed ?? null, incline: s.incline ?? null, level: s.level ?? null })).join(" | ")
                  : last.sets.map((s) => `${fmtNum(s.load)}kg×${s.reps}`).join(", ")}
              </Text>
            </View>
          ) : (
            <Text className="mt-1 text-xs text-muted">Primeira vez nesse exercício 🚀</Text>
          )}
          {best != null && !isCardio ? (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Trophy color={t.ipe600} size={14} />
              <Text className="text-xs text-muted">Recorde: {formatKg(best)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {exercise.equipment.demo ? <DemoToggle key={exercise.equipment.id} demo={exercise.equipment.demo} name={exercise.equipment.name} /> : null}
      <SwapBar original={original} studentId={studentId} state={state} onSwap={onSwap} />

      {technique || exercise.groupedNext ? (
        <View className="mt-3 rounded-2xl border border-anil-700/20 px-3 py-2">
          <Text className="text-sm">
            {technique ? <Text className="text-sm font-bold">{technique.label}: </Text> : null}
            {technique?.hint}
          </Text>
          {exercise.groupedNext ? <Text className="text-xs font-semibold text-anil-700 dark:text-ipe-400">↳ Sem descanso: siga direto para o próximo exercício.</Text> : null}
        </View>
      ) : null}

      {progression ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-2 rounded-2xl bg-bandeira-50 px-3 py-2 dark:bg-bandeira-500/10">
          <TrendingUp color={t.dark ? t.bandeira100 : t.bandeira600} size={16} />
          <Text className="min-w-0 flex-1 text-sm">
            Você completou tudo com {formatKg(progression.from)} na última vez. Que tal <Text className="text-sm font-bold">{formatKg(progression.to)}</Text>?
          </Text>
          {!usingSuggestion ? (
            <Pressable onPress={() => onUseLoad(progression.to)} className="rounded-xl bg-bandeira-500 px-3 py-1">
              <Text className="text-xs font-bold text-white">Usar {formatKg(progression.to)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {exercise.notes ? (
        <View className="mt-3 rounded-2xl bg-ipe-100 px-3 py-2 dark:bg-ipe-500/15">
          <Text className="text-sm text-anil-900 dark:text-ipe-400">💬 {exercise.notes}</Text>
        </View>
      ) : null}

      {!isCardio ? <WarmupPanel key={exercise.equipment.id} name={exercise.equipment.name} loads={state.sets.map((s) => parseNum(s.load))} /> : null}

      {isCardio ? (
        <View className="mt-3 gap-2">
          {state.sets.map((s, si) => (
            <CardioSetRow
              key={si}
              index={si}
              set={s}
              unit={exercise.equipment.intensity_unit ?? "nivel"}
              onChange={(patch) => onSet(si, patch)}
              onMark={(done) => onMark(si, done)}
              now={now}
              live={live}
              onClock={(a) => onClock(si, a)}
            />
          ))}
        </View>
      ) : (
        <View className="mt-3">
          <View className="flex-row items-center gap-2 px-1">
            <Text className="w-7 text-xs font-semibold text-muted">#</Text>
            <Text className="flex-1 text-xs font-semibold text-muted">Carga (kg)</Text>
            <Text className="flex-1 text-xs font-semibold text-muted">Reps</Text>
            <Text className="w-24 text-center text-xs font-semibold text-muted">Feita?</Text>
          </View>
          <View className="mt-1 gap-2">
            {state.sets.map((s, si) => (
              <View
                key={si}
                className={cn(
                  "flex-row items-center gap-2 rounded-2xl p-1",
                  s.done === true && "bg-bandeira-50 dark:bg-bandeira-500/10",
                  s.done === false && "bg-pitanga-100/60 dark:bg-pitanga-500/10",
                )}
              >
                <Text className="w-7 text-center font-display font-bold text-muted">{si + 1}</Text>
                <NumInput value={s.load} onChange={(v) => onSet(si, { load: v })} label={`Carga da série ${si + 1}`} />
                <NumInput value={s.reps} onChange={(v) => onSet(si, { reps: v })} label={`Repetições da série ${si + 1}`} decimal={false} />
                <View className="w-24 flex-row gap-1">
                  <MarkButton done={s.done} value onPress={() => onMark(si, true)} label={`Série ${si + 1} feita`} />
                  <MarkButton done={s.done} value={false} onPress={() => onMark(si, false)} label={`Série ${si + 1} não feita`} />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row gap-2">
          <Pressable onPress={onRemove} disabled={state.sets.length <= 1} className={cn("flex-row items-center gap-1 rounded-xl border border-border px-3 py-1.5", state.sets.length <= 1 && "opacity-40")}>
            <Minus color={t.muted} size={16} />
            <Text className="text-sm font-semibold text-muted">Série</Text>
          </Pressable>
          <Pressable onPress={onAdd} className="flex-row items-center gap-1 rounded-xl border border-border px-3 py-1.5">
            <Plus color={t.muted} size={16} />
            <Text className="text-sm font-semibold text-muted">Série</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center gap-1">
          <Pause color={t.muted} size={16} />
          <Text className="text-sm text-muted">Descanso</Text>
          <Pressable onPress={() => onRest(Math.max(0, state.rest - 15))} className="rounded-lg px-2 py-1" accessibilityLabel="Diminuir descanso">
            <Text className="font-bold text-muted">−</Text>
          </Pressable>
          <Text className="min-w-12 text-center text-sm font-semibold">{state.rest ? formatRest(state.rest) : "—"}</Text>
          <Pressable onPress={() => onRest(Math.min(900, state.rest + 15))} className="rounded-lg px-2 py-1" accessibilityLabel="Aumentar descanso">
            <Text className="font-bold text-muted">+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function RestTimer({ remaining, total, label, bottom, onAdjust, onSkip }: { remaining: number; total: number; label?: string; bottom: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const ended = remaining <= 0;
  const pct = Math.min(100, Math.max(0, (1 - remaining / total) * 100));
  return (
    <View
      accessibilityRole="timer"
      accessibilityLiveRegion="polite"
      style={{ paddingBottom: bottom + 16, position: "absolute", left: 0, right: 0, bottom: 0 }}
      className={cn("border-t px-4 pt-3", ended ? "border-bandeira-500 bg-bandeira-500" : "border-border bg-anil-700")}
    >
      <View className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/20">
        <View className="h-full rounded-full bg-ipe-500" style={{ width: `${pct}%` }} />
      </View>
      <View className="flex-row items-center gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-xs uppercase tracking-wide text-white/70">{ended ? "Bora! Próxima série" : "Descanso"}</Text>
          <Text className="font-display text-4xl font-extrabold leading-none text-white" style={{ fontVariant: ["tabular-nums"] }}>
            {ended ? "0:00" : clock(Math.ceil(remaining))}
          </Text>
          {label ? <Text className="text-xs text-white/70" numberOfLines={1}>{label}</Text> : null}
        </View>
        {!ended ? (
          <>
            <Pressable onPress={() => onAdjust(-15)} className="rounded-xl bg-white/15 px-3 py-2" accessibilityLabel="Menos 15 segundos">
              <Text className="font-bold text-white">−15</Text>
            </Pressable>
            <Pressable onPress={() => onAdjust(15)} className="rounded-xl bg-white/15 px-3 py-2" accessibilityLabel="Mais 15 segundos">
              <Text className="font-bold text-white">+15</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={onSkip} className="rounded-xl bg-ipe-500 px-3 py-2" accessibilityLabel={ended ? "Fechar" : "Pular descanso"}>
          {ended ? <X color="#0b2a5b" size={20} /> : <SkipForward color="#0b2a5b" size={20} />}
        </Pressable>
      </View>
    </View>
  );
}

function WorkoutSummary({ summary, backHref, canRate }: { summary: Summary; backHref: string; canRate: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-5 px-4" contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }}>
      <Text className="text-center text-6xl">{summary.prs.length ? "🏆" : "✅"}</Text>
      <Text className="text-center font-display text-4xl font-extrabold">Tá pago!</Text>
      {summary.offline ? (
        <Alert kind="info">
          <View className="flex-row items-center gap-1">
            <CloudOff color={t.dark ? t.ipe400 : t.anil900} size={16} />
            <Text className="text-sm font-semibold text-anil-900 dark:text-ipe-400">Sem internet agora.</Text>
          </View>
          <Text className="text-sm text-anil-900 dark:text-ipe-400">O treino ficou salvo no aparelho e será enviado automaticamente quando a conexão voltar.</Text>
        </Alert>
      ) : (
        <Text className="text-center text-muted">Treino salvo. Mandou bem!</Text>
      )}
      <View className="flex-row gap-3">
        {[
          { label: "Duração", value: clock(summary.duration) },
          { label: "Séries feitas", value: String(summary.doneSets) },
          { label: "Volume", value: `${fmtNum(Math.round(summary.volume))} kg` },
        ].map((s) => (
          <View key={s.label} className="flex-1 items-center rounded-3xl border border-border bg-surface p-3">
            <Text className="font-display text-xl font-extrabold">{s.value}</Text>
            <Text className="text-xs text-muted">{s.label}</Text>
          </View>
        ))}
      </View>
      {summary.prs.length ? (
        <View className="rounded-3xl bg-ipe-500 p-4">
          <View className="flex-row items-center gap-2">
            <Trophy color="#0b2a5b" size={20} />
            <Text className="font-display text-lg font-bold text-anil-900">Novo recorde pessoal!</Text>
          </View>
          {summary.prs.map((n) => (
            <Text key={n} className="mt-1 text-sm text-anil-900">• {n}</Text>
          ))}
        </View>
      ) : null}
      {canRate && summary.sessionId ? <SessionRating sessionId={summary.sessionId} /> : null}
      <Button size="lg" onPress={() => router.replace(backHref as never)}>
        Voltar
      </Button>
    </ScrollView>
  );
}

/** "Como foi o treino?": esforço 1–5, dor e comentário para o Personal. */
export function SessionRating({ sessionId, initial }: { sessionId: string; initial?: { effort: number | null; pain: boolean; feedback: string | null } }) {
  const [effort, setEffort] = useState<number | null>(initial?.effort ?? null);
  const [pain, setPain] = useState(initial?.pain ?? false);
  const [feedback, setFeedback] = useState(initial?.feedback ?? "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = useTheme();
  if (sent) return <Alert kind="success">{`Avaliação enviada. Obrigado! ${pain ? "Seu Personal foi avisado sobre a dor." : ""}`}</Alert>;
  async function send() {
    if (!effort) return setError("Escolha uma nota de esforço.");
    setError(null);
    setPending(true);
    const r = await callOrQueue("Avaliação do treino", "rpc:rate_workout_session", {
      p_session: sessionId,
      p_effort: effort,
      p_pain: pain,
      p_feedback: feedback.trim().slice(0, 500) || null,
    }).catch(() => ({ error: "Não deu para enviar." }));
    setPending(false);
    if (r.error) setError(r.error);
    else {
      setSent(true);
      void queryClient.invalidateQueries();
    }
  }
  return (
    <View className="gap-3 rounded-3xl border border-border bg-surface p-4">
      <Text className="font-display text-lg font-bold">Como foi o treino?</Text>
      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        {EFFORT.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => setEffort(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: effort === o.value }}
            className={cn("flex-1 items-center rounded-2xl border-2 px-1 py-2", effort === o.value ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/15" : "border-border")}
          >
            <Text className="text-2xl">{o.emoji}</Text>
            <Text className="text-center text-[11px] font-semibold">{o.label}</Text>
          </Pressable>
        ))}
      </View>
      <Checkbox checked={pain} onChange={setPain}>
        Senti dor ou desconforto
      </Checkbox>
      <TextInput
        value={feedback}
        onChangeText={setFeedback}
        maxLength={500}
        multiline
        numberOfLines={2}
        placeholder={pain ? "Onde doeu? Em qual exercício?" : "Comentário para o Personal (opcional)"}
        placeholderTextColor={t.muted}
        className={inputClass}
        style={{ fontFamily: "Inter_400Regular", minHeight: 64, textAlignVertical: "top" }}
      />
      {error ? <Alert>{error}</Alert> : null}
      <Button onPress={send} loading={pending}>
        Enviar avaliação
      </Button>
    </View>
  );
}

function CardioSetRow({
  index,
  set,
  unit,
  onChange,
  onMark,
  now,
  live,
  onClock,
}: {
  index: number;
  set: SetState;
  unit: IntensityUnit;
  onChange: (patch: Partial<SetState>) => void;
  onMark: (done: boolean) => void;
  now: number;
  live: boolean;
  onClock: (action: "start" | "pause" | "stop") => void;
}) {
  const planned = Math.round(parseNum(set.reps) * 60);
  const c = set.clock;
  const left = c ? (c.endsAt ? Math.max(0, (c.endsAt - now) / 1000) : (c.left ?? c.total)) : planned;
  const fields: { key: "reps" | "km" | "speed" | "incline" | "level"; label: string; decimal: boolean }[] = [
    { key: "reps", label: "Tempo (min)", decimal: true },
    { key: "km", label: "Distância (km)", decimal: true },
    ...(unit === "velocidade"
      ? [
          { key: "speed" as const, label: "Velocidade (km/h)", decimal: true },
          { key: "incline" as const, label: "Inclinação (%)", decimal: true },
        ]
      : [{ key: "level" as const, label: "Nível", decimal: false }]),
  ];
  return (
    <View
      className={cn(
        "rounded-2xl border border-border p-2",
        set.done === true && "border-bandeira-500/60 bg-bandeira-50 dark:bg-bandeira-500/10",
        set.done === false && "bg-pitanga-100/60 dark:bg-pitanga-500/10",
      )}
    >
      <View className="flex-row flex-wrap gap-2">
        {fields.map((f) => (
          <View key={f.key} style={{ width: "48%" }}>
            <Text className="mb-1 text-xs font-semibold text-muted">{f.label}</Text>
            <View className="flex-row">
              <NumInput value={set[f.key] ?? ""} onChange={(v) => onChange({ [f.key]: v })} label={`${f.label} da série ${index + 1}`} decimal={f.decimal} disabled={f.key === "reps" && !!c} />
            </View>
          </View>
        ))}
      </View>
      {live && set.done === null && planned > 0 ? (
        <View accessibilityRole="timer" className={cn("mt-2 flex-row items-center gap-2 rounded-2xl p-2", c?.endsAt ? "bg-anil-700" : "bg-anil-700/5 dark:bg-white/5")}>
          <View className="min-w-0 flex-1 pl-1">
            <Text className={cn("text-[11px] font-semibold", c?.endsAt ? "text-white/80" : "text-muted")}>{c ? (c.endsAt ? "Faltam" : "Pausado") : "Cronômetro"}</Text>
            <Text className={cn("font-display text-3xl font-extrabold leading-none", c?.endsAt && "text-white")}>{clock(left)}</Text>
          </View>
          {c?.endsAt ? (
            <Pressable onPress={() => onClock("pause")} className="h-11 flex-row items-center gap-1 rounded-xl bg-white/15 px-3">
              <Pause color="#fff" size={16} />
              <Text className="text-sm font-bold text-white">Pausar</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => onClock("start")} className="h-11 flex-row items-center gap-1 rounded-xl bg-bandeira-500 px-3">
              <Play color="#fff" fill="#fff" size={16} />
              <Text className="text-sm font-bold text-white">{c ? "Retomar" : "Iniciar"}</Text>
            </Pressable>
          )}
          {c ? (
            <Pressable onPress={() => onClock("stop")} className={cn("h-11 flex-row items-center gap-1 rounded-xl px-3", c.endsAt ? "bg-ipe-500" : "border-2 border-border")}>
              <Check color={c.endsAt ? "#0b2a5b" : "#8a8a8a"} size={16} />
              <Text className={cn("text-sm font-bold", c.endsAt && "text-anil-900")}>Concluir</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View className="mt-2 flex-row gap-2">
        <MarkButton done={set.done} value onPress={() => onMark(true)} label={`Série ${index + 1} feita`} wide />
        <MarkButton done={set.done} value={false} onPress={() => onMark(false)} label={`Série ${index + 1} não feita`} wide />
      </View>
    </View>
  );
}

function WarmupPanel({ name, loads }: { name: string; loads: number[] }) {
  const [status, setStatus] = useState<"aberto" | "feito" | "pulado">("aberto");
  const [done, setDone] = useState<boolean[]>([]);
  const sets = warmupSets(Math.max(0, ...loads), guessBar(name));
  if (!sets.length) return null;
  function toggle(i: number) {
    tap();
    const next = sets.map((_, k) => (k === i ? !done[k] : !!done[k]));
    setDone(next);
    if (next.every(Boolean)) setStatus("feito");
  }
  return (
    <View className="mt-3 rounded-2xl border border-dashed border-ipe-500/70 bg-ipe-100/40 p-3 dark:bg-ipe-500/10">
      {status === "aberto" ? (
        <>
          <View className="mb-2 flex-row items-center justify-between gap-2">
            <Text className="text-sm font-bold">
              🔥 Aquecimento <Text className="text-sm text-muted">(opcional)</Text>
            </Text>
            <Pressable onPress={() => setStatus("pulado")} className="rounded-lg px-2 py-1">
              <Text className="text-xs font-semibold text-muted">Pular</Text>
            </Pressable>
          </View>
          <View className="gap-1.5">
            {sets.map((w, i) => (
              <View key={i} className="flex-row items-center gap-2">
                <Text className="w-5 text-center font-display font-bold text-muted">{i + 1}</Text>
                <Text className="flex-1 text-sm font-semibold">
                  {fmtNum(w.load)} kg × {w.reps}
                </Text>
                <Pressable
                  onPress={() => toggle(i)}
                  accessibilityLabel={`Aquecimento ${i + 1} feito`}
                  accessibilityState={{ selected: !!done[i] }}
                  className={cn("h-9 w-12 items-center justify-center rounded-xl border-2", done[i] ? "border-bandeira-500 bg-bandeira-500" : "border-border")}
                >
                  <Check color={done[i] ? "#fff" : "#8a8a8a"} size={16} />
                </Pressable>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-sm text-muted">{status === "feito" ? "🔥 Aquecimento feito ✓" : "🔥 Aquecimento pulado"}</Text>
          <Pressable
            onPress={() => {
              setStatus("aberto");
              setDone([]);
            }}
            className="rounded-lg px-2 py-1"
          >
            <Text className="text-xs font-semibold text-muted">Mostrar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const SOURCE_LABEL: Record<SwapSource, string> = {
  personal: "Indicado pelo seu Personal",
  ia: "Sugestão da IA",
  regras: "Exercícios parecidos do mesmo grupo",
};

function SwapBar({ original, studentId, state, onSwap }: { original: RunnerExercise; studentId: string; state: ExerciseState; onSwap: (opt: SwapOption | null, source?: SwapSource) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<{ options: SwapOption[]; source: SwapSource; reason: string | null } | null>(null);
  const started = state.sets.some((x) => x.done !== null);

  if (state.swap) {
    return (
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 rounded-2xl bg-anil-700/5 px-3 py-2 dark:bg-white/5">
        <Text className="flex-1 text-sm">
          🔁 No lugar de <Text className="text-sm font-bold">{original.equipment.name}</Text> (aparelho ocupado)
        </Text>
        {!started ? (
          <Pressable onPress={() => onSwap(null)}>
            <Text className="text-xs font-semibold text-muted">Desfazer</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (started || (!original.substitute && !original.alternatives?.length)) return null;

  async function openPanel() {
    setOpen(true);
    if (picks) return;
    if (original.substitute) return setPicks({ options: [original.substitute], source: "personal", reason: null });
    const alts = original.alternatives ?? [];
    const fallback = { options: alts.slice(0, 2), source: "regras" as SwapSource, reason: null };
    setLoading(true);
    try {
      const r = await callAction<{ ids: string[]; reason: string | null }>("treino-actions#suggestSubstitutes", {
        studentId,
        original: { id: original.equipment.id, name: original.equipment.name, muscle_group: original.equipment.muscle_group },
        candidates: alts.map((o) => ({ id: o.equipment.id, name: o.equipment.name, muscle_group: o.equipment.muscle_group })),
      });
      const options = (r.result?.ids ?? []).map((id) => alts.find((o) => o.equipment.id === id)).filter((o): o is SwapOption => !!o);
      setPicks(options.length ? { options, source: "ia", reason: r.result?.reason ?? null } : fallback);
    } catch {
      setPicks(fallback);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={openPanel} className="mt-3 self-start rounded-xl border border-border px-3 py-1.5">
        <Text className="text-xs font-semibold text-muted">🔁 Aparelho ocupado?</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-3 rounded-2xl border border-anil-700/30 p-3">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text className="text-sm font-bold">🔁 Trocar por</Text>
        <Pressable onPress={() => setOpen(false)}>
          <Text className="text-xs font-semibold text-muted">Fechar</Text>
        </Pressable>
      </View>
      {loading || !picks ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-muted">Buscando exercícios parecidos…</Text>
        </View>
      ) : (
        <>
          <Text className="mb-2 text-xs text-muted">
            {SOURCE_LABEL[picks.source]}
            {picks.reason ? ` · ${picks.reason}` : ""}
          </Text>
          <View className="gap-2">
            {picks.options.map((o) => (
              <View key={o.equipment.id} className="flex-row items-center gap-2">
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold leading-tight">{o.equipment.name}</Text>
                  {o.history.last ? (
                    <Text className="text-xs text-muted">
                      Última vez: {o.history.last.sets.map((x) => `${fmtNum(x.load)}kg×${x.reps}`).slice(0, 3).join(", ")}
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={() => onSwap(o, picks.source)} className="rounded-xl bg-bandeira-500 px-3 py-1.5">
                  <Text className="text-xs font-bold text-white">Trocar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** GIF ou vídeo curto da execução (aprovado pelo admin). */
export function MediaPreview({ url, kind, label }: { url: string; kind: "gif" | "video"; label: string }) {
  if (kind === "gif") return <Image source={url} style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }} contentFit="contain" accessibilityLabel={label} />;
  return <VideoPreview url={url} />;
}
function VideoPreview({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }} contentFit="contain" nativeControls={false} />;
}

function DemoToggle({ demo, name }: { demo: { url: string; kind: "gif" | "video" }; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View className="mt-3">
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityState={{ expanded: open }} className="self-start rounded-xl border border-border px-3 py-1.5">
        <Text className="text-xs font-semibold text-muted">{open ? "Fechar execução" : "▶ Ver execução"}</Text>
      </Pressable>
      {open ? (
        <View className="mt-2 max-w-sm">
          <MediaPreview url={demo.url} kind={demo.kind} label={`Execução de ${name}`} />
        </View>
      ) : null}
    </View>
  );
}

