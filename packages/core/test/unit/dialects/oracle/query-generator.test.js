'use strict';

const each = require('lodash/each');

const chai = require('chai');

const expect = chai.expect;
const { DataTypes } = require('@sequelize/core');
const { OracleQueryGenerator: QueryGenerator } = require('@sequelize/oracle');
const Support = require('../../../support');

const dialect = Support.getTestDialect();

if (dialect.startsWith('oracle')) {
  describe('[Oracle Specific] QueryGenerator', () => {
    Support.allowDeprecationsInSuite(['SEQUELIZE0023']);
    const sequelize = Support.createSequelizeInstance();
    const dialect = sequelize.dialect;
    const integerDialect = new DataTypes.INTEGER().toDialectDataType(dialect);

    const suites = {
      changeColumnQuery: [
        {
          arguments: [
            'myTable',
            {
              col_1: "ENUM('value 1', 'value 2') NOT NULL",
              col_2: "ENUM('value 3', 'value 4') NOT NULL",
            },
          ],
          expectation: `DECLARE CONS_NAME VARCHAR2(200); BEGIN BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "col_1" ENUM(''value 1'', ''value 2'') NOT NULL'; EXCEPTION WHEN OTHERS THEN  IF SQLCODE = -1442 OR SQLCODE = -1451 THEN    EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "col_1" ENUM(''value 1'', ''value 2'') ';  ELSE    RAISE;  END IF; END; BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "col_2" ENUM(''value 3'', ''value 4'') NOT NULL'; EXCEPTION WHEN OTHERS THEN  IF SQLCODE = -1442 OR SQLCODE = -1451 THEN    EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "col_2" ENUM(''value 3'', ''value 4'') ';  ELSE    RAISE;  END IF; END; END;`,
        },
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM "myTable";',
        },
        {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT "id", "name" FROM "myTable";',
        },
        {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."id" = 2;',
        },
        {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."name" = \'foo\';',
        },
        {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id";',
          context: QueryGenerator,
        },

        // not a reserved column, DESCNORES
        {
          arguments: ['myTable', { order: ['id', 'DESCNORES'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id", "DESCNORES";',
          context: QueryGenerator,
        },

        // reserved column, DESC
        {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id", "DESC";',
          context: QueryGenerator,
        },

        {
          arguments: ['myTable', { order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id" DESC;',
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
            sequelize => sequelize.define('myTable', {}),
          ],
          expectation: 'SELECT * FROM "myTable"  "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          arguments: [
            'myTable',
            { order: [['id', 'DESC'], ['name']] },
            sequelize => sequelize.define('myTable', {}),
          ],
          expectation:
            'SELECT * FROM "myTable"  "myTable" ORDER BY "myTable"."id" DESC, "myTable"."name";',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
        },
        {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
        },
        {
          title: 'functions work for group by',
          arguments: [
            'myTable',
            sequelize => ({
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
            }),
          ],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt");',
          needsSequelize: true,
        },
        {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: [
            'myTable',
            sequelize => ({
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
            }),
          ],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt"), "title";',
          context: QueryGenerator,
          needsSequelize: true,
        },
        {
          arguments: ['myTable', { group: ['name', 'title'] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name", "title";',
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: 'SELECT * FROM "mySchema"."myTable";',
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
          arguments: ['myTable', { order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM myTable ORDER BY id DESC;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { order: ['id DESC'] }],
          expectation: 'SELECT * FROM myTable ORDER BY "id DESC";',
          context: { options: { quoteIdentifiers: false } },
        },
        /*
         * does not work on oracle dialect.
        {
          arguments: ['myTable', { order: ['id DESC'] }],
          expectation: 'SELECT * FROM myTable ORDER BY id DESC;',
          context: { options: { quoteIdentifiers: false } },
        },
        */
        {
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
          arguments: ['myTable', { group: ['name', 'title'] }],
          expectation: 'SELECT * FROM myTable GROUP BY name, title;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: 'SELECT * FROM mySchema.myTable;',
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      insertQuery: [
        {
          arguments: ['myTable', {}],
          expectation: {
            query: 'INSERT INTO "myTable" VALUES ();',
            bind: {},
          },
        },
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
            bind: { sequelize_1: `foo';DROP TABLE myTable;` },
          },
        },
        {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO "myTable" ("data") VALUES ($sequelize_1);',
            bind: {
              sequelize_1: Buffer.from('Sequelize'),
            },
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
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: null },
          },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","nullValue") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: null },
          },
          context: { options: { omitNull: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
        },
        {
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { name: JSON.stringify({ info: 'Look ma a " quote' }) },
          ],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: '{"info":"Look ma a \\" quote"}' },
          },
        },
        {
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { name: "foo';DROP TABLE mySchema.myTable;" },
          ],
          expectation: {
            query: 'INSERT INTO "mySchema"."myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: "foo';DROP TABLE mySchema.myTable;" },
          },
        },
        {
          arguments: [
            'myTable',
            sequelize => ({
              foo: sequelize.fn('NOW'),
            }),
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
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: null },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,nullValue) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: null },
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { name: 'foo', nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }, { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { name: JSON.stringify({ info: 'Look ma a " quote' }) },
          ],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: '{"info":"Look ma a \\" quote"}' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { name: "foo';DROP TABLE mySchema.myTable;" },
          ],
          expectation: {
            query: 'INSERT INTO mySchema.myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: "foo';DROP TABLE mySchema.myTable;" },
          },
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], {}],
          expectation: `INSERT INTO "myTable" ("name") VALUES (:1)`,
          expectBind: [['foo'], ['bar']],
        },
        {
          arguments: [
            'myTable',
            [
              { id: null, name: 'foo' },
              { id: null, name: 'bar' },
            ],
            {},
            { id: { autoIncrement: true, type: integerDialect } },
          ],
          expectation: `INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,:1) RETURNING "id" INTO :2`,
          expectBind: [['foo'], ['bar']],
          outBindAttributes: {
            id: {
              type: {
                num: 2010,
                name: 'DB_TYPE_NUMBER',
                columnTypeName: 'NUMBER',
                _bufferSizeFactor: 22,
                _oraTypeNum: 2,
                _csfrm: 0,
              },
              dir: 3003,
            },
          },
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], {}],
          expectation: `INSERT INTO myTable (name) VALUES (:1)`,
          expectBind: [['foo'], ['bar']],
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [
            'myTable',
            [
              { id: null, name: 'foo' },
              { id: null, name: 'bar' },
            ],
            {},
            { id: { autoIncrement: true, type: integerDialect } },
          ],
          expectation: `INSERT INTO myTable (id,name) VALUES (DEFAULT,:1) RETURNING id INTO :2`,
          expectBind: [['foo'], ['bar']],
          outBindAttributes: {
            id: {
              type: {
                num: 2010,
                name: 'DB_TYPE_NUMBER',
                columnTypeName: 'NUMBER',
                _bufferSizeFactor: 22,
                _oraTypeNum: 2,
                _csfrm: 0,
              },
              dir: 3003,
            },
          },
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
          arguments: ['myTable', { bar: 2, nullValue: undefined }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true } },
        },
        {
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { name: "foo';DROP TABLE mySchema.myTable;" },
            { name: 'foo' },
          ],
          expectation: {
            query:
              'UPDATE "mySchema"."myTable" SET "name"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: "foo';DROP TABLE mySchema.myTable;", sequelize_2: 'foo' },
          },
        },
        {
          arguments: [
            'myTable',
            sequelize => ({
              bar: sequelize.fn('NOW'),
            }),
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
            sequelize => ({
              bar: sequelize.col('foo'),
            }),
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
          arguments: ['myTable', { bar: 2, nullValue: undefined }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        },
        {
          arguments: [
            { schema: 'mySchema', tableName: 'myTable' },
            { name: "foo';DROP TABLE mySchema.myTable;" },
            { name: 'foo' },
          ],
          expectation: {
            query: 'UPDATE mySchema.myTable SET name=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: "foo';DROP TABLE mySchema.myTable;", sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      showIndexesQueryWithBind: [
        {
          title: 'passes the table and schema names as bind parameters',
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: {
            query:
              'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type FROM all_ind_columns i INNER JOIN all_indexes u ON (u.table_name = i.table_name AND u.index_name = i.index_name) LEFT OUTER JOIN all_constraints c ON (c.table_name = i.table_name AND c.index_name = i.index_name) WHERE i.table_name = $sequelize_1 AND u.table_owner = $sequelize_2 ORDER BY index_name, column_position',
            bind: { sequelize_1: 'myTable', sequelize_2: 'mySchema' },
          },
        },
        {
          title:
            'passes the names as they are stored in the catalog when quoteIdentifiers is false',
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: {
            query:
              'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type FROM all_ind_columns i INNER JOIN all_indexes u ON (u.table_name = i.table_name AND u.index_name = i.index_name) LEFT OUTER JOIN all_constraints c ON (c.table_name = i.table_name AND c.index_name = i.index_name) WHERE i.table_name = $sequelize_1 AND u.table_owner = $sequelize_2 ORDER BY index_name, column_position',
            bind: { sequelize_1: 'MYTABLE', sequelize_2: 'MYSCHEMA' },
          },
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      describeTableQueryWithBind: [
        {
          title: 'passes the table and schema names as bind parameters',
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: {
            query:
              'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type FROM all_tab_columns atc LEFT OUTER JOIN (SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) WHERE (atc.OWNER = $sequelize_1) AND (atc.TABLE_NAME = $sequelize_2)ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC',
            bind: { sequelize_1: 'mySchema', sequelize_2: 'myTable' },
          },
        },
      ],

      showConstraintsQueryWithBind: [
        {
          title: 'passes the table, schema, constraint name and type as bind parameters',
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { constraintName: 'myConstraint', constraintType: 'UNIQUE' },
          ],
          expectation: {
            query:
              "SELECT C.CONSTRAINT_NAME \"constraintName\", CASE A.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY' WHEN 'C' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END \"constraintType\", C.TABLE_NAME \"tableName\", A.OWNER \"tableSchema\", C.OWNER \"constraintSchema\", C.COLUMN_NAME \"columnNames\", A.SEARCH_CONDITION \"definition\" FROM ALL_CONS_COLUMNS C INNER JOIN ALL_CONSTRAINTS A ON C.CONSTRAINT_NAME = A.CONSTRAINT_NAME AND C.OWNER = A.OWNER WHERE C.TABLE_NAME =$sequelize_1 AND C.OWNER =$sequelize_2 AND C.CONSTRAINT_NAME =$sequelize_3 AND A.CONSTRAINT_TYPE =$sequelize_4 ORDER BY C.CONSTRAINT_NAME, C.POSITION",
            bind: {
              sequelize_1: 'myTable',
              sequelize_2: 'mySchema',
              sequelize_3: 'myConstraint',
              sequelize_4: 'U',
            },
          },
        },
        {
          title: 'passes the table and schema names as bind parameters for foreign keys',
          arguments: [
            { tableName: 'myTable', schema: 'mySchema' },
            { constraintType: 'FOREIGN KEY' },
          ],
          expectation: {
            query:
              'SELECT DISTINCT  a.table_name "tableName", a.constraint_name "constraintName", c.owner "tableSchema", a.owner "constraintSchema", a.column_name "columnNames",CASE c.CONSTRAINT_TYPE WHEN \'P\' THEN \'PRIMARY KEY\' WHEN \'R\' THEN \'FOREIGN KEY\' WHEN \'C\' THEN \'CHECK\' WHEN \'U\' THEN \'UNIQUE\' ELSE NULL END "constraintType", c.r_owner "referencedTableSchema", c.DELETE_RULE "deleteAction", \'NO ACTION\' AS "updateAction", b.table_name "referencedTableName", b.column_name "referencedColumnNames" FROM all_cons_columns a JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name JOIN all_cons_columns b ON c.r_owner = b.owner AND c.r_constraint_name = b.constraint_name WHERE c.constraint_type  = \'R\' AND a.table_name = $sequelize_1 AND a.owner = $sequelize_2 ORDER BY a.table_name, a.column_name, b.column_name',
            bind: { sequelize_1: 'myTable', sequelize_2: 'mySchema' },
          },
        },
      ],
    };

    each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        for (const test of tests) {
          const query = test.expectation.query || test.expectation;
          const title =
            test.title || `oracle correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, () => {
            const newSequelize = Support.createSequelizeInstance({
              ...test.context?.options,
            });

            const queryGenerator = newSequelize.queryGenerator;

            if (test.needsSequelize) {
              if (typeof test.arguments[1] === 'function') {
                test.arguments[1] = test.arguments[1](newSequelize);
              }

              if (typeof test.arguments[2] === 'function') {
                test.arguments[2] = test.arguments[2](newSequelize);
              }
            }

            const conditions = queryGenerator[suiteTitle](...test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
            if (test.expectBind) {
              const args = test.arguments;
              const options = args[2];
              expect(options.bind).to.deep.equal(test.expectBind);
              if (test.outBindAttributes) {
                expect(options.outBindAttributes).to.deep.equal(test.outBindAttributes);
              }
            }
          });
        }
      });
    });
  });
}
