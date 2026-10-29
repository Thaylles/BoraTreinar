"use client";

import { useState, useTransition } from "react";
import { Droplets, X } from "lucide-react";
import { addWater, waterToday } from "@/app/agua-actions";
import { bottleLabel, liters } from "@/lib/water";
import type { WaterToday } from "@/lib/water-server";
import { WaterButtons } from "./water-card";

/** Durante o treino: botão de água no topo; abre as garrafas para registrar com um toque. */
export function WaterQuickAdd() {
  const [open, setOpen] = useState(false);
  const [water, setWater] = useState<WaterToday | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    setMsg(null);
    if (next)
      start(async () => {
        const res = await waterToday();
        if (res.ok) setWater(res.water);
      });
  }

  function add(ml: number) {
    start(async () => {
      const res = await addWater(ml);
      if (!res.ok) return setMsg(res.error);
      setWater(res.water);
      setMsg(`+${bottleLabel(ml)} registrado 💧`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Registrar água"
        className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border text-anil-500 hover:bg-anil-500/10"
      >
        <Droplets className="size-5" aria-hidden />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-background px-4 py-3 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">
              Quanto você bebeu?
              {water && (
                <span className="ml-1 font-normal text-muted">
                  Hoje: {liters(water.totalMl)}
                  {water.goalMl ? ` de ${liters(water.goalMl)}` : ""}
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="rounded-lg p-1 text-muted hover:bg-border/50"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <WaterButtons disabled={pending} onAdd={add} />
          {msg && (
            <p role="status" className="mt-2 text-center text-sm text-muted">
              {msg}
            </p>
          )}
        </div>
      )}
    </>
  );
}
