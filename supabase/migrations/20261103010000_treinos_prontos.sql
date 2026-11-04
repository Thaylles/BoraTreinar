-- ════════════════════════════════════════════════════════════════
-- Treinos prontos para quem está começando no app
--  • 4 treinos por nível (iniciante, intermediário, avançado), montados com exercícios do
--    catálogo padrão. Todo usuário logado vê.
--  • adopt_starter_workouts(nível): copia os 4 treinos do nível para as fichas da pessoa
--    (aluno, ou Personal no "Meu treino"); com p_as_templates o Personal copia como modelos.
--    Não duplica: um treino com o mesmo nome já ativo é pulado.
-- ════════════════════════════════════════════════════════════════

create table public.starter_workouts (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('iniciante', 'intermediario', 'avancado')),
  position int not null,
  name text not null check (char_length(name) between 1 and 60),
  goal text,
  notes text,
  unique (level, position)
);
create table public.starter_workout_items (
  id uuid primary key default gen_random_uuid(),
  starter_id uuid not null references public.starter_workouts (id) on delete cascade,
  position int not null,
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  sets int not null check (sets between 1 and 20),
  reps_min int,
  reps_max int,
  rest_seconds int not null default 60,
  notes text,
  technique text check (technique in ('biset', 'triset', 'dropset', 'restpause', 'piramide', 'cluster')),
  unique (starter_id, position)
);
alter table public.starter_workouts enable row level security;
alter table public.starter_workout_items enable row level security;
revoke all on public.starter_workouts, public.starter_workout_items from anon;
revoke insert, update, delete, truncate on public.starter_workouts, public.starter_workout_items from authenticated;
create policy "treinos prontos: todos veem" on public.starter_workouts for select to authenticated using (true);
create policy "treinos prontos (itens): todos veem" on public.starter_workout_items for select to authenticated using (true);

-- ─── Conteúdo ──────────────────────────────────────────────
-- Cada linha: nível, posição, nome, objetivo, observações, e os exercícios como
-- (nome no catálogo, séries, reps mín., reps máx., descanso em s, observação, técnica).
-- Exercício que não existir no catálogo é simplesmente pulado.
create function pg_temp.starter(p_level text, p_pos int, p_name text, p_goal text, p_notes text, p_items jsonb)
returns void language plpgsql as $$
declare
  v_id uuid;
  it jsonb;
  i int := 0;
  v_eq uuid;
begin
  insert into public.starter_workouts (level, position, name, goal, notes)
    values (p_level, p_pos, p_name, p_goal, p_notes) returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    select id into v_eq from public.equipment where is_default and lower(name) = lower(it->>0) limit 1;
    continue when v_eq is null;
    i := i + 1;
    insert into public.starter_workout_items (starter_id, position, equipment_id, sets, reps_min, reps_max, rest_seconds, notes, technique)
      values (v_id, i, v_eq, (it->>1)::int, (it->>2)::int, (it->>3)::int, (it->>4)::int, nullif(it->>5, ''), nullif(it->>6, ''));
  end loop;
end $$;

-- Iniciante: corpo todo, máquinas e movimentos simples, 3x por semana (alternando A, B, C, D).
select pg_temp.starter('iniciante', 1, 'Iniciante A — Corpo todo',
  'Aprender os movimentos e criar o hábito',
  'Treine 3 vezes por semana alternando A, B, C e D. Use uma carga que deixe 2 ou 3 repetições sobrando no fim de cada série. Aumente a carga quando fizer todas as séries no máximo de repetições.',
  '[["Leg press 45°",3,12,15,90,"",""],["Supino máquina",3,12,15,90,"",""],["Puxada frontal",3,12,15,90,"",""],
    ["Cadeira extensora",2,12,15,60,"",""],["Mesa flexora",2,12,15,60,"",""],["Desenvolvimento máquina",2,12,15,60,"",""],
    ["Prancha",3,20,30,45,"Repetições = segundos segurando a posição",""]]');
select pg_temp.starter('iniciante', 2, 'Iniciante B — Corpo todo',
  'Aprender os movimentos e criar o hábito',
  'Mantenha a postura antes de pensar em carga. Desça devagar (2 segundos) em cada repetição.',
  '[["Agachamento no smith",3,12,15,90,"Desça até as coxas ficarem paralelas ao chão, se for confortável",""],
    ["Remada baixa",3,12,15,90,"",""],["Supino reto com halteres",3,12,15,90,"",""],["Cadeira flexora",2,12,15,60,"",""],
    ["Elevação lateral",2,12,15,60,"",""],["Rosca direta com barra",2,12,15,60,"",""],["Abdominal (crunch)",3,15,20,45,"",""]]');
