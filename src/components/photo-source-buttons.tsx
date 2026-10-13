"use client";

import { useRef } from "react";
import { Camera, Images, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Dois botões para escolher uma foto: "Tirar foto" (abre a câmera) e "Galeria" (escolhe uma
 * imagem salva). Com `capture` o celular só abre a câmera; por isso a galeria tem um input próprio.
 */
export function PhotoSourceButtons({
  onPick,
  disabled,
  pending,
  size = "md",
  camera = "environment",
  className,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
  pending?: boolean;
  size?: "sm" | "md";
  /** Câmera traseira (aparelhos) ou frontal (selfie). */
  camera?: "environment" | "user";
  className?: string;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = "";
  };
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <input ref={cameraRef} type="file" accept="image/*" capture={camera} className="hidden" onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handle} />
      <Button type="button" size={size} onClick={() => cameraRef.current?.click()} disabled={disabled || pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        Tirar foto
      </Button>
      <Button type="button" size={size} variant="secondary" onClick={() => galleryRef.current?.click()} disabled={disabled || pending}>
        <Images className="size-4" aria-hidden />
        Galeria
      </Button>
    </div>
  );
}
