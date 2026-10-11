-- Usadas só internamente (gatilho e weigh_in_status, que rodam como dono): sem acesso direto pela API.
revoke execute on function public.weigh_in_overdue(uuid, date), public.weigh_in_period_days(uuid) from authenticated;
