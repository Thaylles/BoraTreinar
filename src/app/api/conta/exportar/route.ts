import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { spDateKey } from "@/lib/week";

const PAGE = 1000;

/** Cópia do objeto sem as chaves internas usadas só para filtrar. */
const omit = (o: object, keys: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/** Lê todas as linhas, página a página (a API devolve no máximo 1000 por vez). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * LGPD: exporta, em JSON, os dados do usuário logado (portabilidade).
 * Usa o cliente com a sessão do usuário, então o RLS limita ao que é dele.
 */
export async function GET() {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  const { profile } = session;
  const supabase = await createClient();
  const uid = profile.id;
  const isStudent = profile.role !== "personal";

  try {
    const [settings, links, sessions, sets, weights, plans, planItems, schedules, notifications, health, cardioGoal] = await Promise.all([
      supabase.from("student_settings").select("*").eq("student_id", uid).maybeSingle(),
      supabase
        .from("personal_students")
        .select("role, status, created_at, personal:profiles!personal_students_personal_id_fkey(full_name, email)")
        .eq(isStudent ? "student_id" : "personal_id", uid),
      isStudent
        ? all((a, b) => supabase.from("workout_sessions").select("*").eq("student_id", uid).order("started_at").range(a, b))
        : Promise.resolve([]),
      isStudent
        ? all((a, b) =>
            supabase
              .from("session_sets")
              .select("session_id, exercise_order, set_number, load_kg, reps, done, is_pr, duration_min, distance_km, speed_kmh, incline_pct, level, equipment:equipment(name), session:workout_sessions!inner(student_id)")
              .eq("session.student_id", uid)
              .order("session_id")
              .order("exercise_order")
              .order("set_number")
              .range(a, b),
          )
        : Promise.resolve([]),
      isStudent
        ? all((a, b) => supabase.from("body_weights").select("measured_on, weight_kg, created_at").eq("student_id", uid).order("measured_on").range(a, b))
        : Promise.resolve([]),
      supabase.from("workout_plans").select("*").eq(isStudent ? "student_id" : "created_by", uid),
      all((a, b) =>
        supabase
          .from("workout_plan_items")
          .select("plan_id, position, sets, reps_min, reps_max, suggested_load, rest_seconds, notes, equipment:equipment(name), plan:workout_plans!inner(student_id, created_by)")
          .eq(isStudent ? "plan.student_id" : "plan.created_by", uid)
          .order("plan_id")
          .order("position")
          .range(a, b),
      ),
      supabase.from("class_schedules").select("*, exceptions:class_exceptions(on_date, reason)").eq(isStudent ? "student_id" : "personal_id", uid),
      all((a, b) => supabase.from("notifications").select("title, body, link, read_at, created_at").eq("user_id", uid).order("created_at").range(a, b)),
      supabase.from("health_forms").select("*").eq("student_id", uid).maybeSingle(),
      supabase.from("cardio_goals").select("kind, target, min_speed_kmh, min_level, updated_at").eq("student_id", uid).maybeSingle(),
    ]);

    const body = {
      gerado_em: new Date().toISOString(),
      aviso: "Exportação dos seus dados no BoraTreinar (LGPD, art. 18). Guarde este arquivo em local seguro.",
      perfil: {
        nome: profile.full_name,
        email: profile.email,
        telefone: profile.phone,
        papel: profile.role,
        nascimento: profile.birth_date,
        criado_em: profile.created_at,
      },
      configuracoes: settings.data,
      vinculos: links.data,
      treinos: (sessions as { id: string }[]).map((s) => ({
        ...s,
        series: (sets as { session_id: string }[]).filter((x) => x.session_id === s.id).map((x) => omit(x, ["session_id", "session"])),
      })),
      pesagens: weights,
      fichas: (plans.data ?? []).map((p) => ({
        ...p,
        exercicios: (planItems as { plan_id: string }[]).filter((i) => i.plan_id === p.id).map((i) => omit(i, ["plan_id", "plan"])),
      })),
      aulas: schedules.data,
      anamnese: health.data,
      meta_de_cardio: cardioGoal.data,
      notificacoes: notifications,
    };
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="boratreinar-meus-dados-${spDateKey()}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao exportar." }, { status: 500 });
  }
}
