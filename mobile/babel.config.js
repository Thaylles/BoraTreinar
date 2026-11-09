/** O código do site marca arquivos com `import "server-only"`; no app eles rodam no aparelho (com RLS), então tiramos a marca. */
const stripServerOnly = () => ({
  visitor: {
    ImportDeclaration(path) {
      if (path.node.source.value === "server-only") path.remove();
    },
  },
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [stripServerOnly],
  };
};
