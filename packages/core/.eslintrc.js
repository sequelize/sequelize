module.exports = {
  parserOptions: {
    project: [`${__dirname}/tsconfig.json`],
  },
  overrides: [
    {
      files: ['test/**/*'],
      parserOptions: {
        project: [`${__dirname}/test/tsconfig.json`],
      },
    },
  ],
};
