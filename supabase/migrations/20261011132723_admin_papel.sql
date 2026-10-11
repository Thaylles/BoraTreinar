-- Papel de administrador do site. Fica numa migração separada porque um valor novo de enum
-- não pode ser usado na mesma transação em que é criado.
-- Ninguém escolhe "admin" no cadastro (handle_new_user só aceita personal/aluno) nem altera
-- o próprio papel (profiles.role não tem GRANT de update); a promoção é feita pelo dono do banco.
alter type public.user_role add value if not exists 'admin';
