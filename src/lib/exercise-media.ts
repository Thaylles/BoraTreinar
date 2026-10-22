/**
 * Execução dos exercícios (GIF/vídeo): correspondência com o banco público de fotos e
 * texto para a IA de vídeo. Funções puras.
 */

/** Banco público (Free Exercise DB, licença Unlicense): duas fotos por exercício (início e fim do movimento). */
export const PUBLIC_DB = {
  name: "Free Exercise DB",
  url: "https://github.com/yuhonas/free-exercise-db",
  imageBase: "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/",
};

/** Exercício do catálogo padrão → id no banco público (revisado à mão; o admin pode escolher outro). */
export const PUBLIC_DB_MATCH: Record<string, string> = {
  "crossover": "Cable_Crossover",
  "crucifixo inclinado com halteres": "Incline_Dumbbell_Flyes",
  "crucifixo reto com halteres": "Dumbbell_Flyes",
  "flexao de braco": "Pushups",
  "peck deck (voador)": "Butterfly",
  "supino declinado com barra": "Decline_Barbell_Bench_Press",
  "supino inclinado com barra": "Barbell_Incline_Bench_Press_-_Medium_Grip",
  "supino inclinado com halteres": "Incline_Dumbbell_Press",
  "supino inclinado no smith": "Smith_Machine_Incline_Bench_Press",
  "supino maquina": "Machine_Bench_Press",
  "supino reto com barra": "Barbell_Bench_Press_-_Medium_Grip",
  "supino reto com halteres": "Dumbbell_Bench_Press",
  "barra fixa": "Pullups",
  "levantamento terra": "Barbell_Deadlift",
  "low row pegada neutra": "Seated_Cable_Rows",
  "pulldown na polia": "Straight-Arm_Pulldown",
  "puxada com triangulo": "Close-Grip_Front_Lat_Pulldown",
  "puxada frontal": "Wide-Grip_Lat_Pulldown",
  "puxada supinada": "Underhand_Cable_Pulldowns",
  "remada articulada pronada": "Leverage_High_Row",
  "remada baixa": "Seated_Cable_Rows",
  "serrote na maquina (low row)": "Leverage_Iso_Row",
  "remada cavalinho": "T-Bar_Row_with_Handle",
  "remada curvada com barra": "Bent_Over_Barbell_Row",
  "remada unilateral com halter (serrote)": "One-Arm_Dumbbell_Row",
  "crucifixo inverso (voador inverso)": "Reverse_Machine_Flyes",
  "desenvolvimento com barra": "Barbell_Shoulder_Press",
  "desenvolvimento com halteres": "Dumbbell_Shoulder_Press",
  "desenvolvimento maquina": "Machine_Shoulder_Military_Press",
  "elevacao frontal": "Front_Dumbbell_Raise",
  "elevacao lateral": "Side_Lateral_Raise",
  "encolhimento com halteres": "Dumbbell_Shrug",
  "face pull": "Face_Pull",
  "remada alta": "Upright_Barbell_Row",
  "rosca alternada com halteres": "Dumbbell_Alternate_Bicep_Curl",
  "rosca concentrada": "Concentration_Curls",
  "rosca direta com barra": "Barbell_Curl",
  "rosca martelo": "Hammer_Curls",
  "rosca na polia": "Standing_Biceps_Cable_Curl",
  "rosca scott": "Preacher_Curl",
  "mergulho nas paralelas": "Dips_-_Triceps_Version",
  "triceps coice": "Tricep_Dumbbell_Kickback",
  "triceps corda": "Triceps_Pushdown_-_Rope_Attachment",
  "triceps frances": "Standing_Dumbbell_Triceps_Extension",
  "triceps pulley": "Triceps_Pushdown",
  "triceps testa": "EZ-Bar_Skullcrusher",
  "rosca de punho": "Palms-Up_Barbell_Wrist_Curl_Over_A_Bench",
  "afundo com halteres": "Dumbbell_Lunges",
  "agachamento bulgaro": "Split_Squat_with_Dumbbells",
  "agachamento hack": "Hack_Squat",
  "agachamento livre": "Barbell_Squat",
  "agachamento no smith": "Smith_Machine_Squat",
  "cadeira extensora": "Leg_Extensions",
  "leg press 45°": "Leg_Press",
  "cadeira flexora": "Seated_Leg_Curl",
  "mesa flexora": "Lying_Leg_Curls",
  "flexao de joelhos em pe na maquina": "Standing_Leg_Curl",
  "stiff": "Stiff-Legged_Barbell_Deadlift",
  "cadeira abdutora": "Thigh_Abductor",
  "elevacao pelvica": "Barbell_Hip_Thrust",
  "gluteo na polia (coice)": "Glute_Kickback",
  "agachamento sumo com halter": "Plie_Dumbbell_Squat",
  "cadeira adutora": "Thigh_Adductor",
  "panturrilha em pe": "Standing_Calf_Raises",
  "panturrilha no leg press": "Calf_Press_On_The_Leg_Press_Machine",
  "panturrilha sentado": "Seated_Calf_Raise",
  "abdominal (crunch)": "Crunches",
  "abdominal infra (elevacao de pernas)": "Flat_Bench_Lying_Leg_Raise",
  "abdominal na polia": "Cable_Crunch",
  "abdominal obliquo": "Oblique_Crunches",
  "prancha": "Plank",
  "bicicleta ergometrica": "Bicycling_Stationary",
  "eliptico": "Elliptical_Trainer",
  "esteira": "Running_Treadmill",
};

/** Nome sem acento e em minúsculas (chave do mapa acima). */
export const mediaKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const publicDbMatch = (name: string): string | null => PUBLIC_DB_MATCH[mediaKey(name)] ?? null;

/** Endereço público do arquivo de execução (bucket exercise-media). */
export const MEDIA_BUCKET = "exercise-media";
export const mediaUrl = (path: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;

/** Texto para a IA de vídeo: animar a foto do exercício com a execução correta, sem cortes nem texto. */
export function videoPrompt(e: { name: string; group: string; description?: string | null }): string {
  return [
    `Short fitness demonstration video of the gym exercise "${e.name}" (Brazilian Portuguese name; muscle group: ${e.group}).`,
    "Animate the person in the reference image performing 2 slow, controlled repetitions with correct technique and full range of motion.",
    e.description ? `Execution notes (in Portuguese): ${e.description.slice(0, 400)}` : "",
    "Keep the same person, equipment, framing and background as the image. Static camera, side view, neutral gym lighting.",
    "No text, no captions, no music, no cuts, no extra people. Realistic body mechanics; the weights move with the hands.",
  ]
    .filter(Boolean)
    .join(" ");
}
