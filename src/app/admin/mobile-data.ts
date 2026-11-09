"use server";

import { requireAdmin } from "@/lib/admin-server";
import { photoStatus } from "@/lib/exercise-media";
import { startOfWeekSP } from "@/lib/week";

/**
 * Dados das telas do admin para o app Android. As páginas do site leem com a chave de serviço
 * no servidor; o app pede aqui (mesma checagem de admin) em vez de ter a chave no aparelho.
 */

export async function adminHomeData() {
  const { db } = await requireAdmin();
  const weekStart = startOfWeekSP();
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [personais, alunos, treinosSemana, treinos30, fichas, exerciciosProprios, travados, bloqueados, convites, aulas, relatorios, recentes] = await Promise.all([
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "personal")),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "aluno")),
    count(db.from("workout_sessions").select("id", { count: "exact", head: true }).gte("started_at", weekStart)),
    count(db.from("workout_sessions").select("id", { count: "exact", head: true }).gte("started_at", monthAgo)),
    count(db.from("workout_plans").select("id", { count: "exact", head: true }).eq("is_template", false).is("archived_at", null)),
    count(db.from("equipment").select("id", { count: "exact", head: true }).eq("is_default", false)),
    count(db.from("equipment").select("id", { count: "exact", head: true }).eq("locked", true)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("catalog_blocked", true)),
    count(db.from("invites").select("id", { count: "exact", head: true }).is("used_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString())),
    count(db.from("class_schedules").select("id", { count: "exact", head: true })),
    count(db.from("weekly_reports").select("id", { count: "exact", head: true })),
    db.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  return { personais, alunos, treinosSemana, treinos30, fichas, exerciciosProprios, travados, bloqueados, convites, aulas, relatorios, recentes: recentes.data ?? [] };
}

const clean = (q: string | undefined) => (q ?? "").trim().replace(/[%,()]/g, "");

export async function adminStudentsData(search?: string) {
  const { db } = await requireAdmin();
  const q = clean(search);
  let query = db.from("profiles").select("id, full_name, email").eq("role", "aluno").order("full_name").limit(500);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: students } = await query;
  const ids = (students ?? []).map((s) => s.id);
  const { data: links } = ids.length
    ? await db.from("personal_students").select("student_id, personal:profiles!personal_students_personal_id_fkey(full_name)").in("student_id", ids).eq("status", "ativo")
    : { data: [] };
  const personalsOf: Record<string, string[]> = {};
  for (const l of links ?? []) (personalsOf[l.student_id] ??= []).push(l.personal?.full_name ?? "—");
  return { students: students ?? [], personalsOf };
}

