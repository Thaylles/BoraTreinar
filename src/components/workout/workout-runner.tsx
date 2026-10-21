"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CloudOff,
  History,
  Loader2,
  Minus,
  Pause,
  Plus,
  SkipForward,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { equipmentImageSrc, groupLabel, type MuscleGroup } from "@/lib/catalog";
import { MediaPreview } from "@/components/exercise-media/media-preview";
import { formatRest, formatKg, techniqueInfo, type Technique } from "@/lib/plans";
import { suggestProgression } from "@/lib/progression";
import { draftStore, outbox, type SessionPayload } from "@/lib/outbox";
import type { ExerciseHistoryInfo } from "@/lib/history-server";
import { saveSession, suggestSubstitutes } from "@/app/treino-actions";
import { SessionRating } from "@/components/workout/session-rating";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { cardioSetLine, type IntensityUnit } from "@/lib/cardio";
import { BARS, guessBar, platesFor, platesLabel, warmupSets } from "@/lib/plates";

export type RunnerExercise = {
  equipment: {
    id: string;
    name: string;
    muscle_group: MuscleGroup;
    image_path: string | null;
    image_url: string | null;
    is_bodyweight: boolean;
    /** Cardio: velocidade/inclinação (esteira) ou nível (bicicleta, elíptico). */
    intensity_unit?: IntensityUnit | null;
    /** Execução aprovada pelo admin (GIF ou vídeo curto). */
    demo?: { url: string; kind: "gif" | "video" } | null;
  };
  notes: string | null;
  restSeconds: number;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  suggestedLoad: number | null;
  history: ExerciseHistoryInfo;
  /** Técnica avançada da ficha (bi-set, drop-set…). */
  technique?: Technique | null;
  /** Quantos exercícios seguintes fazem parte do mesmo bi-set/tri-set (sem descanso até lá). */
  groupedNext?: number;
  /** Substituto indicado pelo Personal para quando o aparelho estiver ocupado. */
  substitute?: SwapOption | null;
  /** Sem substituto do Personal: candidatos do mesmo grupo (a IA escolhe 1–2 na hora). */
  alternatives?: SwapOption[];
};

/** Exercício para troca, já com o histórico do aluno nele. */
export type SwapOption = { equipment: RunnerExercise["equipment"]; history: ExerciseHistoryInfo };
type SwapSource = "personal" | "ia" | "regras";

/** No cardio, `reps` guarda os minutos; os demais campos são do painel do aparelho. */
type SetState = { load: string; reps: string; done: boolean | null; km?: string; speed?: string; incline?: string; level?: string };
/** `swap`: exercício feito no lugar do da ficha (aparelho ocupado). */
type ExerciseState = { rest: number; sets: SetState[]; swap?: { id: string; source: SwapSource } };
type Draft = { v: 1; clientId: string; startedAt: string; exercises: ExerciseState[] };
type Timer = { endsAt: number; total: number; exercise: number } | null;
type Summary = { duration: number; doneSets: number; volume: number; prs: string[]; offline: boolean; sessionId?: string };

const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const parseNum = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const optNum = (s: string | undefined) => (s == null || s.trim() === "" ? null : parseNum(s));
const str = (n: number | null | undefined) => (n == null ? "" : fmtNum(n));
const isCardioEx = (ex: RunnerExercise) => ex.equipment.muscle_group === "cardio";

const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

function initialExercises(list: RunnerExercise[]): ExerciseState[] {
  return list.map((ex) => ({ rest: ex.restSeconds, sets: initialSets(ex) }));
}

/** O exercício que vale agora: o da ficha ou o escolhido na troca. */
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
          return {
            load: "0",
            reps: minutes == null ? "" : fmtNum(minutes),
            km: str(prev?.km),
            speed: str(prev?.speed),
            incline: str(prev?.incline),
            level: str(prev?.level),
            done: null,
          };
        }
        const load = prev?.load ?? ex.suggestedLoad ?? (ex.equipment.is_bodyweight ? 0 : null);
        const reps = ex.repsMin ?? prev?.reps ?? null;
        return { load: load == null ? "" : fmtNum(load), reps: reps == null ? "" : String(reps), done: null };
    });
}

