const chai = require('chai');

const expect = chai.expect;

/**
 * Tests whether users can import files deeper than '@sequelize/core" (eg. "@sequelize/core/package.json').
 * Context: https://github.com/sequelize/sequelize/issues/13787
 */

const nodeMajorVersion = Number(process.version.match(/(?<=^v)\d+/));

describe('exports', () => {
  it('exposes /package.json', async () => {
    // TODO: uncomment test once https://nodejs.org/api/esm.html#json-modules are stable
    // if (nodeMajorVersion >= 16) {
    //   await import('@sequelize/core/package.json', {
    //     assert: { type: 'json' }
    //   });
    // }

    require('@sequelize/core/package.json');
  });

  it('exposes lib files', async () => {
    if (nodeMajorVersion >= 12) {
      await import('@sequelize/core/lib/model');
    }

    require('@sequelize/core/lib/model');
  });
});
