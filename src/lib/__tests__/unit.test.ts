// Testes de unidade das funções puras. Rodar com: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhoneBR, normalizePhoneBR } from "../phone.ts";
import { whatsappLink } from "../whatsapp.ts";
import { exportFileName, planCsv, repsLabel, restLabel } from "../plan-export.ts";
import { buildStudentReport, reportHtml, ruleSuggestions, sessionsLine, suggestionSets } from "../report.ts";
import { computeDashboard, periodFor, shiftPeriod, weightChange, type SummarySession } from "../stats.ts";
import { achievementStats, shortNumber } from "../achievements.ts";
import { brl, packageSummary, parseMoney, paymentStatus, pricePerClass } from "../finance.ts";
import { addDays, addMonths, mondayOf, monthGrid, upcomingOccurrences, weekdayOf } from "../schedule.ts";

test("normaliza telefone brasileiro com DDI 55", () => {
  assert.equal(normalizePhoneBR("(11) 99999-0000"), "5511999990000");
  assert.equal(normalizePhoneBR("11 3333-4444"), "551133334444");
  assert.equal(normalizePhoneBR("+55 21 98888-7777"), "5521988887777");
  assert.equal(normalizePhoneBR("0 11 99999 0000"), "5511999990000");
  assert.equal(normalizePhoneBR("5511999990000"), "5511999990000");
  assert.equal(normalizePhoneBR("12345"), null);
  assert.equal(normalizePhoneBR(""), null);
});

test("formata telefone para exibição", () => {
  assert.equal(formatPhoneBR("5511999990000"), "(11) 99999-0000");
});

test("link do WhatsApp abre a conversa com a mensagem correta", () => {
  const link = whatsappLink("(11) 99999-0000");
  assert.equal(
    link,
    "https://wa.me/5511999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F%20Confirmado%20nosso%20treino%20hoje%3F",
  );
  assert.equal(decodeURIComponent(new URL(link!).searchParams.get("text")!), "Olá, tudo bem? Confirmado nosso treino hoje?");
  assert.equal(whatsappLink(null), null);
});