export async function adminStudentData(id: string) {
  const { db } = await requireAdmin();
  const { data: s } = await db.from("profiles").select("*").eq("id", id).eq("role", "aluno").maybeSingle();
  if (!s) return null;
  const [{ data: links }, total, week, plans, { data: last }, { data: settings }] = await Promise.all([
    db.from("personal_students").select("role, status, created_at, personal:profiles!personal_students_personal_id_fkey(id, full_name, email)").eq("student_id", id).order("created_at"),
    db.from("workout_sessions").select("id", { count: "exact", head: true }).eq("student_id", id),
    db.from("workout_sessions").select("id", { count: "exact", head: true }).eq("student_id", id).gte("started_at", startOfWeekSP()),
    db.from("workout_plans").select("id", { count: "exact", head: true }).eq("student_id", id).is("archived_at", null),
    db.from("workout_sessions").select("started_at").eq("student_id", id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("student_settings").select("weight_visible_to_personal, weigh_in_frequency").eq("student_id", id).maybeSingle(),
  ]);
  return { student: s, links: links ?? [], total: total.count ?? 0, week: week.count ?? 0, plans: plans.count ?? 0, last: last?.started_at ?? null, settings };
}

export async function adminPersonalsData(search?: string, filtro?: string) {
  const { db } = await requireAdmin();
  const q = clean(search);
  let query = db.from("profiles").select("id, full_name, email, phone, created_at, catalog_blocked, avatar_path").eq("role", "personal").order("full_name").limit(500);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  if (filtro === "bloqueados") query = query.eq("catalog_blocked", true);
  const { data: personals } = await query;
  const ids = (personals ?? []).map((p) => p.id);
  const { data: links } = ids.length ? await db.from("personal_students").select("personal_id").in("personal_id", ids).eq("status", "ativo") : { data: [] };
  const studentsOf: Record<string, number> = {};
  for (const l of links ?? []) studentsOf[l.personal_id] = (studentsOf[l.personal_id] ?? 0) + 1;
  return { personals: personals ?? [], studentsOf };
}

export async function adminPersonalData(id: string) {
  const { db } = await requireAdmin();
  const { data: p } = await db.from("profiles").select("*").eq("id", id).eq("role", "personal").maybeSingle();
  if (!p) return null;
  const [{ data: links }, plans, exercises, invites, classes] = await Promise.all([
    db.from("personal_students").select("role, status, created_at, archived_at, student:profiles!personal_students_student_id_fkey(id, full_name, email, phone)").eq("personal_id", id).order("created_at", { ascending: false }),
    db.from("workout_plans").select("id", { count: "exact", head: true }).eq("created_by", id),
    db.from("equipment").select("id", { count: "exact", head: true }).eq("created_by", id),
    db.from("invites").select("id", { count: "exact", head: true }).eq("personal_id", id).is("used_at", null).is("revoked_at", null),
    db.from("class_schedules").select("id", { count: "exact", head: true }).eq("personal_id", id),
  ]);
  const active = (links ?? []).filter((l) => l.status === "ativo" && l.student);
  const studentIds = active.map((l) => l.student!.id);
  const { data: lastSessions } = studentIds.length ? await db.from("workout_sessions").select("student_id, started_at").in("student_id", studentIds).order("started_at", { ascending: false }).limit(1000) : { data: [] };
  const lastOf: Record<string, string> = {};
  for (const s of lastSessions ?? []) lastOf[s.student_id] ??= s.started_at;
  return { personal: p, active, lastOf, plans: plans.count ?? 0, exercises: exercises.count ?? 0, invites: invites.count ?? 0, classes: classes.count ?? 0 };
}

export async function adminEquipmentList(search?: string, filtro?: string) {
  const { db } = await requireAdmin();
  const q = clean(search);
  let query = db
    .from("equipment")
    .select("id, name, muscle_group, is_default, locked, created_by, image_credit, image_path, image_url, owner:profiles!equipment_created_by_fkey(full_name)")
    .order("muscle_group")
    .order("name")
    .limit(1000);
  if (q) query = query.ilike("name", `%${q}%`);
  if (filtro === "padrao") query = query.eq("is_default", true);
  if (filtro === "proprios") query = query.eq("is_default", false);
  if (filtro === "travados") query = query.eq("locked", true);
  return (await query).data ?? [];
}

export async function adminEquipmentData(id: string) {
  const { db } = await requireAdmin();
  const { data: eq } = await db
    .from("equipment")
    .select("id, name, muscle_group, description, is_bodyweight, locked, is_default, image_path, image_url, image_credit, owner:profiles!equipment_created_by_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!eq) return null;
  const [{ count: plans }, { count: sets }, { data: options }] = await Promise.all([
    db.from("workout_plan_items").select("id", { count: "exact", head: true }).eq("equipment_id", id),
    db.from("session_sets").select("id", { count: "exact", head: true }).eq("equipment_id", id),
    db.from("equipment").select("id, name, muscle_group").eq("is_default", true).neq("id", id).order("name"),
  ]);
  return { equipment: eq, usage: { plans: plans ?? 0, sets: sets ?? 0 }, options: options ?? [] };
}

export async function adminMediaData() {
  const { db } = await requireAdmin();
  const [{ data: eqs }, { data: media, error }] = await Promise.all([
    db.from("equipment").select("id, name, muscle_group, image_path, image_url").eq("is_default", true).order("muscle_group").order("name"),
    db.from("exercise_media").select("*").order("created_at", { ascending: false }),
  ]);
  return { eqs: eqs ?? [], media: media ?? [], missingTable: !!error };
}

export async function adminPhotosData() {
  const { db } = await requireAdmin();
  const { data: eqs } = await db
    .from("equipment")
    .select("id, name, muscle_group, is_default, image_url, image_path, image_credit, owner:profiles!equipment_created_by_fkey(full_name)")
    .order("is_default", { ascending: false })
    .order("muscle_group")
    .order("name");
  return (eqs ?? []).map((e) => ({ ...e, status: photoStatus(e) }));
}
