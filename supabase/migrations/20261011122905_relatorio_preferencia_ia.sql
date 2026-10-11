-- Comparação das sugestões (regras × IAs): o Personal marca qual foi mais útil em cada relatório.
alter table public.weekly_reports
  add column preferred_source text check (preferred_source in ('regras', 'gemini', 'claude'));

create policy "relatórios: Personal marca a sugestão preferida" on public.weekly_reports
  for update to authenticated
  using (personal_id = (select auth.uid()))
  with check (personal_id = (select auth.uid()));

-- Só esta coluna pode ser alterada pelo Personal; o conteúdo continua sendo do servidor.
grant update (preferred_source) on public.weekly_reports to authenticated;
