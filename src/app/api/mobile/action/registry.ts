// Gerado a partir dos módulos "use server": as ações do site que o app Android pode chamar.
// Ao criar um novo arquivo de ações, inclua-o aqui.
import * as auth from "@/app/(auth)/actions";
import * as auth_convite_token from "@/app/(auth)/convite/[token]/actions";
import * as admin from "@/app/admin/actions";
import * as admin_execucoes from "@/app/admin/execucoes/actions";
import * as admin_fotos from "@/app/admin/fotos/actions";
import * as agua_actions from "@/app/agua-actions";
import * as aluno_aula_actions from "@/app/aluno/aula-actions";
import * as aluno_fichas from "@/app/aluno/fichas/actions";
import * as aluno_meta_actions from "@/app/aluno/meta-actions";
import * as aluno_pagamento_actions from "@/app/aluno/pagamento-actions";
import * as aluno_peso from "@/app/aluno/peso/actions";
import * as aluno_privacidade from "@/app/aluno/privacidade/actions";
import * as aluno_saude_conectada from "@/app/aluno/saude-conectada/actions";
import * as aluno_saude from "@/app/aluno/saude/actions";
import * as aluno_vinculo_actions from "@/app/aluno/vinculo-actions";
import * as cardio_actions from "@/app/cardio-actions";
import * as exercise_request_actions from "@/app/exercise-request-actions";
import * as notifications_actions from "@/app/notifications-actions";
import * as perfil_actions from "@/app/perfil-actions";
import * as personal from "@/app/personal/actions";
import * as personal_agenda from "@/app/personal/agenda/actions";
import * as personal_alunos_vinculo_actions from "@/app/personal/alunos/vinculo-actions";
import * as personal_exercicios from "@/app/personal/exercicios/actions";
import * as personal_fichas from "@/app/personal/fichas/actions";
import * as personal_financeiro from "@/app/personal/financeiro/actions";
import * as personal_relatorios from "@/app/personal/relatorios/actions";
import * as push_actions from "@/app/push-actions";
import * as treino_actions from "@/app/treino-actions";
import * as treinos_prontos_actions from "@/app/treinos-prontos-actions";

export const MODULES = {
  "auth": auth,
  "auth/convite/token": auth_convite_token,
  "admin": admin,
  "admin/execucoes": admin_execucoes,
  "admin/fotos": admin_fotos,
  "agua-actions": agua_actions,
  "aluno/aula-actions": aluno_aula_actions,
  "aluno/fichas": aluno_fichas,
  "aluno/meta-actions": aluno_meta_actions,
  "aluno/pagamento-actions": aluno_pagamento_actions,
  "aluno/peso": aluno_peso,
  "aluno/privacidade": aluno_privacidade,
  "aluno/saude-conectada": aluno_saude_conectada,
  "aluno/saude": aluno_saude,
  "aluno/vinculo-actions": aluno_vinculo_actions,
  "cardio-actions": cardio_actions,
  "exercise-request-actions": exercise_request_actions,
  "notifications-actions": notifications_actions,
  "perfil-actions": perfil_actions,
  "personal": personal,
  "personal/agenda": personal_agenda,
  "personal/alunos/vinculo-actions": personal_alunos_vinculo_actions,
  "personal/exercicios": personal_exercicios,
  "personal/fichas": personal_fichas,
  "personal/financeiro": personal_financeiro,
  "personal/relatorios": personal_relatorios,
  "push-actions": push_actions,
  "treino-actions": treino_actions,
  "treinos-prontos-actions": treinos_prontos_actions,
};
