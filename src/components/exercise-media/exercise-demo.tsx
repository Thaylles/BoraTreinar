import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/exercise-media";
import { MediaPreview } from "./media-preview";

/** "Como executar": GIF ou vídeo aprovado pelo admin (nada aparece se não houver). */
export async function ExerciseDemo({ equipmentId, name, className }: { equipmentId: string; name: string; className?: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_media")
    .select("path, kind, credit")
    .eq("equipment_id", equipmentId)
    .eq("status", "aprovado")
    .maybeSingle();
  if (!data?.path) return null;
  return (
    <figure className={className}>
      <figcaption className="mb-2 font-display text-lg font-bold">▶ Como executar</figcaption>
      <div className="mx-auto max-w-md">
        <MediaPreview url={mediaUrl(data.path)} kind={data.kind} alt={`Execução de ${name}`} />
      </div>
      {data.credit && <p className="mt-1 text-center text-[11px] text-muted">{data.credit}</p>}
    </figure>
  );
}
