module.exports = {
  entryPointStrategy: 'packages',
  entryPoints: ['packages/core', 'packages/validator-js'],
  out: './.typedoc-build',
  readme: 'none',
  plugin: ['typedoc-plugin-missing-exports', 'typedoc-plugin-mdn-links', 'typedoc-plugin-carbon-ads'],
  carbonPlacement: 'sequelizeorg',
  carbonServe: 'CEAI627Y',
  excludeExternals: true,
  treatWarningsAsErrors: true,
};
