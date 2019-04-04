'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Op = require('../../../../lib/operators'),
  QueryGenerator = require('../../../../lib/dialects/postgres/query-generator'),
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types'),
  current = Support.sequelize,
  _ = require('lodash');

const { Composition } = require('../../../../lib/dialects/abstract/query-generator/composition');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] QueryGenerator', () => {
    const suites = {
      createDatabaseQuery: [
        {
          arguments: ['myDatabase'],
          expectation: 'CREATE DATABASE "myDatabase";'
        },
        {
          arguments: ['myDatabase', { encoding: 'UTF8' }],
          expectation: 'CREATE DATABASE "myDatabase" ENCODING = \'UTF8\';'
        },
        {
          arguments: ['myDatabase', { collate: 'en_US.UTF-8' }],
          expectation: 'CREATE DATABASE "myDatabase" LC_COLLATE = \'en_US.UTF-8\';'
        },
        {
          arguments: ['myDatabase', { encoding: 'UTF8' }],
          expectation: 'CREATE DATABASE "myDatabase" ENCODING = \'UTF8\';'
        },
        {
          arguments: ['myDatabase', { ctype: 'zh_TW.UTF-8' }],
          expectation: 'CREATE DATABASE "myDatabase" LC_CTYPE = \'zh_TW.UTF-8\';'
        },
        {
          arguments: ['myDatabase', { template: 'template0' }],
          expectation: 'CREATE DATABASE "myDatabase" TEMPLATE = \'template0\';'
        },
        {
          arguments: ['myDatabase', { encoding: 'UTF8', collate: 'en_US.UTF-8', ctype: 'zh_TW.UTF-8', template: 'template0' }],
          expectation: 'CREATE DATABASE "myDatabase" ENCODING = \'UTF8\' LC_COLLATE = \'en_US.UTF-8\' LC_CTYPE = \'zh_TW.UTF-8\' TEMPLATE = \'template0\';'
        }
      ],
      dropDatabaseQuery: [
        {
          arguments: ['myDatabase'],
          expectation: 'DROP DATABASE IF EXISTS "myDatabase";'
        }
      ],
      arithmeticQuery: [
        {
          title: 'Should use the plus operator',
          arguments: ['+', 'myTable', { foo: 'bar' }, {}, {}],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"+ $1 RETURNING *;',
            bind: ['bar']
          }
        },
        {
          title: 'Should use the plus operator with where clause',
          arguments: ['+', 'myTable', { foo: 'bar' }, { bar: 'biz' }, {}],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"+ $1 WHERE "bar" = $2 RETURNING *;',
            bind: ['bar', 'biz']
          }
        },
        {
          title: 'Should use the plus operator without returning clause',
          arguments: ['+', 'myTable', { foo: 'bar' }, {}, { returning: false }],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"+ $1;',
            bind: ['bar']
          }
        },
        {
          title: 'Should use the minus operator',
          arguments: ['-', 'myTable', { foo: 'bar' }, {}, {}],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"- $1 RETURNING *;',
            bind: ['bar']
          }
        },
        {
          title: 'Should use the minus operator with negative value',
          arguments: ['-', 'myTable', { foo: -1 }, {}, {}],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"- $1 RETURNING *;',
            bind: [-1]
          }
        },
        {
          title: 'Should use the minus operator with where clause',
          arguments: ['-', 'myTable', { foo: 'bar' }, { bar: 'biz' }, {}],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"- $1 WHERE "bar" = $2 RETURNING *;',
            bind: ['bar', 'biz']
          }
        },
        {
          title: 'Should use the minus operator without returning clause',
          arguments: ['-', 'myTable', { foo: 'bar' }, {}, { returning: false }],
          expectation: {
            query: 'UPDATE "myTable" SET "foo"="foo"- $1;',
            bind: ['bar']
          }
        }
      ],
      attributesToSQL: [
        {
          arguments: [{ id: 'INTEGER' }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: 'INTEGER', foo: 'VARCHAR(255)' }],
          expectation: { id: 'INTEGER', foo: 'VARCHAR(255)' }
        },
        {
          arguments: [{ id: { type: 'INTEGER' } }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false } }],
          expectation: { id: 'INTEGER NOT NULL' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: true } }],
          expectation: { id: 'INTEGER' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', primaryKey: true, autoIncrement: true } }],
          expectation: { id: 'INTEGER SERIAL PRIMARY KEY' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: 0 } }],
          expectation: { id: 'INTEGER DEFAULT 0' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true } }],
          expectation: { id: 'INTEGER UNIQUE' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true, comment: 'This is my comment' } }],
          expectation: { id: 'INTEGER UNIQUE COMMENT This is my comment' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true, comment: 'This is my comment' } }, { context: 'addColumn', key: 'column', table: { schema: 'foo', tableName: 'bar' } }],
          expectation: { id: 'INTEGER UNIQUE; COMMENT ON COLUMN "foo"."bar"."column" IS \'This is my comment\'' }
        },
        // New references style
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id")' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("pk")' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT' }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT' }
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id)' },
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (pk)' },
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE' },
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT' },
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT' },
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      createTableQuery: [
        {
          arguments: ['myTable', { int: 'INTEGER', bigint: 'BIGINT', smallint: 'SMALLINT' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER, "bigint" BIGINT, "smallint" SMALLINT);'
        },
        {
          arguments: ['myTable', { serial: 'INTEGER SERIAL', bigserial: 'BIGINT SERIAL', smallserial: 'SMALLINT SERIAL' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("serial"  SERIAL, "bigserial"  BIGSERIAL, "smallserial"  SMALLSERIAL);'
        },
        {
          arguments: ['myTable', { int: 'INTEGER COMMENT Test', foo: 'INTEGER COMMENT Foo Comment' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("int" INTEGER , "foo" INTEGER ); COMMENT ON COLUMN "myTable"."int" IS \'Test\'; COMMENT ON COLUMN "myTable"."foo" IS \'Foo Comment\';'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));'
        },
        {
          arguments: ['myTable', { data: current.normalizeDataType(DataTypes.BLOB).toSql() }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);'
        },
        {
          arguments: ['myTable', { data: current.normalizeDataType(DataTypes.BLOB('long')).toSql() }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BYTEA);'
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "mySchema"."myTable" ("title" VARCHAR(255), "name" VARCHAR(255));'
        },
        {
          arguments: ['myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" "public"."enum_myTable_title", "name" VARCHAR(255));'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));'
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS mySchema.myTable (title VARCHAR(255), name VARCHAR(255));',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: ['myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title public."enum_myTable_title", name VARCHAR(255));',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), id INTEGER , PRIMARY KEY (id));',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), otherId INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      dropTableQuery: [
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS "myTable";'
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: 'DROP TABLE IF EXISTS "mySchema"."myTable";'
        },
        {
          arguments: ['myTable', { cascade: true }],
          expectation: 'DROP TABLE IF EXISTS "myTable" CASCADE;'
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { cascade: true }],
          expectation: 'DROP TABLE IF EXISTS "mySchema"."myTable" CASCADE;'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS myTable;',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable;',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: ['myTable', { cascade: true }],
          expectation: 'DROP TABLE IF EXISTS myTable CASCADE;',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { cascade: true }],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable CASCADE;',
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      changeColumnQuery: [
        {
          arguments: ['myTable', {
            col_1: "ENUM('value 1', 'value 2') NOT NULL",
            col_2: "ENUM('value 3', 'value 4') NOT NULL"
          }],
          expectation: 'ALTER TABLE "myTable" ALTER COLUMN "col_1" SET NOT NULL;ALTER TABLE "myTable" ALTER COLUMN "col_1" DROP DEFAULT;CREATE TYPE "public"."enum_myTable_col_1" AS ENUM(\'value 1\', \'value 2\');ALTER TABLE "myTable" ALTER COLUMN "col_1" TYPE "public"."enum_myTable_col_1" USING ("col_1"::"public"."enum_myTable_col_1");ALTER TABLE "myTable" ALTER COLUMN "col_2" SET NOT NULL;ALTER TABLE "myTable" ALTER COLUMN "col_2" DROP DEFAULT;CREATE TYPE "public"."enum_myTable_col_2" AS ENUM(\'value 3\', \'value 4\');ALTER TABLE "myTable" ALTER COLUMN "col_2" TYPE "public"."enum_myTable_col_2" USING ("col_2"::"public"."enum_myTable_col_2");'
        }
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: {
            query: 'SELECT * FROM "myTable";',
            bind: []
          }
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: {
            query: 'SELECT "id", "name" FROM "myTable";',
            bind: []
          }
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."id" = $1;',
            bind: [2]
          }
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."name" = $1;',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { where: { name: "foo';DROP TABLE myTable;" } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."name" = $1;',
            bind: ["foo';DROP TABLE myTable;"]
          }
        }, {
          arguments: ['myTable', { where: 2 }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."id" = $1;',
            bind: [2]
          }
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: {
            query: 'SELECT count(*) AS "count" FROM "foo";',
            bind: []
          }
        }, {
          arguments: ['myTable', { order: ['id'] }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY "id";',
            bind: []
          },
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY "id", "DESC";',
            bind: []
          },
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY "myTable"."id";',
            bind: []
          },
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY "myTable"."id" DESC;',
            bind: []
          },
          context: QueryGenerator
        }, {
          arguments: ['myTable', { order: [['id', 'DESC']] }, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: {
            query: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC;',
            bind: []
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', { order: [['id', 'DESC'], ['name']] }, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: {
            query: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC, "myTable"."name";',
            bind: []
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'uses limit 0',
          arguments: ['myTable', { limit: 0 }],
          expectation: {
            query: 'SELECT * FROM "myTable" LIMIT $1;',
            bind: [0]
          },
          context: QueryGenerator
        }, {
          title: 'uses offset 0',
          arguments: ['myTable', { offset: 0 }],
          expectation: {
            query: 'SELECT * FROM "myTable" OFFSET $1;',
            bind: [0]
          },
          context: QueryGenerator
        }, {
          title: 'sequelize.where with .fn as attribute and default comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'jan'),
                { type: 1 }
              )
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") = $1 AND "myTable"."type" = $2);',
            bind: ['jan', 1]
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'sequelize.where with .fn as attribute and LIKE comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'LIKE', '%t%'),
                { type: 1 }
              )
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") LIKE $1 AND "myTable"."type" = $2);',
            bind: ['%t%', 1]
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']]
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY f1(f2("id")) DESC;',
            bind: []
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take all types as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [
                [sequelize.fn('f1', sequelize.col('myTable.id')), 'DESC'],
                [sequelize.fn('f2', 12, 'lalala', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))), 'ASC']
              ]
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" ORDER BY f1("myTable"."id") DESC, f2($1, $2, $3) ASC;',
            bind: [12, 'lalala', '2011-03-27 10:01:55.000 +00:00']
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { Op.in: ... }',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                { archived: null },
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { [Op.in]: ['Lost', 'Found'] })
              )
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE ("myTable"."archived" IS NULL AND COALESCE("place_type_codename", "announcement_type_codename") IN ($1, $2));',
            bind: ['Lost', 'Found']
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: {
            query: 'SELECT * FROM "myTable" GROUP BY "name";',
            bind: []
          }
        }, {
          arguments: ['myTable', { group: ['name'] }],
          expectation: {
            query: 'SELECT * FROM "myTable" GROUP BY "name";',
            bind: []
          }
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))]
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt");',
            bind: []
          },
          needsSequelize: true
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title']
            };
          }],
          expectation: {
            query: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt"), "title";',
            bind: []
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', { group: ['name', 'title'] }],
          expectation: {
            query: 'SELECT * FROM "myTable" GROUP BY "name", "title";',
            bind: []
          }
        }, {
          title: 'HAVING clause works with where-like hash',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: { creationYear: { [Op.gt]: 2002 } }
            };
          }],
          expectation: {
            query: 'SELECT *, YEAR("createdAt") AS "creationYear" FROM "myTable" GROUP BY "creationYear", "title" HAVING "creationYear" > $1;',
            bind: [2002]
          },
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', { limit: 10 }],
          expectation: {
            query: 'SELECT * FROM "myTable" LIMIT $1;',
            bind: [10]
          }
        }, {
          arguments: ['myTable', { limit: 10, offset: 2 }],
          expectation: {
            query: 'SELECT * FROM "myTable" LIMIT $1 OFFSET $2;',
            bind: [10, 2]
          }
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', { offset: 2 }],
          expectation: {
            query: 'SELECT * FROM "myTable" OFFSET $1;',
            bind: [2]
          }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: {
            query: 'SELECT * FROM "mySchema"."myTable";',
            bind: []
          }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { where: { name: "foo';DROP TABLE mySchema.myTable;" } }],
          expectation: {
            query: 'SELECT * FROM "mySchema"."myTable" WHERE "mySchema"."myTable"."name" = $1;',
            bind: ["foo';DROP TABLE mySchema.myTable;"]
          }
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', { where: { field: Buffer.from('Sequelize') } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."field" = $1;',
            bind: [Buffer.from('Sequelize')]
          },
          context: QueryGenerator
        }, {
          title: 'string in array should escape \' as \'\'',
          arguments: ['myTable', { where: { aliases: { [Op.contains]: ['Queen\'s'] } } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."aliases" @> $1;',
            bind: [['Queen\'s']]
          }
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: {
            query: 'SELECT * FROM myTable;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: {
            query: 'SELECT id, name FROM myTable;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.id = $1;',
            bind: [2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.name = $1;',
            bind: ['foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { where: { name: "foo';DROP TABLE myTable;" } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.name = $1;',
            bind: ["foo';DROP TABLE myTable;"]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { where: 2 }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.id = $1;',
            bind: [2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: {
            query: 'SELECT count(*) AS count FROM foo;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { order: ['id DESC'] }],
          expectation: {
            query: 'SELECT * FROM myTable ORDER BY id DESC;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { group: 'name' }],
          expectation: {
            query: 'SELECT * FROM myTable GROUP BY name;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { group: ['name'] }],
          expectation: {
            query: 'SELECT * FROM myTable GROUP BY name;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { group: ['name', 'title'] }],
          expectation: {
            query: 'SELECT * FROM myTable GROUP BY name, title;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { limit: 10 }],
          expectation: {
            query: 'SELECT * FROM myTable LIMIT $1;',
            bind: [10]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { limit: 10, offset: 2 }],
          expectation: {
            query: 'SELECT * FROM myTable LIMIT $1 OFFSET $2;',
            bind: [10, 2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', { offset: 2 }],
          expectation: {
            query: 'SELECT * FROM myTable OFFSET $1;',
            bind: [2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: {
            query: 'SELECT * FROM mySchema.myTable;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { where: { name: "foo';DROP TABLE mySchema.myTable;" } }],
          expectation: {
            query: 'SELECT * FROM mySchema.myTable WHERE mySchema.myTable.name = $1;',
            bind: ["foo';DROP TABLE mySchema.myTable;"]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'use != if Op.ne !== null',
          arguments: ['myTable', { where: { field: { [Op.ne]: 0 } } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.field != $1;',
            bind: [0]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'use IS NOT if Op.ne === null',
          arguments: ['myTable', { where: { field: { [Op.ne]: null } } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.field IS NOT NULL;',
            bind: []
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'use IS NOT if Op.not === BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: true } } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.field IS NOT $1;',
            bind: [true]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'use != if Op.not !== BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: 3 } } }],
          expectation: {
            query: 'SELECT * FROM myTable WHERE myTable.field != $1;',
            bind: [3]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          title: 'Regular Expression in where clause',
          arguments: ['myTable', { where: { field: { [Op.regexp]: '^[h|a|t]' } } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."field" ~ $1;',
            bind: ['^[h|a|t]']
          },
          context: QueryGenerator
        }, {
          title: 'Regular Expression negation in where clause',
          arguments: ['myTable', { where: { field: { [Op.notRegexp]: '^[h|a|t]' } } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."field" !~ $1;',
            bind: ['^[h|a|t]']
          },
          context: QueryGenerator
        }, {
          title: 'Case-insensitive Regular Expression in where clause',
          arguments: ['myTable', { where: { field: { [Op.iRegexp]: '^[h|a|t]' } } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."field" ~* $1;',
            bind: ['^[h|a|t]']
          },
          context: QueryGenerator
        }, {
          title: 'Case-insensitive Regular Expression negation in where clause',
          arguments: ['myTable', { where: { field: { [Op.notIRegexp]: '^[h|a|t]' } } }],
          expectation: {
            query: 'SELECT * FROM "myTable" WHERE "myTable"."field" !~* $1;',
            bind: ['^[h|a|t]']
          },
          context: QueryGenerator
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', {}],
          expectation: {
            query: 'INSERT INTO "myTable" DEFAULT VALUES;',
            bind: []
          }
        },
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1);',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: 'foo' }, {}, { ignoreDuplicates: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1) ON CONFLICT DO NOTHING;',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: 'foo' }, {}, { returning: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1) RETURNING *;',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: 'foo' }, {}, { ignoreDuplicates: true, returning: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1) ON CONFLICT DO NOTHING RETURNING *;',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1);',
            bind: ["foo';DROP TABLE myTable;"]
          }
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","birthday") VALUES ($1,$2);',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00']
          }
        }, {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO "myTable" ("data") VALUES ($1);',
            bind: [Buffer.from('Sequelize')]
          }
        }, {
          arguments: ['myTable', { name: 'foo', numbers: [1, 2, 3] }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","numbers") VALUES ($1,$2);',
            bind: ['foo', [1, 2, 3]]
          }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($1,$2);',
            bind: ['foo', 1]
          }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL);',
            bind: ['foo']
          }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL);',
            bind: ['foo']
          },
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1);',
            bind: ['foo']
          }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: JSON.stringify({ info: 'Look ma a " quote' }) }],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1);',
            bind: ['{"info":"Look ma a \\" quote"}']
          }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: "foo';DROP TABLE mySchema.myTable;" }],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1);',
            bind: ["foo';DROP TABLE mySchema.myTable;"]
          }
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              foo: sequelize.fn('NOW')
            };
          }],
          expectation: {
            query: 'INSERT INTO "myTable" ("foo") VALUES (NOW());',
            bind: []
          },
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1);',
            bind: ["foo';DROP TABLE myTable;"]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }],
          expectation: {
            query: 'INSERT INTO myTable (name,birthday) VALUES ($1,$2);',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', numbers: [1, 2, 3] }],
          expectation: {
            query: 'INSERT INTO myTable (name,numbers) VALUES ($1,$2);',
            bind: ['foo', [1, 2, 3]]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($1,$2);',
            bind: ['foo', 1]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL);',
            bind: ['foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL);',
            bind: ['foo']
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1);',
            bind: ['foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: JSON.stringify({ info: 'Look ma a " quote' }) }],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1);',
            bind: ['{"info":"Look ma a \\" quote"}']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: "foo';DROP TABLE mySchema.myTable;" }],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1);',
            bind: ["foo';DROP TABLE mySchema.myTable;"]
          },
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1),($2);',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1),($2) ON CONFLICT DO NOTHING;',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { returning: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1),($2) RETURNING *;',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true, returning: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1),($2) ON CONFLICT DO NOTHING RETURNING *;',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($1),($2);',
            bind: ["foo';DROP TABLE myTable;", 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","birthday") VALUES ($1,$2),($3,$4);',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 'bar', '2012-03-27 10:01:55.000 +00:00']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1 }, { name: 'bar', foo: 2 }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($1,$2),($3,$4);',
            bind: ['foo', 1, 'bar', 2]
          }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { omitNull: true } } // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: undefined }, { name: 'bar', nullValue: undefined }]],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { omitNull: true } } // Note: As above
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: 'foo' }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1),($2);',
            bind: ['foo', 'bar']
          }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: JSON.stringify({ info: 'Look ma a " quote' }) }, { name: JSON.stringify({ info: 'Look ma another " quote' }) }]],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1),($2);',
            bind: ['{"info":"Look ma a \\" quote"}', '{"info":"Look ma another \\" quote"}']
          }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: "foo';DROP TABLE mySchema.myTable;" }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($1),($2);',
            bind: ["foo';DROP TABLE mySchema.myTable;", 'bar']
          }
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1),($2);',
            bind: ['foo', 'bar']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($1),($2);',
            bind: ["foo';DROP TABLE myTable;", 'bar']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) }]],
          expectation: {
            query: 'INSERT INTO myTable (name,birthday) VALUES ($1,$2),($3,$4);',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 'bar', '2012-03-27 10:01:55.000 +00:00']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1 }, { name: 'bar', foo: 2 }]],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($1,$2),($3,$4);',
            bind: ['foo', 1, 'bar', 2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { quoteIdentifiers: false, omitNull: false } }
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } } // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{ name: 'foo', nullValue: undefined }, { name: 'bar', nullValue: undefined }]],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($1,NULL),($2,NULL);',
            bind: ['foo', 'bar']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } } // Note: As above
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: 'foo' }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1),($2);',
            bind: ['foo', 'bar']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: JSON.stringify({ info: 'Look ma a " quote' }) }, { name: JSON.stringify({ info: 'Look ma another " quote' }) }]],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1),($2);',
            bind: ['{"info":"Look ma a \\" quote"}', '{"info":"Look ma another \\" quote"}']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, [{ name: "foo';DROP TABLE mySchema.myTable;" }, { name: 'bar' }]],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($1),($2);',
            bind: ["foo';DROP TABLE mySchema.myTable;", 'bar']
          },
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$1,"birthday"=$2 WHERE "id" = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          }
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$1,"birthday"=$2 WHERE "id" = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          }
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1 WHERE "name" = $2;',
            bind: [2, 'foo']
          }
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }, { returning: true }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1 WHERE "name" = $2 RETURNING *;',
            bind: [2, 'foo']
          }
        }, {
          arguments: ['myTable', { numbers: [1, 2, 3] }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "numbers"=$1 WHERE "name" = $2;',
            bind: [[1, 2, 3], 'foo']
          }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$1 WHERE "name" = $2;',
            bind: ["foo';DROP TABLE myTable;", 'foo']
          }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1,"nullValue"=$2 WHERE "name" = $3;',
            bind: [2, null, 'foo']
          }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1,"nullValue"=$2 WHERE "name" = $3;',
            bind: [2, null, 'foo']
          },
          context: { options: { omitNull: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1 WHERE "name" = $2;',
            bind: [2, 'foo']
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: undefined }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$1 WHERE "name" = $2;',
            bind: [2, 'foo']
          },
          context: { options: { omitNull: true } }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE "mySchema"."myTable" SET "name"=$1,"birthday"=$2 WHERE "id" = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          }
        }, {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: "foo';DROP TABLE mySchema.myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "mySchema"."myTable" SET "name"=$1 WHERE "name" = $2;',
            bind: ["foo';DROP TABLE mySchema.myTable;", 'foo']
          }
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.fn('NOW')
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=NOW() WHERE "name" = $1;',
            bind: ['foo']
          },
          needsSequelize: true
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.col('foo')
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"="foo" WHERE "name" = $1;',
            bind: ['foo']
          },
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE myTable SET name=$1,birthday=$2 WHERE id = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE myTable SET name=$1,birthday=$2 WHERE id = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$1 WHERE name = $2;',
            bind: [2, 'foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { numbers: [1, 2, 3] }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET numbers=$1 WHERE name = $2;',
            bind: [[1, 2, 3], 'foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { name: "foo';DROP TABLE myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET name=$1 WHERE name = $2;',
            bind: ["foo';DROP TABLE myTable;", 'foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$1,nullValue=$2 WHERE name = $3;',
            bind: [2, null, 'foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$1,nullValue=$2 WHERE name = $3;',
            bind: [2, null, 'foo']
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$1 WHERE name = $2;',
            bind: [2, 'foo']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } }
        }, {
          arguments: ['myTable', { bar: 2, nullValue: undefined }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$1 WHERE name = $2;',
            bind: [2, 'foo']
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE mySchema.myTable SET name=$1,birthday=$2 WHERE id = $3;',
            bind: ['foo', '2011-03-27 10:01:55.000 +00:00', 2]
          },
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, { name: "foo';DROP TABLE mySchema.myTable;" }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE mySchema.myTable SET name=$1 WHERE name = $2;',
            bind: ["foo';DROP TABLE mySchema.myTable;", 'foo']
          },
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      removeIndexQuery: [
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS "user_foo_bar"'
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS "user_foo_bar"'
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS "mySchema"."user_foo_bar"'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: { options: { quoteIdentifiers: false } }
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS mySchema.user_foo_bar',
          context: { options: { quoteIdentifiers: false } }
        }
      ],

      startTransactionQuery: [
        {
          arguments: [{}],
          expectation: 'START TRANSACTION;',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
          expectation: 'SAVEPOINT "transaction-uid";',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
          expectation: 'SAVEPOINT "transaction-uid";',
          context: { options: { quoteIdentifiers: true } }
        }
      ],

      rollbackTransactionQuery: [
        {
          arguments: [{}],
          expectation: 'ROLLBACK;',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
          expectation: 'ROLLBACK TO SAVEPOINT "transaction-uid";',
          context: { options: { quoteIdentifiers: false } }
        },
        {
          arguments: [{ parent: 'MockTransaction', name: 'transaction-uid' }],
          expectation: 'ROLLBACK TO SAVEPOINT "transaction-uid";',
          context: { options: { quoteIdentifiers: true } }
        }
      ],

      createTrigger: [
        {
          arguments: ['myTable', 'myTrigger', 'after', ['insert'],  'myFunction', [], []],
          expectation: 'CREATE TRIGGER "myTrigger" AFTER INSERT ON "myTable" EXECUTE PROCEDURE myFunction();'
        },
        {
          arguments: ['myTable', 'myTrigger', 'before', ['insert', 'update'],  'myFunction', [{ name: 'bar', type: 'INTEGER' }], []],
          expectation: 'CREATE TRIGGER "myTrigger" BEFORE INSERT OR UPDATE ON "myTable" EXECUTE PROCEDURE myFunction(bar INTEGER);'
        },
        {
          arguments: ['myTable', 'myTrigger', 'instead_of', ['insert', 'update'],  'myFunction', [], ['FOR EACH ROW']],
          expectation: 'CREATE TRIGGER "myTrigger" INSTEAD OF INSERT OR UPDATE ON "myTable" FOR EACH ROW EXECUTE PROCEDURE myFunction();'
        },
        {
          arguments: ['myTable', 'myTrigger', 'after_constraint', ['insert', 'update'],  'myFunction', [{ name: 'bar', type: 'INTEGER' }], ['FOR EACH ROW']],
          expectation: 'CREATE CONSTRAINT TRIGGER "myTrigger" AFTER INSERT OR UPDATE ON "myTable" FOR EACH ROW EXECUTE PROCEDURE myFunction(bar INTEGER);'
        }
      ],

      dropTrigger: [
        {
          arguments: ['myTable', 'myTrigger'],
          expectation: 'DROP TRIGGER "myTrigger" ON "myTable" RESTRICT;'
        }
      ],

      renameTrigger: [
        {
          arguments: ['myTable', 'oldTrigger', 'newTrigger'],
          expectation: 'ALTER TRIGGER "oldTrigger" ON "myTable" RENAME TO "newTrigger";'
        }
      ],

      getForeignKeyReferenceQuery: [
        {
          arguments: ['myTable', 'myColumn'],
          expectation: 'SELECT ' +
              'DISTINCT tc.constraint_name as constraint_name, ' +
              'tc.constraint_schema as constraint_schema, ' +
              'tc.constraint_catalog as constraint_catalog, ' +
              'tc.table_name as table_name,' +
              'tc.table_schema as table_schema,' +
              'tc.table_catalog as table_catalog,' +
              'kcu.column_name as column_name,' +
              'ccu.table_schema  AS referenced_table_schema,' +
              'ccu.table_catalog  AS referenced_table_catalog,' +
              'ccu.table_name  AS referenced_table_name,' +
              'ccu.column_name AS referenced_column_name ' +
            'FROM information_schema.table_constraints AS tc ' +
              'JOIN information_schema.key_column_usage AS kcu ' +
                'ON tc.constraint_name = kcu.constraint_name ' +
              'JOIN information_schema.constraint_column_usage AS ccu ' +
                'ON ccu.constraint_name = tc.constraint_name ' +
            'WHERE constraint_type = \'FOREIGN KEY\' AND tc.table_name=\'myTable\' AND  kcu.column_name = \'myColumn\''
        },
        {
          arguments: [{ schema: 'mySchema', tableName: 'myTable' }, 'myColumn'],
          expectation: 'SELECT ' +
              'DISTINCT tc.constraint_name as constraint_name, ' +
              'tc.constraint_schema as constraint_schema, ' +
              'tc.constraint_catalog as constraint_catalog, ' +
              'tc.table_name as table_name,' +
              'tc.table_schema as table_schema,' +
              'tc.table_catalog as table_catalog,' +
              'kcu.column_name as column_name,' +
              'ccu.table_schema  AS referenced_table_schema,' +
              'ccu.table_catalog  AS referenced_table_catalog,' +
              'ccu.table_name  AS referenced_table_name,' +
              'ccu.column_name AS referenced_column_name ' +
            'FROM information_schema.table_constraints AS tc ' +
              'JOIN information_schema.key_column_usage AS kcu ' +
                'ON tc.constraint_name = kcu.constraint_name ' +
              'JOIN information_schema.constraint_column_usage AS ccu ' +
                'ON ccu.constraint_name = tc.constraint_name ' +
            'WHERE constraint_type = \'FOREIGN KEY\' AND tc.table_name=\'myTable\' AND  kcu.column_name = \'myColumn\'' +
              ' AND tc.table_schema = \'mySchema\''
        }
      ]
    };

    _.each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        beforeEach(function() {
          this.queryGenerator = new QueryGenerator({
            sequelize: this.sequelize,
            _dialect: this.sequelize.dialect
          });
        });

        tests.forEach(test => {
          const query = test.expectation.query || test.expectation;
          const title = test.title || `Postgres correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, function() {
            if (test.needsSequelize) {
              if (typeof test.arguments[1] === 'function') test.arguments[1] = test.arguments[1](this.sequelize);
              if (typeof test.arguments[2] === 'function') test.arguments[2] = test.arguments[2](this.sequelize);
            }

            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            this.queryGenerator.options = Object.assign({}, this.queryGenerator.options, test.context && test.context.options || {});

            let result = this.queryGenerator[suiteTitle](...test.arguments);
            if (result instanceof Composition) {
              result = this.queryGenerator.composeQuery(result);
            }
            expect(result).to.deep.equal(test.expectation);
          });
        });
      });
    });
  });
}
