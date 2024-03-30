import { expect } from 'chai';

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
    // @ts-expect-error -- we're testing that this will be rejected
    await expect(import('@sequelize/core/lib/model')).to.be.rejectedWith(
      'ERR_PACKAGE_PATH_NOT_EXPORTED',
    );
  });

  it('allows access to lib if the user acknowledges that it is unsafe', async () => {
    await import('@sequelize/core/_non-semver-use-at-your-own-risk_/model.js');
  });
});
