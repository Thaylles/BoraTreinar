import { useState } from "react";
import { Pressable, View } from "react-native";
import { CalendarClock, CalendarX2, Repeat, RotateCcw, Trash2 } from "lucide-react-native";
import { WEEKDAYS, WEEKDAYS_SHORT, addDays, dayLabel, mondayOf, weekdayOf, type Occurrence, type ScheduleLike } from "@/lib/schedule";
import { form } from "~/lib/api";
import { confirmAsk } from "~/lib/confirm";
import { useCall, useFormAction } from "~/lib/use-action";
import { Button, FormMessage, Input, Text, useTheme } from "~/ui";
import { cx as cn } from "~/ui/cn";
import { Sheet, WhatsAppButton } from "~/ui/extras";
import { Checkbox, DateField, Segmented, Select, TextField, TimeField } from "~/ui/forms";

type S = ScheduleLike & {
  personal_id: string;
  student: { id: string; full_name: string; phone: string | null } | null;
  personal: { full_name: string } | null;
};
export type PendingChange = { id: string; new_date: string; new_time: string };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const okState = (r: unknown) => !!(r as { result?: { ok?: string } } | null)?.result?.ok;

/** Próximas aulas por dia. O Personal dono remarca/cancela; o aluno pede troca. */
export function OccurrenceList({
  occurrences,
  today,
  managerId,
  showStudent = false,
  showPersonal = false,
  studentChanges,
}: {
  occurrences: Occurrence<S>[];
  today: string;
  managerId?: string;
  showStudent?: boolean;
  showPersonal?: boolean;
  studentChanges?: Map<string, PendingChange>;
}) {
  const t = useTheme();
  const toggle = useCall("personal/agenda#toggleOccurrence");
  const cancelChange = useCall("aluno/aula-actions#cancelClassChange");
  if (!occurrences.length) return <Text className="text-sm text-muted">Nenhuma aula nos próximos dias.</Text>;
  const days = [...new Set(occurrences.map((o) => o.date))];
  return (
    <View className="gap-4">
      {days.map((day) => (
        <View key={day}>
          <Text className={cn("mb-1 text-sm font-bold", day === today ? "text-bandeira-600 dark:text-bandeira-100" : "text-muted")}>{dayLabel(day, today)}</Text>
          <View className="gap-2">
            {occurrences
              .filter((o) => o.date === day)
              .map((o) => {
                const canManage = managerId && o.schedule.personal_id === managerId;
                const pending = studentChanges?.get(`${o.schedule.id}|${o.date}`);
                const canRequest = studentChanges && !o.cancelled && o.date >= today;
                return (
                  <View key={`${o.schedule.id}-${o.date}`} className={cn("flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-3", o.cancelled && "opacity-60")}>
                    <Text className={cn("font-display text-xl font-extrabold", o.cancelled && "line-through")}>{o.time}</Text>
                    <View className="min-w-0 flex-1">
                      {showStudent ? <Text className="text-sm font-semibold" numberOfLines={1}>{o.schedule.student?.full_name}</Text> : null}
                      {showPersonal ? <Text className="text-sm font-semibold" numberOfLines={1}>com {o.schedule.personal?.full_name}</Text> : null}
                      <Text className="text-xs text-muted">
                        {o.schedule.duration_minutes} min
                        {o.schedule.ends_on === o.schedule.starts_on ? " · aula única" : ""}
                        {o.cancelled ? (o.rescheduled ? ` · ${o.reason?.toLowerCase() ?? "remarcada"}` : ` · cancelada${o.reason ? `: ${o.reason}` : ""}`) : ""}
                      </Text>
                      {canRequest && pending ? (
                        <Text className="mt-1 text-xs font-semibold text-anil-700 dark:text-ipe-400">
                          🔄 Troca pedida para {WEEKDAYS_SHORT[weekdayOf(pending.new_date)].toLowerCase()} {ddmm(pending.new_date)} às {pending.new_time.slice(0, 5)} · aguardando o Personal
                        </Text>
                      ) : null}
                    </View>
                    {canRequest ? (
                      pending ? (
                        <Pressable
                          className="rounded-xl px-2.5 py-1.5"
                          onPress={async () => {
                            if (await confirmAsk("Desistir do pedido de troca?", { ok: "Desistir" })) await cancelChange.run(form({ id: pending.id }));
                          }}
                        >
                          <Text className="text-xs font-semibold text-muted">Desistir</Text>
                        </Pressable>
                      ) : (
                        <ChangeRequestButton scheduleId={o.schedule.id} date={o.date} time={o.time} weekday={o.schedule.weekday} today={today} personalName={o.schedule.personal?.full_name} />
                      )
                    ) : null}
                    {showStudent && !o.cancelled ? <WhatsAppButton phone={o.schedule.student?.phone} compact /> : null}
                    {canManage && !o.cancelled && o.date >= today ? (
                      <RescheduleButton
                        scheduleId={o.schedule.id}
                        date={o.date}
                        time={o.time}
                        weekday={o.schedule.weekday}
                        recurring={o.schedule.ends_on !== o.schedule.starts_on}
                        today={today}
                        studentName={o.schedule.student?.full_name}
                      />
                    ) : null}
                    {canManage ? (
                      <Pressable
                        className="rounded-xl p-2"
                        accessibilityLabel={o.cancelled ? (o.rescheduled ? "Desfazer remarcação" : "Reativar aula") : "Cancelar esta data"}
                        onPress={async () => {
                          const msg = o.cancelled
                            ? o.rescheduled
                              ? `Desfazer a remarcação? A aula volta para ${ddmm(o.date)} às ${o.time} e o aluno será avisado.`
                              : `Reativar a aula de ${ddmm(o.date)} às ${o.time}?`
                            : `Cancelar a aula de ${ddmm(o.date)} às ${o.time}? O aluno será avisado.`;
                          if (await confirmAsk(msg, { destructive: !o.cancelled })) await toggle.run(form({ schedule_id: o.schedule.id, date: o.date, cancel: o.cancelled ? "0" : "1" }));
                        }}
                      >
                        {o.cancelled ? <RotateCcw color={t.muted} size={20} /> : <CalendarX2 color={t.pitanga600} size={20} />}
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** "Pedir troca" do aluno: outro dia (mesma semana ou a seguinte) e horário. */
export function ChangeRequestButton({ scheduleId, date, time, weekday, today, personalName }: { scheduleId: string; date: string; time: string; weekday: number; today: string; personalName?: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const monday = mondayOf(date);
  const min = monday > today ? monday : today;
  const max = addDays(monday, 13);
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [note, setNote] = useState("");
  const { state, pending, submit } = useFormAction("aluno/aula-actions#requestClassChange");
  return (
    <>
      <Pressable onPress={() => setOpen(true)} className="flex-row items-center gap-1 rounded-xl border border-border px-2.5 py-1.5">
        <Repeat color={t.dark ? t.ipe400 : t.anil700} size={16} />
        <Text className="text-xs font-semibold text-anil-700 dark:text-ipe-400">Pedir troca</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Pedir troca de aula" sub={`${WEEKDAYS[weekday]}, ${ddmm(date)} às ${time}${personalName ? ` · com ${personalName}` : ""}`}>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField label="Novo dia" value={newDate} onChange={setNewDate} />
          </View>
          <View className="flex-1">
            <TimeField label="Horário" value={newTime} onChange={setNewTime} />
          </View>
        </View>
        <Text className="text-xs text-muted">
          Escolha um dia desta semana ou da próxima (de {ddmm(min)} a {ddmm(max)}).
        </Text>
        <TextField label="Recado para o Personal (opcional)" value={note} onChangeText={setNote} maxLength={300} multiline placeholder="Ex.: tenho consulta nesse horário" />
        <FormMessage state={state?.error ? state : null} />
        <Button
          loading={pending}
          onPress={async () => {
            const r = await submit({ schedule_id: scheduleId, date, new_date: newDate, new_time: newTime, note });
            if (okState(r)) setOpen(false);
          }}
        >
          Enviar pedido
        </Button>
      </Sheet>
    </>
  );
}

/** "Remarcar" (Personal): só esta aula ou, na semanal, esta e as próximas. */
export function RescheduleButton({ scheduleId, date, time, weekday, recurring, today, studentName }: { scheduleId: string; date: string; time: string; weekday: number; recurring: boolean; today: string; studentName?: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"unica" | "serie">("unica");
  const [newDate, setNewDate] = useState(date);
  const [newTime, setNewTime] = useState(time);
  const [wd, setWd] = useState(String(weekday));
  const { state, pending, submit } = useFormAction("personal/agenda#rescheduleClass");
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Remarcar aula" className="rounded-xl p-2">
        <CalendarClock color={t.dark ? t.ipe400 : t.anil700} size={20} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Remarcar aula" sub={`${studentName ? `${studentName} · ` : ""}${WEEKDAYS[weekday]}, ${ddmm(date)} às ${time}`}>
        {recurring ? (
          <Segmented
            options={[
              { value: "unica", label: "Só esta aula" },
              { value: "serie", label: "Esta e as próximas" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as typeof mode)}
          />
        ) : null}
        {mode === "unica" ? (
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField label="Nova data" value={newDate} onChange={setNewDate} hint={`De ${ddmm(today)} até ${ddmm(addDays(today, 60))}`} />
            </View>
            <View className="flex-1">
              <TimeField label="Horário" value={newTime} onChange={setNewTime} />
            </View>
          </View>
        ) : (
          <>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Select label="Novo dia" value={wd} onChange={setWd} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
              </View>
              <View className="flex-1">
                <TimeField label="Horário" value={newTime} onChange={setNewTime} />
              </View>
            </View>
            <Text className="text-xs text-muted">Vale a partir de {ddmm(date)}: daí em diante as aulas ficam sempre no novo dia e horário. As anteriores não mudam.</Text>
          </>
        )}
        <FormMessage state={state?.error ? state : null} />
        <Button
          loading={pending}
          onPress={async () => {
            const r = await submit({ schedule_id: scheduleId, date, mode, new_date: mode === "unica" ? newDate : undefined, weekday: mode === "serie" ? wd : undefined, start_time: newTime });
            if (okState(r)) setOpen(false);
          }}
        >
          Remarcar e avisar o aluno
        </Button>
      </Sheet>
    </>
  );
}

/** Agendar aula semanal (um ou mais dias) ou única. */
export function ScheduleForm({ studentId, students, today, date, defaultKind = "semanal", onDone }: { studentId?: string; students?: { id: string; full_name: string }[]; today: string; date?: string; defaultKind?: "semanal" | "unica"; onDone?: () => void }) {
  const day = date && date >= today ? date : today;
  const [student, setStudent] = useState(studentId ?? "");
  const [kind, setKind] = useState(defaultKind);
  const [days, setDays] = useState<number[]>(date ? [weekdayOf(day)] : []);
  const [perDay, setPerDay] = useState(false);
  const [time, setTime] = useState("07:00");
  const [times, setTimes] = useState<Record<number, string>>({});
  const [duration, setDuration] = useState("60");
  const [onDate, setOnDate] = useState(day);
  const [startsOn, setStartsOn] = useState(day);
  const [notes, setNotes] = useState("");
  const { state, pending, submit } = useFormAction("personal/agenda#addSchedule");
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  const multi = kind === "semanal" && perDay && days.length > 1;
  return (
    <View className="gap-4">
      {!studentId ? <Select label="Aluno" value={student} onChange={setStudent} placeholder="Escolha o aluno…" options={(students ?? []).map((s) => ({ value: s.id, label: s.full_name }))} /> : null}
      <Segmented
        options={[
          { value: "semanal", label: "Toda semana" },
          { value: "unica", label: "Aula única" },
        ]}
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
      />
      {kind === "semanal" ? (
        <View>
          <Text className="mb-2 text-sm font-semibold">
            Dias da semana <Text className="text-sm text-muted">(marque um ou mais)</Text>
          </Text>
          <View className="flex-row gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => {
              const on = days.includes(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => setDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                  accessibilityState={{ checked: on }}
                  className={cn("flex-1 items-center rounded-xl border-2 py-2", on ? "border-bandeira-500 bg-bandeira-500" : "border-border")}
                >
                  <Text className={cn("text-xs font-bold", on ? "text-white" : "text-muted")}>{WEEKDAYS_SHORT[i]}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="mt-1 text-xs text-muted">
            {days.length > 1 ? `${days.length} aulas por semana. ` : ""}Repete toda semana até você remover. Dá para cancelar datas avulsas.
          </Text>
          {days.length > 1 ? (
            <Checkbox checked={perDay} onChange={setPerDay} className="mt-2">
              Horário diferente em cada dia
            </Checkbox>
          ) : null}
        </View>
      ) : (
        <DateField label="Data" value={onDate} onChange={setOnDate} />
      )}
      {multi ? (
        <View className="flex-row flex-wrap gap-3">
          {ordered.map((d) => (
            <View key={d} style={{ width: "47%" }}>
              <TimeField label={WEEKDAYS[d]} value={times[d] ?? time} onChange={(v) => setTimes((x) => ({ ...x, [d]: v }))} />
            </View>
          ))}
        </View>
      ) : null}
      <View className="flex-row gap-3">
        {!multi ? (
          <View className="flex-1">
            <TimeField label="Horário" value={time} onChange={setTime} />
          </View>
        ) : null}
        <View className="flex-1">
          <Select label="Duração" value={duration} onChange={setDuration} options={[30, 45, 60, 75, 90, 120].map((m) => ({ value: String(m), label: `${m} min` }))} />
        </View>
      </View>
      {kind === "semanal" ? <DateField label="A partir de" value={startsOn} onChange={setStartsOn} /> : null}
      <Input value={notes} onChangeText={setNotes} maxLength={200} placeholder="Observação (opcional): local, foco da aula…" accessibilityLabel="Observação" />
      <FormMessage state={state} />
      <Button
        loading={pending}
        onPress={async () => {
          const perDayTimes: Record<string, string> = {};
          if (multi) for (const d of ordered) perDayTimes[`time_${d}`] = times[d] ?? time;
          const r = await submit({
            student_id: student,
            kind,
            weekday: kind === "semanal" ? days.map(String) : undefined,
            on_date: kind === "unica" ? onDate : undefined,
            start_time: time,
            duration,
            starts_on: kind === "semanal" ? startsOn : undefined,
            notes,
            ...perDayTimes,
          });
          if (okState(r)) onDone?.();
        }}
      >
        {kind === "semanal" && days.length > 1 ? `Agendar ${days.length} aulas por semana` : "Agendar aula"}
      </Button>
    </View>
  );
}

export type ChangeRequest = {
  id: string;
  on_date: string;
  new_date: string;
  new_time: string;
  note: string | null;
  student: { full_name: string } | null;
  schedule: { start_time: string } | null;
};

/** Pedido de troca de aula de um aluno: o Personal aceita (remarca) ou recusa. */
export function ChangeRequestCard({ request: r }: { request: ChangeRequest }) {
  const [reply, setReply] = useState("");
  const { state, pending, submit } = useFormAction("personal/agenda#answerClassChange");
  const [which, setWhich] = useState<"1" | "0" | null>(null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <View className="gap-3 rounded-2xl border-2 border-ipe-400 bg-surface p-3">
      <Text className="text-sm">
        <Text className="text-sm font-bold">{r.student?.full_name ?? "Aluno"}</Text> quer trocar a aula de{" "}
        <Text className="text-sm font-bold">
          {WEEKDAYS[weekdayOf(r.on_date)].toLowerCase()}, {ddmm(r.on_date)} às {r.schedule?.start_time.slice(0, 5)}
        </Text>{" "}
        para{" "}
        <Text className="text-sm font-bold">
          {WEEKDAYS[weekdayOf(r.new_date)].toLowerCase()}, {ddmm(r.new_date)} às {r.new_time.slice(0, 5)}
        </Text>
        .
      </Text>
      {r.note ? (
        <View className="rounded-xl bg-border/40 px-3 py-2">
          <Text className="text-sm text-muted">💬 {r.note}</Text>
        </View>
      ) : null}
      <Input value={reply} onChangeText={setReply} maxLength={300} placeholder="Resposta para o aluno (opcional)" accessibilityLabel="Resposta para o aluno" />
      <FormMessage state={state?.error ? state : null} />
      <View className="flex-row gap-2">
        {(["1", "0"] as const).map((v) => (
          <Button
            key={v}
            variant={v === "1" ? "primary" : "ghost"}
            className={cn("flex-1", v === "0" && "border border-border")}
            loading={pending && which === v}
            disabled={pending}
            onPress={() => {
              setWhich(v);
              void submit({ id: r.id, accept: v, reply });
            }}
          >
            {v === "1" ? "Aceitar e remarcar" : "Recusar"}
          </Button>
        ))}
      </View>
    </View>
  );
}

/** Lista das aulas cadastradas (lado do Personal, na página do aluno). */
export function ScheduleRows({ schedules, meId }: { schedules: (S & { notes: string | null })[]; meId: string }) {
  const t = useTheme();
  const del = useCall("personal/agenda#deleteSchedule");
  return (
    <View className="mb-3 gap-1">
      {schedules.map((s) => (
        <View key={s.id} className="flex-row items-center justify-between gap-2 rounded-xl bg-border/30 px-3 py-2">
          <View className="flex-1">
            <Text className="text-sm">
              {s.ends_on && s.ends_on === s.starts_on ? (
                <>
                  <Text className="text-sm font-bold">Aula única</Text> em {ddmm(s.starts_on)}
                </>
              ) : (
                <Text className="text-sm font-bold">
                  {s.weekday === 0 || s.weekday === 6 ? "Todo" : "Toda"} {WEEKDAYS[s.weekday].toLowerCase()}
                </Text>
              )}{" "}
              às {s.start_time.slice(0, 5)} · {s.duration_minutes} min
              {s.personal_id !== meId ? <Text className="text-sm text-muted"> · com {s.personal?.full_name}</Text> : null}
            </Text>
            {s.notes ? <Text className="text-xs text-muted">{s.notes}</Text> : null}
          </View>
          {s.personal_id === meId ? (
            <Pressable
              accessibilityLabel="Remover aula"
              className="rounded-lg p-1.5"
              onPress={async () => {
                if (await confirmAsk("Remover esta aula da agenda?", { ok: "Remover", destructive: true })) await del.run(form({ id: s.id }));
              }}
            >
              <Trash2 color={t.muted} size={16} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
