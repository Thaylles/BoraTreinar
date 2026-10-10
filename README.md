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

As migrações SQL ficam em `supabase/migrations/` e o seed do catálogo em `supabase/seed.sql`.

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
| `RESEND_API_KEY` / `EMAIL_FROM` | só servidor | envio de e-mails |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | só servidor | sugestões por IA (opcional) |
| `CRON_SECRET` | só servidor | protege a rota do cron |

Nenhum segredo vai para o repositório: `.env*` está no `.gitignore` (exceto `.env.example`).

## Deploy (Vercel)

1. Crie um projeto no Supabase e aplique as migrações (`npx supabase db push`).
2. Em **Supabase → Authentication → URL Configuration**, cadastre a URL de produção como *Site URL* e `https://SEU-DOMINIO/auth/callback` em *Redirect URLs*.
3. Importe o repositório na Vercel e configure as variáveis de ambiente acima.
4. O `vercel.json` já agenda o relatório semanal: `0 1 * * 1` (UTC) = **domingo 22h em São Paulo** (Brasil sem horário de verão desde 2019).
5. Defina `CRON_SECRET` na Vercel — ela envia esse valor automaticamente no header `Authorization` das chamadas de cron.

## Scripts

| Comando | O quê |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |

## Checklist de funcionalidades

### Etapa 1 — Repositório e estrutura
- [x] README, `.gitignore`, licença MIT, `.env.example`
- [x] Next.js + TypeScript + Tailwind
- [x] Identidade visual (cores, tipografia, logo, ícones)
- [x] Clientes Supabase (browser/servidor) e middleware de sessão
- [x] Manifest PWA básico
- [x] `vercel.json` com cron do relatório
- [ ] Deploy inicial na Vercel (aguardando projeto Supabase/Vercel)

### Etapa 2 — Autenticação, perfis e convites
- [ ] Login/cadastro por e-mail e senha, recuperação de senha
- [ ] Cadastro direto do Personal
- [ ] Convite por link (expiração configurável, revogação) e cadastro do aluno com LGPD
- [ ] Compartilhamento e transferência entre Personais (com aceite)

### Etapa 3 — Catálogo
- [ ] Seed de equipamentos/exercícios com imagens livres
- [ ] Cadastro de equipamentos pelo Personal (upload com compressão)

### Etapa 4 — Fichas
- [ ] Fichas por aluno (A/B/C), exercícios ordenados, duplicar, modelos

### Etapa 5 — Execução
- [ ] Execução com séries, carga, timer de descanso, Wake Lock, histórico
- [ ] Registro manual pelo Personal

### Etapa 6 — Peso corporal
- [ ] Registro, privacidade e trava de pesagem

### Etapa 7 — Treino livre
- [ ] Treino livre só com exercícios do catálogo

### Etapa 8 — Agenda e WhatsApp
- [ ] Aulas recorrentes com exceções
- [ ] Botão "Chamar no WhatsApp"

### Etapa 9 — Dashboard
- [ ] Visões semanal/mensal, PRs, volume, ranking

### Etapa 10 — Relatório de domingo
- [ ] Geração, e-mail, histórico no app, sugestões por IA/regras

### Etapa 11 — PWA e polimento
- [ ] Service worker, modo offline no treino, polimento visual

## Licença

[MIT](LICENSE)
