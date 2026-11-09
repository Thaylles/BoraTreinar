import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Link, type Href } from "expo-router";
import { Check, ChevronRight, Clock, MessageCircle, Trash2, Trophy, UserCheck, X } from "lucide-react-native";
import { cardioSetLine } from "@/lib/cardio";
import { effortInfo } from "@/lib/effort";
import { formatDateTime } from "@/lib/format";
import type { listSessions, loadSession } from "@/lib/sessions-server";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useData } from "~/lib/data";
import { supabase } from "~/lib/supabase";
import { useCall, useFormAction } from "~/lib/use-action";
import { Badge, Button, FormMessage, inputClass, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Avatar } from "~/ui/extras";
import { EquipmentImage } from "./plan-view";

type Item = Awaited<ReturnType<typeof listSessions>>[number];
type Loaded = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

export function SessionList({ sessions, href }: { sessions: Item[]; href: (id: string) => Href }) {
  const t = useTheme();
  return (
    <View className="gap-2">
      {sessions.map((s) => (
        <Link key={s.id} href={href(s.id)} asChild>
          <Pressable className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3 active:opacity-80">
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap items-center gap-1">
                <Text className="font-semibold">{s.plan_name ?? "Treino livre"}</Text>
                {s.kind === "livre" ? <Text className="text-xs text-muted">(livre)</Text> : null}
                {s.hasPr ? <Trophy color={t.ipe600} size={16} accessibilityLabel="Recorde" /> : null}
                {s.byInstructor ? <UserCheck color={t.anil500} size={16} accessibilityLabel="Registrado pelo instrutor" /> : null}
                {s.effort != null ? <Text className="text-sm">{effortInfo(s.effort)?.emoji}</Text> : null}
                {s.pain ? (
                  <View className="rounded-full bg-pitanga-100 px-1.5 dark:bg-pitanga-500/20">
                    <Text className="text-xs font-bold text-pitanga-600">dor</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-xs text-muted">
                {formatDateTime(s.started_at)} · {Math.round(s.duration_seconds / 60)} min · {s.doneSets} séries
              </Text>
            </View>
            <ChevronRight color={t.muted} size={20} />
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const dur = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}` : `${Math.round(s / 60)} min`);

export function SessionDetail({ data, exerciseHref }: { data: Loaded; exerciseHref: (equipmentId: string) => Href }) {
  const t = useTheme();
  const { session, exercises } = data;
  const allSets = exercises.flatMap((e) => e.sets);
  const done = allSets.filter((s) => s.done);
  const volume = done.reduce((acc, s) => acc + Number(s.load_kg) * s.reps, 0);
  const byInstructor = session.logged_by && session.logged_by !== session.student_id;
  return (
    <>
      <View className="mb-4">
        <View className="mb-1 flex-row flex-wrap gap-2">
          {session.imported_from ? (
            <Badge tone="blue">{`📲 Importado${session.source_app ? ` · ${session.source_app}` : " do Health Connect"}`}</Badge>
          ) : session.kind === "livre" ? (
            <Badge tone="blue">Treino livre</Badge>
          ) : (
            <Badge tone="green">Ficha</Badge>
          )}
          {byInstructor ? <Badge tone="yellow">Registrado pelo instrutor</Badge> : null}
          {done.some((s) => s.is_pr) ? <Badge tone="yellow">🏆 Recorde</Badge> : null}
        </View>
        <Text className="font-display text-3xl font-extrabold leading-tight">{session.plan_name ?? "Treino livre"}</Text>
        <View className="flex-row flex-wrap items-center gap-1">
          <Text className="text-sm text-muted">{formatDateTime(session.started_at)} ·</Text>
          <Clock color={t.muted} size={14} />
          <Text className="text-sm text-muted">
            {dur(session.duration_seconds)}
            {byInstructor && session.logger ? ` · por ${session.logger.full_name}` : ""}
          </Text>
        </View>
      </View>

      <View className="mb-6 flex-row gap-3">
        {[
          { label: "Exercícios", value: String(exercises.length) },
          { label: "Séries feitas", value: `${done.length}/${allSets.length}` },
          { label: "Volume", value: `${Math.round(volume).toLocaleString("pt-BR")} kg` },
        ].map((s) => (
          <View key={s.label} className="flex-1 items-center rounded-3xl border border-border bg-surface p-3">
            <Text className="font-display text-xl font-extrabold">{s.value}</Text>
            <Text className="text-xs text-muted">{s.label}</Text>
          </View>
        ))}
      </View>

      {session.effort != null ? (
        <View className={cn("mb-6 rounded-3xl border p-4", session.pain ? "border-pitanga-500/60 bg-pitanga-100/50 dark:bg-pitanga-500/10" : "border-border bg-surface")}>
          <Text className="font-semibold">
            {effortInfo(session.effort)?.emoji} Esforço: {effortInfo(session.effort)?.label} ({session.effort}/5)
          </Text>
          {session.pain ? <Text className="mt-1 text-sm font-semibold text-pitanga-600">⚠️ Relatou dor ou desconforto</Text> : null}
          {session.feedback ? <Text className="mt-1 text-sm">💬 “{session.feedback}”</Text> : null}
        </View>
      ) : null}

      <View className="gap-3">
        {exercises.map((ex) => (
          <View key={ex.order} className="rounded-3xl border border-border bg-surface p-3">
            <View className="flex-row items-center gap-3">
              {ex.equipment ? <EquipmentImage equipment={ex.equipment} size={56} /> : null}
              <Link href={exerciseHref(ex.equipmentId)} className="flex-1">
                <Text className="font-semibold underline">{ex.equipment?.name ?? "Exercício indisponível"}</Text>
              </Link>
            </View>
            <View className="mt-2 gap-1">
              {ex.sets.map((s) => (
                <View key={s.id} className="flex-row items-center gap-2">
                  <Text className="w-5 text-sm text-muted">{s.set_number}.</Text>
                  {s.done ? <Check color={t.bandeira600} size={16} /> : <X color={t.pitanga500} size={16} />}
                  <Text className={cn("text-sm", !s.done && "text-muted line-through")}>
                    {ex.equipment?.muscle_group === "cardio"
                      ? cardioSetLine({ minutes: s.duration_min ?? s.reps, km: s.distance_km, speed: s.speed_kmh, incline: s.incline_pct, level: s.level })
                      : `${Number(s.load_kg).toLocaleString("pt-BR")} kg × ${s.reps}`}
                  </Text>
                  {s.is_pr ? (
                    <View className="rounded-full bg-ipe-500 px-2">
                      <Text className="text-xs font-bold text-anil-900">🏆 PR</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/** Conversa entre aluno e Personal sobre um treino feito. */
export function SessionComments({ sessionId, meId, placeholder }: { sessionId: string; meId: string; placeholder: string }) {
  const t = useTheme();
  const q = useData(["session-comments", sessionId], async () => {
    const { data, error } = await supabase
      .from("session_comments")
      .select("id, body, created_at, author_id, author:profiles!session_comments_author_id_fkey(full_name, avatar_path)")
      .eq("session_id", sessionId)
      .order("created_at");
    return error ? null : (data ?? []);
  });
  const [body, setBody] = useState("");
  const add = useFormAction("treino-actions#addSessionComment");
  const del = useCall("treino-actions#deleteSessionComment");
  if (q.data === null || q.data === undefined) return null;
  return (
    <View className="mt-8">
      <View className="mb-3 flex-row items-center gap-2">
        <MessageCircle color={t.bandeira500} size={20} />
        <Text className="font-display text-xl font-bold">Comentários</Text>
      </View>
      {q.data.length ? (
        <View className="mb-4 gap-3">
          {q.data.map((c) => {
            const mine = c.author_id === meId;
            const name = c.author?.full_name ?? "Usuário";
            return (
              <View key={c.id} className={cn("flex-row items-start gap-2", mine && "flex-row-reverse")}>
                <Avatar path={c.author?.avatar_path} name={name} size={32} />
                <View className={cn("max-w-[80%] rounded-2xl px-3 py-2", mine ? "bg-bandeira-500" : "border border-border bg-surface")}>
                  <Text className={cn("mb-0.5 text-xs font-semibold", mine ? "text-white/80" : "text-muted")}>
                    {mine ? "Você" : name.split(" ")[0]} · {formatDateTime(c.created_at)}
                  </Text>
                  <Text className={cn("text-sm", mine && "text-white")}>{c.body}</Text>
                  {mine ? (
                    <Pressable
                      className="mt-1 flex-row items-center justify-end gap-1"
                      onPress={async () => {
                        if (await confirmAsk("Apagar este comentário?", { ok: "Apagar", destructive: true })) await del.run(form({ id: c.id, session_id: sessionId }));
                      }}
                    >
                      <Trash2 color="#ffffffcc" size={12} />
                      <Text className="text-xs text-white/80">Apagar</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      <View className="gap-2">
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={1000}
          multiline
          placeholder={placeholder}
          placeholderTextColor={t.muted}
          accessibilityLabel="Comentário"
          className={inputClass}
          style={{ fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" }}
        />
        {add.state?.error ? <FormMessage state={add.state} /> : null}
        <Button
          className="self-start"
          loading={add.pending}
          disabled={!body.trim()}
          onPress={async () => {
            const r = await add.submit({ session_id: sessionId, body });
            if (r && !r.error && !(r.result as { error?: string } | null)?.error) setBody("");
          }}
        >
          Comentar
        </Button>
      </View>
    </View>
  );
}
