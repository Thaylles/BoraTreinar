// Testes de unidade das funções puras. Rodar com: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhoneBR, normalizePhoneBR } from "../phone.ts";
import { whatsappLink } from "../whatsapp.ts";
import { exportFileName, planCsv, repsLabel, restLabel } from "../plan-export.ts";
import { buildStudentReport, reportHtml, ruleSuggestions, sessionsLine, suggestionSets } from "../report.ts";
import { computeDashboard, periodFor, shiftPeriod, weightChange, type SummarySession } from "../stats.ts";
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
  assert.ok(sug.length >= 3 && sug.length <= 4);
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