/** Bipe curto via Web Audio (o AudioContext é criado num toque do usuário). */
function useBeeper() {
  const ctx = useRef<AudioContext | null>(null);
  const unlock = useCallback(() => {
    if (!ctx.current && typeof window !== "undefined" && "AudioContext" in window) {
      ctx.current = new AudioContext();
    }
    void ctx.current?.resume();
  }, []);
  const beep = useCallback(() => {
    const ac = ctx.current;
    if (ac) {
      [0, 0.25, 0.5].forEach((t, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = i === 2 ? 1320 : 880;
        gain.gain.setValueAtTime(0.0001, ac.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.2);
        osc.connect(gain).connect(ac.destination);
        osc.start(ac.currentTime + t);
        osc.stop(ac.currentTime + t + 0.22);
      });
    }
    navigator.vibrate?.([300, 120, 300, 120, 500]);
  }, []);
  return { unlock, beep };
}

/** Mantém a tela ligada durante o treino (Screen Wake Lock API). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* sem permissão / bateria fraca */
      }
    };
    const onVisible = () => document.visibilityState === "visible" && request();
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

export function WorkoutRunner({
  studentId,
  planId,
  planName,
  kind,
  exercises,
  storageKey,
  backHref,
  loggedByInstructor = false,
}: {
  studentId: string;
  planId: string | null;
  planName: string;
  kind: "ficha" | "livre";
  exercises: RunnerExercise[];
  storageKey: string;
  backHref: string;
  loggedByInstructor?: boolean;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resumed, setResumed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [timer, setTimer] = useState<Timer>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const { unlock, beep } = useBeeper();
  const beepedFor = useRef<number | null>(null);

  // Carrega o rascunho (se o treino foi interrompido) ou começa um novo.
  useEffect(() => {
    const saved = draftStore.get<Draft>(storageKey);
    if (saved?.v === 1 && saved.exercises.length === exercises.length) {
      setDraft(saved);
      setResumed(true);
    } else {
      setDraft({ v: 1, clientId: crypto.randomUUID(), startedAt: new Date().toISOString(), exercises: initialExercises(exercises) });
    }
  }, [storageKey, exercises]);

  useEffect(() => {
    if (draft && !summary) draftStore.set(storageKey, draft);
  }, [draft, storageKey, summary]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useWakeLock(Boolean(draft) && !summary);

  // Fim do descanso: som + vibração, uma vez por timer.
  const remaining = timer ? (timer.endsAt - now) / 1000 : 0;
  useEffect(() => {
    if (timer && remaining <= 0 && beepedFor.current !== timer.endsAt) {
      beepedFor.current = timer.endsAt;
      beep();
      const id = setTimeout(() => setTimer(null), 3000);
      return () => clearTimeout(id);
    }
  }, [timer, remaining, beep]);

  const updateSet = (ei: number, si: number, patch: Partial<SetState>) =>
    setDraft((d) =>
      d && {
        ...d,
        exercises: d.exercises.map((ex, i) =>
          i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) },
        ),
      },
    );
  const updateExercise = (ei: number, patch: Partial<ExerciseState>) =>
    setDraft((d) => d && { ...d, exercises: d.exercises.map((ex, i) => (i === ei ? { ...ex, ...patch } : ex)) });

  function markSet(ei: number, si: number, done: boolean) {
    unlock();
    const current = draft?.exercises[ei].sets[si].done;
    const next = current === done ? null : done;
    updateSet(ei, si, { done: next });
    const rest = draft?.exercises[ei].rest ?? 0;
    // Bi-set/tri-set: o descanso vem só depois do último exercício do grupo.
    if (next === true && rest > 0 && !exercises[ei].groupedNext) {
      setTimer({ endsAt: Date.now() + rest * 1000, total: rest, exercise: ei });
    }
  }

  function addSet(ei: number) {
    const ex = draft!.exercises[ei];
    const last = ex.sets[ex.sets.length - 1];
    if (ex.sets.length >= 20) return;
    updateExercise(ei, { sets: [...ex.sets, { ...(last ?? { load: "", reps: "" }), done: null }] });
  }
  /** Aparelho ocupado: troca o exercício (séries recomeçam com o histórico do novo) ou desfaz. */
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
    if (stats.done === 0 && !confirm("Nenhuma série marcada como feita. Salvar mesmo assim?")) return;
    if (stats.pending > 0 && stats.done > 0 && !confirm(`${stats.pending} série(s) sem marcação serão salvas como "não feita". Finalizar?`)) return;

    const finishedAt = new Date().toISOString();
    const payload: SessionPayload = {
      client_id: draft.clientId,
      student_id: studentId,
      plan_id: planId,
      plan_name: planName,
      kind,
      started_at: draft.startedAt,
      finished_at: finishedAt,
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
    const base = {
      duration: (Date.parse(finishedAt) - Date.parse(draft.startedAt)) / 1000,
      doneSets: stats.done,
      volume: stats.volume,
    };

    setSaving(true);
    setError(null);
    try {
      const res = await saveSession(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      draftStore.remove(storageKey);
      setTimer(null);
      setSummary({
        ...base,
        offline: false,
        sessionId: res.id,
        prs: res.prs.map((id) => exercises.find((e) => e.equipment.id === id)?.equipment.name ?? "").filter(Boolean),
      });
    } catch {
      // Sem internet: guarda no aparelho e sincroniza depois.
      outbox.add(payload);
      draftStore.remove(storageKey);
      setTimer(null);
      setSummary({ ...base, offline: true, prs: [] });
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!confirm("Descartar este treino? O que foi marcado será perdido.")) return;
    draftStore.remove(storageKey);
    window.location.href = backHref;
  }

  if (summary) return <WorkoutSummary summary={summary} backHref={backHref} canRate={!loggedByInstructor} />;
  if (!draft) {
    return (
      <div className="flex justify-center py-20 text-muted">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando treino" />
      </div>
    );
  }

  const elapsed = (now - Date.parse(draft.startedAt)) / 1000;

  return (
    <div className="pb-40">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:top-[57px]">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold leading-tight">{planName}</p>
          <p className="text-xs text-muted">
            ⏱ {clock(elapsed)} · {stats.done}/{stats.total} séries
            {loggedByInstructor && " · registro do instrutor"}
          </p>
        </div>
        <Button onClick={finish} disabled={saving} size="sm">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
          Finalizar
        </Button>
      </div>

      {resumed && (
        <Alert kind="info" className="mb-4">
          Treino retomado de onde você parou. 💪
        </Alert>
      )}
      {error && <Alert className="mb-4">{error}</Alert>}

      <ol className="space-y-4">
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
            onUseLoad={(load) =>
              updateExercise(ei, {
                sets: draft.exercises[ei].sets.map((s) => (s.done === null ? { ...s, load: fmtNum(load) } : s)),
              })
            }
          />
        ))}
      </ol>

      <div className="mt-8 flex flex-col gap-3">
        <Button size="lg" onClick={finish} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Finalizar treino
        </Button>
        <button type="button" onClick={discard} className="text-sm font-semibold text-muted hover:text-pitanga-600">
          Descartar treino
        </button>
      </div>

      {timer && (
        <RestTimer
          remaining={remaining}
          total={timer.total}
          label={exercises[timer.exercise]?.equipment.name}
          onAdjust={(delta) => setTimer((t) => t && { ...t, endsAt: Math.max(Date.now(), t.endsAt + delta * 1000), total: Math.max(1, t.total + delta) })}
          onSkip={() => setTimer(null)}
        />
      )}
    </div>
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
}: {
  index: number;
  exercise: RunnerExercise;
  /** O exercício da ficha (antes de qualquer troca). */
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
}) {
  const src = equipmentImageSrc(exercise.equipment);
  const { last, best } = exercise.history;
  const technique = techniqueInfo(exercise.technique);
  const progression = suggestProgression({
    lastSets: last?.sets ?? null,
    targetSets: exercise.targetSets,
    repsMin: exercise.repsMin,
    repsMax: exercise.repsMax,
    cardio: exercise.equipment.muscle_group === "cardio",
  });
  const usingSuggestion = progression != null && state.sets.every((s) => s.done !== null || parseNum(s.load) === progression.to);
  const allDone = state.sets.every((s) => s.done !== null);
  const isCardio = exercise.equipment.muscle_group === "cardio";

  return (
    <li className={cn("rounded-3xl border bg-surface p-4 transition", allDone ? "border-bandeira-500/60" : "border-border")}>
      <div className="flex gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do equipamento
          <img src={src} alt={exercise.equipment.name} className="size-20 shrink-0 rounded-2xl bg-ipe-100 object-cover" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-anil-700/5 text-center text-xs font-semibold text-muted">
            {groupLabel(exercise.equipment.muscle_group)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">
            <span className="text-bandeira-600 dark:text-bandeira-100">{index + 1}.</span> {exercise.equipment.name}
          </p>
          {last ? (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted">
              <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Última vez ({new Date(last.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}):{" "}
                {isCardio
                  ? last.sets.map((s) => cardioSetLine({ minutes: s.minutes ?? s.reps, km: s.km ?? null, speed: s.speed ?? null, incline: s.incline ?? null, level: s.level ?? null })).join(" | ")
                  : last.sets.map((s) => `${fmtNum(s.load)}kg×${s.reps}`).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Primeira vez nesse exercício 🚀</p>
          )}
          {best != null && !isCardio && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Trophy className="size-3.5 text-ipe-600" aria-hidden /> Recorde: {formatKg(best)}
            </p>
          )}
        </div>
      </div>
      {exercise.equipment.demo && <DemoToggle key={exercise.equipment.id} demo={exercise.equipment.demo} name={exercise.equipment.name} />}

      <SwapBar original={original} studentId={studentId} state={state} onSwap={onSwap} />

      {(technique || !!exercise.groupedNext) && (
        <p className="mt-3 rounded-2xl border border-anil-700/20 px-3 py-2 text-sm">
          {technique && <strong className="mr-1">{technique.label}:</strong>}
          {technique?.hint}
          {!!exercise.groupedNext && (
            <span className="block text-xs font-semibold text-anil-700 dark:text-ipe-400">
              ↳ Sem descanso: siga direto para o próximo exercício.
            </span>
          )}
        </p>
      )}

      {progression && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-bandeira-50 px-3 py-2 text-sm dark:bg-bandeira-500/10">
          <TrendingUp className="size-4 shrink-0 text-bandeira-600 dark:text-bandeira-100" aria-hidden />
          <span className="min-w-0 flex-1">
            Você completou tudo com {formatKg(progression.from)} na última vez. Que tal <strong>{formatKg(progression.to)}</strong>?
          </span>
          {!usingSuggestion && (
            <button
              type="button"
              onClick={() => onUseLoad(progression.to)}
              className="rounded-xl bg-bandeira-500 px-3 py-1 text-xs font-bold text-white hover:bg-bandeira-600"
            >
              Usar {formatKg(progression.to)}
            </button>
          )}
        </div>
      )}

      {exercise.notes && (
        <p className="mt-3 rounded-2xl bg-ipe-100 px-3 py-2 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
          💬 {exercise.notes}
        </p>
      )}

      {!isCardio && (
        <WarmupPanel
          equipmentId={exercise.equipment.id}
          name={exercise.equipment.name}
          loads={state.sets.map((s) => parseNum(s.load))}
        />
      )}

      {isCardio ? (
        <ul className="mt-3 space-y-2">
          {state.sets.map((s, si) => (
            <CardioSetRow
              key={si}
              index={si}
              set={s}
              unit={exercise.equipment.intensity_unit ?? "nivel"}
              onChange={(patch) => onSet(si, patch)}
              onMark={(done) => onMark(si, done)}
            />
          ))}
        </ul>
      ) : (
      <div className="mt-3">
        <div className="grid grid-cols-[1.75rem_1fr_1fr_5.5rem] items-center gap-2 px-1 text-xs font-semibold text-muted">
          <span>#</span>
          <span>Carga (kg)</span>
          <span>{isCardio ? "Minutos" : "Reps"}</span>
          <span className="text-center">Feita?</span>
        </div>
        <ul className="mt-1 space-y-2">
          {state.sets.map((s, si) => (
            <li
              key={si}
              className={cn(
                "grid grid-cols-[1.75rem_1fr_1fr_5.5rem] items-center gap-2 rounded-2xl p-1 transition",
                s.done === true && "bg-bandeira-50 dark:bg-bandeira-500/10",
                s.done === false && "bg-pitanga-100/60 dark:bg-pitanga-500/10",
              )}
            >
              <span className="text-center font-display font-bold text-muted">{si + 1}</span>
              <input
                inputMode="decimal"
                value={s.load}
                onChange={(e) => onSet(si, { load: e.target.value })}
                placeholder="0"
                aria-label={`Carga da série ${si + 1}`}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg font-semibold outline-none focus:border-bandeira-500"
              />
              <input
                inputMode="numeric"
                value={s.reps}
                onChange={(e) => onSet(si, { reps: e.target.value })}
                placeholder="0"
                aria-label={`Repetições da série ${si + 1}`}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg font-semibold outline-none focus:border-bandeira-500"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => onMark(si, true)}
                  aria-pressed={s.done === true}
                  aria-label={`Série ${si + 1} feita`}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center rounded-xl border-2 transition",
                    s.done === true ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border text-muted",
                  )}
                >
                  <Check className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onMark(si, false)}
                  aria-pressed={s.done === false}
                  aria-label={`Série ${si + 1} não feita`}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center rounded-xl border-2 transition",
                    s.done === false ? "border-pitanga-500 bg-pitanga-500 text-white" : "border-border text-muted",
                  )}
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={onRemove} disabled={state.sets.length <= 1} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-muted disabled:opacity-40">
            <Minus className="size-4" aria-hidden /> Série
          </button>
          <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-muted">
            <Plus className="size-4" aria-hidden /> Série
          </button>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Pause className="size-4 text-muted" aria-hidden />
          <span className="text-muted">Descanso</span>
          <button type="button" onClick={() => onRest(Math.max(0, state.rest - 15))} className="rounded-lg px-2 py-1 font-bold text-muted hover:bg-border/50" aria-label="Diminuir descanso">
            −
          </button>
          <span className="min-w-12 text-center font-semibold">{state.rest ? formatRest(state.rest) : "—"}</span>
          <button type="button" onClick={() => onRest(Math.min(900, state.rest + 15))} className="rounded-lg px-2 py-1 font-bold text-muted hover:bg-border/50" aria-label="Aumentar descanso">
            +
          </button>
        </div>
      </div>
    </li>
  );
}

function RestTimer({
  remaining,
  total,
  label,
  onAdjust,
  onSkip,
}: {
  remaining: number;
  total: number;
  label?: string;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
}) {
  const ended = remaining <= 0;
  const pct = Math.min(100, Math.max(0, (1 - remaining / total) * 100));
  return (
    <div
      role="timer"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-2xl",
        ended ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border bg-anil-700 text-white",
      )}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-ipe-500 transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-white/70">{ended ? "Bora! Próxima série" : "Descanso"}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums leading-none">{ended ? "0:00" : clock(Math.ceil(remaining))}</p>
            {label && <p className="truncate text-xs text-white/70">{label}</p>}
          </div>
          {!ended && (
            <>
              <button type="button" onClick={() => onAdjust(-15)} className="rounded-xl bg-white/15 px-3 py-2 font-bold" aria-label="Menos 15 segundos">
                −15
              </button>
              <button type="button" onClick={() => onAdjust(15)} className="rounded-xl bg-white/15 px-3 py-2 font-bold" aria-label="Mais 15 segundos">
                +15
              </button>
            </>
          )}
          <button type="button" onClick={onSkip} className="rounded-xl bg-ipe-500 px-3 py-2 font-bold text-anil-900" aria-label={ended ? "Fechar" : "Pular descanso"}>
            {ended ? <X className="size-5" aria-hidden /> : <SkipForward className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkoutSummary({ summary, backHref, canRate }: { summary: Summary; backHref: string; canRate: boolean }) {
  return (
    <div className="space-y-5 py-6 text-center">
      <p className="text-6xl" aria-hidden>
        {summary.prs.length ? "🏆" : "✅"}
      </p>
      <h1 className="font-display text-4xl font-extrabold">Tá pago!</h1>
      {summary.offline ? (
        <Alert kind="info" className="text-left">
          <span className="inline-flex items-center gap-1 font-semibold">
            <CloudOff className="size-4" aria-hidden /> Sem internet agora.
          </span>{" "}
          O treino ficou salvo no aparelho e será enviado automaticamente quando a conexão voltar.
        </Alert>
      ) : (
        <p className="text-muted">Treino salvo. Mandou bem!</p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Duração", value: clock(summary.duration) },
          { label: "Séries feitas", value: String(summary.doneSets) },
          { label: "Volume", value: `${fmtNum(Math.round(summary.volume))} kg` },
        ].map((s) => (
          <div key={s.label} className="rounded-3xl border border-border bg-surface p-3">
            <p className="font-display text-xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>
      {summary.prs.length > 0 && (
        <div className="rounded-3xl bg-ipe-500 p-4 text-left text-anil-900">
          <p className="flex items-center gap-2 font-display text-lg font-bold">
            <Trophy className="size-5" aria-hidden /> Novo recorde pessoal!
          </p>
          <ul className="mt-1 list-disc pl-6 text-sm">
            {summary.prs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {canRate && summary.sessionId && <SessionRating sessionId={summary.sessionId} />}
      <Link href={backHref} className="block rounded-2xl bg-bandeira-500 py-4 font-display text-lg font-bold text-white hover:bg-bandeira-600">
        Voltar
      </Link>
    </div>
  );
}

const cardioInput =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg font-semibold outline-none focus:border-bandeira-500";

/** Uma série de cardio: tempo, distância e a intensidade do painel do aparelho. */
function CardioSetRow({
  index,
  set,
  unit,
  onChange,
  onMark,
}: {
  index: number;
  set: SetState;
  unit: IntensityUnit;
  onChange: (patch: Partial<SetState>) => void;
  onMark: (done: boolean) => void;
}) {
  const fields: { key: "reps" | "km" | "speed" | "incline" | "level"; label: string; mode: "decimal" | "numeric" }[] = [
    { key: "reps", label: "Tempo (min)", mode: "decimal" },
    { key: "km", label: "Distância (km)", mode: "decimal" },
    ...(unit === "velocidade"
      ? ([
          { key: "speed", label: "Velocidade (km/h)", mode: "decimal" },
          { key: "incline", label: "Inclinação (%)", mode: "decimal" },
        ] as const)
      : ([{ key: "level", label: "Nível", mode: "numeric" }] as const)),
  ];
  return (
    <li
      className={cn(
        "rounded-2xl border border-border p-2 transition",
        set.done === true && "border-bandeira-500/60 bg-bandeira-50 dark:bg-bandeira-500/10",
        set.done === false && "bg-pitanga-100/60 dark:bg-pitanga-500/10",
      )}
    >
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.key} className="text-xs font-semibold text-muted">
            {f.label}
            <input
              inputMode={f.mode}
              value={set[f.key] ?? ""}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              placeholder="—"
              aria-label={`${f.label} da série ${index + 1}`}
              className={cn(cardioInput, "mt-1 text-foreground")}
            />
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onMark(true)}
          aria-pressed={set.done === true}
          aria-label={`Série ${index + 1} feita`}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border-2 text-sm font-bold transition",
            set.done === true ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border text-muted",
          )}
        >
          <Check className="size-5" aria-hidden /> Feito
        </button>
        <button
          type="button"
          onClick={() => onMark(false)}
          aria-pressed={set.done === false}
          aria-label={`Série ${index + 1} não feita`}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border-2 text-sm font-bold transition",
            set.done === false ? "border-pitanga-500 bg-pitanga-500 text-white" : "border-border text-muted",
          )}
        >
          <X className="size-5" aria-hidden /> Não fiz
        </button>
      </div>
    </li>
  );
}

const fmtKg = (n: number) => `${fmtNum(n)} kg`;

/** Barra escolhida para o exercício (fica guardada no aparelho do aluno). */
function useBar(equipmentId: string, name: string) {
  const key = `bt:barra:${equipmentId}`;
  const [bar, setBar] = useState(() => guessBar(name));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved != null && BARS.includes(Number(saved))) setBar(Number(saved));
    } catch {
      /* armazenamento indisponível */
    }
  }, [key]);
  const choose = (b: number) => {
    setBar(b);
    try {
      localStorage.setItem(key, String(b));
    } catch {
      /* armazenamento indisponível */
    }
  };
  return [bar, choose] as const;
}