select pg_temp.starter('iniciante', 3, 'Iniciante C — Corpo todo',
  'Aprender os movimentos e criar o hábito',
  'Se algum aparelho estiver ocupado, use o botão "Aparelho ocupado?" durante o treino.',
  '[["Leg press 45°",3,12,15,90,"",""],["Peck deck (voador)",3,12,15,60,"",""],["Pulldown na polia",3,12,15,90,"",""],
    ["Elevação pélvica",3,12,15,60,"",""],["Tríceps pulley",2,12,15,60,"",""],["Rosca alternada com halteres",2,12,15,60,"",""],
    ["Panturrilha sentado",3,15,20,45,"",""]]');
select pg_temp.starter('iniciante', 4, 'Iniciante D — Corpo todo',
  'Aprender os movimentos e criar o hábito',
  'Termine com 10 minutos de caminhada ou bicicleta leve, se quiser.',
  '[["Cadeira abdutora",3,15,20,60,"",""],["Afundo com halteres",2,10,12,90,"Repetições por perna",""],
    ["Supino inclinado com halteres",3,12,15,90,"",""],["Remada unilateral com halter (serrote)",3,12,15,60,"Repetições por braço",""],
    ["Face pull",2,12,15,60,"",""],["Cadeira adutora",2,15,20,60,"",""],["Prancha",3,20,30,45,"Repetições = segundos segurando a posição",""]]');

-- Intermediário: divisão ABCD, 4x por semana, mais volume e exercícios livres.
select pg_temp.starter('intermediario', 1, 'Intermediário A — Peito e tríceps',
  'Hipertrofia (ganho de massa muscular)',
  'Divisão de 4 dias (A, B, C, D). Faça as séries perto da falha, deixando 1 ou 2 repetições sobrando.',
  '[["Supino reto com barra",4,8,10,120,"",""],["Supino inclinado com halteres",3,10,12,90,"",""],["Peck deck (voador)",3,12,15,60,"",""],
    ["Mergulho nas paralelas",3,8,12,90,"Se ficar pesado, use o graviton ou troque por Tríceps pulley",""],
    ["Tríceps pulley",3,10,12,60,"",""],["Tríceps francês",3,10,12,60,"",""]]');
select pg_temp.starter('intermediario', 2, 'Intermediário B — Costas e bíceps',
  'Hipertrofia (ganho de massa muscular)',
  'Puxe com os cotovelos, não com as mãos. Segure 1 segundo no fim de cada remada.',
  '[["Puxada frontal",4,8,10,90,"",""],["Remada curvada com barra",4,8,10,120,"",""],["Remada unilateral com halter (serrote)",3,10,12,60,"Repetições por braço",""],
    ["Face pull",3,12,15,60,"",""],["Rosca direta com barra",3,8,10,60,"",""],["Rosca martelo",3,10,12,60,"",""]]');
select pg_temp.starter('intermediario', 3, 'Intermediário C — Pernas',
  'Hipertrofia (ganho de massa muscular)',
  'Aqueça bem antes do agachamento: 2 séries leves de 10 e 5 repetições.',
  '[["Agachamento livre",4,8,10,150,"",""],["Leg press 45°",3,10,12,120,"",""],["Stiff",3,10,12,90,"",""],
    ["Cadeira extensora",3,12,15,60,"",""],["Mesa flexora",3,10,12,60,"",""],["Panturrilha em pé",4,12,15,45,"",""]]');
select pg_temp.starter('intermediario', 4, 'Intermediário D — Ombros e abdômen',
  'Hipertrofia (ganho de massa muscular)',
  'Elevação lateral: suba até a altura dos ombros, sem balançar o corpo.',
  '[["Desenvolvimento com halteres",4,8,10,90,"",""],["Elevação lateral",4,12,15,45,"",""],["Crucifixo inverso (voador inverso)",3,12,15,60,"",""],
    ["Encolhimento com halteres",3,10,12,60,"",""],["Abdominal infra (elevação de pernas)",3,12,15,45,"",""],
    ["Prancha",3,40,60,45,"Repetições = segundos segurando a posição",""]]');

