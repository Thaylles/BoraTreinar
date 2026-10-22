-- ════════════════════════════════════════════════════════════════
-- Ajustes do catálogo
--  • Técnica nova na ficha: Cluster (série dividida em blocos com pausas curtas).
--  • Foto certa para "Panturrilha no leg press" (no leg press, não na panturrilheira).
--  • Dois exercícios criados por uma Personal entram no catálogo padrão, com foto:
--    flexão de joelhos em pé na máquina e serrote na máquina (low row). No banco novo
--    (testes) esses ids não existem e o update não faz nada.
--  • Fotos novas: Free Exercise DB (domínio público).
-- Aplicar só depois do deploy que publica os arquivos em public/catalogo/fotos/.
-- ════════════════════════════════════════════════════════════════

alter table public.workout_plan_items drop constraint workout_plan_items_technique_check;
alter table public.workout_plan_items add constraint workout_plan_items_technique_check
  check (technique in ('biset', 'triset', 'dropset', 'restpause', 'piramide', 'cluster'));

update public.equipment
   set image_url = '/catalogo/fotos/61b-panturrilha-no-leg-press.webp',
       image_path = null,
       image_updated_at = now(),
       image_credit = 'Free Exercise DB (domínio público)'
 where is_default and name = 'Panturrilha no leg press';

update public.equipment e
   set name = v.name,
       description = v.description,
       image_url = v.url,
       image_path = null,
       image_updated_at = now(),
       image_credit = 'Free Exercise DB (domínio público)',
       is_default = true,
       locked = true,
       created_by = null
  from (values
    ('35fa2ff3-952e-4555-8ecf-6ad2782883c0'::uuid, 'Flexão de joelhos em pé na máquina',
     'Em pé na máquina, flexione um joelho de cada vez levando o calcanhar em direção ao glúteo.',
     '/catalogo/fotos/70-flexao-de-joelhos-em-pe-maquina.webp'),
    ('e0f63d8f-6e98-4292-8077-1990ce6c6254'::uuid, 'Serrote na máquina (low row)',
     'Sentado com o peito apoiado, puxe a pegada até a lateral do corpo; pode ser feito com um braço de cada vez.',
     '/catalogo/fotos/71-serrote-na-maquina-low-row.webp')
  ) as v(id, name, description, url)
 where e.id = v.id;
