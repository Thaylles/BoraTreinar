/** Anamnese / PAR-Q: opções padronizadas (para levantamento) e alertas para montar fichas. */

type Opt = { value: string; label: string };

/** PAR-Q (Questionário de Prontidão para Atividade Física), versão em português. "Sim" em qualquer uma = atenção. */
export const PARQ: Opt[] = [
  { value: "coracao", label: "Algum médico já disse que você tem problema no coração e que só deve fazer atividade física recomendada por médico?" },
  { value: "dor_peito_atividade", label: "Você sente dor no peito quando faz atividade física?" },
  { value: "dor_peito_repouso", label: "No último mês, você sentiu dor no peito sem estar fazendo atividade física?" },
  { value: "tontura", label: "Você perde o equilíbrio por tontura ou já perdeu a consciência?" },
  { value: "osso_articulacao", label: "Você tem algum problema ósseo ou articular que pode piorar com atividade física?" },
  { value: "remedio_pressao", label: "Você toma remédio para pressão arterial ou para o coração?" },
  { value: "outro_motivo", label: "Você sabe de algum outro motivo pelo qual não deveria fazer atividade física?" },
];

export const REGIONS: Opt[] = [
  { value: "cervical", label: "Pescoço (cervical)" },
  { value: "ombro", label: "Ombro" },
  { value: "cotovelo", label: "Cotovelo" },
  { value: "punho", label: "Punho / mão" },
  { value: "toracica", label: "Costas (parte alta)" },
  { value: "lombar", label: "Lombar" },
  { value: "quadril", label: "Quadril" },
  { value: "joelho", label: "Joelho" },
  { value: "tornozelo", label: "Tornozelo / pé" },
];

export const MUSCLES: Opt[] = [
  { value: "peito", label: "Peito" },
  { value: "costas", label: "Costas" },
  { value: "ombros", label: "Ombros" },
  { value: "biceps", label: "Bíceps" },
  { value: "triceps", label: "Tríceps" },
  { value: "antebraco", label: "Antebraço" },
  { value: "quadriceps", label: "Quadríceps" },
  { value: "posterior", label: "Posterior de coxa" },
  { value: "gluteos", label: "Glúteos" },
  { value: "adutores", label: "Adutores" },
  { value: "panturrilha", label: "Panturrilha" },
  { value: "abdomen", label: "Abdômen" },
];

export const SURGERIES: Opt[] = [
  { value: "joelho", label: "Joelho" },
  { value: "ombro", label: "Ombro" },
  { value: "coluna", label: "Coluna" },
  { value: "quadril", label: "Quadril" },
  { value: "cardiaca", label: "Coração" },
  { value: "abdominal", label: "Abdômen / hérnia" },
  { value: "outra", label: "Outra" },
];

export const CONDITIONS: Opt[] = [
  { value: "hipertensao", label: "Pressão alta" },
  { value: "diabetes", label: "Diabetes" },
  { value: "colesterol", label: "Colesterol alto" },
  { value: "cardiaco", label: "Problema no coração" },
  { value: "asma", label: "Asma / bronquite" },
  { value: "tireoide", label: "Tireoide" },
  { value: "labirintite", label: "Labirintite / tontura" },
  { value: "hernia_disco", label: "Hérnia de disco" },
  { value: "artrose", label: "Artrose / artrite" },
  { value: "osteoporose", label: "Osteoporose" },
  { value: "ansiedade_depressao", label: "Ansiedade / depressão" },
  { value: "gestante", label: "Gestante" },
];

export const MEDICATIONS: Opt[] = [
  { value: "pressao", label: "Pressão" },
  { value: "diabetes", label: "Diabetes" },
  { value: "antidepressivo", label: "Antidepressivo / ansiolítico" },
  { value: "hormonal", label: "Hormônio / anticoncepcional" },
  { value: "anti_inflamatorio", label: "Anti-inflamatório frequente" },
  { value: "tireoide", label: "Tireoide" },
  { value: "outro", label: "Outro" },
];

export const GOALS: Opt[] = [
  { value: "emagrecimento", label: "Emagrecimento" },
  { value: "hipertrofia", label: "Ganho de massa (hipertrofia)" },
  { value: "condicionamento", label: "Condicionamento" },
  { value: "saude", label: "Saúde e qualidade de vida" },
  { value: "forca", label: "Força" },
  { value: "mobilidade", label: "Mobilidade / flexibilidade" },
  { value: "reabilitacao", label: "Reabilitação" },
  { value: "performance", label: "Desempenho no esporte" },
];

export const ACTIVITY: Opt[] = [
  { value: "sedentario", label: "Sedentário" },
  { value: "pouco_ativo", label: "1–2× por semana" },
  { value: "ativo", label: "3–4× por semana" },
  { value: "muito_ativo", label: "5× ou mais" },
];

export const EXPERIENCE: Opt[] = [
  { value: "nunca", label: "Nunca treinei" },
  { value: "menos_6m", label: "Menos de 6 meses" },
  { value: "ate_2a", label: "6 meses a 2 anos" },
  { value: "mais_2a", label: "Mais de 2 anos" },
];

export const SLEEP: Opt[] = [
  { value: "menos_5", label: "Menos de 5 h" },
  { value: "5_6", label: "5 a 6 h" },
  { value: "7_8", label: "7 a 8 h" },
  { value: "mais_8", label: "Mais de 8 h" },
];

