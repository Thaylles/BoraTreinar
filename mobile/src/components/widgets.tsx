import { useState } from "react";
import { Pressable, View } from "react-native";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BellOff, Check, Droplets, HeartPulse, Settings2, Target, Undo2, X } from "lucide-react-native";
import { achievementStats, type AchievementRow } from "@/lib/achievements";
import { formatAmount, goalLabel, goalProgress, GOAL_KIND_LABEL, parseCardioWeek, type CardioGoal, type CardioGoalKind } from "@/lib/cardio";
import { firstName, formatDateTime } from "@/lib/format";
import { BOTTLES, bottleLabel, liters } from "@/lib/water";
import { spDateKey, startOfWeekSP } from "@/lib/week";
import { loadWaterToday, type WaterToday } from "@/lib/water-server";
import { callAction, form } from "~/lib/api";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { queryClient } from "~/lib/query";
import { Button, FormMessage, Input, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Avatar, Disclosure, ProgressBar, ShortcutCard } from "~/ui/extras";
import { Checkbox } from "~/ui/forms";

// ─── Meta da semana (dias de treino) ─────────────────────────────
export function WeeklyGoal({ studentId }: { studentId: string }) {
  const { data } = useQuery({
    queryKey: ["weekly-goal", studentId],
    queryFn: async () => {
      const [{ data: settings }, { data: sessions }] = await Promise.all([
        supabase.from("student_settings").select("weekly_goal").eq("student_id", studentId).maybeSingle(),
        supabase.from("workout_sessions").select("started_at").eq("student_id", studentId).gte("started_at", startOfWeekSP()),
      ]);
      return { goal: settings?.weekly_goal ?? null, days: new Set((sessions ?? []).map((s) => spDateKey(s.started_at))).size };
    },
  });
  const { run, pending } = useCall("aluno/meta-actions#setWeeklyGoal");
  const t = useTheme();
  if (!data) return null;
  const { goal, days } = data;
  const buttons = (
    <View className="flex-row flex-wrap items-center gap-2">
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <Pressable
          key={n}
          disabled={pending}
          onPress={() => run(form({ goal: n }))}
          accessibilityLabel={`${n} ${n === 1 ? "dia" : "dias"} por semana`}
          accessibilityState={{ selected: goal === n }}
          className={cn("size-10 items-center justify-center rounded-full border-2", goal === n ? "border-bandeira-500 bg-bandeira-500" : "border-border")}
        >
          <Text className={cn("font-display font-bold", goal === n && "text-white")}>{n}</Text>
        </Pressable>
      ))}
      {goal ? (
        <Pressable onPress={() => run(form({ goal: 0 }))} className="px-2">
          <Text className="text-xs font-semibold text-muted">Remover meta</Text>
        </Pressable>
      ) : null}
    </View>
  );
  const title = (
    <View className="flex-row items-center gap-2">
      <Target color={t.bandeira500} size={20} />
      <Text className="font-display text-lg font-bold">Meta da semana</Text>
    </View>
  );
  if (!goal) {
    return (
      <View className="mb-6 rounded-3xl border border-border bg-surface p-4">
        {title}
        <Text className="mb-3 mt-1 text-sm text-muted">Quantos dias por semana você quer treinar?</Text>
        {buttons}
      </View>
    );
  }
  const done = days >= goal;
  return (
    <View className="mb-6 rounded-3xl border border-border bg-surface p-4">
      <View className="mb-2 flex-row items-baseline justify-between">
        {title}
        <Text className="font-display text-lg font-extrabold">
          {days}/{goal} <Text className="text-sm font-semibold text-muted">{goal === 1 ? "dia" : "dias"}</Text>
        </Text>
      </View>
      <ProgressBar pct={Math.round((days / goal) * 100)} barClassName={done ? "bg-ipe-500" : "bg-bandeira-500"} />
      <Text className="mt-2 text-sm text-muted">
        {done ? "Meta batida! 🎉 Mandou bem nesta semana." : `Faltam ${goal - days} ${goal - days === 1 ? "dia" : "dias"} de treino para bater a meta.`}
      </Text>
      <Disclosure label="Alterar meta" className="mt-2">
        {buttons}
      </Disclosure>
    </View>
  );
}

// ─── Meta de cardio ─────────────────────────────────────────────
const fmt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

