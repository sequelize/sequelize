module.exports = {
  tsconfig: '../tsconfig-typedoc.json',
  entryPoints: ['../dist/index.d.ts'],
  out: '../esdoc',
  plugin: ['typedoc-plugin-markdown'],

  // typedoc-plugin-markdown
  entryDocument: ['../docs/index.md']
};
