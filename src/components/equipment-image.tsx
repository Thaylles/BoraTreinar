import {
  ArrowUpFromLine,
  BicepsFlexed,
  ChevronsUp,
  Footprints,
  Grid3x3,
  Hand,
  HeartPulse,
  PersonStanding,
  Shield,
} from "lucide-react";
import { equipmentImageSrc, groupLabel, type Equipment, type MuscleGroup } from "@/lib/catalog";
import { cn } from "@/lib/cn";

const GROUP_ICON: Record<MuscleGroup, typeof Shield> = {
  peito: Shield,
  costas: ChevronsUp,
  ombros: ArrowUpFromLine,
  biceps: BicepsFlexed,
  triceps: BicepsFlexed,
  antebraco: Hand,
  quadriceps: Footprints,
  posterior: Footprints,
  gluteos: Footprints,
  adutores: Footprints,
  panturrilha: Footprints,
  abdomen: Grid3x3,
  cardio: HeartPulse,
  corpo_inteiro: PersonStanding,
};

/** Imagem do equipamento ou placeholder com o ícone do grupo muscular. */
export function EquipmentImage({
  equipment,
  className,
}: {
  equipment: Pick<Equipment, "name" | "image_path" | "image_url" | "muscle_group">;
  className?: string;
}) {
  const src = equipmentImageSrc(equipment);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagens do Storage/estáticas, já comprimidas
      <img
        src={src}
        alt={equipment.name}
        loading="lazy"
        className={cn("aspect-[4/3] w-full rounded-2xl bg-ipe-100 object-cover", className)}
      />
    );
  }
  const Icon = GROUP_ICON[equipment.muscle_group];
  return (
    <div
      role="img"
      aria-label={`${equipment.name} (sem foto)`}
      className={cn(
        "flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-anil-700/5 text-anil-700 dark:bg-white/5 dark:text-ipe-400",
        className,
      )}
    >
      <Icon className="size-1/4" aria-hidden />
      <span className="text-xs font-semibold">{groupLabel(equipment.muscle_group)}</span>
    </div>
  );
}
