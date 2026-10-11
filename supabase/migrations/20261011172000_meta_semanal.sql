-- Meta de treinos por semana escolhida pelo aluno (null = sem meta).
alter table public.student_settings
  add column weekly_goal smallint check (weekly_goal between 1 and 7);
grant update (weekly_goal) on public.student_settings to authenticated;