export type HealthForm = {
  parq_yes: string[];
  pain_regions: string[];
  injury_regions: string[];
  mobility_regions: string[];
  muscle_pain: string[];
  surgeries: string[];
  conditions: string[];
  medications: string[];
  goals: string[];
  activity_level: string | null;
  experience: string | null;
  sleep: string | null;
  smoker: boolean | null;
  notes: string | null;
  clearance_path?: string | null;
  updated_at?: string;
};

/** Perguntas de múltipla escolha, na ordem do formulário e do levantamento. */
export const MULTI_FIELDS: { key: keyof HealthForm; title: string; options: Opt[]; none: string }[] = [
  { key: "pain_regions", title: "Sente dor ou desconforto nas articulações?", options: REGIONS, none: "Não sinto" },
  { key: "muscle_pain", title: "Sente dor muscular frequente?", options: MUSCLES, none: "Não sinto" },
  { key: "injury_regions", title: "Tem ou já teve lesão?", options: REGIONS, none: "Nunca tive" },
  { key: "mobility_regions", title: "Tem dificuldade de mobilidade (pouca amplitude, travamento)?", options: REGIONS, none: "Não tenho" },
  { key: "surgeries", title: "Já fez cirurgia?", options: SURGERIES, none: "Nunca fiz" },
  { key: "conditions", title: "Tem alguma destas condições de saúde?", options: CONDITIONS, none: "Nenhuma" },
  { key: "medications", title: "Toma remédio de uso contínuo?", options: MEDICATIONS, none: "Nenhum" },
  { key: "goals", title: "Quais são seus objetivos?", options: GOALS, none: "" },
];

export const SINGLE_FIELDS: { key: "activity_level" | "experience" | "sleep"; title: string; options: Opt[] }[] = [
  { key: "activity_level", title: "Com que frequência você se exercita hoje?", options: ACTIVITY },
  { key: "experience", title: "Há quanto tempo treina musculação?", options: EXPERIENCE },
  { key: "sleep", title: "Quantas horas dorme por noite?", options: SLEEP },
];

export const labelOf = (options: Opt[], value: string) => options.find((o) => o.value === value)?.label ?? value;

/** Precisa de liberação médica: "sim" em alguma pergunta do PAR-Q. */
export const needsClearance = (f: Pick<HealthForm, "parq_yes">) => f.parq_yes.length > 0;

/** Grupos musculares envolvidos em cada região (para alertar ao montar a ficha). */
const REGION_GROUPS: Record<string, string[]> = {
  cervical: ["ombros", "costas"],
  ombro: ["ombros", "peito", "costas"],
  cotovelo: ["biceps", "triceps"],
  punho: ["antebraco", "biceps", "triceps"],
  toracica: ["costas"],
  lombar: ["costas", "posterior", "gluteos"],
  quadril: ["gluteos", "adutores", "posterior"],
  joelho: ["quadriceps", "posterior"],
  tornozelo: ["panturrilha"],
  coluna: ["costas", "posterior"],
};

const regionName = (v: string) => (v === "coluna" ? "coluna" : labelOf(REGIONS, v).toLowerCase());

/**
 * Cuidados por grupo muscular a partir da anamnese:
 * { joelho → quadríceps e posterior: ["dor no joelho", "cirurgia no joelho"] , … }.
 */
export function cautionsFor(f: HealthForm | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!f) return out;
  const add = (groups: string[], reason: string) => {
    for (const g of groups) if (!(out[g] ??= []).includes(reason)) out[g].push(reason);
  };
  for (const r of f.pain_regions) add(REGION_GROUPS[r] ?? [], `dor: ${regionName(r)}`);
  for (const r of f.injury_regions) add(REGION_GROUPS[r] ?? [], `lesão: ${regionName(r)}`);
  for (const r of f.mobility_regions) add(REGION_GROUPS[r] ?? [], `mobilidade limitada: ${regionName(r)}`);
  for (const r of f.surgeries) add(REGION_GROUPS[r] ?? [], `cirurgia: ${regionName(r)}`);
  for (const m of f.muscle_pain) add([m], "dor muscular");
  return out;
}

/** Levantamento: quantos alunos marcaram cada opção (só as marcadas, da mais comum para a menos). */
export function healthSurvey(forms: HealthForm[]) {
  const count = (values: string[][]) => {
    const m = new Map<string, number>();
    for (const list of values) for (const v of new Set(list)) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  return {
    total: forms.length,
    risk: forms.filter(needsClearance).length,
    parq: count(forms.map((f) => f.parq_yes)).map(([v, n]) => ({ value: v, label: labelOf(PARQ, v), n })),
    multi: MULTI_FIELDS.map((q) => ({
      ...q,
      counts: count(forms.map((f) => f[q.key] as string[])).map(([v, n]) => ({ value: v, label: labelOf(q.options, v), n })),
    })),
    single: SINGLE_FIELDS.map((q) => ({
      ...q,
      counts: count(forms.map((f) => (f[q.key] ? [f[q.key] as string] : []))).map(([v, n]) => ({ value: v, label: labelOf(q.options, v), n })),
    })),
    smokers: forms.filter((f) => f.smoker).length,
  };
}
