# BoraTreinar 🇧🇷💪

> **Bora treinar?** Registro e acompanhamento de treinos de academia para **Personal/Instrutor** e **Aluno**.

Aplicação web mobile-first (PWA) em português do Brasil, com fuso de referência `America/Sao_Paulo`.

## Identidade visual

| Elemento | Escolha | Por quê |
|---|---|---|
| **Verde Bandeira** `#009C3B` | cor primária (ações, sucesso, "série feita") | verde da bandeira, energia e vitalidade |
| **Amarelo Ipê** `#FFC72C` | destaque (recordes, timer, CTA) | o ipê-amarelo e o ouro da bandeira |
| **Azul Anil** `#002776` | texto forte, cabeçalhos | azul do círculo da bandeira |
| **Coral Pitanga** `#FF5A36` | alertas, "não feita", pesagem vencida | fruta bem brasileira, chama atenção sem ser agressiva |
| **Areia** `#FFF8E7` | fundo claro | lembra praia/calçadão |
| Tipografia | **Baloo 2** (títulos) + **Inter** (texto) | Baloo tem cara de "papo de academia", arredondada e amigável |
| Logo | halter estilizado dentro de um losango verde-amarelo | releitura do losango da bandeira |
| Tom de voz | "Bora!", "Mandou bem!", "Partiu treino", "Tá pago ✅" | gírias de academia brasileira |

O padrão decorativo de fundo é inspirado no **calçadão de Copacabana** (ondas em pedra portuguesa), aplicado de forma sutil.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Supabase** (Postgres + Auth + Storage) com **RLS** em todas as tabelas
- **Vercel** (deploy + Vercel Cron para o relatório de domingo)
- **Resend** (e-mail transacional)
- **Recharts** (gráficos)
- **PWA** instalável (manifest + service worker)
- **API da Anthropic (Claude)** para sugestões do relatório semanal (opcional; sem chave usa regras simples)

## Rodando localmente