test("datas civis e dia da semana", () => {
  assert.equal(weekdayOf("2026-10-12"), 1); // segunda
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("ocorrências da agenda respeitam dia, vigência e cancelamentos", () => {
  const s = [
    { id: "a", weekday: 1, start_time: "07:00:00", duration_minutes: 60, starts_on: "2026-10-01", ends_on: null },
    { id: "b", weekday: 3, start_time: "18:30:00", duration_minutes: 45, starts_on: "2026-10-20", ends_on: null },
  ];
  const occ = upcomingOccurrences(s, [{ schedule_id: "a", on_date: "2026-10-12", reason: "Feriado" }], "2026-10-11", 14);
  assert.deepEqual(
    occ.map((o) => `${o.date} ${o.time} ${o.cancelled ? "X" : "ok"}`),
    ["2026-10-12 07:00 X", "2026-10-19 07:00 ok", "2026-10-21 18:30 ok"],
  );
  assert.equal(occ[0].reason, "Feriado");
  assert.equal(occ[0].rescheduled, false);
  const moved = upcomingOccurrences(
    s,
    [{ schedule_id: "a", on_date: "2026-10-12", reason: "Remarcada para 14/10 às 18:00", rescheduled_to: "c" }],
    "2026-10-11",
    7,
  );
  assert.equal(moved[0].cancelled && moved[0].rescheduled, true);
});

test("grade do calendário mensal começa na segunda e termina no domingo", () => {
  // Outubro/2026: dia 1 é quinta; dia 31 é sábado.
  assert.deepEqual(monthGrid("2026-10"), { start: "2026-09-28", days: 35 });
  // Fevereiro/2027: dia 1 é segunda; dia 28 é domingo.
  assert.deepEqual(monthGrid("2027-02"), { start: "2027-02-01", days: 28 });
  assert.equal(mondayOf("2026-10-11"), "2026-10-05");
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
});

test("aula única aparece só no seu dia; semanal repete o mês todo", () => {
  const schedules = [
    { id: "w", weekday: 1, start_time: "07:00", duration_minutes: 60, starts_on: "2026-10-01", ends_on: null },
    { id: "u", weekday: 3, start_time: "18:00", duration_minutes: 60, starts_on: "2026-10-14", ends_on: "2026-10-14" },
  ];
  const { start, days } = monthGrid("2026-10");
  const occ = upcomingOccurrences(schedules, [{ schedule_id: "w", on_date: "2026-10-19", reason: null }], start, days);
  assert.deepEqual(occ.filter((o) => o.schedule.id === "u").map((o) => o.date), ["2026-10-14"]);
  assert.deepEqual(occ.filter((o) => o.schedule.id === "w").map((o) => o.date), ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.ok(occ.find((o) => o.date === "2026-10-19")?.cancelled);
});

const sess = (date: string, ex: [string, number, boolean?][], kind: "ficha" | "livre" = "ficha"): SummarySession => ({
  id: date,
  started_at: `${date}T10:00:00Z`,
  date,
  kind,
  duration: 3600,
  ex: ex.map(([e, max, pr]) => ({ e, max, vol: max * 30, sets: 3, reps: 30, pr: !!pr })),
});

test("períodos semanal e mensal com o anterior para comparar", () => {
  const w = periodFor("semana", "2026-10-11");
  assert.deepEqual([w.from, w.to, w.prevFrom, w.prevTo], ["2026-10-05", "2026-10-11", "2026-09-28", "2026-10-04"]);
  const m = periodFor("mes", "2026-03-15");
  assert.deepEqual([m.from, m.to, m.prevFrom, m.prevTo, m.label], ["2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28", "Março de 2026"]);
  assert.equal(shiftPeriod(w, -1), "2026-09-28");
  assert.equal(shiftPeriod(m, 1), "2026-04-01");
});

test("dashboard: progressão, maiores aumentos, recordes, sequência e volume", () => {
  const sessions = [
    sess("2026-09-22", [["supino", 20], ["agach", 40], ["remada", 30]]),
    sess("2026-09-29", [["supino", 22], ["agach", 50]]),
    sess("2026-10-06", [["supino", 25, true], ["agach", 50], ["remada", 25]]),
    sess("2026-10-08", [["supino", 24], ["rosca", 10]], "livre"),
  ];
  const d = computeDashboard(sessions, periodFor("semana", "2026-10-08"), "2026-10-08");
  assert.equal(d.totals.sessions, 2);
  assert.equal(d.prevTotals.sessions, 1);
  assert.equal(d.totals.sets, 15);
  assert.equal(d.totals.volume, (25 + 50 + 25 + 24 + 10) * 30);
  const byId = Object.fromEntries(d.progress.map((p) => [p.id, p]));
  assert.equal(byId.supino.trend, "up");
  assert.equal(byId.supino.delta, 3); // 25 na semana × 22 da última vez
  assert.equal(byId.agach.trend, "same");
  assert.equal(byId.remada.trend, "down"); // 25 × 30 de duas semanas antes
  assert.equal(byId.rosca.trend, "new");
  assert.deepEqual(d.topGains.map((p) => p.id), ["supino"]);
  assert.deepEqual(d.prs, [{ id: "supino", load: 25, date: "2026-10-06" }]);
  assert.equal(d.streakWeeks, 3);
  assert.equal(d.bestVolume?.date, "2026-10-06");
  assert.equal(d.bestVolume?.allTime, true);
  assert.equal(d.weeks.length, 8);
  assert.deepEqual(d.weeks.at(-1), { week: "2026-10-05", sessions: 2, volume: 134 * 30 });
});

test("semana em andamento sem treino não zera a sequência; semana vazia no meio zera", () => {
  const sessions = [sess("2026-09-21", [["a", 10]]), sess("2026-09-28", [["a", 10]])];
  assert.equal(computeDashboard(sessions, periodFor("semana", "2026-10-06"), "2026-10-06").streakWeeks, 2);
  assert.equal(computeDashboard(sessions, periodFor("semana", "2026-10-13"), "2026-10-13").streakWeeks, 0);
});

test("variação de peso usa a primeira e a última pesagem do período", () => {
  const p = periodFor("mes", "2026-10-01");
  const ws = [
    { measured_on: "2026-09-30", weight_kg: 90 },
    { measured_on: "2026-10-02", weight_kg: 80 },
    { measured_on: "2026-10-20", weight_kg: 78.6 },
  ];
  assert.deepEqual(weightChange(ws, p), { first: 80, last: 78.6, delta: -1.4, count: 2 });
  assert.equal(weightChange(ws, periodFor("mes", "2026-08-01")), null);
});

test("relatório do aluno: fichas e livres, tendência de carga e peso só com permissão", () => {
  const sessions: SummarySession[] = [
    { ...sess("2026-09-29", [["sup", 20], ["agc", 50], ["rem", 30]]), plan: "Treino A" },
    { ...sess("2026-10-05", [["sup", 22, true], ["agc", 50], ["rem", 25]]), plan: "Treino A" },
    { ...sess("2026-10-07", [["sup", 22]]), plan: "Treino B" },
    { ...sess("2026-10-09", [["ros", 10]], "livre"), plan: null },
  ];
  const base = {
    id: "s1",
    name: "Ana <Souza>",
    sessions,
    names: { sup: "Supino", agc: "Agachamento", rem: "Remada", ros: "Rosca" },
    period: periodFor("semana", "2026-10-11"),
    today: "2026-10-11",
  };
  const weights = [
    { measured_on: "2026-10-05", weight_kg: 70 },
    { measured_on: "2026-10-11", weight_kg: 71.2 },
  ];
  const r = buildStudentReport({ ...base, weights });
  assert.equal(r.sessions, 3);
  assert.deepEqual(r.plans, [{ name: "Treino A", count: 1 }, { name: "Treino B", count: 1 }]);
  assert.equal(r.free, 1);
  assert.equal(sessionsLine(r), "3 treinos: Treino A, Treino B, treino livre");
  const t = Object.fromEntries(r.exercises.map((e) => [e.name, e.trend]));
  assert.deepEqual(t, { Supino: "up", Agachamento: "same", Remada: "down", Rosca: "new" });
  assert.deepEqual(r.weight, { visible: true, change: { first: 70, last: 71.2, delta: 1.2 } });

  const hidden = buildStudentReport({ ...base, weights: null });
  assert.deepEqual(hidden.weight, { visible: false });

  const sug = ruleSuggestions(r);
  assert.ok(sug.length >= 3 && sug.length <= 6);
  assert.ok(sug.some((x) => x.includes("estagnada em Agachamento")));
  assert.ok(sug.some((x) => x.includes("caiu em Remada")));

  const html = reportHtml({ week_start: "2026-10-05", week_end: "2026-10-11", students: [{ ...r, suggestions: sug }], ai: false }, {
    personalName: "Dora Lima",
    reportUrl: "https://x/personal/relatorios/1",
  });
  assert.ok(html.includes("Ana &lt;Souza&gt;"), "escapa o nome do aluno");
  assert.ok(html.includes("05/10 a 11/10"));
  assert.ok(html.includes("diminuiu"));
  assert.ok(!buildStudentReport({ ...base, weights: null }).weight.visible && !reportHtml(
    { week_start: "2026-10-05", week_end: "2026-10-11", students: [hidden], ai: false },
    { personalName: "Dora", reportUrl: "https://x" },
  ).includes("Peso:"), "sem permissão o peso não aparece no e-mail");
});

test("semana em detalhe: exercícios pulados, séries não feitas, cardio e meta", async () => {
  const { weekDetail, ruleSuggestions: rules, ruleMotivation, reportHtml: html } = await import("../report.ts");
  const { goalProgress, cardioSetLine, goalLabel } = await import("../cardio.ts");
  const cardioWeek = {
    week_start: "2026-10-12", minutes: 45, km: 4.5, intense_minutes: 30, days: 1,
    goal: { kind: "minutos" as const, target: 90, min_speed_kmh: null, min_level: null, by_personal: true },
  };
  assert.deepEqual(goalProgress(cardioWeek), { value: 45, target: 90, unit: "min", pct: 50, done: false });
  assert.equal(cardioSetLine({ minutes: 30, km: 4.5, speed: 9, incline: 1, level: null }), "30 min · 4,5 km · 9 km/h · inclinação 1%");
  assert.equal(goalLabel({ kind: "intenso", target: 60, min_speed_kmh: 8.5, min_level: 6 }), "60 min em ritmo forte por semana (≥ 8,5 km/h ou nível ≥ 6)");
  const set = (session_id: string, equipment_id: string, done: boolean, extra = {}) => ({
    session_id, equipment_id, done, reps: 10, duration_min: null, distance_km: null, speed_kmh: null, incline_pct: null, level: null, ...extra,
  });
  const d = weekDetail({
    sessions: [
      { id: "w1", date: "2026-10-13", plan_id: "p1", plan_name: "Treino A", duration_seconds: 3600, effort: 4, pain: true, feedback: "Joelho incomodou" },
      { id: "w2", date: "2026-10-15", plan_id: null, plan_name: null, duration_seconds: 1800, effort: 3, pain: false, feedback: null },
    ],
    sets: [
      set("w1", "sup", true), set("w1", "sup", false), set("w1", "sup", true),
      set("w1", "est", true, { reps: 30, duration_min: 30, distance_km: 4.5, speed_kmh: 9 }),
      set("w2", "bic", true, { reps: 15, duration_min: 15, level: 6 }),
      set("w2", "ros", false), set("w2", "ros", false),
    ],
    planItems: { p1: ["sup", "agc", "est"] },
    equipment: {
      sup: { name: "Supino", cardio: false }, agc: { name: "Agachamento", cardio: false }, ros: { name: "Rosca", cardio: false },
      est: { name: "Esteira", cardio: true }, bic: { name: "Bicicleta", cardio: true },
    },
    cardioWeek,
    weeklyGoal: 3,
    lastWorkout: "2026-10-15",
    achievements: [{ emoji: "✅", title: "Tá pago!" }],
  });
  assert.equal(d.days, 2);
  assert.equal(d.minutes, 90);
  // Agachamento trocado pelo Leg press (aparelho ocupado): não conta como pulado.
  const swapped = weekDetail({
    sessions: [{ id: "w1", date: "2026-10-13", plan_id: "p1", plan_name: "Treino A", duration_seconds: 600, effort: null, pain: false, feedback: null }],
    sets: [set("w1", "leg", true, { replaced_equipment_id: "agc" })],
    planItems: { p1: ["agc"] },
    equipment: { agc: { name: "Agachamento", cardio: false }, leg: { name: "Leg press", cardio: false } },
    cardioWeek: null, weeklyGoal: null, lastWorkout: null, achievements: [],
  });
  assert.deepEqual(swapped.missed, []);
  assert.deepEqual(
    d.missed.map((m) => [m.name, m.kind, m.count, m.total ?? null]),
    [["Agachamento", "pulado", 1, null], ["Rosca", "pulado", 1, null], ["Supino", "incompleto", 1, 3]],
  );
  assert.deepEqual(d.cardio.items.map((i) => i.line), ["30 min · 4,5 km · 9 km/h", "15 min · nível 6"]);
  assert.equal(d.cardio.goal?.pct, 50);
  assert.deepEqual(d.effort, { avg: 3.5, rated: 2, pain: 1, feedback: ["Joelho incomodou"] });

  const r = buildStudentReport({
    id: "s9", name: "Duda Lima", sessions: [], names: {}, period: periodFor("semana", "2026-10-18"), today: "2026-10-18", weights: null,
  });
  const s = { ...r, sessions: 2, detail: d };
  const sug = rules(s);
  assert.ok(sug.length <= 6);
  assert.ok(sug.some((x) => x.startsWith("Treinou 2 de 3 dias")));
  assert.ok(sug.some((x) => x.includes("Deixou de fazer Agachamento e Rosca")));
  assert.ok(sug.some((x) => x.startsWith("Cardio abaixo da meta: 45 min de 90 min")));
  assert.ok(sug.some((x) => x.startsWith("Relatou dor em 1 treino")));
  assert.ok(ruleMotivation(s).includes("Duda"));
  const out = html({ week_start: "2026-10-12", week_end: "2026-10-18", students: [{ ...s, suggestions: sug, motivation: ruleMotivation(s) }], ai: false }, {
    personalName: "Dora", reportUrl: "https://x",
  });
  for (const t of ["Deixou de fazer", "Agachamento — não fez", "1 de 3 séries não feitas", "Cardio: fez (45 min", "45 min de 90 min", "Esteira: 30 min", "Mensagem de motivação", "Tá pago!", "Relatou dor"])
    assert.ok(out.includes(t), `e-mail com "${t}"`);
  const none = html({ week_start: "2026-10-12", week_end: "2026-10-18", students: [{ ...s, detail: { ...d, cardio: { ...d.cardio, minutes: 0, items: [], goal: null } } }], ai: false }, {
    personalName: "Dora", reportUrl: "https://x",
  });
  assert.ok(none.includes("Cardio: não fez nesta semana"));
});

test("sugestões por regras para quem não treinou", () => {
  const r = buildStudentReport({
    id: "s2", name: "Bia", sessions: [], names: {}, period: periodFor("semana", "2026-10-11"), today: "2026-10-11", weights: null,
  });
  const sug = ruleSuggestions(r);
  assert.equal(sug.length, 2);
  assert.ok(sug[0].startsWith("Não treinou"));
});

test("exportação da ficha em CSV: uma linha por série e colunas para anotar", () => {
  const plan = {
    name: "Treino A",
    goal: "Força",
    notes: null,
    validUntil: "2026-12-31",
    studentName: "Ana Souza",
    creatorName: "Dora",
    items: [
      { name: "Supino; reto", group: "Peito", sets: 3, repsMin: 8, repsMax: 10, load: 40, bodyweight: false, rest: 90, notes: 'Desça "devagar"' },
      { name: "Prancha", group: "Abdômen", sets: 2, repsMin: 30, repsMax: 30, load: null, bodyweight: true, rest: 30, notes: null },
    ],
  };
  const csv = planCsv(plan, 2);
  assert.ok(csv.startsWith("﻿"), "BOM para o Excel");
  const lines = csv.trim().split("\r\n");
  const header = lines.findIndex((l) => l.startsWith("Ordem;"));
  assert.equal(lines.length - header - 1, 5, "3 + 2 séries");
  assert.ok(lines[header].endsWith("Dia 2 carga (kg);Dia 2 reps;Dia 2 feito"));
  assert.ok(lines[header + 1].startsWith('1;"Supino; reto";Peito;1/3;8–10;40 kg;1min30;"Desça ""devagar""";'));
  assert.ok(lines.at(-1)!.startsWith("2;Prancha;Abdômen;2/2;30;peso corporal;30s;;"));
  assert.ok(lines.includes("Validade;31/12/2026"));
  assert.equal(exportFileName(plan), "treino-a-ana-souza");
  assert.equal(repsLabel(12, 12), "12");
  assert.equal(restLabel(120), "2min");
});

test("relatório compara regras e IAs com rótulo de cada fonte", () => {
  const base = buildStudentReport({
    id: "s3", name: "Caio", sessions: [], names: {}, period: periodFor("semana", "2026-10-11"), today: "2026-10-11", weights: null,
  });
  const s = {
    ...base,
    suggestions: ruleSuggestions(base),
    aiSuggestions: [
      { source: "gemini" as const, items: ["Combine 2 treinos curtos na semana."] },
      { source: "claude" as const, items: [] },
    ],
  };
  assert.deepEqual(suggestionSets(s).map((x) => x.source), ["regras", "gemini"], "IA sem sugestão não aparece");
  assert.deepEqual(suggestionSets(base).map((x) => x.source), [], "relatório antigo sem sugestões");
  const html = reportHtml(
    { week_start: "2026-10-05", week_end: "2026-10-11", students: [s], ai: true, aiStatus: [{ source: "gemini", ok: true }] },
    { personalName: "Dora", reportUrl: "https://x" },
  );
  assert.ok(html.includes("Sugestões · Regras (sem IA)"));
  assert.ok(html.includes("Sugestões · Gemini (IA do Google)"));
  assert.ok(html.includes("Fase de testes"));
});

test("progressão de carga: sugere subir quando bateu tudo", async () => {
  const { suggestProgression, loadStep } = await import("../progression.ts");
  const sets = (n: number, load: number, reps: number) => Array.from({ length: n }, () => ({ load, reps }));
  assert.deepEqual(suggestProgression({ lastSets: sets(3, 40, 12), targetSets: 3, repsMin: 10, repsMax: 12 }), { from: 40, to: 42.5, step: 2.5 });
  assert.deepEqual(suggestProgression({ lastSets: sets(4, 8, 15), targetSets: 3, repsMin: 15, repsMax: null }), { from: 8, to: 9, step: 1 });
  // Faltou repetição, faltou série, cardio ou sem histórico: não sugere.
  assert.equal(suggestProgression({ lastSets: [...sets(2, 40, 12), { load: 40, reps: 9 }], targetSets: 3, repsMin: 10, repsMax: 12 }), null);
  assert.equal(suggestProgression({ lastSets: sets(2, 40, 12), targetSets: 3, repsMin: 10, repsMax: 12 }), null);
  assert.equal(suggestProgression({ lastSets: sets(3, 40, 12), targetSets: 3, repsMin: 10, repsMax: 12, cardio: true }), null);
  assert.equal(suggestProgression({ lastSets: null, targetSets: 3, repsMin: 10, repsMax: 12 }), null);
  assert.equal(suggestProgression({ lastSets: sets(3, 0, 20), targetSets: 3, repsMin: 10, repsMax: 12 }), null);
  // Sem faixa na ficha: referência de 12 repetições.
  assert.equal(suggestProgression({ lastSets: sets(3, 50, 10), targetSets: 3, repsMin: null, repsMax: null }), null);
  assert.equal(loadStep(120), 5);
});

test("bi-set e tri-set agrupam com os exercícios seguintes", async () => {
  const { groupedWithNext } = await import("../plans.ts");
  assert.deepEqual(groupedWithNext(["biset", null, null]), [1, 0, 0]);
  assert.deepEqual(groupedWithNext(["triset", null, null, "dropset"]), [2, 1, 0, 0]);
  assert.deepEqual(groupedWithNext([null, "biset"]), [0, 0]);
  assert.deepEqual(groupedWithNext(["triset", null]), [1, 0]);
});

test("financeiro: valor por aula, moeda e status", () => {
  assert.equal(pricePerClass({ kind: "por_aula", price: 50, classes_per_week: null }), 50);
  // 2x por semana = 52/12 × 2 ≈ 8,67 aulas no mês → R$ 350 ÷ 8,67 ≈ R$ 40,38
  assert.equal(Math.round(pricePerClass({ kind: "mensal", price: 350, classes_per_week: 2 }) * 100) / 100, 40.38);
  assert.equal(brl(1234.5), "R$ 1.234,50");
  assert.equal(packageSummary({ kind: "mensal", price: 200, classes_per_week: 1 }), "1x por semana · R$ 200,00/mês");
  assert.equal(parseMoney("1.200,50"), 1200.5);
  assert.equal(parseMoney("350"), 350);
  assert.equal(parseMoney("R$ 49,9"), 49.9);
  assert.equal(parseMoney("abc"), null);
  const p = { paid_at: null, due_on: "2026-10-10", amount: 200 };
  assert.equal(paymentStatus(p, "2026-10-09"), "pendente");
  assert.equal(paymentStatus(p, "2026-10-10"), "hoje");
  assert.equal(paymentStatus(p, "2026-10-11"), "atrasado");
  assert.equal(paymentStatus({ ...p, paid_at: "2026-10-09T10:00:00Z" }, "2026-10-11"), "pago");
});

test("conquistas: resumo, pontos e números curtos", () => {
  const base = { emoji: "🏆", category: "X", hidden: false, progress: 1, threshold: 1, sort: 1, title: "t", description: "d" };
  const rows = [
    { ...base, code: "a", tier: "bronze" as const, unlocked_at: "2026-10-01T10:00:00Z" },
    { ...base, code: "b", tier: "ouro" as const, unlocked_at: "2026-10-02T10:00:00Z" },
    { ...base, code: "c", tier: "platina" as const, unlocked_at: null, hidden: true, title: null, description: null },
  ];
  const s = achievementStats(rows);
  assert.equal(s.unlocked, 2);
  assert.equal(s.points, 105);
  assert.equal(s.hiddenLeft, 1);
  assert.equal(s.byTier.find((t) => t.tier === "ouro")?.got, 1);
  assert.equal(shortNumber(12500), "12,5 mil");
  assert.equal(shortNumber(1_000_000), "1 mi");
  assert.equal(shortNumber(250), "250");
});

test("séries de aquecimento", async () => {
  const { warmupSets, guessBar } = await import("../plates.ts");
  assert.deepEqual(warmupSets(30, 20), [{ load: 20, reps: 10 }], "abaixo de 40 kg: 1 série, nunca menos que a barra");
  assert.deepEqual(warmupSets(80, 20), [{ load: 40, reps: 8 }, { load: 60, reps: 4 }], "a partir de 40 kg: 2 séries");
  assert.deepEqual(warmupSets(41, 0), [{ load: 20, reps: 8 }, { load: 30, reps: 4 }]);
  assert.deepEqual(warmupSets(8), [{ load: 4, reps: 10 }], "halter leve arredonda de 1 em 1 kg");
  assert.deepEqual(warmupSets(20, 20), [], "carga igual à barra não tem aquecimento");
  assert.deepEqual(warmupSets(0), []);
  assert.equal(guessBar("Supino reto com barra"), 20);
  assert.equal(guessBar("Barra fixa"), 0);
  assert.equal(guessBar("Leg press 45°"), 0);
});

test("anamnese: alertas por grupo muscular e levantamento", async () => {
  const { cautionsFor, healthSurvey, needsClearance } = await import("../health.ts");
  const base = {
    parq_yes: [], pain_regions: [], injury_regions: [], mobility_regions: [], muscle_pain: [], surgeries: [], conditions: [],
    medications: [], goals: [], activity_level: null, experience: null, sleep: null, smoker: null, notes: null,
  };
  const a = { ...base, pain_regions: ["joelho"], mobility_regions: ["ombro"], muscle_pain: ["posterior"], surgeries: ["joelho"], goals: ["hipertrofia"], activity_level: "ativo" };
  const c = cautionsFor(a);
  assert.deepEqual(c.quadriceps, ["dor: joelho", "cirurgia: joelho"]);
  assert.deepEqual(c.posterior, ["dor: joelho", "cirurgia: joelho", "dor muscular"]);
  assert.deepEqual(c.peito, ["mobilidade limitada: ombro"]);
  assert.equal(c.biceps, undefined);
  assert.deepEqual(cautionsFor(null), {});
  assert.ok(!needsClearance(a) && needsClearance({ parq_yes: ["tontura"] }));

  const s = healthSurvey([a, { ...base, parq_yes: ["tontura"], pain_regions: ["joelho", "lombar"], goals: ["hipertrofia", "saude"], smoker: true }]);
  assert.equal(s.total, 2);
  assert.equal(s.risk, 1);
  assert.equal(s.smokers, 1);
  assert.deepEqual(s.multi.find((q) => q.key === "pain_regions")!.counts.map((x) => [x.label, x.n]), [["Joelho", 2], ["Lombar", 1]]);
  assert.deepEqual(s.multi.find((q) => q.key === "goals")!.counts[0], { value: "hipertrofia", label: "Ganho de massa (hipertrofia)", n: 2 });
  assert.deepEqual(s.single.find((q) => q.key === "activity_level")!.counts, [{ value: "ativo", label: "3–4× por semana", n: 1 }]);
});

test("aparelho ocupado: candidatos do mesmo grupo e leitura da resposta da IA", async () => {
  const { rankAlternatives, parseSwap } = await import("../swaps.ts");
  const cat = [
    { id: "lp", name: "Leg press 45°", muscle_group: "quadriceps" },
    { id: "lph", name: "Leg press horizontal", muscle_group: "quadriceps" },
    { id: "hack", name: "Agachamento hack", muscle_group: "quadriceps" },
    { id: "ext", name: "Cadeira extensora", muscle_group: "quadriceps" },
    { id: "sup", name: "Supino reto com barra", muscle_group: "peito" },
  ];
  const lp = cat[0];
  assert.deepEqual(rankAlternatives(lp, cat).map((c) => c.id), ["lph", "hack", "ext"], "nome parecido primeiro, só o mesmo grupo");
  assert.deepEqual(rankAlternatives(lp, cat, { known: new Set(["ext"]) }).map((c) => c.id), ["ext", "lph", "hack"], "o que o aluno já fez vem antes");
  assert.deepEqual(rankAlternatives(lp, cat, { exclude: new Set(["lph"]), limit: 1 }).map((c) => c.id), ["hack"], "tira os que já estão no treino");
  assert.deepEqual(parseSwap({ ids: ["hack", "x", "hack", "ext", "lph"], motivo: "Mesmo padrão" }, ["hack", "ext", "lph"]), { ids: ["hack", "ext"], reason: "Mesmo padrão" });
  assert.deepEqual(parseSwap(null, ["a"]), { ids: [], reason: null });
});

test("Pix: chave, CRC e BR Code no padrão do Banco Central", async () => {
  const { crc16, pixPayload, normalizePixKey, formatPixKey } = await import("../pix.ts");
  assert.equal(crc16("123456789"), "29B1");
  // Exemplo do manual do BR Code (Bacen).
  assert.equal(
    pixPayload({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" }),
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D",
  );
  const code = pixPayload({ key: "paula@pix.com", name: "Paula Ünder Pereira da Silva Souza", city: "São José dos Campos", amount: 350, description: "Aulas de outubro" });
  assert.ok(code.includes("5406350.00"));
  assert.ok(code.includes("5925Paula Under Pereira da Si"));
  assert.ok(code.includes("6015Sao Jose dos Ca"));
  assert.ok(code.includes("0216Aulas de outubro"));
  assert.equal(code.slice(-4), (await import("../pix.ts")).crc16(code.slice(0, -4)));
  assert.deepEqual(normalizePixKey("cpf", "529.982.247-25"), { key: "52998224725" });
  assert.ok("error" in normalizePixKey("cpf", "111.111.111-11"));
  assert.deepEqual(normalizePixKey("cnpj", "11.222.333/0001-81"), { key: "11222333000181" });
  assert.deepEqual(normalizePixKey("telefone", "(11) 98888-7777"), { key: "+5511988887777" });
  assert.deepEqual(normalizePixKey("telefone", "+55 11 98888-7777"), { key: "+5511988887777" });
  assert.deepEqual(normalizePixKey("email", " Paula@Pix.com "), { key: "paula@pix.com" });
  assert.ok("error" in normalizePixKey("aleatoria", "abc"));
  assert.equal(formatPixKey("telefone", "+5511988887777"), "(11) 98888-7777");
  assert.equal(formatPixKey("cpf", "52998224725"), "529.982.247-25");
});

test("cidades do RS e idade", async () => {
  const { RS_CITIES } = await import("../cities-rs.ts");
  const { cityName, searchCities, citiesLabel, isCity } = await import("../cities.ts");
  const { ageOn, birthDateError } = await import("../age.ts");
  assert.equal(RS_CITIES.length, 497);
  assert.equal(cityName(4314902), "Porto Alegre");
  assert.ok(!isCity(3550308));
  assert.deepEqual(searchCities("caxias").map((c) => c.name), ["Caxias do Sul"]);
  assert.equal(searchCities("sao leo")[0].name, "São Leopoldo");
  assert.equal(searchCities("PELOTAS")[0].code, 4314407);
  assert.ok(searchCities("santa").length === 8);
  assert.equal(citiesLabel([4314902, 4304606]), "Porto Alegre e Canoas");
  assert.equal(citiesLabel([4314902, 4304606, 4305108, 4314407]), "Porto Alegre, Canoas, Caxias do Sul e mais 1");
  assert.equal(ageOn("1990-10-21", "2026-10-20"), 35);
  assert.equal(ageOn("1990-10-20", "2026-10-20"), 36);
  assert.equal(birthDateError("1990-10-20", "2026-10-20"), null);
  assert.ok(birthDateError("2015-01-01", "2026-10-20"));
  assert.ok(birthDateError("abc", "2026-10-20"));
});

test("execuções: todo exercício do catálogo padrão tem correspondência no banco público", async () => {
  const { publicDbMatch, mediaKey, videoPrompt, PUBLIC_DB_MATCH } = await import("../exercise-media.ts");
  const catalog = [
    "Crossover", "Crucifixo inclinado com halteres", "Crucifixo reto com halteres", "Flexão de braço", "Peck deck (voador)",
    "Supino declinado com barra", "Supino inclinado com barra", "Supino inclinado com halteres", "Supino inclinado no Smith",
    "Supino máquina", "Supino reto com barra", "Supino reto com halteres", "Barra fixa", "Levantamento terra",
    "Low row pegada neutra", "Pulldown na polia", "Puxada com triângulo", "Puxada frontal", "Puxada supinada",
    "Remada articulada pronada", "Remada baixa", "Remada cavalinho", "Remada curvada com barra",
    "Remada unilateral com halter (serrote)", "Crucifixo inverso (voador inverso)", "Desenvolvimento com barra",
    "Desenvolvimento com halteres", "Desenvolvimento máquina", "Elevação frontal", "Elevação lateral",
    "Encolhimento com halteres", "Face pull", "Remada alta", "Rosca alternada com halteres", "Rosca concentrada",
    "Rosca direta com barra", "Rosca martelo", "Rosca na polia", "Rosca Scott", "Mergulho nas paralelas", "Tríceps coice",
    "Tríceps corda", "Tríceps francês", "Tríceps pulley", "Tríceps testa", "Rosca de punho", "Afundo com halteres",
    "Agachamento búlgaro", "Agachamento hack", "Agachamento livre", "Agachamento no smith", "Cadeira extensora",
    "Leg press 45°", "Cadeira flexora", "Mesa flexora", "Stiff", "Cadeira abdutora", "Elevação pélvica",
    "Glúteo na polia (coice)", "Agachamento sumô com halter", "Cadeira adutora", "Panturrilha em pé",
    "Panturrilha no leg press", "Panturrilha sentado", "Abdominal (crunch)", "Abdominal infra (elevação de pernas)",
    "Abdominal na polia", "Abdominal oblíquo", "Prancha", "Bicicleta ergométrica", "Elíptico", "Esteira",
    "Flexão de joelhos em pé na máquina", "Serrote na máquina (low row)",
  ];
  assert.deepEqual(catalog.filter((n) => !publicDbMatch(n)), []);
  assert.equal(Object.keys(PUBLIC_DB_MATCH).length, catalog.length);
  assert.equal(mediaKey("  Tríceps   Francês "), "triceps frances");
  const prompt = videoPrompt({ name: "Rosca martelo", group: "Bíceps", description: "Cotovelos fixos." });
  assert.ok(prompt.includes("Rosca martelo") && prompt.includes("Cotovelos fixos.") && prompt.includes("No text"));
});

test("fotos com IA: situação da foto e pedido para a IA", async () => {
  const { STYLE_REFERENCES, catalogImagePrompt, photoStatus } = await import("../exercise-media.ts");
  const { existsSync } = await import("node:fs");
  for (const ref of STYLE_REFERENCES) assert.ok(existsSync(`public${ref}`), `referência existe: ${ref}`);
  assert.equal(photoStatus({ image_url: null, image_path: null, image_credit: null }), "sem");
  assert.equal(photoStatus({ image_url: "/catalogo/fotos/70-x.webp", image_path: null, image_credit: "Free Exercise DB (domínio público)" }), "fora");
  assert.equal(photoStatus({ image_url: "/catalogo/fotos/51-mesa-flexora-v2.webp", image_path: null, image_credit: null }), "fora");
  assert.equal(photoStatus({ image_url: "/catalogo/fotos/49-afundo-com-halteres.webp", image_path: null, image_credit: null }), "ok");
  assert.equal(photoStatus({ image_url: null, image_path: "admin/ia-1.webp", image_credit: null }), "ok");
  const p = catalogImagePrompt({ name: "RDL", group: "Glúteos", description: null, hint: "Romanian deadlift com barra" });
  assert.ok(p.includes('"RDL"') && p.includes("Romanian deadlift com barra") && p.includes("No text") && !p.includes("Execution notes"));
});

test("início: aula acontecendo agora e próxima ficha sugerida", async () => {
  const { classInProgress, classEnd, nextPlan } = await import("../schedule.ts");
  const s = { id: "s", weekday: 4, start_time: "18:00:00", duration_minutes: 60, starts_on: "2026-10-01", ends_on: null };
  const occ = [{ date: "2026-10-22", time: "18:00", schedule: s, cancelled: false, reason: null, rescheduled: false }];
  assert.equal(classInProgress(occ, "2026-10-22", "17:29"), undefined);
  assert.ok(classInProgress(occ, "2026-10-22", "17:30"), "30 min antes já aparece");
  assert.ok(classInProgress(occ, "2026-10-22", "18:59"));
  assert.equal(classInProgress(occ, "2026-10-22", "19:00"), undefined, "depois do fim some");
  assert.equal(classInProgress(occ, "2026-10-23", "18:10"), undefined, "outro dia não");
  assert.equal(classInProgress([{ ...occ[0], cancelled: true }], "2026-10-22", "18:10"), undefined, "cancelada não");
  assert.equal(classEnd(occ[0]), "19:00");
  const plans = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(nextPlan(plans, new Map([["a", "2026-10-20"], ["b", "2026-10-18"], ["c", "2026-10-21"]]))?.id, "b");
  assert.equal(nextPlan(plans, new Map([["a", "2026-10-20"]]))?.id, "b", "nunca treinada vem primeiro");
  assert.equal(nextPlan([], new Map()), undefined);
});

test("treino: duração do cardio e treino esquecido", async () => {
  const { parseBackdate, backdateDays, sessionWindow, cardioOnlyMinutes } = await import("../session-window.ts");
  // Treino esquecido
  assert.deepEqual(parseBackdate("2026-10-20T18:30", "60", "2026-10-24", "10:00"), { date: "2026-10-20", time: "18:30", minutes: 60 });
  assert.ok(parseBackdate("2026-10-17T07:00", "45", "2026-10-24", "10:00"), "7 dias atrás vale");
  assert.equal(parseBackdate("2026-10-16T07:00", "45", "2026-10-24", "10:00"), null, "8 dias atrás não");
  assert.equal(parseBackdate("2026-10-25T07:00", "45", "2026-10-24", "10:00"), null, "amanhã não");
  assert.equal(parseBackdate("2026-10-24T11:00", "45", "2026-10-24", "10:00"), null, "hoje mais tarde não");
  assert.equal(parseBackdate("2026-10-24T09:00", "2", "2026-10-24", "10:00"), null, "duração mínima");
  assert.equal(parseBackdate("2026-10-24T25:00", "60", "2026-10-24", "10:00"), null);
  assert.equal(parseBackdate(undefined, undefined, "2026-10-24", "10:00"), null);
  assert.deepEqual(backdateDays("2026-10-02"), ["2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29", "2026-09-28", "2026-09-27", "2026-09-26", "2026-09-25"]);
  // Só cardio
  assert.equal(cardioOnlyMinutes([{ cardio: true, done: true, minutes: 20 }, { cardio: true, done: true, minutes: 10 }]), 30);
  assert.equal(cardioOnlyMinutes([{ cardio: true, done: true, minutes: 20 }, { cardio: false, done: true, minutes: 0 }]), null, "com musculação vale o relógio");
  assert.equal(cardioOnlyMinutes([{ cardio: true, done: false, minutes: 20 }]), null);
  assert.equal(cardioOnlyMinutes([{ cardio: true, done: true, minutes: 30 }, { cardio: false, done: false, minutes: 0 }]), 30, "musculação não feita não conta");
  const now = "2026-10-24T12:00:00.000Z";
  assert.deepEqual(sessionWindow({ startedAt: "2026-10-24T11:58:00.000Z", now, cardioOnlyMinutes: 30 }), {
    started_at: "2026-10-24T11:30:00.000Z",
    finished_at: now,
  });
  assert.deepEqual(sessionWindow({ startedAt: "2026-10-24T11:00:00.000Z", now, cardioOnlyMinutes: null }), { started_at: "2026-10-24T11:00:00.000Z", finished_at: now });
  assert.deepEqual(sessionWindow({ startedAt: "x", now, cardioOnlyMinutes: null, backdate: { startedAt: "2026-10-20T21:00:00.000Z", minutes: 50 } }), {
    started_at: "2026-10-20T21:00:00.000Z",
    finished_at: "2026-10-20T21:50:00.000Z",
  });
  assert.equal(sessionWindow({ startedAt: "x", now, cardioOnlyMinutes: 25, backdate: { startedAt: "2026-10-20T21:00:00.000Z", minutes: 50 } }).finished_at, "2026-10-20T21:25:00.000Z");
});

// ─── Evolução para o Personal e resumo do mês ──────────────────
import { estimateOneRm, stagnationAlerts, strengthTrends, weeklyVolumeByGroup } from "../evolution.ts";
import { monthShareText, monthSummary } from "../month-summary.ts";

const evoSession = (date: string, ex: { e: string; max: number; reps?: number; sets?: number; rm?: number; pr?: boolean }[], plan = "A"): SummarySession => ({
  id: date + plan,
  started_at: `${date}T10:00:00Z`,
  date,
  kind: "ficha",
  plan,
  duration: 3600,
  ex: ex.map((x) => ({ e: x.e, max: x.max, vol: x.max * (x.reps ?? 10) * (x.sets ?? 3), sets: x.sets ?? 3, reps: (x.reps ?? 10) * (x.sets ?? 3), pr: !!x.pr, rm: x.rm ?? estimateOneRm(x.max, x.reps ?? 10) })),
});

test("1RM estimado (Epley) só para 1 a 12 repetições", () => {
  assert.equal(estimateOneRm(100, 10), 133.3);
  assert.equal(estimateOneRm(100, 1), 103.3);
  assert.equal(estimateOneRm(100, 15), null);
  assert.equal(estimateOneRm(0, 10), null);
});

test("séries por grupo muscular nas últimas 4 semanas, sem cardio", () => {
  const today = "2026-10-22"; // quinta
  const sessions = [
    evoSession("2026-10-20", [{ e: "supino", max: 60 }, { e: "esteira", max: 0 }]),
    evoSession("2026-10-13", [{ e: "supino", max: 60, sets: 4 }, { e: "remada", max: 50 }]),
    evoSession("2026-09-01", [{ e: "supino", max: 50 }]), // fora da janela
  ];
  const { weeks, groups } = weeklyVolumeByGroup(sessions, { supino: "peito", remada: "costas", esteira: "cardio" }, today);
  assert.deepEqual(weeks, ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  assert.deepEqual(groups.map((g) => [g.group, g.weeks]), [["peito", [0, 0, 4, 3]], ["costas", [0, 0, 3, 0]]]);
  assert.equal(groups[0].avg, 1.8);
});

test("força estimada: últimas 4 semanas × 4 anteriores", () => {
  const t = strengthTrends([evoSession("2026-09-10", [{ e: "supino", max: 60 }]), evoSession("2026-10-20", [{ e: "supino", max: 66 }])], "2026-10-22");
  assert.equal(t.length, 1);
  assert.equal(t[0].current, 88);
  assert.equal(t[0].previous, 80);
  assert.equal(t[0].deltaPct, 10);
});

test("alerta de estagnação: 3+ semanas sem subir carga", () => {
  const today = "2026-10-22";
  const flat = ["2026-09-24", "2026-10-01", "2026-10-08", "2026-10-15", "2026-10-20"].map((d) => evoSession(d, [{ e: "supino", max: 60 }]));
  const a = stagnationAlerts(flat, today);
  assert.equal(a.length, 1);
  assert.equal(a[0].weeks, 4);
  assert.equal(a[0].sessions, 4);
  // Subiu a carga na semana passada: sem alerta
  assert.equal(stagnationAlerts([...flat.slice(0, 4), evoSession("2026-10-20", [{ e: "supino", max: 62.5 }])], today).length, 0);
  // Mais repetições com a mesma carga também é evolução (força estimada subiu)
  assert.equal(stagnationAlerts([...flat.slice(0, 4), evoSession("2026-10-20", [{ e: "supino", max: 60, reps: 12 }])], today).length, 0);
  // Parou de fazer o exercício há mais de 2 semanas: sem alerta
  assert.equal(stagnationAlerts(flat.slice(0, 3), "2026-10-23").length, 0);
});

test("resumo do mês e texto para compartilhar", () => {
  const sessions = [
    evoSession("2026-09-30", [{ e: "supino", max: 50 }]),
    evoSession("2026-10-01", [{ e: "supino", max: 60, pr: true }], "LOWER"),
    evoSession("2026-10-01", [{ e: "agacho", max: 80 }], "LOWER"),
    evoSession("2026-10-08", [{ e: "agacho", max: 90, pr: true }], "UPPER"),
  ];
  const s = monthSummary(sessions, "2026-10", "2026-10-14", { minutes: 42.4, km: 5.04 });
  assert.equal(s.label, "Outubro de 2026");
  assert.equal(s.sessions, 3);
  assert.equal(s.prevSessions, 1);
  assert.deepEqual(s.activeDays, ["2026-10-01", "2026-10-08"]);
  assert.equal(s.perWeek, 1.5); // 3 treinos em 14 dias
  assert.equal(s.weeksActive, 2);
  assert.deepEqual(s.prs.map((p) => p.id), ["agacho", "supino"]);
  assert.deepEqual(s.topPlan, { name: "LOWER", count: 2 });
  assert.deepEqual(s.cardio, { minutes: 42, km: 5 });
  const text = monthShareText(s, { agacho: "Agachamento", supino: "Supino" });
  assert.match(text, /Meu outubro no BoraTreinar/);
  assert.match(text, /3 treinos em 2 dias/);
  assert.match(text, /2 recordes: Agachamento 90 kg, Supino 60 kg/);
  assert.match(text, /42 min de cardio · 5 km/);
});
