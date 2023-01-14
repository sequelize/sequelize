module.exports = {
  tsconfig: './tsconfig-typedoc.json',
  entryPointStrategy: 'packages',
  entryPoints: ['packages/core'],
  out: './.typedoc-build',
  readme: 'none',
};
