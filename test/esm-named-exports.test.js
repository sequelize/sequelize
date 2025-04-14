const chai = require('chai');

const expect = chai.expect;

/**
 * Tests whether the ESM named exports & the CJS exports are the same.
 * Context: https://github.com/sequelize/sequelize/pull/13689
 */

// require('@sequelize/core') returns the Sequelize class
// The typings do not reflect this as some properties of the Sequelize class are not declared as exported in types/index.d.ts.
// This array lists the properties that are present on the class, but should not be exported in the esm export file nor in types/index.d.ts.
const ignoredCjsKeysMap = {
  '@sequelize/core': [
    // make no sense to export
    'length',
    'prototype',
    'name',
    'version',

    // importing the data type directly has been removed, and accessing them on the Sequelize constructor is deprecated.
    // Use DataTypes.x exclusively.
    'ABSTRACT',
    'ARRAY',
    'BIGINT',
    'BLOB',
    'BOOLEAN',
    'CHAR',
    'CIDR',
    'CITEXT',
    'DATE',
    'DATEONLY',
    'DECIMAL',
    'DOUBLE',
    'ENUM',
    'FLOAT',
    'GEOGRAPHY',
    'GEOMETRY',
    'HSTORE',
    'INET',
    'INTEGER',
    'JSON',
    'JSONB',
    'MACADDR',
    'MACADDR8',
    'MEDIUMINT',
    'NOW',
    'RANGE',
    'REAL',
    'SMALLINT',
    'STRING',
    'TEXT',
    'TIME',
    'TINYINT',
    'TSVECTOR',
    'UUID',
    'UUIDV1',
    'UUIDV4',
    'VIRTUAL',
  ],
  '@sequelize/core/decorators-legacy': ['__esModule'],
  '@sequelize/db2': ['__esModule'],
  '@sequelize/db2-ibmi': ['__esModule'],
  '@sequelize/mariadb': ['__esModule'],
  '@sequelize/mssql': ['__esModule'],
  '@sequelize/mysql': ['__esModule'],
  '@sequelize/postgres': ['__esModule'],
  '@sequelize/snowflake': ['__esModule'],
  '@sequelize/sqlite3': ['__esModule'],
  '@sequelize/utils': ['__esModule'],
  '@sequelize/utils/node': ['__esModule'],
  '@sequelize/validator.js': ['__esModule'],
};

const exportPaths = Object.keys(ignoredCjsKeysMap);

for (const exportPath of exportPaths) {
  describe(`module "${exportPath}"`, () => {
    it('exposes the same named exports as the CJS module', async () => {
      // important: if you transpile this file, it's important
      //  that we still use both the native import() and the native require().
      //  don't transpile this import() to a require().
      const sequelizeEsm = await import(exportPath);
      const sequelizeCjs = require(exportPath);

      const esmKeys = Object.keys(sequelizeEsm);

      // include non-enumerables as "Sequelize.{and, or, ...}" are non-enumerable
      const cjsKeys = Object.getOwnPropertyNames(sequelizeCjs);

      const ignoredCjsKeys = ignoredCjsKeysMap[exportPath];
      for (const key of ignoredCjsKeys) {
        expect(cjsKeys).to.include(
          key,
          `Sequelize static property ${JSON.stringify(key)} is marked as ignored for ESM export but does not exist. Remove it from ignore list.`,
        );
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

      expect(missingEsmKeys.length).to.eq(
        0,
        `ESM entry point is missing exports: ${missingEsmKeys
          .map(v => JSON.stringify(v))
          .join(', ')}.
Either add these exports the corresponding .mjs file (and .d.ts if applicable), or mark them as ignored in "esm-named-exports.test.js:

${missingEsmKeys.map(key => `export const ${key} = Pkg.${key};\n`).join('')}"
      `,
      );

      for (const key of esmKeys) {
        expect(sequelizeEsm[key]).not.to.eq(
          undefined,
          `ESM is exporting undefined under key ${JSON.stringify(key)}`,
        );

        expect(cjsKeys).to.include(
          key,
          `ESM entry point is declaring export ${JSON.stringify(key)} that is missing from CJS`,
        );

        // exported values need to be the same instances
        //  if we want to avoid major bugs:
        //  https://github.com/sequelize/sequelize/pull/13689#issuecomment-987412233
        expect(sequelizeEsm[key]).to.eq(sequelizeCjs[key]);
      }
    });
  });
}
