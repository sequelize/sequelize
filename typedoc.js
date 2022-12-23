module.exports = {
  tsconfig: './tsconfig.json',
  entryPoints: ['./src/index.d.ts', './src/decorators/legacy/index.ts'],
  out: './.typedoc-build',
  readme: 'none',
  plugin: ['typedoc-plugin-missing-exports', 'typedoc-plugin-mdn-links', 'typedoc-plugin-carbon-ads'],
  carbonPlacement: 'sequelizeorg',
  carbonServe: 'CEAI627Y',
  excludeExternals: true,
  treatWarningsAsErrors: true,
};
