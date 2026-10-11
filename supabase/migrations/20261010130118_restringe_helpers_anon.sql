-- Funções auxiliares das policies: só usuários logados.
revoke execute on function
  public.current_role_is(public.user_role),
  public.is_linked_personal(uuid),
  public.is_responsible_personal(uuid)
from public, anon;
grant execute on function
  public.current_role_is(public.user_role),
  public.is_linked_personal(uuid),
  public.is_responsible_personal(uuid)
to authenticated;
