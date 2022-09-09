const { expect } = require('chai');

/**
 * Tests whether users can import files deeper than '@sequelize/core" (eg. "@sequelize/core/package.json').
 * Context: https://github.com/sequelize/sequelize/issues/13787
 */

describe('exports', () => {
  it('exposes /package.json', async () => {
    // TODO: uncomment test once https://nodejs.org/api/esm.html#json-modules are stable
    // await import('@sequelize/core/package.json', {
    //   assert: { type: 'json' }
    // });

    require('@sequelize/core/package.json');
  });

  it('blocks access to lib files', async () => {
    await expect(import('@sequelize/core/lib/model')).to.be.rejectedWith('Package subpath \'./lib/model\' is not defined by "exports"');
  });

  it('allows access to lib if the user acknowledges that it is unsafe', async () => {
    await import('@sequelize/core/_non-semver-use-at-your-own-risk_/model.js');
  });
});
