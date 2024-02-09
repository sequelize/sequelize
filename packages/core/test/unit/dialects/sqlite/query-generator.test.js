'use strict';

const each = require('lodash/each');

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../../support');

const dialect = Support.getTestDialect();
const { SqliteQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/sqlite/query-generator.js');
const { createSequelizeInstance } = require('../../../support');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] QueryGenerator', () => {
    const suites = {
      attributesToSQL: [
        {
          arguments: [{ id: 'INTEGER' }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: 'INTEGER', foo: 'VARCHAR(255)' }],
          expectation: { id: 'INTEGER', foo: 'VARCHAR(255)' },
        },
        {
          arguments: [{ id: { type: 'INTEGER' } }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false } }],
          expectation: { id: 'INTEGER NOT NULL' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: true } }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', primaryKey: true, autoIncrement: true } }],
          expectation: { id: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: 0 } }],
          expectation: { id: 'INTEGER DEFAULT 0' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: undefined } }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true } }],
          expectation: { id: 'INTEGER UNIQUE' },
        },

        // New references style
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`)' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`pk`)' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES `Bar` (`id`) ON UPDATE RESTRICT' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, defaultValue: 1, references: { table: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT' },
        },
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM `myTable`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT `id`, `name` FROM `myTable`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`id` = 2;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: 'SELECT * FROM `myTable` WHERE `myTable`.`name` = \'foo\';',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `id`, `DESC`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: [['id', 'DESC']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC;',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          arguments: ['myTable', { order: [['id', 'DESC'], ['name']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM `myTable` AS `myTable` ORDER BY `myTable`.`id` DESC, `myTable`.`name`;',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`;',
          context: QueryGenerator,
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
            };
          }],
          expectation: 'SELECT * FROM `myTable` GROUP BY YEAR(`createdAt`);',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
            };
          }],
          expectation: 'SELECT * FROM `myTable` GROUP BY YEAR(`createdAt`), `title`;',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          arguments: ['myTable', { group: ['name', 'title'] }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name`, `title`;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM `myTable` GROUP BY `name` ORDER BY `id` DESC;',
          context: QueryGenerator,
        },
      ],

      updateQuery: [
        {
          arguments: ['myTable', { name: 'foo' }, { id: 2 }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$sequelize_1 WHERE `id` = $sequelize_2',
            bind: { sequelize_1: 'foo', sequelize_2: 2 },
          },
        }, {
          arguments: ['myTable', { name: '\'bar\'' }, { id: 2 }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$sequelize_1 WHERE `id` = $sequelize_2',
            bind: { sequelize_1: '\'bar\'', sequelize_2: 2 },
          },
        }, {
          arguments: ['myTable', { name: 'bar', value: null }, { id: 2 }],
          expectation: {
            query: 'UPDATE `myTable` SET `name`=$sequelize_1,`value`=$sequelize_2 WHERE `id` = $sequelize_3',
            bind: { sequelize_1: 'bar', sequelize_2: null, sequelize_3: 2 },
          },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$sequelize_1,`nullValue`=$sequelize_2 WHERE `name` = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$sequelize_1,`nullValue`=$sequelize_2 WHERE `name` = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null,  sequelize_3: 'foo' },
          },
          context: { options: { omitNull: false } },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=$sequelize_1 WHERE `name` = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true } },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.fn('NOW'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=NOW() WHERE `name` = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.col('foo'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE `myTable` SET `bar`=`foo` WHERE `name` = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        },
      ],
      foreignKeyCheckQuery: [
        {
          title: 'Properly quotes table names',
          arguments: ['myTable'],
          expectation: 'PRAGMA foreign_key_check(`myTable`);',
        },
        {
          title: 'Properly quotes table names as schema',
          arguments: [{ schema: 'schema', tableName: 'myTable' }],
          expectation: 'PRAGMA foreign_key_check(`schema.myTable`);',
        },
      ],
    };

    each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        for (const test of tests) {
          const query = test.expectation.query || test.expectation;
          const title = test.title || `SQLite correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, () => {
            const sequelize = createSequelizeInstance({
              ...test.context && test.context.options,
            });

            if (test.needsSequelize) {
              if (typeof test.arguments[1] === 'function') {
                test.arguments[1] = test.arguments[1](sequelize);
              }

              if (typeof test.arguments[2] === 'function') {
                test.arguments[2] = test.arguments[2](sequelize);
              }
            }

            const queryGenerator = sequelize.dialect.queryGenerator;

            const conditions = queryGenerator[suiteTitle](...test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        }
      });
    });
  });
}
