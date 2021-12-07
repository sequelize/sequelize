const chai = require('chai'),
  expect = chai.expect;

/**
 * Tests whether the ESM named exports & the CJS exports are the same.
 * Context: https://github.com/sequelize/sequelize/pull/13689
 */

describe('ESM module', () => {
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
      'length',
      'prototype',
      'useCLS',
      '_clsRun',
      'name',
      'DOUBLE PRECISION',
      'version',
      'options',
      'postgres',
      'mysql',
      'mariadb',
      'sqlite',
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

    for (const key of cjsKeys) {
      if (ignoredCjsKeys.includes(key)) {
        continue;
      }

      expect(esmKeys).to.include(key, `esm entry point is missing export ${JSON.stringify(key)}`);
    }

    for (const key of esmKeys) {
      expect(sequelizeEsm[key]).not.to.eq(undefined, `esm is exporting undefined under key ${JSON.stringify(key)}`);
      expect(cjsKeys).to.include(key, `esm entry point is declaring export ${JSON.stringify(key)} that is missing from CJS`);
    }
  });
});
