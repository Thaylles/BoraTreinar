# BoraTreinar — app Android nativo (Expo / React Native)

App nativo com **todas as funções do site** (aluno, Personal e admin), mais rápido, com cache para
funcionar sem internet e recursos do celular.

## Como funciona

- **Código compartilhado:** o app importa direto de `../src/lib` (regras, cálculos, carregadores de dados).
  O Metro (`metro.config.js`) resolve `@/` para `../src` e troca `@/lib/supabase/server` pelo cliente do app.
  Os carregadores `*-server.ts` rodam no aparelho com o login do usuário (mesmo RLS do site).
- **Ações do servidor:** tudo que escreve ou precisa do servidor (e-mail, IA, chave de serviço) usa as
  mesmas server actions do site pela ponte `POST /api/mobile/action` (`src/app/api/mobile/action`),
  com o token do Supabase no cabeçalho `Authorization`. Novo arquivo `"use server"` → incluir em `registry.ts`.
- **Admin:** os dados das telas do admin vêm de `src/app/admin/mobile-data.ts` (no servidor).
- **Sem internet:** as telas abrem com a última versão salva (React Query + AsyncStorage); treinos,
  água e avaliações ficam numa fila e sobem quando a conexão volta. O treino em andamento é salvo a cada toque.
- **Recursos do celular:** aviso de fim de descanso/cardio (notificação local + vibração), tela ligada no treino,
  avisos do app no celular (conferidos em segundo plano), Health Connect, câmera/galeria, compartilhar imagem/PDF.

## Manutenção

Toda mudança de tela no site deve ser feita também aqui (as telas ficam em `src/app`, com os mesmos caminhos do site).

## Desenvolvimento

```bash
npm install            # (usa legacy-peer-deps, ver .npmrc)
npx expo start         # Expo Go / dev client
npx tsc --noEmit       # tipos
```

## APK de release (GitHub Actions)

Todo merge no `main` que mexe em `mobile/` gera o APK assinado e publica numa **Release** (`app-v<versão>-<versionCode>`).
O site lê a última Release em `/api/app/versao` (cartão "App Android" no início, link fixo `/api/app/baixar`) e o app mostra "Nova versão" quando o `versionCode` publicado é maior que o dele.
Também dá para rodar à mão: aba **Actions → App Android (APK) → Run workflow**.
O `versionCode` sobe sozinho a cada execução; a versão mostrada vem de `app.json` (ou do campo do formulário).

A chave fica só nos segredos do repositório (Settings → Secrets and variables → Actions):
`BT_KEYSTORE_BASE64` (o `.keystore` em base64) e `BT_KEYSTORE_PASSWORD`; opcionais `BT_KEY_PASSWORD` e `BT_KEY_ALIAS` (padrão `boratreinar`).
O fluxo recusa APK assinado com chave que não esteja em `public/.well-known/assetlinks.json`.
Em PRs que mexem em `mobile/`, o mesmo fluxo só confere se o app compila.

### Build local (alternativa)

```bash
npx expo prebuild -p android --clean --no-install
echo "sdk.dir=/caminho/do/android-sdk" > android/local.properties
BT_KEYSTORE=/caminho/boratreinar.keystore BT_KEY_ALIAS=boratreinar \
BT_KEYSTORE_PASSWORD=... BT_KEY_PASSWORD=... \
  (cd android && ./gradlew assembleRelease)
# saída: android/app/build/outputs/apk/release/app-release.apk
```

Nunca coloque a chave nem a senha no repositório.
