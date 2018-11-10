'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Operators = require('../../../../lib/operators'),
  QueryGenerator = require('../../../../lib/dialects/postgres/query-generator'),
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  moment = require('moment'),
  current = Support.sequelize,
  _ = require('lodash');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryGenerator', () => {
    const suites = {
      arithmeticQuery: [
        {
          title: 'Should use the plus operator',
          arguments: ['+', 'myTable', { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE "myTable" SET "foo"="foo"+ \'bar\'  RETURNING *'
        },
        {
          title: 'Should use the plus operator with where clause',
          arguments: ['+', 'myTable', { foo: 'bar' }, { bar: 'biz'}, {}],
          expectation: 'UPDATE "myTable" SET "foo"="foo"+ \'bar\' WHERE "bar" = \'biz\' RETURNING *'
        },
        {
          title: 'Should use the plus operator without returning clause',
          arguments: ['+', 'myTable', { foo: 'bar' }, {}, { returning: false }],
          expectation: 'UPDATE "myTable" SET "foo"="foo"+ \'bar\' '
        },
        {
          title: 'Should use the minus operator',
          arguments: ['-', 'myTable', { foo: 'bar' }, {}, {}],
          expectation: 'UPDATE "myTable" SET "foo"="foo"- \'bar\'  RETURNING *'
        },
        {
          title: 'Should use the minus operator with negative value',
          arguments: ['-', 'myTable', { foo: -1 }, {}, {}],
          expectation: 'UPDATE "myTable" SET "foo"="foo"- -1  RETURNING *'
        },
        {
          title: 'Should use the minus operator with where clause',
          arguments: ['-', 'myTable', { foo: 'bar' }, { bar: 'biz'}, {}],
          expectation: 'UPDATE "myTable" SET "foo"="foo"- \'bar\' WHERE "bar" = \'biz\' RETURNING *'
        },
        {
          title: 'Should use the minus operator without returning clause',
          arguments: ['-', 'myTable', { foo: 'bar' }, {}, { returning: false }],
          expectation: 'UPDATE "myTable" SET "foo"="foo"- \'bar\' '
        }
      ],
      attributesToSQL: [
        {
          arguments: [{id: 'INTEGER'}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: 'INTEGER', foo: 'VARCHAR(255)'}],
          expectation: {id: 'INTEGER', foo: 'VARCHAR(255)'}
        },
        {
          arguments: [{id: {type: 'INTEGER'}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false}}],
          expectation: {id: 'INTEGER NOT NULL'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: true}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', primaryKey: true, autoIncrement: true}}],
          expectation: {id: 'INTEGER SERIAL PRIMARY KEY'}
        },
        {
          arguments: [{id: {type: 'INTEGER', defaultValue: 0}}],
          expectation: {id: 'INTEGER DEFAULT 0'}
        },
        {
          arguments: [{id: {type: 'INTEGER', unique: true}}],
          expectation: {id: 'INTEGER UNIQUE'}
        },

        // New references style
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id")'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar', key: 'pk' }}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("pk")'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT'}
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id)'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar', key: 'pk' }}}],
          expectation: {id: 'INTEGER REFERENCES Bar (pk)'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onDelete: 'CASCADE'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: { model: 'Bar' }, onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: { model: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT'},
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      createTableQuery: [
        {
          arguments: ['myTable', {int: 'INTEGER', bigint: 'BIGINT', smallint: 'SMALLINT' }],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"int\" INTEGER, \"bigint\" BIGINT, \"smallint\" SMALLINT);'
        },
        {
          arguments: ['myTable', {serial: 'INTEGER SERIAL', bigserial: 'BIGINT SERIAL', smallserial: 'SMALLINT SERIAL' }],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"serial\"  SERIAL, \"bigserial\"  BIGSERIAL, \"smallserial\"  SMALLSERIAL);'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {data: current.normalizeDataType(DataTypes.BLOB).toSql()}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" BYTEA);'
        },
        {
          arguments: ['myTable', {data: current.normalizeDataType(DataTypes.BLOB('long')).toSql()}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" BYTEA);'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"mySchema\".\"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" \"public\".\"enum_myTable_title\", \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"id\" INTEGER , PRIMARY KEY (\"id\"));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"otherId\" INTEGER REFERENCES \"otherTable\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION);'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS mySchema.myTable (title VARCHAR(255), name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title public."enum_myTable_title", name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), id INTEGER , PRIMARY KEY (id));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), otherId INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      dropTableQuery: [
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS \"myTable\";'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'DROP TABLE IF EXISTS \"mySchema\".\"myTable\";'
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS \"myTable\" CASCADE;'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS \"mySchema\".\"myTable\" CASCADE;'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS myTable;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS myTable CASCADE;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable CASCADE;',
          context: {options: {quoteIdentifiers: false}}
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
          expectation: 'SELECT * FROM \"myTable\";'
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: 'SELECT \"id\", \"name\" FROM \"myTable\";'
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: 'SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\" = 2;'
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\" = 'foo';"
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\" = 'foo'';DROP TABLE myTable;';"
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: 'SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\" = 2;'
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS \"count\" FROM \"foo\";'
        }, {
          arguments: ['myTable', {order: ['id']}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id";',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['id', 'DESC']}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id", "DESC";',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['myTable.id']}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id";',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: [['myTable.id', 'DESC']]}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: [['id', 'DESC']]}, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {order: [['id', 'DESC'], ['name']]}, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC, "myTable"."name";',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'uses limit 0',
          arguments: ['myTable', {limit: 0}],
          expectation: 'SELECT * FROM "myTable" LIMIT 0;',
          context: QueryGenerator
        }, {
          title: 'uses offset 0',
          arguments: ['myTable', {offset: 0}],
          expectation: 'SELECT * FROM "myTable" OFFSET 0;',
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
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") = \'jan\' AND "myTable"."type" = 1);',
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
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") LIKE \'%t%\' AND "myTable"."type" = 1);',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']]
            };
          }],
          expectation: 'SELECT * FROM "myTable" ORDER BY f1(f2("id")) DESC;',
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
          expectation: 'SELECT * FROM "myTable" ORDER BY f1("myTable"."id") DESC, f2(12, \'lalala\', \'2011-03-27 10:01:55.000 +00:00\') ASC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { in: ... }',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                { archived: null},
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { in: ['Lost', 'Found'] })
              )
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE ("myTable"."archived" IS NULL AND COALESCE("place_type_codename", "announcement_type_codename") IN (\'Lost\', \'Found\'));',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', {group: 'name'}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY \"name\";'
        }, {
          arguments: ['myTable', {group: ['name']}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY \"name\";'
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))]
            };
          }],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY YEAR(\"createdAt\");',
          needsSequelize: true
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title']
            };
          }],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY YEAR(\"createdAt\"), \"title\";',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {group: ['name', 'title']}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY \"name\", \"title\";'
        }, {
          title: 'HAVING clause works with where-like hash',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: { creationYear: { gt: 2002 } }
            };
          }],
          expectation: 'SELECT *, YEAR(\"createdAt\") AS \"creationYear\" FROM \"myTable\" GROUP BY \"creationYear\", \"title\" HAVING \"creationYear\" > 2002;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: 'SELECT * FROM \"myTable\" LIMIT 10;'
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: 'SELECT * FROM \"myTable\" LIMIT 10 OFFSET 2;'
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: 'SELECT * FROM \"myTable\" OFFSET 2;'
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'SELECT * FROM \"mySchema\".\"myTable\";'
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM \"mySchema\".\"myTable\" WHERE \"mySchema\".\"myTable\".\"name\" = 'foo'';DROP TABLE mySchema.myTable;';"
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', {where: { field: new Buffer('Sequelize')}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\" = E'\\\\x53657175656c697a65';",
          context: QueryGenerator
        }, {
          title: 'string in array should escape \' as \'\'',
          arguments: ['myTable', {where: { aliases: {$contains: ['Queen\'s']} }}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"aliases\" @> ARRAY['Queen''s'];"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: 'SELECT id, name FROM myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.id = 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM myTable WHERE myTable.name = 'foo';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM myTable WHERE myTable.name = 'foo'';DROP TABLE myTable;';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: 'SELECT * FROM myTable WHERE myTable.id = 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS count FROM foo;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {order: ['id DESC']}],
          expectation: 'SELECT * FROM myTable ORDER BY id DESC;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: 'name'}],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ['name']}],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ['name', 'title']}],
          expectation: 'SELECT * FROM myTable GROUP BY name, title;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: 'SELECT * FROM myTable LIMIT 10;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: 'SELECT * FROM myTable LIMIT 10 OFFSET 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: 'SELECT * FROM myTable OFFSET 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'SELECT * FROM mySchema.myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM mySchema.myTable WHERE mySchema.myTable.name = 'foo'';DROP TABLE mySchema.myTable;';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', {where: {field: {ne: 0}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field != 0;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', {where: {field: {ne: null}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field IS NOT NULL;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use IS NOT if not === BOOLEAN',
          arguments: ['myTable', {where: {field: {not: true}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field IS NOT true;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use != if not !== BOOLEAN',
          arguments: ['myTable', {where: {field: {not: 3}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field != 3;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'Regular Expression in where clause',
          arguments: ['myTable', {where: {field: {$regexp: '^[h|a|t]'}}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\" ~ '^[h|a|t]';",
          context: QueryGenerator
        }, {
          title: 'Regular Expression negation in where clause',
          arguments: ['myTable', {where: {field: {$notRegexp: '^[h|a|t]'}}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\" !~ '^[h|a|t]';",
          context: QueryGenerator
        }, {
          title: 'Case-insensitive Regular Expression in where clause',
          arguments: ['myTable', {where: {field: {$iRegexp: '^[h|a|t]'}}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\" ~* '^[h|a|t]';",
          context: QueryGenerator
        }, {
          title: 'Case-insensitive Regular Expression negation in where clause',
          arguments: ['myTable', {where: {field: {$notIRegexp: '^[h|a|t]'}}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\" !~* '^[h|a|t]';",
          context: QueryGenerator
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', {}],
          expectation: 'INSERT INTO \"myTable\" DEFAULT VALUES;'
        },
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');"
        }, {
          arguments: ['myTable', {name: 'foo'}, {}, { ignoreDuplicates: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') ON CONFLICT DO NOTHING;"
        }, {
          arguments: ['myTable', {name: 'foo'}, {}, { returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') RETURNING *;"
        }, {
          arguments: ['myTable', {name: 'foo'}, {}, { ignoreDuplicates: true, returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') ON CONFLICT DO NOTHING RETURNING *;"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;');"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', {data: new Buffer('Sequelize') }],
          expectation: "INSERT INTO \"myTable\" (\"data\") VALUES (E'\\\\x53657175656c697a65');"
        }, {
          arguments: ['myTable', {name: 'foo', numbers: [1, 2, 3]}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"numbers\") VALUES ('foo',ARRAY[1,2,3]);"
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1);"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL);"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');",
          context: {options: {omitNull: true}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo'}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo');"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}');"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;');"
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              foo: sequelize.fn('NOW')
            };
          }],
          expectation: 'INSERT INTO \"myTable\" (\"foo\") VALUES (NOW());',
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', numbers: [1, 2, 3]}],
          expectation: "INSERT INTO myTable (name,numbers) VALUES ('foo',ARRAY[1,2,3]);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL);",
          context: {options: {omitNull: false, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo'}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;');",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar');"
        }, {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}], { ignoreDuplicates: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING;"
        }, {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}], { returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar') RETURNING *;"
        }, {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}], { ignoreDuplicates: true, returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING RETURNING *;"
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;'),('bar');"
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {name: 'bar', birthday: moment('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1),('bar',2);"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true}} // Note: As above
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'),('bar');"
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}');"
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar');"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {name: 'bar', birthday: moment('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}]],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1),('bar',2);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {quoteIdentifiers: false, omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: As above
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\" = 2"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\" = 2"
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\" = 'foo'"
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}, { returning: true }],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\" = 'foo' RETURNING *"
        }, {
          arguments: ['myTable', {numbers: [1, 2, 3]}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"numbers\"=ARRAY[1,2,3] WHERE \"name\" = 'foo'"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo'';DROP TABLE myTable;' WHERE \"name\" = 'foo'"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\" = 'foo'"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\" = 'foo'",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\" = 'foo'",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\" = 'foo'",
          context: {options: {omitNull: true}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\" = 2"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo'';DROP TABLE mySchema.myTable;' WHERE \"name\" = 'foo'"
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.fn('NOW')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=NOW() WHERE \"name\" = 'foo'",
          needsSequelize: true
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.col('foo')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=\"foo\" WHERE \"name\" = 'foo'",
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id = 2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id = 2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name = 'foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {numbers: [1, 2, 3]}, {name: 'foo'}],
          expectation: "UPDATE myTable SET numbers=ARRAY[1,2,3] WHERE name = 'foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE myTable SET name='foo'';DROP TABLE myTable;' WHERE name = 'foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name = 'foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name = 'foo'",
          context: {options: {omitNull: false, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name = 'foo'",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name = 'foo'",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE mySchema.myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id = 2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE mySchema.myTable SET name='foo'';DROP TABLE mySchema.myTable;' WHERE name = 'foo'",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      removeIndexQuery: [
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS \"user_foo_bar\"'
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS \"user_foo_bar\"'
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS \"mySchema\".\"user_foo_bar\"'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS mySchema.user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      startTransactionQuery: [
        {
          arguments: [{}],
          expectation: 'START TRANSACTION;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{parent: 'MockTransaction', name: 'transaction-uid'}],
          expectation: 'SAVEPOINT \"transaction-uid\";',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{parent: 'MockTransaction', name: 'transaction-uid'}],
          expectation: 'SAVEPOINT \"transaction-uid\";',
          context: {options: {quoteIdentifiers: true}}
        }
      ],

      rollbackTransactionQuery: [
        {
          arguments: [{}],
          expectation: 'ROLLBACK;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{parent: 'MockTransaction', name: 'transaction-uid'}],
          expectation: 'ROLLBACK TO SAVEPOINT \"transaction-uid\";',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{parent: 'MockTransaction', name: 'transaction-uid'}],
          expectation: 'ROLLBACK TO SAVEPOINT \"transaction-uid\";',
          context: {options: {quoteIdentifiers: true}}
        }
      ],

      createTrigger: [
        {
          arguments: ['myTable', 'myTrigger', 'after', ['insert'],  'myFunction', [], []],
          expectation: 'CREATE TRIGGER myTrigger\n\tAFTER INSERT\n\tON myTable\n\t\n\tEXECUTE PROCEDURE myFunction();'
        },
        {
          arguments: ['myTable', 'myTrigger', 'before', ['insert', 'update'],  'myFunction', [{name: 'bar', type: 'INTEGER'}], []],
          expectation: 'CREATE TRIGGER myTrigger\n\tBEFORE INSERT OR UPDATE\n\tON myTable\n\t\n\tEXECUTE PROCEDURE myFunction(bar INTEGER);'
        },
        {
          arguments: ['myTable', 'myTrigger', 'instead_of', ['insert', 'update'],  'myFunction', [], ['FOR EACH ROW']],
          expectation: 'CREATE TRIGGER myTrigger\n\tINSTEAD OF INSERT OR UPDATE\n\tON myTable\n\t\n\tFOR EACH ROW\n\tEXECUTE PROCEDURE myFunction();'
        },
        {
          arguments: ['myTable', 'myTrigger', 'after_constraint', ['insert', 'update'],  'myFunction', [{name: 'bar', type: 'INTEGER'}], ['FOR EACH ROW']],
          expectation: 'CREATE CONSTRAINT TRIGGER myTrigger\n\tAFTER INSERT OR UPDATE\n\tON myTable\n\t\n\tFOR EACH ROW\n\tEXECUTE PROCEDURE myFunction(bar INTEGER);'
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
        afterEach(function() {
          this.sequelize.options.quoteIdentifiers = true;
          QueryGenerator.options.quoteIdentifiers = true;
        });

        tests.forEach(test => {
          const title = test.title || 'Postgres correctly returns ' + test.expectation + ' for ' + JSON.stringify(test.arguments);
          it(title, function() {
            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            const context = test.context || {options: {}};

            if (test.needsSequelize) {
              if (_.isFunction(test.arguments[1])) test.arguments[1] = test.arguments[1](this.sequelize);
              if (_.isFunction(test.arguments[2])) test.arguments[2] = test.arguments[2](this.sequelize);
            }

            QueryGenerator.options = _.assign(context.options, { timezone: '+00:00' });
            QueryGenerator._dialect = this.sequelize.dialect;
            QueryGenerator.sequelize = this.sequelize;
            QueryGenerator.setOperatorsAliases(Operators.LegacyAliases);
            const conditions = QueryGenerator[suiteTitle].apply(QueryGenerator, test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        });
      });
    });
  });
}
