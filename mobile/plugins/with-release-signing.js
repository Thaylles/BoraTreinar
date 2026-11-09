/**
 * Assina o APK de release com a chave do BoraTreinar (a mesma do app antigo, para atualizar por cima).
 * A chave fica fora do repositório: informe o caminho e as senhas por variáveis de ambiente
 * BT_KEYSTORE, BT_KEYSTORE_PASSWORD, BT_KEY_ALIAS e BT_KEY_PASSWORD na hora do build.
 * Sem elas, o release usa a chave de debug (só para testes).
 */
const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes("signingConfigs.btRelease")) {
      g = g.replace(
        /signingConfigs \{/,
        `signingConfigs {
        btRelease {
            if (System.getenv("BT_KEYSTORE")) {
                storeFile file(System.getenv("BT_KEYSTORE"))
                storePassword System.getenv("BT_KEYSTORE_PASSWORD")
                keyAlias System.getenv("BT_KEY_ALIAS")
                keyPassword System.getenv("BT_KEY_PASSWORD")
            }
        }`,
      );
      g = g.replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        `$1signingConfig System.getenv("BT_KEYSTORE") ? signingConfigs.btRelease : signingConfigs.debug`,
      );
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