Pré-requisitos: Node.js 20+ e uma conta no [Supabase](https://supabase.com) (ou o [Supabase CLI](https://supabase.com/docs/guides/local-development) com Docker).

```bash
git clone https://github.com/thaylles/boratreinar.git
cd boratreinar
npm install
cp .env.example .env.local   # preencha as variáveis
npm run dev                  # http://localhost:3000
```

### Banco de dados

As migrações SQL ficam em `supabase/migrations/`. O catálogo padrão é uma migração de dados gerada por `python3 scripts/catalogo.py` (as ilustrações, por `python3 scripts/gerar-ilustracoes.py`).

```bash
# Com Supabase CLI ligado a um projeto remoto
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push

# Ou localmente (Docker)
npx supabase start
npx supabase db reset   # aplica migrações + seed
```

## Variáveis de ambiente

Veja `.env.example`. Resumo:

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | cliente/servidor | URL pública do app (links de convite, e-mails) |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente/servidor | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente/servidor | chave pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | usada pelo cron do relatório |
| `RESEND_API_KEY` / `EMAIL_FROM` | só servidor | envio de e-mails (relatório e lembrete das 7h; sem elas, só a notificação no app) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | só servidor | sugestões por IA (opcional) |
| `CRON_SECRET` | só servidor | protege a rota do cron |

Nenhum segredo vai para o repositório: `.env*` está no `.gitignore` (exceto `.env.example`).

## Deploy (Vercel)

1. Crie um projeto no Supabase e aplique as migrações (`npx supabase db push`).
2. Em **Supabase → Authentication → URL Configuration**, cadastre a URL de produção como *Site URL* e `https://SEU-DOMINIO/auth/confirm` em *Redirect URLs* (para previews: `https://*-SEU-USUARIO.vercel.app/auth/confirm`).
   - Recomendado: em **Authentication → Email Templates**, troque o link de *Confirm signup* por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/personal` e o de *Reset password* por
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`.
     Assim o link funciona mesmo se aberto em outro aparelho/navegador.
3. Importe o repositório na Vercel e configure as variáveis de ambiente acima.
4. O `vercel.json` já agenda os crons (em UTC; Brasil sem horário de verão desde 2019):
   - relatório semanal `0 1 * * 1` = **domingo 22h em São Paulo**;
   - lembrete das aulas `0 10 * * *` = **todo dia às 7h em São Paulo**.
   No plano Hobby da Vercel o cron pode disparar em qualquer minuto daquela hora; no Pro, no minuto exato.
5. Defina `CRON_SECRET` na Vercel — ela envia esse valor automaticamente no header `Authorization` das chamadas de cron.

## Scripts

| Comando | O quê |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |
| `npm run test:unit` | testes de unidade das funções puras (telefone, WhatsApp, agenda, estatísticas do dashboard) |
| `npm run test:db` | aplica as migrações num Postgres descartável (com stub do Supabase) e roda os testes SQL de RLS. Use `PGHOST`/`PGPORT`/`PGUSER` para apontar o servidor |

## Como funciona o acesso

- **Personal** cria a conta em `/cadastro` e confirma o e-mail.
- **Aluno** só entra por `/convite/<token>`. O cadastro é feito no servidor com a service role e a conta já nasce confirmada; um gatilho no banco valida o convite (pendente, não expirado, não revogado), exige o aceite do termo e o WhatsApp, e cria o vínculo com o Personal.
- **Compartilhar/Transferir**: o Personal responsável faz o pedido na página do aluno; o outro Personal aceita em *Pedidos*. Compartilhar mantém os dois; transferir revoga o acesso do anterior. O aluno é notificado.
- Toda escrita sensível passa por funções `SECURITY DEFINER` no Postgres; as tabelas têm RLS e só permitem leitura do que cada perfil pode ver.

## Checklist de funcionalidades

### Etapa 1 — Repositório e estrutura
- [x] README, `.gitignore`, licença MIT, `.env.example`
- [x] Next.js + TypeScript + Tailwind
- [x] Identidade visual (cores, tipografia, logo, ícones)
- [x] Clientes Supabase (browser/servidor) e middleware de sessão
- [x] Manifest PWA básico
- [x] `vercel.json` com cron do relatório
- [x] Projeto Supabase criado (`boratreinar`, região São Paulo)
- [ ] Deploy inicial na Vercel (aguardando importação do repositório na Vercel)

### Etapa 2 — Autenticação, perfis e convites
- [x] Login/cadastro por e-mail e senha, recuperação de senha
- [x] Cadastro direto do Personal (com confirmação de e-mail)
- [x] Convite por link (expiração configurável, revogação) e cadastro do aluno com termo LGPD
- [x] Compartilhamento e transferência entre Personais (com aceite), revogação e notificações
- [x] Lista de alunos, página do aluno, arquivar/reativar
- [x] RLS em todas as tabelas + 34 testes SQL (`npm run test:db`)

### Etapa 3 — Catálogo
- [x] Seed com 69 exercícios por grupo muscular, com **ilustrações próprias** (licença MIT) — `scripts/catalogo.py` e `scripts/gerar-ilustracoes.py`
- [ ] Trocar ilustrações por fotos do Wikimedia Commons (bloqueado pela rede do ambiente de desenvolvimento; o campo `image_credit` já existe)
- [x] Cadastro/edição/exclusão de exercícios pelo Personal, com upload comprimido (WebP ≤1024px) no Supabase Storage
- [x] Aviso ao salvar sem foto; placeholder com ícone do grupo muscular
- [x] Qualquer Personal pode trocar a foto de um exercício do catálogo padrão (vale para todos, com crédito de quem enviou) ou voltar à ilustração original
- [x] Visibilidade: catálogo padrão para todos; exercícios de um Personal visíveis para ele, seus alunos e Personais que compartilham alunos com ele

### Etapa 4 — Fichas
- [x] Fichas por aluno (A/B/C) com nome, objetivo, observações e validade opcional
- [x] Exercícios ordenados (subir/descer), séries (padrão 3), repetições-alvo (ex.: 10–12), carga sugerida, descanso e observações
- [x] Duplicar ficha (mesmo aluno, outro aluno ou como modelo) e aplicar modelo a um aluno
- [x] Fichas mostram quem criou; Personal compartilhado também monta fichas
- [x] Aluno vê suas fichas (somente leitura)

### Etapa 5 — Execução
- [x] Execução: 3 séries por padrão, adicionar/remover séries, carga pré-preenchida com a última vez, reps com o alvo, Feita/Não feita
- [x] Timer de descanso automático (ajustável ±15s e por exercício), com som e vibração; tela ligada (Wake Lock)
- [x] Última carga/reps e recorde em cada exercício; recorde pessoal (PR) detectado ao salvar
- [x] Progresso salvo no aparelho durante o treino; treino finalizado sem internet fica na fila e sincroniza depois (idempotente)
- [x] Registro manual pelo Personal ("registrado pelo instrutor")
- [x] Histórico de treinos, detalhe do treino e histórico por exercício com gráfico de evolução de carga
- [x] Lista de alunos com treinos na semana (seg–dom, fuso SP), último treino e status
- [x] Migrações `fichas` e `sessoes_treino` aplicadas no Supabase de produção

### Etapa 6 — Peso corporal
- [x] Registro de peso com data (um por dia; registrar de novo no mesmo dia corrige), histórico e gráfico
- [x] Privacidade: o Personal só vê o peso se o aluno permitir (padrão: não), garantido por RLS em todas as telas
- [x] Frequência de pesagem semanal ou quinzenal
- [x] Trava: com pesagem vencida o aluno não inicia treino (tela com o campo de peso); registro manual do Personal não é bloqueado; reforçada no banco
- [x] Página do aluno (Personal) mostra a situação da pesagem e o peso apenas quando permitido

### Etapa 7 — Treino livre
- [x] Treino livre: o aluno monta o treino do dia escolhendo e ordenando exercícios do catálogo (sugere a última seleção)
- [x] Só exercícios do catálogo visível ao aluno (padrão + criados pelos seus Personais); aluno não cria exercício — garantido no banco
- [x] Mesma execução da ficha (séries, timer, histórico, trava de pesagem, offline) e aparece para os Personais como "livre"

### Etapa 8 — Agenda e WhatsApp
- [x] Aulas presenciais recorrentes (dias da semana, horário, duração, início) com cancelamento de datas avulsas e reativação
- [x] Aluno é avisado de aula nova e de cancelamento; vê "Minhas aulas" e a próxima aula no início
- [x] Aulas semanais em **um ou mais dias da semana** (mesmo horário ou um horário por dia), que repetem todo mês até o Personal remover, ou **aulas únicas** numa data
- [x] **Calendário mensal** do Personal: alunos de cada dia, navegação entre meses, detalhe do dia (cancelar/reativar, WhatsApp, agendar aula naquele dia) e resumo dos alunos da semana
- [x] **Lembrete às 7h (SP)**: notificação no app + e-mail ao Personal com os alunos do dia e o botão do WhatsApp de cada um (cron diário, idempotente)
- [x] Botão "Chamar no WhatsApp" na lista e na página do aluno (e na agenda), com telefone normalizado (DDI 55) e a mensagem "Olá, tudo bem? Confirmado nosso treino hoje?"
- [x] Testes de unidade (`npm run test:unit`) para telefone, link do WhatsApp e cálculo da agenda

### Etapa 9 — Dashboard
- [x] Aba **Evolução** do aluno e página "Ver evolução" de cada aluno (Personal), com visões **semanal (seg–dom) e mensal** e navegação entre períodos
- [x] Treinos, volume (séries feitas × reps × carga), séries e tempo, comparados com o período anterior
- [x] Frequência por semana (últimas 8 semanas) em gráfico de barras
- [x] Progressão de carga por exercício (subiu / estável / caiu / primeira vez) com setas e cores; ranking de onde mais aumentou carga
- [x] Evoluções notáveis: recordes (PRs), semanas seguidas treinando e maior volume (com aviso de recorde de volume)
- [x] Peso corporal no período, respeitando a permissão do aluno (RLS)
- [x] Visão geral do Personal no início: ranking de frequência (semana/mês) e alunos sem treinar há 7+ dias
- [x] Agregados no banco (`training_summary`, `training_overview`, *security invoker*: o RLS decide o que cada um vê), com testes SQL e de unidade

### Etapa 10 — Relatório de domingo
- [ ] Geração, e-mail, histórico no app, sugestões por IA/regras

### Etapa 11 — PWA e polimento
- [ ] Service worker, modo offline no treino, polimento visual

## Licença

[MIT](LICENSE)
