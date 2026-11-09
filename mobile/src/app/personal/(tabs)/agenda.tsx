import { useState } from "react";
import { Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { loadAgenda } from "@/lib/agenda-server";
import { addDays, addMonths, dayLabel, mondayOf, monthGrid, MONTHS, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/schedule";
import { spDateKey } from "@/lib/week";
import { useData, useRefresh } from "~/lib/data";
import { useProfile } from "~/lib/session";
import { supabase } from "~/lib/supabase";
import { Card, Loading, PageTitle, Screen, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { ChangeRequestCard, OccurrenceList, ScheduleForm } from "~/components/agenda";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const HEADER = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAYS_SHORT[d]);

export default function Agenda() {
  const profile = useProfile();
  const t = useTheme();
  const today = spDateKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const selected = picked && picked.startsWith(month) ? picked : today.startsWith(month) ? today : `${month}-01`;
  const grid = monthGrid(month);
  const q = useData(["personal-agenda", profile.id, month], async () => {
    const [{ occurrences }, { data: links }, { data: changeRequests }] = await Promise.all([
      loadAgenda({ personalId: profile.id, from: grid.start, days: grid.days }),
      supabase.from("personal_students").select("student:profiles!personal_students_student_id_fkey(id, full_name)").eq("personal_id", profile.id).eq("status", "ativo").is("archived_at", null),
      supabase
        .from("class_change_requests")
        .select("id, on_date, new_date, new_time, note, student:profiles!class_change_requests_student_id_fkey(full_name), schedule:class_schedules!class_change_requests_schedule_id_fkey(start_time)")
        .eq("personal_id", profile.id)
        .eq("status", "pendente")
        .gte("on_date", today)
        .order("on_date"),
    ]);
    return { occurrences, links: links ?? [], changeRequests: changeRequests ?? [] };
  }, { placeholderData: (p) => p });
  const refresh = useRefresh(q);
  if (!q.data) return <Loading />;
  const { occurrences, links, changeRequests } = q.data;
  const students = links.map((l) => l.student).filter((s): s is { id: string; full_name: string } => !!s).sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const byDay = new Map<string, typeof occurrences>();
  for (const o of occurrences) byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);
  const dayOcc = byDay.get(selected) ?? [];
  const weekStart = mondayOf(selected);
  const weekEnd = addDays(weekStart, 6);
  const weekStudents = new Map<string, { name: string; slots: string[] }>();
  for (const o of occurrences.filter((o) => o.date >= weekStart && o.date <= weekEnd && !o.cancelled)) {
    const id = o.schedule.student?.id ?? o.schedule.id;
    const e = weekStudents.get(id) ?? { name: o.schedule.student?.full_name ?? "Aluno", slots: [] };
    e.slots.push(`${WEEKDAYS_SHORT[weekdayOf(o.date)]} ${o.time}`);
    weekStudents.set(id, e);
  }
  const monthTotal = occurrences.filter((o) => o.date.startsWith(month) && !o.cancelled).length;
  return (
    <Screen edges={[]} refreshControl={refresh}>
      <PageTitle sub="Aulas semanais se repetem todo mês até você remover. Toque num dia para ver e ajustar.">Agenda</PageTitle>
      {changeRequests.length ? (
        <View className="mb-6">
          <Text className="mb-2 font-display text-xl font-bold">Pedidos de troca de aula ({changeRequests.length})</Text>
          <View className="gap-3">
            {changeRequests.map((r) => (
              <ChangeRequestCard key={r.id} request={r} />
            ))}
          </View>
        </View>
      ) : null}
      <Card className="mb-6 p-3">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Pressable onPress={() => setMonth(addMonths(month, -1))} className="rounded-xl p-2" accessibilityLabel="Mês anterior">
            <ChevronLeft color={t.foreground} size={20} />
          </Pressable>
          <View className="items-center">
            <Text className="font-display text-xl font-bold">
              {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
            </Text>
            <View className="flex-row">
              <Text className="text-xs text-muted">
                {monthTotal} {monthTotal === 1 ? "aula" : "aulas"} no mês
              </Text>
              {!today.startsWith(month) ? (
                <Pressable
                  onPress={() => {
                    setMonth(today.slice(0, 7));
                    setPicked(today);
                  }}
                >
                  <Text className="text-xs font-semibold text-bandeira-600 underline dark:text-bandeira-100"> · voltar para hoje</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => setMonth(addMonths(month, 1))} className="rounded-xl p-2" accessibilityLabel="Próximo mês">
            <ChevronRight color={t.foreground} size={20} />
          </Pressable>
        </View>
        <View className="flex-row">
          {HEADER.map((d) => (
            <Text key={d} className="flex-1 text-center text-[11px] font-bold text-muted">
              {d}
            </Text>
          ))}
        </View>
        <View className="mt-1 flex-row flex-wrap">
          {Array.from({ length: grid.days }, (_, i) => {
            const date = addDays(grid.start, i);
            const inMonth = date.startsWith(month);
            const all = byDay.get(date) ?? [];
            const active = all.filter((o) => !o.cancelled);
            const isSel = date === selected;
            return (
              <View key={date} style={{ width: `${100 / 7}%` }} className="p-0.5">
                <Pressable
                  onPress={() => {
                    setPicked(date);
                    if (!inMonth) setMonth(date.slice(0, 7));
                  }}
                  accessibilityLabel={`${dayLabel(date, today)}: ${active.length ? active.map((o) => `${o.time} ${o.schedule.student?.full_name}`).join(", ") : "sem aulas"}`}
                  className={cn("min-h-16 rounded-xl border p-1", isSel ? "border-bandeira-500" : "border-transparent", inMonth ? "bg-background" : "opacity-40", date < today && "opacity-60")}
                >
                  <View className={cn("mb-0.5 size-6 items-center justify-center rounded-full", date === today && "bg-bandeira-500")}>
                    <Text className={cn("text-xs font-bold", date === today && "text-white")}>{Number(date.slice(8, 10))}</Text>
                  </View>
                  {active.slice(0, 2).map((o) => (
                    <View key={o.schedule.id} className="mb-0.5 rounded bg-bandeira-50 px-0.5 dark:bg-bandeira-500/20">
                      <Text className="text-[10px] font-semibold leading-4 text-bandeira-700 dark:text-bandeira-100" numberOfLines={1}>
                        {(o.schedule.student?.full_name ?? "").split(" ")[0]}
                      </Text>
                    </View>
                  ))}
                  {active.length > 2 ? <Text className="text-[10px] font-bold text-muted">+{active.length - 2}</Text> : null}
                  {!active.length && all.some((o) => o.cancelled) ? <Text className="text-[10px] font-semibold text-pitanga-600">✕</Text> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>
      <View className="mb-6">
        <Text className="mb-2 font-display text-xl font-bold">
          {dayLabel(selected, today)}
          {selected === today || selected === addDays(today, 1) ? <Text className="font-display text-xl text-muted">, {ddmm(selected)}</Text> : null}
        </Text>
        {dayOcc.length ? <OccurrenceList occurrences={dayOcc} today={today} managerId={profile.id} showStudent /> : <Text className="text-sm text-muted">Nenhuma aula neste dia.</Text>}
        {selected >= today ? (
          <View className="mt-3 rounded-3xl border border-border bg-surface p-4">
            <Pressable onPress={() => setAdding((a) => !a)}>
              <Text className="font-display font-bold">
                {adding ? "−" : "+"} Agendar aula ({WEEKDAYS[weekdayOf(selected)].toLowerCase()}, {ddmm(selected)})
              </Text>
            </Pressable>
            {adding ? (
              <View className="mt-4">
                {students.length ? <ScheduleForm key={selected} students={students} today={today} date={selected} onDone={() => setAdding(false)} /> : <Text className="text-sm text-muted">Convide um aluno primeiro.</Text>}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <View>
        <Text className="mb-2 font-display text-xl font-bold">
          Semana de {ddmm(weekStart)} a {ddmm(weekEnd)}
        </Text>
        {weekStudents.size ? (
          <View className="gap-2">
            {[...weekStudents.values()]
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
              .map((s) => (
                <View key={s.name + s.slots[0]} className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>{s.name}</Text>
                  <Text className="text-xs text-muted">{s.slots.join(" · ")}</Text>
                </View>
              ))}
          </View>
        ) : (
          <Text className="text-sm text-muted">Nenhuma aula nesta semana.</Text>
        )}
      </View>
    </Screen>
  );
}