-- Avançado: 4 dias de alta intensidade, cargas pesadas nos básicos e técnicas avançadas.
select pg_temp.starter('avancado', 1, 'Avançado A — Empurrar (peito, ombros, tríceps)',
  'Força e hipertrofia',
  'Básicos pesados primeiro (descanso longo) e técnicas de intensidade no fim. Registre as cargas para acompanhar a progressão.',
  '[["Supino reto com barra",5,5,8,150,"Pesado: aumente a carga quando fizer 5x8",""],["Supino inclinado com barra",4,6,8,120,"",""],
    ["Desenvolvimento com barra",4,6,8,120,"",""],["Crossover",3,12,15,60,"Última série em drop-set","dropset"],
    ["Elevação lateral",4,12,15,45,"",""],["Tríceps testa",3,8,10,75,"",""],["Tríceps corda",3,12,15,45,"Última série em rest-pause","restpause"]]');
select pg_temp.starter('avancado', 2, 'Avançado B — Puxar (costas, bíceps)',
  'Força e hipertrofia',
  'Levantamento terra com técnica perfeita: coluna neutra e barra colada ao corpo.',
  '[["Levantamento terra",4,4,6,180,"Pesado",""],["Barra fixa",4,6,10,120,"Se fizer mais de 10, use carga extra",""],
    ["Remada cavalinho",4,8,10,90,"",""],["Pulldown na polia",3,12,15,60,"",""],["Crucifixo inverso (voador inverso)",3,15,20,45,"",""],
    ["Rosca direta com barra",4,8,10,75,"",""],["Rosca Scott",3,10,12,60,"Última série em drop-set","dropset"]]');
select pg_temp.starter('avancado', 3, 'Avançado C — Pernas (quadríceps)',
  'Força e hipertrofia',
  'Agachamento em pirâmide: aumente a carga a cada série e diminua as repetições.',
  '[["Agachamento livre",5,5,8,180,"","piramide"],["Agachamento hack",4,8,10,120,"",""],["Agachamento búlgaro",3,8,10,90,"Repetições por perna",""],
    ["Cadeira extensora",3,12,15,60,"Última série em drop-set","dropset"],["Panturrilha em pé",5,10,12,45,"",""],
    ["Abdominal na polia",4,12,15,45,"",""]]');
select pg_temp.starter('avancado', 4, 'Avançado D — Pernas (posterior e glúteos)',
  'Força e hipertrofia',
  'Stiff: desça até sentir o alongamento atrás da coxa, sem arredondar as costas.',
  '[["Stiff",4,6,8,120,"",""],["Elevação pélvica",4,8,10,90,"Segure 1 segundo no alto",""],["Mesa flexora",4,10,12,60,"",""],
    ["Cadeira flexora",3,12,15,60,"Última série em rest-pause","restpause"],["Cadeira abdutora",3,15,20,45,"",""],
    ["Panturrilha sentado",4,15,20,45,"",""],["Abdominal infra (elevação de pernas)",3,15,20,45,"",""]]');

/**
 * Copia os 4 treinos prontos do nível para as fichas da pessoa logada (aluno ou Personal treinando),
 * ou, com p_as_templates, para os modelos do Personal. Pula os que já existem com o mesmo nome.
 * Devolve quantas fichas foram criadas.
 */
create function public.adopt_starter_workouts(p_level text, p_as_templates boolean default false)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  s public.starter_workouts;
  v_plan uuid;
  n int := 0;
begin
  if p_level not in ('iniciante', 'intermediario', 'avancado') then
    raise exception 'Nível inválido' using errcode = 'P0001';
  end if;
  if p_as_templates then
    if not public.current_role_is('personal') then
      raise exception 'Apenas Personais criam modelos' using errcode = '42501';
    end if;
  elsif not public.can_train_self() then
    raise exception 'Sua conta não registra treinos' using errcode = '42501';
  end if;

  for s in select * from public.starter_workouts where level = p_level order by position loop
    continue when exists (
      select 1 from public.workout_plans p
       where p.archived_at is null and lower(p.name) = lower(s.name)
         and ((p_as_templates and p.is_template and p.created_by = auth.uid())
              or (not p_as_templates and not p.is_template and p.student_id = auth.uid())));
    insert into public.workout_plans (student_id, created_by, name, goal, notes, is_template)
      values (case when p_as_templates then null else auth.uid() end, auth.uid(), s.name, s.goal, s.notes, p_as_templates)
      returning id into v_plan;
    insert into public.workout_plan_items (plan_id, equipment_id, position, sets, reps_min, reps_max, rest_seconds, notes, technique)
      select v_plan, equipment_id, position, sets, reps_min, reps_max, rest_seconds, notes, technique
        from public.starter_workout_items where starter_id = s.id order by position;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.adopt_starter_workouts(text, boolean) from public, anon;
grant execute on function public.adopt_starter_workouts(text, boolean) to authenticated;
