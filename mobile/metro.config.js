// Metro: o app reaproveita o código "puro" do site em ../src/lib (cálculos, regras, textos).
// Imports "@/..." apontam para ../src, e os pacotes sempre vêm de mobile/node_modules.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [path.join(root, "src")];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules")];
const appOrigin = path.join(__dirname, "index.js");

// Módulos só do servidor Next trocados por versões do app.
const SHIMS = {
  "server-only": path.join(__dirname, "src/shims/empty.ts"),
  "@/lib/supabase/server": path.join(__dirname, "src/lib/supabase.ts"),
  "@/lib/supabase/client": path.join(__dirname, "src/lib/supabase.ts"),
  "next/cache": path.join(__dirname, "src/shims/next-cache.ts"),
};
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  // Pacotes importados pelos arquivos do site (../src) vêm do node_modules do app, nunca do site.
  const fromSite = ctx.originModulePath.startsWith(path.join(root, "src")) && !moduleName.startsWith(".") && !moduleName.startsWith("@/");
  const context = fromSite ? { ...ctx, originModulePath: appOrigin } : ctx;
  if (SHIMS[moduleName]) return { type: "sourceFile", filePath: SHIMS[moduleName] };
  if (moduleName.startsWith("~/")) {
    return (defaultResolve ?? context.resolveRequest)(context, path.join(__dirname, "src", moduleName.slice(2)), platform);
  }
  if (moduleName.startsWith("@/")) {
    return (defaultResolve ?? context.resolveRequest)(context, path.join(root, "src", moduleName.slice(2)), platform);
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
