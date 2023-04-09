const chai = require('chai'),
  expect = chai.expect;

/**
 * Tests whether the ESM named exports & the CJS exports are the same.
 * Context: https://github.com/sequelize/sequelize/pull/13689
 */

const nodeMajorVersion = Number(process.version.match(/(?<=^v)\d+/));

describe('ESM module', () => {
  // esm is only available in node 12 and above
  if (nodeMajorVersion < 12) {
    return;
  }

  it('exposes the same named exports as the CJS module', async () => {
    // important: if you transpile this file, it's important
    //  that we still use both the native import() and the native require().
    //  don't transpile this import() to a require().
    const sequelizeEsm = await import('sequelize');
    const sequelizeCjs = require('sequelize');

    const esmKeys = Object.keys(sequelizeEsm);

    // include non-enumerables as "Sequelize.{and, or, ...}" are non-enumerable
    const cjsKeys = Object.getOwnPropertyNames(sequelizeCjs);

    // require('sequelize') returns the Sequelize class
    // The typings do not reflect this as some properties of the Sequelize class are not declared as exported in types/index.d.ts.
    // This array lists the properties that are present on the class, but should not be exported in the esm export file nor in types/index.d.ts.
    const ignoredCjsKeys = [
      // cannot be exported - not a valid identifier
      'DOUBLE PRECISION', // DataTypes['DOUBLE PRECISION']

      // make no sense to export
      'length',
      'prototype',
      'useCLS',
      '_clsRun',
      'name',
      'version',
      'options',
      'postgres',
      'mysql',
      'mariadb',
      'sqlite',
      'snowflake',
      'oracle',
      'db2',
      'mssql',
      '_setupHooks',
      'runHooks',
      'addHook',
      'removeHook',
      'hasHook',
      'hasHooks',
      'beforeValidate',
      'afterValidate',
      'validationFailed',
      'beforeCreate',
      'afterCreate',
      'beforeDestroy',
      'afterDestroy',
      'beforeRestore',
      'afterRestore',
      'beforeUpdate',
      'afterUpdate',
      'beforeSave',
      'afterSave',
      'beforeUpsert',
      'afterUpsert',
      'beforeBulkCreate',
      'afterBulkCreate',
      'beforeBulkDestroy',
      'afterBulkDestroy',
      'beforeBulkRestore',
      'afterBulkRestore',
      'beforeBulkUpdate',
      'afterBulkUpdate',
      'beforeFind',
      'beforeFindAfterExpandIncludeAll',
      'beforeFindAfterOptions',
      'afterFind',
      'beforeCount',
      'beforeDefine',
      'afterDefine',
      'beforeInit',
      'afterInit',
      'beforeAssociate',
      'afterAssociate',
      'beforeConnect',
      'afterConnect',
      'beforePoolAcquire',
      'afterPoolAcquire',
      'beforeDisconnect',
      'afterDisconnect',
      'beforeSync',
      'afterSync',
      'beforeBulkSync',
      'afterBulkSync',
      'beforeQuery',
      'afterQuery'
    ];

    for (const key of ignoredCjsKeys) {
      expect(cjsKeys).to.include(key, `Sequelize static property ${JSON.stringify(key)} is marked as ignored for ESM export but does not exist. Remove it from ignore list.`);
    }

    const missingEsmKeys = [];
    for (const key of cjsKeys) {
      if (ignoredCjsKeys.includes(key)) {
        continue;
      }

      if (!esmKeys.includes(key)) {
        missingEsmKeys.push(key);
      }
    }

    expect(missingEsmKeys.length).to.eq(0,
      `esm entry point is missing exports: ${missingEsmKeys.map(v => JSON.stringify(v)).join(', ')}.
Either add these exports to "index.mjs" (and "types/index.d.ts"), or mark them as ignored in "esm-named-exports.test.js"
      `);

    for (const key of esmKeys) {
      expect(sequelizeEsm[key]).not.to.eq(undefined, `esm is exporting undefined under key ${JSON.stringify(key)}`);
      expect(cjsKeys).to.include(key, `esm entry point is declaring export ${JSON.stringify(key)} that is missing from CJS`);

      // exported values need to be the same instances
      //  if we want to avoid major bugs:
      //  https://github.com/sequelize/sequelize/pull/13689#issuecomment-987412233
      expect(sequelizeEsm[key]).to.eq(sequelizeCjs[key]);
    }
  });
});
