import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Ficha pronta para exportar (já com nomes resolvidos). */
export type ExportPlan = {
  name: string;
  goal: string | null;
  notes: string | null;
  validUntil: string | null; // "YYYY-MM-DD"
  studentName: string | null;
  creatorName: string | null;
  items: {
    name: string;
    group: string;
    sets: number;
    repsMin: number | null;
    repsMax: number | null;
    load: number | null;
    bodyweight: boolean;
    rest: number;
    notes: string | null;
  }[];
};

const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function repsLabel(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}–${max}`;
  return String(min ?? max ?? "—");
}

export function loadLabel(load: number | null, bodyweight: boolean): string {
  if (load) return `${load.toLocaleString("pt-BR")} kg`;
  return bodyweight ? "peso corporal" : "—";
}

export function restLabel(s: number): string {
  if (s < 60) return `${s}s`;
  return s % 60 ? `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}` : `${s / 60}min`;
}

/** Nome de arquivo seguro: "treino-a-ana-souza". */
export function exportFileName(plan: ExportPlan): string {
  return [plan.name, plan.studentName]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "ficha";
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? "" : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV (separador ";" e BOM, para abrir certo no Excel em pt-BR).
 * Uma linha por série, com colunas em branco de carga/reps/feito para `days` dias.
 */
export function planCsv(plan: ExportPlan, days = 4): string {
  const meta: (string | null)[][] = [
    ["Ficha", plan.name],
    ["Aluno", plan.studentName],
    ["Objetivo", plan.goal],
    ["Validade", plan.validUntil ? ddmmyyyy(plan.validUntil) : null],
    ["Criada por", plan.creatorName],
    ["Observações", plan.notes],
  ];
  const lines = meta.filter(([, v]) => v).map((r) => r.map(csvCell).join(";"));
  const dayCols = Array.from({ length: days }, (_, i) => [`Dia ${i + 1} carga (kg)`, `Dia ${i + 1} reps`, `Dia ${i + 1} feito`]).flat();
  lines.push("");
  lines.push(
    ["Ordem", "Exercício", "Grupo muscular", "Série", "Repetições", "Carga sugerida", "Descanso", "Observações", ...dayCols]
      .map(csvCell)
      .join(";"),
  );
  plan.items.forEach((it, i) => {
    for (let s = 1; s <= it.sets; s++) {
      lines.push(
        [
          i + 1,
          it.name,
          it.group,
          `${s}/${it.sets}`,
          repsLabel(it.repsMin, it.repsMax),
          loadLabel(it.load, it.bodyweight),
          restLabel(it.rest),
          s === 1 ? it.notes : null,
          ...dayCols.map(() => null),
        ]
          .map(csvCell)
          .join(";"),
      );
    }
  });
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ─── PDF ──────────────────────────────────────────────────────────────

const GREEN = rgb(0, 0.612, 0.231);
const YELLOW = rgb(1, 0.78, 0.173);
const BLUE = rgb(0, 0.153, 0.463);
const INK = rgb(0.063, 0.129, 0.247);
const MUTED = rgb(0.36, 0.4, 0.47);
const LINE = rgb(0.78, 0.8, 0.84);
const ZEBRA = rgb(0.97, 0.97, 0.95);

/** As fontes padrão do PDF usam WinAnsi: troca o que não dá para desenhar. */
function safe(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text.replace(/\s+/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ch === "−" ? "-" : "";
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = safe(font, text).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let s = safe(font, text);
  if (font.widthOfTextAtSize(s, size) <= width) return s;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}…`, size) > width) s = s.slice(0, -1);
  return `${s}…`;
}

function brand(page: PDFPage, bold: PDFFont, x: number, y: number) {
  // Mini logo: quadrado verde, losango amarelo e círculo azul.
  page.drawRectangle({ x, y, width: 22, height: 22, color: GREEN });
  page.drawSvgPath("M 11 2 L 20 11 L 11 20 L 2 11 Z", { x, y: y + 22, color: YELLOW });
  page.drawCircle({ x: x + 11, y: y + 11, size: 5, color: BLUE });
  page.drawText("Bora", { x: x + 28, y: y + 6, size: 14, font: bold, color: GREEN });
  page.drawText("Treinar", { x: x + 28 + bold.widthOfTextAtSize("Bora", 14), y: y + 6, size: 14, font: bold, color: BLUE });
}

/**
 * PDF da ficha: página com os exercícios (retrato) e folha de registro para preencher
 * à mão (paisagem), com carga, repetições e "feito" de cada série em `days` dias.
 */