function CardioGoalForm({ studentId, goal }: { studentId: string; goal: CardioGoal | null }) {
  const [kind, setKind] = useState<CardioGoalKind>(goal?.kind ?? "minutos");
  const def = (k: CardioGoalKind) => (goal?.kind === k ? fmt(goal.target) : k === "distancia" ? "10" : k === "intenso" ? "60" : "150");
  const [target, setTarget] = useState(def(kind));
  const [speed, setSpeed] = useState(fmt(goal?.min_speed_kmh) || "8");
  const [level, setLevel] = useState(fmt(goal?.min_level) || "6");
  const { state, pending, submit } = useFormAction("cardio-actions#saveCardioGoal");
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold">Tipo de meta</Text>
      <View className="flex-row gap-2">
        {(["minutos", "distancia", "intenso"] as CardioGoalKind[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => {
              setKind(k);
              setTarget(def(k));
            }}
            className={cn("flex-1 rounded-2xl border-2 px-2 py-2", kind === k ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/10" : "border-border")}
          >
            <Text className="text-center text-xs font-bold">{GOAL_KIND_LABEL[k]}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="text-sm font-semibold">Meta por semana ({kind === "distancia" ? "km" : "min"})</Text>
      <Input value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      {kind === "intenso" ? (
        <View className="gap-2 rounded-2xl bg-background p-3">
          <Text className="text-xs text-muted">Conta como ritmo forte o cardio feito a partir destes valores (preencha um ou os dois):</Text>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-xs font-semibold">Esteira: velocidade ≥ (km/h)</Text>
              <Input value={speed} onChangeText={setSpeed} keyboardType="decimal-pad" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-xs font-semibold">Bicicleta/elíptico: nível ≥</Text>
              <Input value={level} onChangeText={setLevel} keyboardType="number-pad" />
            </View>
          </View>
        </View>
      ) : null}
      <Button loading={pending} onPress={() => submit({ student_id: studentId, kind, target, min_speed: kind === "intenso" ? speed : undefined, min_level: kind === "intenso" ? level : undefined })}>
        {pending ? "Salvando…" : "Salvar meta de cardio"}
      </Button>
      <FormMessage state={state} />
    </View>
  );
}

export function CardioGoalCard({ studentId, canEdit, audience }: { studentId: string; canEdit: boolean; audience: "aluno" | "personal" }) {
  const t = useTheme();
  const { data: week } = useQuery({
    queryKey: ["cardio-week", studentId],
    queryFn: async () => {
      const { data } = await supabase.rpc("cardio_week", { p_student: studentId });
      return data ? parseCardioWeek(data) : null;
    },
  });
  const remove = useCall("cardio-actions#removeCardioGoal");
  if (!week) return null;
  const progress = goalProgress(week);
  const you = audience === "aluno";
  const title = (
    <View className="flex-row items-center gap-2">
      <HeartPulse color={t.pitanga500} size={20} />
      <Text className="font-display text-lg font-bold">Meta de cardio</Text>
    </View>
  );
  const summary = (
    <Text className="mt-2 text-xs text-muted">
      Nesta semana: {formatAmount(week.minutes, "min")} · {formatAmount(week.km, "km")} · {week.days} {week.days === 1 ? "dia" : "dias"} com cardio
    </Text>
  );
  if (!week.goal || !progress) {
    if (!canEdit && !week.minutes) return null;
    return (
      <View className="mb-6 rounded-3xl border border-border bg-surface p-4">
        {title}
        <Text className="mb-3 mt-1 text-sm text-muted">
          {canEdit
            ? you
              ? "Escolha quanto cardio você quer fazer por semana: tempo, distância ou minutos em ritmo forte."
              : "Defina a meta de cardio do aluno: tempo, distância ou minutos em ritmo forte por semana."
            : "Seu Personal ainda não definiu uma meta de cardio."}
        </Text>
        {canEdit ? <CardioGoalForm studentId={studentId} goal={null} /> : null}
        {summary}
      </View>
    );
  }
  const left = Math.max(0, progress.target - progress.value);
  return (
    <View className="mb-6 rounded-3xl border border-border bg-surface p-4">
      <View className="mb-1 flex-row items-baseline justify-between">
        {title}
        <Text className="font-display text-lg font-extrabold">
          {formatAmount(progress.value, progress.unit)}
          <Text className="text-sm font-semibold text-muted"> / {formatAmount(progress.target, progress.unit)}</Text>
        </Text>
      </View>
      <Text className="mb-2 text-xs text-muted">
        {goalLabel(week.goal)}
        {week.goal.by_personal && you ? " · definida pelo seu Personal (você pode ajustar)" : ""}
        {!week.goal.by_personal && !you ? " · escolhida pelo aluno" : ""}
      </Text>
      <ProgressBar pct={progress.pct} barClassName={progress.done ? "bg-ipe-500" : "bg-pitanga-500"} />
      <Text className="mt-2 text-sm text-muted">
        {progress.done ? "Meta de cardio batida! 🫀🔥" : `Faltam ${formatAmount(left, progress.unit)}${week.goal.kind === "intenso" ? " em ritmo forte" : ""} para bater a meta.`}
      </Text>
      {summary}
      {canEdit ? (
        <Disclosure label="Alterar meta de cardio" className="mt-2">
          <View className="gap-2">
            <CardioGoalForm studentId={studentId} goal={week.goal} />
            <Pressable onPress={() => remove.run(form({ student_id: studentId }))}>
              <Text className="text-xs font-semibold text-muted">Remover meta de cardio</Text>
            </Pressable>
          </View>
        </Disclosure>
      ) : null}
    </View>
  );
}

// ─── Conquistas ─────────────────────────────────────────────────
export function AchievementsCard({ rows, href }: { rows: AchievementRow[]; href: "/aluno/conquistas" | "/personal/conquistas" }) {
  if (!rows.length) return null;
  const stats = achievementStats(rows);
  const recent = rows
    .filter((r) => r.unlocked_at)
    .sort((a, b) => (b.unlocked_at ?? "").localeCompare(a.unlocked_at ?? ""))
    .slice(0, 5);
  return (
    <ShortcutCard
      href={href}
      emoji="🏆"
      title={`Conquistas ${stats.unlocked}/${stats.total}`}
      sub={`${recent.length ? `Últimas: ${recent.map((r) => r.emoji).join(" ")}` : "Treine para liberar a primeira!"} · ${stats.points} pts`}
    />
  );
}

// ─── Pedidos de acompanhamento de Personais ──────────────────────
type LinkReq = { id: string; personal: { full_name: string; avatar_path: string | null } | null };
export function LinkRequestsCard({ requests }: { requests: LinkReq[] }) {
  const { run, pending } = useCall("aluno/vinculo-actions#respondLinkRequest");
  if (!requests.length) return null;
  return (
    <View className="mb-6 gap-2">
      {requests.map((r) => {
        const name = r.personal?.full_name ?? "Personal";
        return (
          <View key={r.id} className="rounded-3xl border-2 border-bandeira-500 bg-surface p-4">
            <View className="flex-row items-center gap-3">
              <Avatar path={r.personal?.avatar_path} name={name} size={48} />
              <View className="min-w-0 flex-1">
                <Text className="font-semibold">{name} quer te acompanhar 💪</Text>
                <Text className="text-sm text-muted">
                  Aceitando, {firstName(name)} pode montar suas fichas e ver seus treinos. Seu peso só aparece se você permitir.
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row gap-2">
              <Button className="flex-1" icon={Check} disabled={pending} onPress={() => run(form({ id: r.id, accept: "1" }))}>
                Aceitar
              </Button>
              <Button variant="ghost" icon={X} disabled={pending} onPress={() => run(form({ id: r.id, accept: "0" }))}>
                Recusar
              </Button>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Novidades (notificações) ───────────────────────────────────
export function NotificationsList({ limit = 8 }: { limit?: number }) {
  const t = useTheme();
  const { data: items } = useQuery({
    queryKey: ["notifications", limit],
    queryFn: async () =>
      (await supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(limit)).data ?? [],
  });
  const markAll = useCall("notifications-actions#markAllNotificationsRead");
  const unread = items?.filter((n) => !n.read_at).length ?? 0;
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-xl font-bold">
          Novidades {unread > 0 ? <Text className="font-display text-xl font-bold text-pitanga-500">({unread})</Text> : null}
        </Text>
        {unread > 0 ? (
          <Pressable onPress={() => markAll.run(form({}))}>
            <Text className="text-sm font-semibold text-anil-700 dark:text-ipe-500">Marcar como lidas</Text>
          </Pressable>
        ) : null}
      </View>
      {!items?.length ? (
        <View className="flex-row items-center gap-2">
          <BellOff color={t.muted} size={16} />
          <Text className="text-sm text-muted">Nada de novo por aqui.</Text>
        </View>
      ) : (
        items.map((n) => {
          const body = (
            <View className={cn("rounded-2xl border border-border bg-surface p-3", !n.read_at && "border-l-4 border-l-ipe-500")}>
              <Text className="font-semibold">{n.title}</Text>
              {n.body ? <Text className="text-sm text-muted">{n.body}</Text> : null}
              <Text className="mt-1 text-xs text-muted">{formatDateTime(n.created_at)}</Text>
            </View>
          );
          return n.link ? (
            <Link key={n.id} href={n.link.split("#")[0] as never} asChild>
              <Pressable>{body}</Pressable>
            </Link>
          ) : (
            <View key={n.id}>{body}</View>
          );
        })
      )}
    </View>
  );
}

// ─── Água de hoje ───────────────────────────────────────────────
export function WaterButtons({ onAdd, disabled }: { onAdd: (ml: number) => void; disabled?: boolean }) {
  return (
    <View className="flex-row gap-2">
      {BOTTLES.map((ml) => (
        <Pressable
          key={ml}
          disabled={disabled}
          onPress={() => onAdd(ml)}
          accessibilityLabel={`Bebi ${bottleLabel(ml)}`}
          className={cn("flex-1 items-center rounded-2xl border-2 border-anil-500/30 bg-anil-500/5 py-2 active:border-anil-500", disabled && "opacity-60")}
        >
          <Text>💧</Text>
          <Text className="font-display font-bold">+{bottleLabel(ml)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function useWaterToday(userId: string) {
  return useQuery({ queryKey: ["water", userId], queryFn: () => loadWaterToday(userId) });
}

export function WaterCard({ userId, suggestion }: { userId: string; suggestion: number }) {
  const t = useTheme();
  const { data: water } = useWaterToday(userId);
  const [editing, setEditing] = useState<boolean | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [reminders, setReminders] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!water) return null;
  const isEditing = editing ?? water.goalMl === null;
  const goalText = goal ?? ((water.goalMl ?? suggestion) / 1000).toLocaleString("pt-BR");
  const rem = reminders ?? water.reminders;

  async function run(action: string, ...args: unknown[]) {
    setPending(true);
    setError(null);
    try {
      const r = await callAction<{ ok: boolean; water?: WaterToday; error?: string }>(action, ...args);
      const res = r.result;
      if (!res?.ok) setError(res?.error ?? r.error ?? "Algo deu errado.");
      else queryClient.setQueryData(["water", userId], res.water);
      return !!res?.ok;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  }

  const pct = water.goalMl ? Math.min(100, Math.round((water.totalMl / water.goalMl) * 100)) : 0;
  const reached = !!water.goalMl && water.totalMl >= water.goalMl;
  return (
    <View className="mb-4 rounded-3xl border border-border bg-surface p-4">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Droplets color={t.anil500} size={20} />
          <Text className="font-display text-lg font-bold">Água de hoje</Text>
        </View>
        {water.goalMl !== null ? (
          <Pressable onPress={() => setEditing(!isEditing)} className="flex-row items-center gap-1 rounded-xl px-2 py-1">
            <Settings2 color={t.muted} size={16} />
            <Text className="text-xs font-semibold text-muted">Meta</Text>
          </Pressable>
        ) : null}
      </View>
      {isEditing ? (
        <View className="gap-3">
          <Text className="text-sm text-muted">Quantos litros por dia você quer beber? Sugestão: {liters(suggestion)} (cerca de 35 ml por kg).</Text>
          <View className="flex-row items-center gap-2">
            <Input value={goalText} onChangeText={setGoal} keyboardType="decimal-pad" className="w-28 text-center text-lg" accessibilityLabel="Meta diária em litros" />
            <Text className="font-semibold">litros por dia</Text>
          </View>
          <Checkbox checked={rem} onChange={setReminders}>
            Me lembrar de 3 em 3 horas (8h às 20h) enquanto não bater a meta
          </Checkbox>
          <Button variant="secondary" loading={pending} onPress={async () => (await run("agua-actions#saveWaterGoal", goalText, rem)) && setEditing(false)}>
            Salvar meta
          </Button>
        </View>
      ) : (
        <>
          <Text className="mb-1">
            <Text className="font-display text-2xl font-extrabold">{liters(water.totalMl)}</Text>
            <Text className="text-muted"> de {liters(water.goalMl ?? 0)}</Text>
            {reached ? <Text className="font-semibold text-bandeira-600 dark:text-bandeira-100">  Meta batida! 🎉</Text> : null}
          </Text>
          <ProgressBar pct={pct} className="mb-3" barClassName="bg-anil-500" />
          <WaterButtons disabled={pending} onAdd={(ml) => run("agua-actions#addWater", ml)} />
          {water.lastId ? (
            <Pressable disabled={pending} onPress={() => run("agua-actions#removeWater", water.lastId)} className="mt-2 flex-row items-center gap-1">
              <Undo2 color={t.muted} size={14} />
              <Text className="text-xs font-semibold text-muted">Desfazer último ({bottleLabel(water.lastMl ?? 0)})</Text>
            </Pressable>
          ) : null}
        </>
      )}
      {error ? <Text className="mt-2 text-sm text-pitanga-600">{error}</Text> : null}
    </View>
  );
}
