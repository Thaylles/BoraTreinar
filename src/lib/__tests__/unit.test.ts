// Testes de unidade das funções puras. Rodar com: npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhoneBR, normalizePhoneBR } from "../phone.ts";
import { whatsappLink } from "../whatsapp.ts";
import { addDays, upcomingOccurrences, weekdayOf } from "../schedule.ts";

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
});
