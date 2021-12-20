const chai = require('chai'),
  expect = chai.expect;

/**
 * Tests whether users can import files deeper than "sequelize" (eg. "sequelize/package.json").
 * Context: https://github.com/sequelize/sequelize/issues/13787
 */

describe('exports', () => {
  it('exposes /package.json', async () => {
    // await import('sequelize/package.json');
    require('sequelize/package.json');
  });

  it('exposes lib files', async () => {
    await import('sequelize/dist/lib/model.js');
    require('sequelize/dist/lib/model.js');
  });
});
