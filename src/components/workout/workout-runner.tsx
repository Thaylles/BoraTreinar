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
  Trophy,
  X,
} from "lucide-react";
import { equipmentImageSrc, groupLabel, type MuscleGroup } from "@/lib/catalog";
import { formatRest, formatKg } from "@/lib/plans";
import { draftStore, outbox, type SessionPayload } from "@/lib/outbox";
import type { ExerciseHistoryInfo } from "@/lib/history-server";
import { saveSession } from "@/app/treino-actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

export type RunnerExercise = {
  equipment: {
    id: string;
    name: string;
    muscle_group: MuscleGroup;
    image_path: string | null;
    image_url: string | null;
    is_bodyweight: boolean;
  };
  notes: string | null;
  restSeconds: number;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  suggestedLoad: number | null;
  history: ExerciseHistoryInfo;
};

type SetState = { load: string; reps: string; done: boolean | null };
type ExerciseState = { rest: number; sets: SetState[] };
type Draft = { v: 1; clientId: string; startedAt: string; exercises: ExerciseState[] };
type Timer = { endsAt: number; total: number; exercise: number } | null;
type Summary = { duration: number; doneSets: number; volume: number; prs: string[]; offline: boolean };

const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const parseNum = (s: string) => {
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const clock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

function initialExercises(list: RunnerExercise[]): ExerciseState[] {
  return list.map((ex) => {
    const last = ex.history.last?.sets ?? [];
    const count = Math.max(1, ex.targetSets);
    return {
      rest: ex.restSeconds,
      sets: Array.from({ length: count }, (_, i) => {
        const prev = last[i] ?? last[last.length - 1];
        const load = prev?.load ?? ex.suggestedLoad ?? (ex.equipment.is_bodyweight ? 0 : null);
        const reps = ex.repsMin ?? prev?.reps ?? null;
        return { load: load == null ? "" : fmtNum(load), reps: reps == null ? "" : String(reps), done: null };
      }),
    };
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
    if (next === true && rest > 0) {
      setTimer({ endsAt: Date.now() + rest * 1000, total: rest, exercise: ei });
    }
  }

  function addSet(ei: number) {
    const ex = draft!.exercises[ei];
    const last = ex.sets[ex.sets.length - 1];
    if (ex.sets.length >= 20) return;
    updateExercise(ei, { sets: [...ex.sets, { load: last?.load ?? "", reps: last?.reps ?? "", done: null }] });
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
        equipment_id: exercises[i].equipment.id,
        sets: ex.sets.map((s) => ({ load_kg: parseNum(s.load), reps: Math.round(parseNum(s.reps)), done: s.done === true })),
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

  if (summary) return <WorkoutSummary summary={summary} backHref={backHref} />;
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
      <div className="sticky top-[57px] z-10 -mx-4 mb-4 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
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
            exercise={ex}
            state={draft.exercises[ei]}
            onSet={(si, patch) => updateSet(ei, si, patch)}
            onMark={(si, done) => markSet(ei, si, done)}
            onAdd={() => addSet(ei)}
            onRemove={() => removeSet(ei)}
            onRest={(rest) => updateExercise(ei, { rest })}
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
  state,
  onSet,
  onMark,
  onAdd,
  onRemove,
  onRest,
}: {
  index: number;
  exercise: RunnerExercise;
  state: ExerciseState;
  onSet: (si: number, patch: Partial<SetState>) => void;
  onMark: (si: number, done: boolean) => void;
  onAdd: () => void;
  onRemove: () => void;
  onRest: (rest: number) => void;
}) {
  const src = equipmentImageSrc(exercise.equipment);
  const { last, best } = exercise.history;
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
                {last.sets.map((s) => `${fmtNum(s.load)}kg×${s.reps}`).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted">Primeira vez nesse exercício 🚀</p>
          )}
          {best != null && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <Trophy className="size-3.5 text-ipe-600" aria-hidden /> Recorde: {formatKg(best)}
            </p>
          )}
        </div>
      </div>

      {exercise.notes && (
        <p className="mt-3 rounded-2xl bg-ipe-100 px-3 py-2 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400">
          💬 {exercise.notes}
        </p>
      )}

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

function WorkoutSummary({ summary, backHref }: { summary: Summary; backHref: string }) {
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
      <Link href={backHref} className="block rounded-2xl bg-bandeira-500 py-4 font-display text-lg font-bold text-white hover:bg-bandeira-600">
        Voltar
      </Link>
    </div>
  );
}
