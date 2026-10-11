-- Fotos ilustrativas enviadas pelo administrador para os exercícios 01–20 do catálogo padrão.
-- Cada exercício fica TRAVADO: nenhum Personal troca a foto, edita ou exclui.
-- Aplicar só depois do deploy que publica os arquivos em public/catalogo/fotos/.
update public.equipment e
   set image_url = v.url,
       image_path = null,
       image_updated_by = null,
       image_updated_at = now(),
       image_credit = 'Ilustração do catálogo BoraTreinar (enviada pelo administrador)',
       locked = true
  from (values
  ('Supino reto com barra', '/catalogo/fotos/01-supino-reto-com-barra.webp'),
  ('Supino reto com halteres', '/catalogo/fotos/02-supino-reto-com-halteres.webp'),
  ('Supino inclinado com barra', '/catalogo/fotos/03-supino-inclinado-com-barra.webp'),
  ('Supino inclinado com halteres', '/catalogo/fotos/04-supino-inclinado-com-halteres.webp'),
  ('Supino declinado com barra', '/catalogo/fotos/05-supino-declinado-com-barra.webp'),
  ('Supino máquina', '/catalogo/fotos/06-supino-maquina.webp'),
  ('Crucifixo reto com halteres', '/catalogo/fotos/07-crucifixo-reto-com-halteres.webp'),
  ('Crucifixo inclinado com halteres', '/catalogo/fotos/08-crucifixo-inclinado-com-halteres.webp'),
  ('Peck deck (voador)', '/catalogo/fotos/09-peck-deck-voador.webp'),
  ('Crossover', '/catalogo/fotos/10-crossover.webp'),
  ('Flexão de braço', '/catalogo/fotos/11-flexao-de-braco.webp'),
  ('Puxada frontal', '/catalogo/fotos/12-puxada-frontal.webp'),
  ('Puxada com triângulo', '/catalogo/fotos/13-puxada-com-triangulo.webp'),
  ('Puxada supinada', '/catalogo/fotos/14-puxada-supinada.webp'),
  ('Remada baixa', '/catalogo/fotos/15-remada-baixa.webp'),
  ('Remada curvada com barra', '/catalogo/fotos/16-remada-curvada-com-barra.webp'),
  ('Remada unilateral com halter (serrote)', '/catalogo/fotos/17-remada-unilateral-com-halter-serrote.webp'),
  ('Remada cavalinho', '/catalogo/fotos/18-remada-cavalinho.webp'),
  ('Pulldown na polia', '/catalogo/fotos/19-pulldown-na-polia.webp'),
  ('Barra fixa', '/catalogo/fotos/20-barra-fixa.webp')
  ) as v(name, url)
 where e.is_default and e.name = v.name;
