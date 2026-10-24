import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Download, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import { Card, PageTitle } from "@/components/ui/card";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/cn";
import { setPersonalEditsPlans, setTrainingReminders } from "./actions";
import { DeleteAccountForm } from "./delete-form";

export const metadata: Metadata = { title: "Privacidade e meus dados" };

export default async function PrivacidadePage() {
  const { profile } = await requireStudent();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("student_settings").select("personal_edits_plans, training_reminders").eq("student_id", profile.id).maybeSingle();
  const allow = !!settings?.personal_edits_plans;
  const reminders = settings?.training_reminders ?? true;
  return (
    <>
      <PageTitle sub="Seus direitos pela LGPD (Lei Geral de Proteção de Dados).">Privacidade e meus dados</PageTitle>

      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <ShieldCheck className="size-5 text-bandeira-500" aria-hidden /> Quem vê seus dados
        </h2>
        <p className="text-sm text-muted">
          Só você e os Personais vinculados a você veem suas fichas e treinos. O peso só aparece para eles se você permitir na aba{" "}
          <Link href="/aluno/peso" className="font-semibold underline">
            Peso
          </Link>
          . Leia os{" "}
          <Link href="/termos" className="font-semibold underline">
            termos de uso e privacidade
          </Link>
          .
        </p>
      </Card>

      <Card className="mb-4" id="fichas">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <PencilLine className="size-5 text-bandeira-500" aria-hidden /> Fichas que você montou
        </h2>
        <p className="mb-3 text-sm text-muted">
          {allow
            ? "Seu Personal pode editar e excluir as fichas que você montou. Você também continua editando."
            : "Só você edita as fichas que montou; seu Personal apenas vê. Libere para ele poder ajustar seus treinos."}
        </p>
        <form action={setPersonalEditsPlans}>
          <input type="hidden" name="allow" value={allow ? "0" : "1"} />
          <button
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display font-bold transition",
              allow ? "border-2 border-border bg-surface hover:border-pitanga-500" : "bg-bandeira-500 text-white hover:bg-bandeira-600",
            )}
          >
            {allow ? "Tirar a permissão do Personal" : "Permitir que meu Personal edite"}
          </button>
        </form>
      </Card>

      <Card className="mb-4" id="lembretes">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <BellRing className="size-5 text-bandeira-500" aria-hidden /> Lembrete do dia de treino
        </h2>
        <p className="mb-3 text-sm text-muted">
          {reminders
            ? "Ligado: avisamos 1h antes da aula com seu Personal ou, sem aula, perto do horário em que você costuma treinar (“Hoje é dia de LOWER 💪”). Ative as notificações no celular na tela inicial."
            : "Desligado: você não recebe lembretes nos dias de treino."}
        </p>
        <form action={setTrainingReminders}>
          <input type="hidden" name="on" value={reminders ? "0" : "1"} />
          <button
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display font-bold transition",
              reminders ? "border-2 border-border bg-surface hover:border-pitanga-500" : "bg-bandeira-500 text-white hover:bg-bandeira-600",
            )}
          >
            {reminders ? "Desligar lembretes" : "Ligar lembretes"}
          </button>
        </form>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold">
          <Download className="size-5 text-anil-500" aria-hidden /> Baixar meus dados
        </h2>
        <p className="mb-3 text-sm text-muted">
          Um arquivo (JSON) com seu perfil, vínculos, fichas, treinos com todas as séries, pesagens, aulas e notificações.
        </p>
        <a
          href="/api/conta/exportar"
          download
          className="inline-flex items-center gap-2 rounded-2xl border-2 border-border bg-surface px-4 py-2.5 font-display font-bold transition hover:border-bandeira-500"
        >
          <Download className="size-4" aria-hidden /> Baixar meus dados
        </a>
      </Card>

      <Card className="border-pitanga-500/40">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-pitanga-600">
          <Trash2 className="size-5" aria-hidden /> Excluir minha conta
        </h2>
        <p className="mb-3 text-sm text-muted">
          Apaga sua conta e <strong>todos</strong> os seus dados: treinos, pesagens, fichas e aulas. Seus Personais são avisados e
          deixam de ver você. <strong>Não dá para desfazer.</strong> Se quiser guardar seu histórico, baixe seus dados antes.
        </p>
        <DeleteAccountForm />
      </Card>
    </>
  );
}
