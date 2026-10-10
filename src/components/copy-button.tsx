"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copie o link:", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button type="button" variant="ipe" size="sm" onClick={copy}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copiado!" : label}
    </Button>
  );
}

export function ShareButton({ text, url }: { text: string; url: string }) {
  if (typeof navigator === "undefined" || !("share" in navigator)) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => navigator.share({ title: "BoraTreinar", text, url }).catch(() => {})}
    >
      <Share2 className="size-4" aria-hidden /> Compartilhar
    </Button>
  );
}
