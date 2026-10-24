"use client";

import { useState } from "react";
import { Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import type { MonthSummary } from "@/lib/month-summary";

const W = 1080;
const H = 1350;
const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min} min`);
const kg = (n: number) => `${Math.round(n).toLocaleString("pt-BR")} kg`;

function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let t = text;
  while (ctx.measureText(t).width > max && t.length > 4) t = `${t.slice(0, -2).trimEnd()}…`;
  return t;
}

/** Imagem 1080×1350 (feed/stories do Instagram, status do WhatsApp) desenhada no aparelho. */
async function drawImage(s: MonthSummary, names: Record<string, string>): Promise<Blob | null> {
  await document.fonts?.ready;
  const display = getComputedStyle(document.querySelector(".font-display") ?? document.body).fontFamily;
  const body = getComputedStyle(document.body).fontFamily;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#009c3b");
  g.addColorStop(1, "#004d1e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Faixa amarela e azul (bandeira) no topo
  ctx.fillStyle = "#ffc72c";
  ctx.fillRect(0, 0, W, 14);
  ctx.fillStyle = "#1a3f99";
  ctx.fillRect(0, 14, W, 6);

  const pad = 80;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 44px ${display}`;
  ctx.fillText("BoraTreinar", pad, 110);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.font = `600 40px ${body}`;
  ctx.fillText(s.label, pad, 170);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 220px ${display}`;
  ctx.fillText(String(s.sessions), pad - 8, 390);
  const numW = ctx.measureText(String(s.sessions)).width;
  ctx.font = `800 72px ${display}`;
  ctx.fillText(s.sessions === 1 ? "treino" : "treinos", pad + numW + 24, 390);

  const stats = [
    [String(s.activeDays.length), "dias treinados"],
    [s.perWeek.toLocaleString("pt-BR"), "por semana"],
    [hours(s.minutes), "treinando"],
    [kg(s.volume), "levantados"],
  ];
  const boxW = (W - pad * 2 - 24) / 2;
  stats.forEach(([v, l], i) => {
    const x = pad + (i % 2) * (boxW + 24);
    const y = 450 + Math.floor(i / 2) * 170;
    ctx.fillStyle = "rgba(255,255,255,.13)";
    ctx.beginPath();
    ctx.roundRect(x, y, boxW, 146, 28);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.font = `600 30px ${body}`;
    ctx.fillText(l, x + 32, y + 52);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 60px ${display}`;
    ctx.fillText(fit(ctx, v, boxW - 64), x + 32, y + 118);
  });

  let y = 850;
  ctx.font = `700 38px ${body}`;
  if (s.cardio.minutes) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`🏃 ${s.cardio.minutes} min de cardio${s.cardio.km ? ` · ${s.cardio.km.toLocaleString("pt-BR")} km` : ""}`, pad, y);
    y += 70;
  }
  if (s.prs.length) {
    ctx.fillStyle = "#ffd45c";
    ctx.fillText(`🏆 ${s.prs.length} ${s.prs.length === 1 ? "recorde" : "recordes"} no mês`, pad, y);
    y += 58;
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 34px ${body}`;
    for (const p of s.prs.slice(0, 3)) {
      ctx.fillText(fit(ctx, `${names[p.id] ?? "Exercício"} · ${kg(p.load)}`, W - pad * 2), pad, y);
      y += 50;
    }
  }

  // Dias treinados: uma bolinha por dia do mês
  const daysInMonth = new Date(Number(s.month.slice(0, 4)), Number(s.month.slice(5, 7)), 0).getDate();
  const active = new Set(s.activeDays.map((d) => Number(d.slice(8))));
  const r = 13;
  const gap = (W - pad * 2) / 16;
  for (let d = 1; d <= daysInMonth; d++) {
    const i = d - 1;
    const cx = pad + r + (i % 16) * gap;
    const cy = H - 190 + Math.floor(i / 16) * 44;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = active.has(d) ? "#ffc72c" : "rgba(255,255,255,.18)";
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,.75)";
  ctx.font = `600 28px ${body}`;
  ctx.fillText("Bora treinar! 🇧🇷", pad, H - 50);

  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/** Compartilhar o resumo: imagem (Instagram, etc.), texto no WhatsApp ou baixar a imagem. */
export function MonthShare({ summary, names, text }: { summary: MonthSummary; names: Record<string, string>; text: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileName = `boratreinar-${summary.month}.png`;

  async function image() {
    const blob = await drawImage(summary, names);
    if (!blob) throw new Error("sem imagem");
    return new File([blob], fileName, { type: "image/png" });
  }
  function download(file: File) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: fileName,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function share() {
    setBusy(true);
    setMsg(null);
    try {
      const file = await image();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        download(file);
        setMsg("Imagem baixada. Agora é só postar no Instagram ou mandar no WhatsApp. 📸");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setMsg("Não deu para gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      download(await image());
    } finally {
      setBusy(false);
    }
  }

  if (!summary.sessions) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={share}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-anil-700 py-3.5 font-display text-lg font-bold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Share2 className="size-5" aria-hidden />}
        Compartilhar (Instagram, WhatsApp…)
      </button>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-2.5 font-display font-bold text-[#0b3d1f] transition hover:brightness-105"
        >
          <MessageCircle className="size-4" aria-hidden /> Texto no WhatsApp
        </a>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-border bg-surface py-2.5 font-display font-bold transition hover:border-bandeira-500 disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden /> Baixar imagem
        </button>
      </div>
      {msg && (
        <p role="status" className="text-center text-sm text-muted">
          {msg}
        </p>
      )}
    </div>
  );
}
