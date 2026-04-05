'use strict';

const each = require('lodash/each');

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../../support');

const dialect = Support.getTestDialect();
const { Op } = require('@sequelize/core');
const { SnowflakeQueryGenerator: QueryGenerator } = require('@sequelize/snowflake');
const { createSequelizeInstance } = require('../../../support');

if (dialect === 'snowflake') {
  describe('[SNOWFLAKE Specific] QueryGenerator', () => {
    Support.allowDeprecationsInSuite(['SEQUELIZE0023']);

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
          expectation: { id: 'INTEGER AUTOINCREMENT PRIMARY KEY' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: 0 } }],
          expectation: { id: 'INTEGER DEFAULT 0' },
        },
        {
          title: 'Add column level comment',
          arguments: [{ id: { type: 'INTEGER', comment: 'Test' } }],
          expectation: { id: "INTEGER COMMENT 'Test'" },
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true } }],
          expectation: { id: 'INTEGER UNIQUE' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', after: 'Bar' } }],
          expectation: { id: 'INTEGER AFTER "Bar"' },
        },
        // No Default Values allowed for certain types
        {
          title: 'No Default value for SNOWFLAKE BLOB allowed',
          arguments: [{ id: { type: 'BLOB', defaultValue: [] } }],
          expectation: { id: 'BLOB' },
        },
        {
          title: 'No Default value for SNOWFLAKE TEXT allowed',
          arguments: [{ id: { type: 'TEXT', defaultValue: [] } }],
          expectation: { id: 'TEXT' },
        },
        {
          title: 'No Default value for SNOWFLAKE GEOMETRY allowed',
          arguments: [{ id: { type: 'GEOMETRY', defaultValue: [] } }],
          expectation: { id: 'GEOMETRY' },
        },
        {
          title: 'No Default value for SNOWFLAKE JSON allowed',
          arguments: [{ id: { type: 'JSON', defaultValue: [] } }],
          expectation: { id: 'JSON' },
        },
        // New references style
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id")' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("pk")' },
        },
        {
          arguments: [
            { id: { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' } },
          ],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE' },
        },
        {
          arguments: [
            { id: { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' } },
          ],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT' },
        },
        {
          arguments: [
            {
              id: {
                type: 'INTEGER',
                allowNull: false,
                autoIncrement: true,
                defaultValue: 1,
                references: { table: 'Bar' },
                onDelete: 'CASCADE',
                onUpdate: 'RESTRICT',
              },
            },
          ],
          expectation: {
            id: 'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          },
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id)' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (pk)' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            { id: { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' } },
          ],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            { id: { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' } },
          ],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            {
              id: {
                type: 'INTEGER',
                allowNull: false,
                autoIncrement: true,
                defaultValue: 1,
                references: { table: 'Bar' },
                onDelete: 'CASCADE',
                onUpdate: 'RESTRICT',
              },
            },
          ],
          expectation: {
            id: 'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT',
          },
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT "id", "name" FROM "myTable";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."id" = 2;',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."name" = \'foo\';',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id", "DESC";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
        },
        {
          arguments: [
            'myTable',
            { order: [['id', 'DESC']] },
            function (sequelize) {
              return sequelize.define('myTable', {});
            },
          ],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          arguments: [
            'myTable',
            { order: [['id', 'DESC'], ['name']] },
            function (sequelize) {
              return sequelize.define('myTable', {});
            },
          ],
          expectation:
            'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC, "myTable"."name";',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
          context: QueryGenerator,
        },
        {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
          context: QueryGenerator,
        },
        {
          title: 'functions work for group by',
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
              };
            },
          ],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt");',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
              };
            },
          ],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt"), "title";',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name" ORDER BY "id" DESC;',
          context: QueryGenerator,
        },
        {
          title: 'Empty having',
          arguments: [
            'myTable',
            function () {
              return {
                having: {},
              };
            },
          ],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          title: 'Having in subquery',
          arguments: [
            'myTable',
            function () {
              return {
                subQuery: true,
                tableAs: 'test',
                having: { creationYear: { [Op.gt]: 2002 } },
              };
            },
          ],
          expectation:
            'SELECT "test".* FROM (SELECT * FROM "myTable" AS "test" HAVING "test"."creationYear" > 2002) AS "test";',
          context: QueryGenerator,
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT id, name FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.id = 2;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: "SELECT * FROM myTable WHERE myTable.name = 'foo';",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM myTable ORDER BY id;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM myTable ORDER BY id, DESC;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM myTable ORDER BY myTable.id;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM myTable ORDER BY myTable.id DESC;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            { order: [['id', 'DESC']] },
            function (sequelize) {
              return sequelize.define('myTable', {});
            },
          ],
          expectation: 'SELECT * FROM myTable AS myTable ORDER BY myTable.id DESC;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
        {
          arguments: [
            'myTable',
            { order: [['id', 'DESC'], ['name']] },
            function (sequelize) {
              return sequelize.define('myTable', {});
            },
          ],
          expectation: 'SELECT * FROM myTable AS myTable ORDER BY myTable.id DESC, myTable.name;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
        {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          title: 'functions work for group by',
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
              };
            },
          ],
          expectation: 'SELECT * FROM myTable GROUP BY YEAR(createdAt);',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
        {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
              };
            },
          ],
          expectation: 'SELECT * FROM myTable GROUP BY YEAR(createdAt), title;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
        {
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM myTable GROUP BY name ORDER BY id DESC;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          title: 'Empty having',
          arguments: [
            'myTable',
            function () {
              return {
                having: {},
              };
            },
          ],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
        {
          title: 'Having in subquery',
          arguments: [
            'myTable',
            function () {
              return {
                subQuery: true,
                tableAs: 'test',
                having: { creationYear: { [Op.gt]: 2002 } },
              };
            },
          ],
          expectation:
            'SELECT test.* FROM (SELECT * FROM myTable AS test HAVING test.creationYear > 2002) AS test;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
      ],

      insertQuery: [
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
        },
        {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: "foo';DROP TABLE myTable;" },
          },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
        },
        {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO "myTable" ("data") VALUES ($sequelize_1);',
            bind: { sequelize_1: Buffer.from('Sequelize') },
          },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query:
              'INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query:
              'INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { omitNull: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                foo: sequelize.fn('NOW'),
              };
            },
          ],
          expectation: {
            query: 'INSERT INTO "myTable" ("foo") VALUES (NOW());',
            bind: {},
          },
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: "foo';DROP TABLE myTable;" },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO myTable (data) VALUES ($sequelize_1);',
            bind: { sequelize_1: Buffer.from('Sequelize') },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query:
              'INSERT INTO myTable (name,foo,nullValue) VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query:
              'INSERT INTO myTable (name,foo,nullValue) VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                foo: sequelize.fn('NOW'),
              };
            },
          ],
          expectation: {
            query: 'INSERT INTO myTable (foo) VALUES (NOW());',
            bind: {},
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: 'INSERT INTO "myTable" ("name") VALUES (\'foo\'),(\'bar\');',
        },
        {
          arguments: ['myTable', [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }]],
          expectation:
            "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;'),('bar');",
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) },
              { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) },
            ],
          ],
          expectation: `INSERT INTO "myTable" ("name","birthday") VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');`,
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1 },
              { name: 'bar', foo: 2 },
            ],
          ],
          expectation: 'INSERT INTO "myTable" ("name","foo") VALUES (\'foo\',1),(\'bar\',2);',
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', nullValue: null },
            ],
          ],
          expectation:
            'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',NULL,NULL);',
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', foo: 2, nullValue: null },
            ],
          ],
          expectation:
            'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', foo: 2, nullValue: null },
            ],
          ],
          expectation:
            'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: true } }, // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: undefined },
              { name: 'bar', foo: 2, undefinedValue: undefined },
            ],
          ],
          expectation:
            'INSERT INTO "myTable" ("name","foo","nullValue","undefinedValue") VALUES (\'foo\',1,NULL,NULL),(\'bar\',2,NULL,NULL);',
          context: { options: { omitNull: true } }, // Note: As above
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', value: true },
              { name: 'bar', value: false },
            ],
          ],
          expectation:
            'INSERT INTO "myTable" ("name","value") VALUES (\'foo\',true),(\'bar\',false);',
        },
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: 'INSERT IGNORE INTO "myTable" ("name") VALUES (\'foo\'),(\'bar\');',
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'),('bar');",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;'),('bar');",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1 },
              { name: 'bar', foo: 2 },
            ],
          ],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1),('bar',2);",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', nullValue: null },
            ],
          ],
          expectation:
            "INSERT INTO myTable (name,foo,nullValue) VALUES ('foo',1,NULL),('bar',NULL,NULL);",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', foo: 2, nullValue: null },
            ],
          ],
          expectation:
            "INSERT INTO myTable (name,foo,nullValue) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: null },
              { name: 'bar', foo: 2, nullValue: null },
            ],
          ],
          expectation:
            "INSERT INTO myTable (name,foo,nullValue) VALUES ('foo',1,NULL),('bar',2,NULL);",
          context: { options: { omitNull: true, quoteIdentifiers: false } }, // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', foo: 1, nullValue: undefined },
              { name: 'bar', foo: 2, undefinedValue: undefined },
            ],
          ],
          expectation:
            "INSERT INTO myTable (name,foo,nullValue,undefinedValue) VALUES ('foo',1,NULL,NULL),('bar',2,NULL,NULL);",
          context: { options: { omitNull: true, quoteIdentifiers: false } }, // Note: As above
        },
        {
          arguments: [
            'myTable',
            [
              { name: 'foo', value: true },
              { name: 'bar', value: false },
            ],
          ],
          expectation: "INSERT INTO myTable (name,value) VALUES ('foo',true),('bar',false);",
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: "INSERT IGNORE INTO myTable (name) VALUES ('foo'),('bar');",
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      updateQuery: [
        {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
        },
        {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: "foo';DROP TABLE myTable;", sequelize_2: 'foo' },
          },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query:
              'UPDATE "myTable" SET "bar"=$sequelize_1,"nullValue"=$sequelize_2 WHERE "name" = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query:
              'UPDATE "myTable" SET "bar"=$sequelize_1,"nullValue"=$sequelize_2 WHERE "name" = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { omitNull: false } },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                bar: sequelize.fn('NOW'),
              };
            },
            { name: 'foo' },
          ],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=NOW() WHERE "name" = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                bar: sequelize.col('foo'),
              };
            },
            { name: 'foo' },
          ],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"="foo" WHERE "name" = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET name=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: "foo';DROP TABLE myTable;", sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query:
              'UPDATE myTable SET bar=$sequelize_1,nullValue=$sequelize_2 WHERE name = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query:
              'UPDATE myTable SET bar=$sequelize_1,nullValue=$sequelize_2 WHERE name = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                bar: sequelize.fn('NOW'),
              };
            },
            { name: 'foo' },
          ],
          expectation: {
            query: 'UPDATE myTable SET bar=NOW() WHERE name = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            function (sequelize) {
              return {
                bar: sequelize.col('foo'),
              };
            },
            { name: 'foo' },
          ],
          expectation: {
            query: 'UPDATE myTable SET bar=foo WHERE name = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        },
      ],
    };

    each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        for (const test of tests) {
          const query = test.expectation.query || test.expectation;
          const title =
            test.title ||
            `SNOWFLAKE correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, () => {
            const sequelize = createSequelizeInstance({
              ...(test.context && test.context.options),
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