/**
 * Antes de cada exercício: até 2 séries de aquecimento (opcionais, não entram no registro)
 * e a calculadora de anilhas para as cargas do exercício.
 */
function WarmupPanel({ equipmentId, name, loads }: { equipmentId: string; name: string; loads: number[] }) {
  const [bar, setBar] = useBar(equipmentId, name);
  const [status, setStatus] = useState<"aberto" | "feito" | "pulado">("aberto");
  const [done, setDone] = useState<boolean[]>([]);
  const [showPlates, setShowPlates] = useState(false);
  const work = Math.max(0, ...loads);
  const sets = warmupSets(work, bar);
  if (work <= 0) return null;
  const allLoads = [...new Set([...sets.map((s) => s.load), ...loads.filter((l) => l > 0)])].sort((a, b) => a - b);

  function toggle(i: number) {
    const next = sets.map((_, k) => (k === i ? !done[k] : !!done[k]));
    setDone(next);
    if (next.every(Boolean)) setStatus("feito");
  }

  const open = status === "aberto" && sets.length > 0;
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-ipe-500/70 bg-ipe-100/40 p-3 text-sm dark:bg-ipe-500/10">
      {open ? (
        <>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-bold">🔥 Aquecimento <span className="font-normal text-muted">(opcional)</span></p>
            <button type="button" onClick={() => setStatus("pulado")} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-border/50">
              Pular
            </button>
          </div>
          <ul className="space-y-1.5">
            {sets.map((w, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-center font-display font-bold text-muted">{i + 1}</span>
                <span className="flex-1 font-semibold">
                  {fmtKg(w.load)} × {w.reps}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-pressed={!!done[i]}
                  aria-label={`Aquecimento ${i + 1} feito`}
                  className={cn(
                    "flex h-9 w-12 items-center justify-center rounded-xl border-2 transition",
                    done[i] ? "border-bandeira-500 bg-bandeira-500 text-white" : "border-border text-muted",
                  )}
                >
                  <Check className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted">
            {status === "feito" ? "🔥 Aquecimento feito ✓" : sets.length ? "🔥 Aquecimento pulado" : "Carga leve: sem aquecimento"}
          </p>
          {sets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setStatus("aberto");
                setDone([]);
              }}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-border/50"
            >
              Mostrar
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPlates((v) => !v)}
        aria-expanded={showPlates}
        className="mt-2 text-xs font-semibold text-anil-700 hover:underline dark:text-ipe-400"
      >
        🏋️ {showPlates ? "Esconder anilhas" : "Quais anilhas colocar?"}
      </button>
      {showPlates && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Barra">
            {BARS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBar(b)}
                aria-pressed={bar === b}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                  bar === b ? "border-anil-700 bg-anil-700 text-white" : "border-border text-muted",
                )}
              >
                {b ? `Barra ${b} kg` : "Sem barra"}
              </button>
            ))}
          </div>
          <ul className="space-y-1">
            {allLoads.map((l) => {
              const { perSide, remainder } = platesFor(l, bar);
              return (
                <li key={l} className="flex flex-wrap gap-x-2">
                  <span className="w-16 font-semibold">{fmtKg(l)}</span>
                  <span className="text-muted">
                    {l < bar
                      ? "menos que a barra"
                      : perSide.length
                        ? `cada lado: ${platesLabel(perSide)}`
                        : bar
                          ? "só a barra"
                          : "—"}
                    {remainder > 0 && l >= bar && ` (faltam ${fmtKg(remainder)}: sem anilha para isso)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<SwapSource, string> = {
  personal: "Indicado pelo seu Personal",
  ia: "Sugestão da IA",
  regras: "Exercícios parecidos do mesmo grupo",
};

/**
 * "Aparelho ocupado?": só aparece antes de marcar alguma série. Se o Personal indicou um substituto,
 * mostra só ele; senão a IA escolhe 1–2 parecidos entre os candidatos (sem IA/sem internet: os 2 primeiros).
 */
function SwapBar({
  original,
  studentId,
  state,
  onSwap,
}: {
  original: RunnerExercise;
  studentId: string;
  state: ExerciseState;
  onSwap: (opt: SwapOption | null, source?: SwapSource) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<{ options: SwapOption[]; source: SwapSource; reason: string | null } | null>(null);
  const started = state.sets.some((x) => x.done !== null);

  if (state.swap) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-anil-700/5 px-3 py-2 text-sm dark:bg-white/5">
        <span>
          🔁 No lugar de <strong>{original.equipment.name}</strong> (aparelho ocupado)
        </span>
        {!started && (
          <button type="button" onClick={() => onSwap(null)} className="text-xs font-semibold text-muted hover:text-foreground">
            Desfazer
          </button>
        )}
      </div>
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
      const r = await suggestSubstitutes({
        studentId,
        original: { id: original.equipment.id, name: original.equipment.name, muscle_group: original.equipment.muscle_group },
        candidates: alts.map((o) => ({ id: o.equipment.id, name: o.equipment.name, muscle_group: o.equipment.muscle_group })),
      });
      const options = r.ids.map((id) => alts.find((o) => o.equipment.id === id)).filter((o): o is SwapOption => !!o);
      setPicks(options.length ? { options, source: "ia", reason: r.reason } : fallback);
    } catch {
      setPicks(fallback); // sem internet: usa os candidatos por regra
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="mt-3 inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-bandeira-500 hover:text-foreground"
      >
        🔁 Aparelho ocupado?
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-2xl border border-anil-700/30 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-bold">🔁 Trocar por</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-muted hover:text-foreground">
          Fechar
        </button>
      </div>
      {loading || !picks ? (
        <p className="flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Buscando exercícios parecidos…
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-muted">
            {SOURCE_LABEL[picks.source]}
            {picks.reason && ` · ${picks.reason}`}
          </p>
          <ul className="space-y-2">
            {picks.options.map((o) => (
              <li key={o.equipment.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{o.equipment.name}</span>
                  {o.history.last && (
                    <span className="text-xs text-muted">
                      Última vez: {o.history.last.sets.map((x) => `${fmtNum(x.load)}kg×${x.reps}`).slice(0, 3).join(", ")}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onSwap(o, picks.source)}
                  className="rounded-xl bg-bandeira-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-bandeira-600"
                >
                  Trocar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** "▶ Ver execução": GIF ou vídeo curto aprovado pelo admin, aberto só quando o aluno pede. */
function DemoToggle({ demo, name }: { demo: { url: string; kind: "gif" | "video" }; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-bandeira-500 hover:text-foreground"
      >
        {open ? "Fechar execução" : "▶ Ver execução"}
      </button>
      {open && (
        <div className="mt-2 max-w-sm">
          <MediaPreview url={demo.url} kind={demo.kind} alt={`Execução de ${name}`} />
        </div>
      )}
    </div>
  );
}
