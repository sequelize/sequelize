module.exports = {
  entryPointStrategy: 'packages',
  // Note: packages/postgres cannot be included until https://github.com/TypeStrong/typedoc/issues/2467 is fixed
  entryPoints: ['packages/core', 'packages/utils', 'packages/validator-js'],
  out: './.typedoc-build',
  readme: 'none',
  plugin: [
    'typedoc-plugin-missing-exports',
    'typedoc-plugin-mdn-links',
    'typedoc-plugin-carbon-ads',
  ],
  carbonPlacement: 'sequelizeorg',
  carbonServe: 'CEAI627Y',
  treatWarningsAsErrors: true,
};