export async function planPdf(plan: ExportPlan, opts: { days?: number; generatedAt?: string } = {}): Promise<Uint8Array> {
  const days = Math.min(Math.max(opts.days ?? 5, 1), 8);
  const doc = await PDFDocument.create();
  doc.setTitle(`${plan.name}${plan.studentName ? ` — ${plan.studentName}` : ""}`);
  doc.setAuthor("BoraTreinar");
  doc.setCreator("BoraTreinar");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 40;

  // ── Página da ficha (A4 retrato) ──
  const W = 595.28;
  const H = 841.89;
  let page = doc.addPage([W, H]);
  let y = H - M;
  const footer = (p: PDFPage) =>
    p.drawText(safe(font, `Gerado pelo BoraTreinar${opts.generatedAt ? ` em ${opts.generatedAt}` : ""}`), {
      x: M,
      y: 20,
      size: 8,
      font,
      color: MUTED,
    });

  brand(page, bold, M, y - 22);
  y -= 50;
  for (const line of wrap(bold, plan.name, 22, W - 2 * M)) {
    page.drawText(line, { x: M, y, size: 22, font: bold, color: INK });
    y -= 26;
  }
  const meta = [
    plan.studentName && `Aluno: ${plan.studentName}`,
    plan.goal && `Objetivo: ${plan.goal}`,
    plan.validUntil && `Válida até ${ddmmyyyy(plan.validUntil)}`,
    plan.creatorName && `Montada por ${plan.creatorName}`,
  ].filter(Boolean) as string[];
  for (const m of meta) {
    page.drawText(fit(font, m, 11, W - 2 * M), { x: M, y, size: 11, font, color: MUTED });
    y -= 15;
  }
  if (plan.notes) {
    y -= 4;
    for (const line of wrap(font, plan.notes, 10, W - 2 * M - 16)) {
      page.drawText(line, { x: M + 8, y, size: 10, font, color: INK });
      y -= 13;
    }
  }
  y -= 10;

  const cols = [
    { label: "#", w: 22 },
    { label: "Exercício", w: 235 },
    { label: "Séries", w: 44 },
    { label: "Reps", w: 52 },
    { label: "Carga", w: 80 },
    { label: "Descanso", w: 82 },
  ];
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: GREEN });
    let x = M + 6;
    for (const c of cols) {
      page.drawText(c.label, { x, y: y, size: 9, font: bold, color: rgb(1, 1, 1) });
      x += c.w;
    }
    y -= 22;
  };
  header();
  plan.items.forEach((it, i) => {
    const noteLines = it.notes ? wrap(font, it.notes, 8.5, cols[1].w - 8) : [];
    const nameLines = wrap(bold, it.name, 10, cols[1].w - 8);
    const rowH = 8 + nameLines.length * 12 + 11 + noteLines.length * 10;
    if (y - rowH < M + 10) {
      footer(page);
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - rowH + 10, width: W - 2 * M, height: rowH, color: ZEBRA });
    let x = M + 6;
    const top = y;
    page.drawText(String(i + 1), { x, y: top, size: 10, font: bold, color: INK });
    x += cols[0].w;
    let ty = top;
    for (const l of nameLines) {
      page.drawText(l, { x, y: ty, size: 10, font: bold, color: INK });
      ty -= 12;
    }
    page.drawText(safe(font, it.group), { x, y: ty, size: 8.5, font, color: MUTED });
    ty -= 11;
    for (const l of noteLines) {
      page.drawText(l, { x, y: ty, size: 8.5, font, color: INK });
      ty -= 10;
    }
    x += cols[1].w;
    for (const [j, v] of [String(it.sets), repsLabel(it.repsMin, it.repsMax), loadLabel(it.load, it.bodyweight), restLabel(it.rest)].entries()) {
      page.drawText(fit(font, v, 10, cols[j + 2].w - 6), { x, y: top, size: 10, font, color: INK });
      x += cols[j + 2].w;
    }
    y -= rowH;
    page.drawLine({ start: { x: M, y: y + 10 }, end: { x: W - M, y: y + 10 }, thickness: 0.5, color: LINE });
  });
  footer(page);

  // ── Folha de registro (A4 paisagem) ──
  const LW = 841.89;
  const LH = 595.28;
  const fixed = [
    { label: "Exercício", w: 190 },
    { label: "Série", w: 34 },
    { label: "Alvo", w: 62 },
  ];
  const fixedW = fixed.reduce((a, c) => a + c.w, 0);
  const dayW = (LW - 2 * M - fixedW) / days;
  const sub = [
    { label: "kg", w: dayW * 0.4 },
    { label: "reps", w: dayW * 0.37 },
    { label: "ok", w: dayW * 0.23 },
  ];
  const rowH = 17;
  let lp: PDFPage;
  let ly = 0;
  const sheetHeader = () => {
    lp = doc.addPage([LW, LH]);
    ly = LH - M;
    brand(lp, bold, M, ly - 22);
    lp.drawText(fit(bold, `Folha de registro · ${plan.name}${plan.studentName ? ` · ${plan.studentName}` : ""}`, 14, LW - 2 * M - 140), {
      x: M + 120,
      y: ly - 16,
      size: 14,
      font: bold,
      color: INK,
    });
    ly -= 40;
    lp.drawText("Anote a carga e as repetições de cada série e marque \"ok\" quando fizer.", { x: M, y: ly, size: 9, font, color: MUTED });
    ly -= 26;
    // linha 1: "Dia N  __/__"
    lp.drawRectangle({ x: M, y: ly - 22, width: LW - 2 * M, height: 36, color: GREEN });
    let x = M;
    for (const c of fixed) {
      lp.drawText(c.label, { x: x + 4, y: ly - 14, size: 9, font: bold, color: rgb(1, 1, 1) });
      x += c.w;
    }
    for (let d = 0; d < days; d++) {
      lp.drawText(`Dia ${d + 1}   ____/____`, { x: x + 4, y: ly, size: 8.5, font: bold, color: rgb(1, 1, 1) });
      let sx = x;
      for (const s of sub) {
        lp.drawText(s.label, { x: sx + 4, y: ly - 16, size: 8, font, color: rgb(1, 1, 1) });
        sx += s.w;
      }
      lp.drawLine({ start: { x, y: ly + 14 }, end: { x, y: ly - 22 }, thickness: 0.8, color: rgb(1, 1, 1) });
      x += dayW;
    }
    ly -= 22;
  };
  sheetHeader();
  for (const it of plan.items) {
    if (ly - it.sets * rowH < M) sheetHeader();
    const blockTop = ly;
    for (let s = 1; s <= it.sets; s++) {
      const rowTop = ly;
      let x = M + fixed[0].w;
      lp!.drawText(`${s}`, { x: x + 4, y: rowTop - 12, size: 9, font, color: INK });
      x += fixed[1].w;
      lp!.drawText(fit(font, `${repsLabel(it.repsMin, it.repsMax)} × ${it.load ? `${it.load.toLocaleString("pt-BR")}kg` : it.bodyweight ? "PC" : "—"}`, 8.5, fixed[2].w - 6), {
        x: x + 4,
        y: rowTop - 12,
        size: 8.5,
        font,
        color: MUTED,
      });
      x += fixed[2].w;
      for (let d = 0; d < days; d++) {
        let sx = x;
        for (const [k, c] of sub.entries()) {
          if (k > 0) lp!.drawLine({ start: { x: sx, y: rowTop }, end: { x: sx, y: rowTop - rowH }, thickness: 0.4, color: LINE });
          if (k === 2) lp!.drawRectangle({ x: sx + c.w / 2 - 4.5, y: rowTop - rowH / 2 - 4.5, width: 9, height: 9, borderColor: MUTED, borderWidth: 0.7 });
          sx += c.w;
        }
        lp!.drawLine({ start: { x, y: rowTop }, end: { x, y: rowTop - rowH }, thickness: 0.8, color: MUTED });
        x += dayW;
      }
      ly -= rowH;
      lp!.drawLine({ start: { x: M + fixed[0].w, y: ly }, end: { x: LW - M, y: ly }, thickness: 0.4, color: LINE });
    }
    // nome do exercício ocupa as linhas das séries
    const nameLines = wrap(bold, it.name, 9, fixed[0].w - 8).slice(0, Math.max(1, it.sets));
    nameLines.forEach((l, k) => lp!.drawText(l, { x: M + 4, y: blockTop - 12 - k * 11, size: 9, font: bold, color: INK }));
    lp!.drawLine({ start: { x: M, y: ly }, end: { x: LW - M, y: ly }, thickness: 0.9, color: MUTED });
    lp!.drawLine({ start: { x: M + fixed[0].w, y: blockTop }, end: { x: M + fixed[0].w, y: ly }, thickness: 0.4, color: LINE });
    lp!.drawLine({ start: { x: M + fixed[0].w + fixed[1].w, y: blockTop }, end: { x: M + fixed[0].w + fixed[1].w, y: ly }, thickness: 0.4, color: LINE });
  }
  lp!.drawRectangle({ x: M, y: ly, width: LW - 2 * M, height: 0.01, borderColor: MUTED, borderWidth: 0.5 });
  if (ly - 50 > M) {
    lp!.drawText("Observações:", { x: M, y: ly - 22, size: 9, font: bold, color: INK });
    lp!.drawLine({ start: { x: M + 66, y: ly - 24 }, end: { x: LW - M, y: ly - 24 }, thickness: 0.5, color: LINE });
    lp!.drawLine({ start: { x: M, y: ly - 44 }, end: { x: LW - M, y: ly - 44 }, thickness: 0.5, color: LINE });
  }
  footer(lp!);

  return doc.save();
}
