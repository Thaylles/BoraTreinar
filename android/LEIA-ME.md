# App Android do BoraTreinar (TWA)

O app abre o site https://bora-treinar-gamma.vercel.app em tela cheia (Trusted Web Activity).
Mudanças no site aparecem no app sem gerar um novo APK.

- Pacote: `com.boratreinar.app`
- Verificação do domínio: `public/.well-known/assetlinks.json` (impressão SHA-256 da chave).
  Sem ela no ar, o app mostra uma barra de endereço no topo.

## Gerar um novo APK (ex.: novo ícone ou nome)

Precisa do JDK 17+, do Android SDK (platform 36 e build-tools 35) e da chave de assinatura
(`boratreinar.keystore` + senha), que fica fora do repositório.

1. Aumente `appVersionCode` (e `appVersionName`) em `twa-manifest.json` e `versionCode`/`versionName` em `app/build.gradle`.
2. `echo "sdk.dir=/caminho/do/android-sdk" > local.properties`
3. `./gradlew assembleRelease`
4. Alinhe e assine:
   `zipalign -p 4 app/build/outputs/apk/release/app-release-unsigned.apk alinhado.apk`
   `apksigner sign --ks boratreinar.keystore --ks-key-alias boratreinar --out BoraTreinar.apk alinhado.apk`

Atualizações precisam ser assinadas com a MESMA chave; sem ela, o Android não aceita a atualização.
