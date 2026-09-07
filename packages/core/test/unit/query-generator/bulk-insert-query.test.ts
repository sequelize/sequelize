import { DataTypes, ParameterStyle, literal } from '@sequelize/core';
import { expect } from 'chai';
import {
  allowDeprecationsInSuite,
  beforeAll2,
  createSequelizeInstance,
  expectsql,
  getTestDialect,
  sequelize,
} from '../../support';

const dialect = getTestDialect();

const BIND = { parameterStyle: ParameterStyle.BIND };
// see supports.inserts.bulkInsertParameterStyles
const inlinesValues = { mssql: undefined, db2: undefined };

const rows = [{ name: 'foo' }, { name: 'bar' }];
const twoStrings = { sequelize_1: 'foo', sequelize_2: 'bar' };
const oracleTwoStrings = [['foo'], ['bar']];

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  describe('parameterStyle', () => {
    it('inlines values by default', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: oracleTwoStrings },
      });
    });

    it('inlines values with parameterStyle REPLACEMENT', () => {
      expectsql(
        queryGenerator.bulkInsertQuery('myTable', rows, {
          parameterStyle: ParameterStyle.REPLACEMENT,
        }),
        {
          query: {
            default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
            mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
            oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
          },
          bind: { default: undefined, oracle: oracleTwoStrings },
        },
      );
    });

    it('uses bind parameters with parameterStyle BIND', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          db2: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
      });
    });

    it('parses named replacements in literals', () => {
      if (
        !sequelize.dialect.supports.inserts.bulkInsertParameterStyles[ParameterStyle.REPLACEMENT]
      ) {
        return;
      }

      expectsql(
        queryGenerator.bulkInsertQuery('myTable', [{ name: literal(':injection') }], {
          replacements: { injection: 'a string' },
        }),
        {
          query: {
            default: `INSERT INTO [myTable] ([name]) VALUES ('a string');`,
            mssql: `INSERT INTO [myTable] ([name]) VALUES (N'a string');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('a string'))`,
          },
          bind: { default: undefined },
        },
      );
    });
  });

  describe('strings containing single quotes', () => {
    const quoted = [{ name: "foo';DROP TABLE myTable;" }, { name: 'bar' }];

    it('escapes them when inlined', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', quoted), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('foo'';DROP TABLE myTable;'),('bar');`,
          'mysql mariadb': `INSERT INTO [myTable] ([name]) VALUES ('foo\\';DROP TABLE myTable;'),('bar');`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'';DROP TABLE myTable;'),(N'bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'';DROP TABLE myTable;'),('bar'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: [["foo';DROP TABLE myTable;"], ['bar']] },
      });
    });

    it('passes them through as bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', quoted, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'';DROP TABLE myTable;'),(N'bar');`,
          db2: `INSERT INTO "myTable" ("name") VALUES ('foo'';DROP TABLE myTable;'),('bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: {
          default: { sequelize_1: "foo';DROP TABLE myTable;", sequelize_2: 'bar' },
          ...inlinesValues,
          oracle: [["foo';DROP TABLE myTable;"], ['bar']],
        },
      });
    });
  });

  describe('strings containing double quotes', () => {
    const json = [
      { name: JSON.stringify({ info: 'Look ma a " quote' }) },
      { name: JSON.stringify({ info: 'Look ma another " quote' }) },
    ];

    it('escapes them when inlined', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', json), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('{"info":"Look ma a \\" quote"}'),('{"info":"Look ma another \\" quote"}');`,
          'mysql mariadb': `INSERT INTO [myTable] ([name]) VALUES ('{"info":"Look ma a \\\\" quote"}'),('{"info":"Look ma another \\\\" quote"}');`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'{"info":"Look ma a \\" quote"}'),(N'{"info":"Look ma another \\" quote"}');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('{"info":"Look ma a \\" quote"}'),('{"info":"Look ma another \\" quote"}'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: {
          default: undefined,
          oracle: [['{"info":"Look ma a \\" quote"}'], ['{"info":"Look ma another \\" quote"}']],
        },
      });
    });

    it('passes them through as bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', json, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'{"info":"Look ma a \\" quote"}'),(N'{"info":"Look ma another \\" quote"}');`,
          db2: `INSERT INTO "myTable" ("name") VALUES ('{"info":"Look ma a \\" quote"}'),('{"info":"Look ma another \\" quote"}');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: {
          default: {
            sequelize_1: '{"info":"Look ma a \\" quote"}',
            sequelize_2: '{"info":"Look ma another \\" quote"}',
          },
          ...inlinesValues,
          oracle: [['{"info":"Look ma a \\" quote"}'], ['{"info":"Look ma another \\" quote"}']],
        },
      });
    });
  });

  describe('dates', () => {
    const dates = [
      { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) },
      { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) },
    ];

    it('serializes them when inlined', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', dates), {
        query: {
          default: `INSERT INTO [myTable] ([name],[birthday]) VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');`,
          'postgres sqlite3': `INSERT INTO [myTable] ([name],[birthday]) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');`,
          mssql: `INSERT INTO [myTable] ([name],[birthday]) VALUES (N'foo',N'2011-03-27 10:01:55.000 +00:00'),(N'bar',N'2012-03-27 10:01:55.000 +00:00');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","birthday") VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000'))`,
          oracle: `INSERT INTO "myTable" ("name","birthday") VALUES (:1,:2)`,
        },
        bind: {
          default: undefined,
          oracle: dates.map(row => [row.name, row.birthday]),
        },
      });
    });

    it('serializes them as bind parameters', () => {
      const withOffset = {
        sequelize_1: 'foo',
        sequelize_2: '2011-03-27 10:01:55.000 +00:00',
        sequelize_3: 'bar',
        sequelize_4: '2012-03-27 10:01:55.000 +00:00',
      };

      expectsql(queryGenerator.bulkInsertQuery('myTable', dates, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name],[birthday]) VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4);`,
          mssql: `INSERT INTO [myTable] ([name],[birthday]) VALUES (N'foo',N'2011-03-27 10:01:55.000 +00:00'),(N'bar',N'2012-03-27 10:01:55.000 +00:00');`,
          db2: `INSERT INTO "myTable" ("name","birthday") VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","birthday") VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4))`,
          oracle: `INSERT INTO "myTable" ("name","birthday") VALUES (:1,:2)`,
        },
        bind: {
          default: {
            sequelize_1: 'foo',
            sequelize_2: '2011-03-27 10:01:55.000',
            sequelize_3: 'bar',
            sequelize_4: '2012-03-27 10:01:55.000',
          },
          postgres: withOffset,
          sqlite3: withOffset,
          ...inlinesValues,
          oracle: dates.map(row => [row.name, row.birthday]),
        },
      });
    });
  });

  describe('numbers', () => {
    const numbers = [
      { name: 'foo', foo: 1 },
      { name: 'bar', foo: 2 },
    ];

    it('inlines them', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', numbers), {
        query: {
          default: `INSERT INTO [myTable] ([name],[foo]) VALUES ('foo',1),('bar',2);`,
          mssql: `INSERT INTO [myTable] ([name],[foo]) VALUES (N'foo',1),(N'bar',2);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo") VALUES ('foo',1),('bar',2))`,
          oracle: `INSERT INTO "myTable" ("name","foo") VALUES (:1,:2)`,
        },
        bind: {
          default: undefined,
          oracle: [
            ['foo', 1],
            ['bar', 2],
          ],
        },
      });
    });

    it('passes them through as bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', numbers, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name],[foo]) VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4);`,
          mssql: `INSERT INTO [myTable] ([name],[foo]) VALUES (N'foo',1),(N'bar',2);`,
          db2: `INSERT INTO "myTable" ("name","foo") VALUES ('foo',1),('bar',2);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4))`,
          oracle: `INSERT INTO "myTable" ("name","foo") VALUES (:1,:2)`,
        },
        bind: {
          default: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: 'bar', sequelize_4: 2 },
          ...inlinesValues,
          oracle: [
            ['foo', 1],
            ['bar', 2],
          ],
        },
      });
    });
  });

  describe('booleans', () => {
    const booleans = [
      { name: 'foo', value: true },
      { name: 'bar', value: false },
    ];

    it('serializes them when inlined', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', booleans), {
        query: {
          default: `INSERT INTO [myTable] ([name],[value]) VALUES ('foo',true),('bar',false);`,
          sqlite3: "INSERT INTO `myTable` (`name`,`value`) VALUES ('foo',1),('bar',0);",
          mssql: `INSERT INTO [myTable] ([name],[value]) VALUES (N'foo',1),(N'bar',0);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","value") VALUES ('foo',1),('bar',0))`,
          oracle: `INSERT INTO "myTable" ("name","value") VALUES (:1,:2)`,
        },
        bind: {
          default: undefined,
          oracle: [
            ['foo', '1'],
            ['bar', '0'],
          ],
        },
      });
    });

    it('serializes them as bind parameters', () => {
      const asIntegers = { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: 'bar', sequelize_4: 0 };

      expectsql(queryGenerator.bulkInsertQuery('myTable', booleans, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name],[value]) VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4);`,
          mssql: `INSERT INTO [myTable] ([name],[value]) VALUES (N'foo',1),(N'bar',0);`,
          db2: `INSERT INTO "myTable" ("name","value") VALUES ('foo',true),('bar',false);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","value") VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4))`,
          oracle: `INSERT INTO "myTable" ("name","value") VALUES (:1,:2)`,
        },
        bind: {
          default: {
            sequelize_1: 'foo',
            sequelize_2: true,
            sequelize_3: 'bar',
            sequelize_4: false,
          },
          mysql: asIntegers,
          mariadb: asIntegers,
          sqlite3: asIntegers,
          ibmi: asIntegers,
          ...inlinesValues,
          oracle: [
            ['foo', '1'],
            ['bar', '0'],
          ],
        },
      });
    });
  });

  describe('null and missing values', () => {
    const nulls = [
      { name: 'foo', foo: 1, nullValue: null },
      { name: 'bar', nullValue: null },
    ];
    const nullsBind = {
      sequelize_1: 'foo',
      sequelize_2: 1,
      sequelize_3: null,
      sequelize_4: 'bar',
      sequelize_5: null,
      sequelize_6: null,
    };

    it('inlines NULL for null values and keys missing from a row', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', nulls), {
        query: {
          default: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES ('foo',1,NULL),('bar',NULL,NULL);`,
          mssql: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES (N'foo',1,NULL),(N'bar',NULL,NULL);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo","nullValue") VALUES ('foo',1,NULL),('bar',NULL,NULL))`,
          oracle: `INSERT INTO "myTable" ("name","foo","nullValue") VALUES (:1,:2,:3)`,
        },
        bind: {
          default: undefined,
          oracle: [
            ['foo', 1, null],
            ['bar', null, null],
          ],
        },
      });
    });

    it('binds null for null values and keys missing from a row', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', nulls, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES ($sequelize_1,$sequelize_2,$sequelize_3),($sequelize_4,$sequelize_5,$sequelize_6);`,
          mssql: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES (N'foo',1,NULL),(N'bar',NULL,NULL);`,
          db2: `INSERT INTO "myTable" ("name","foo","nullValue") VALUES ('foo',1,NULL),('bar',NULL,NULL);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3),($sequelize_4,$sequelize_5,$sequelize_6))`,
          oracle: `INSERT INTO "myTable" ("name","foo","nullValue") VALUES (:1,:2,:3)`,
        },
        bind: {
          default: nullsBind,
          ...inlinesValues,
          oracle: [
            ['foo', 1, null],
            ['bar', null, null],
          ],
        },
      });
    });

    it('treats undefined values as null', () => {
      expectsql(
        queryGenerator.bulkInsertQuery('myTable', [
          { name: 'foo', foo: 1, nullValue: undefined },
          { name: 'bar', foo: 2, undefinedValue: undefined },
        ]),
        {
          query: {
            default: `INSERT INTO [myTable] ([name],[foo],[nullValue],[undefinedValue]) VALUES ('foo',1,NULL,NULL),('bar',2,NULL,NULL);`,
            mssql: `INSERT INTO [myTable] ([name],[foo],[nullValue],[undefinedValue]) VALUES (N'foo',1,NULL,NULL),(N'bar',2,NULL,NULL);`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo","nullValue","undefinedValue") VALUES ('foo',1,NULL,NULL),('bar',2,NULL,NULL))`,
            oracle: `INSERT INTO "myTable" ("name","foo","nullValue","undefinedValue") VALUES (:1,:2,:3,:4)`,
          },
          bind: {
            default: undefined,
            oracle: [
              ['foo', 1, null, null],
              ['bar', 2, null, null],
            ],
          },
        },
      );
    });

    it('does not honour the omitNull option', () => {
      const omitNullSequelize = createSequelizeInstance({ omitNull: true });

      expectsql(omitNullSequelize.queryGenerator.bulkInsertQuery('myTable', nulls, BIND), {
        query: {
          default: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES ($sequelize_1,$sequelize_2,$sequelize_3),($sequelize_4,$sequelize_5,$sequelize_6);`,
          mssql: `INSERT INTO [myTable] ([name],[foo],[nullValue]) VALUES (N'foo',1,NULL),(N'bar',NULL,NULL);`,
          db2: `INSERT INTO "myTable" ("name","foo","nullValue") VALUES ('foo',1,NULL),('bar',NULL,NULL);`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3),($sequelize_4,$sequelize_5,$sequelize_6))`,
          oracle: `INSERT INTO "myTable" ("name","foo","nullValue") VALUES (:1,:2,:3)`,
        },
        bind: {
          default: nullsBind,
          ...inlinesValues,
          oracle: [
            ['foo', 1, null],
            ['bar', null, null],
          ],
        },
      });
    });
  });

  describe('autoIncrement attributes', () => {
    const vars = beforeAll2(() => {
      const integer = new DataTypes.INTEGER().toDialectDataType(sequelize.dialect);

      return { attributes: { id: { autoIncrement: true, type: integer } } };
    });

    it('lets the database generate the value when null is provided', () => {
      const { attributes } = vars;
      const options = {};

      expectsql(
        queryGenerator.bulkInsertQuery(
          'myTable',
          [
            { id: null, name: 'foo' },
            { id: null, name: 'bar' },
          ],
          options,
          attributes,
        ),
        {
          query: {
            default: `INSERT INTO [myTable] ([id],[name]) VALUES (NULL,'foo'),(NULL,'bar');`,
            postgres: `INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,'foo'),(DEFAULT,'bar');`,
            mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            db2: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,'foo'),(DEFAULT,'bar'))`,
            oracle: `INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,:1) RETURNING "id" INTO :2`,
          },
          bind: { default: undefined, oracle: oracleTwoStrings },
        },
      );

      if (dialect === 'oracle') {
        expect(options).to.have.property('outBindAttributes').that.has.nested.property('id.dir');
      }
    });

    it('lets the database generate the value when null is provided, with bind parameters', () => {
      const { attributes } = vars;

      expectsql(
        queryGenerator.bulkInsertQuery(
          'myTable',
          [
            { id: null, name: 'foo' },
            { id: null, name: 'bar' },
          ],
          BIND,
          attributes,
        ),
        {
          query: {
            default: `INSERT INTO [myTable] ([id],[name]) VALUES ($sequelize_1,$sequelize_2),($sequelize_3,$sequelize_4);`,
            postgres: `INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,$sequelize_1),(DEFAULT,$sequelize_2);`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,$sequelize_1),(DEFAULT,$sequelize_2))`,
            mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            db2: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar');`,
            oracle: `INSERT INTO "myTable" ("id","name") VALUES (DEFAULT,:1) RETURNING "id" INTO :2`,
          },
          bind: {
            default: {
              sequelize_1: null,
              sequelize_2: 'foo',
              sequelize_3: null,
              sequelize_4: 'bar',
            },
            postgres: twoStrings,
            ibmi: twoStrings,
            ...inlinesValues,
            oracle: oracleTwoStrings,
          },
        },
      );
    });

    if (dialect === 'mssql') {
      it('uses DEFAULT VALUES when the only column is a null autoIncrement column', () => {
        expectsql(
          queryGenerator.bulkInsertQuery(
            'myTable',
            [{ id: null }],
            {},
            { id: { autoIncrement: true } },
          ),
          {
            query: { mssql: 'INSERT INTO [myTable] DEFAULT VALUES;' },
            bind: { default: undefined },
          },
        );
      });
    }
  });

  describe('ignoreDuplicates', () => {
    it('inlines values', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, { ignoreDuplicates: true }), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
          postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING;`,
          'mysql mariadb snowflake': `INSERT IGNORE INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
          sqlite3: "INSERT OR IGNORE INTO `myTable` (`name`) VALUES ('foo'),('bar');",
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: oracleTwoStrings },
      });
    });

    it('uses bind parameters', () => {
      expectsql(
        queryGenerator.bulkInsertQuery('myTable', rows, { ignoreDuplicates: true, ...BIND }),
        {
          query: {
            default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
            postgres: `INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2) ON CONFLICT DO NOTHING;`,
            'mysql mariadb snowflake': `INSERT IGNORE INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
            sqlite3:
              'INSERT OR IGNORE INTO `myTable` (`name`) VALUES ($sequelize_1),($sequelize_2);',
            mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            db2: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
            oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
          },
          bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
        },
      );
    });
  });

  describe('updateOnDuplicate', () => {
    const options = { updateOnDuplicate: ['name'], upsertKeys: ['name'] };

    it('inlines values', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, options), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
          'postgres sqlite3': `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar') ON CONFLICT ([name]) DO UPDATE SET [name]=EXCLUDED.[name];`,
          'mysql mariadb': `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar') ON DUPLICATE KEY UPDATE [name]=VALUES([name]);`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: oracleTwoStrings },
      });
    });

    it('uses bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, { ...options, ...BIND }), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          'postgres sqlite3': `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2) ON CONFLICT ([name]) DO UPDATE SET [name]=EXCLUDED.[name];`,
          'mysql mariadb': `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2) ON DUPLICATE KEY UPDATE [name]=VALUES([name]);`,
          mssql: `INSERT INTO [myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          db2: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
      });
    });
  });

  describe('returning', () => {
    it('returns all columns with returning: true', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, { returning: true }), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
          'postgres sqlite3': `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar') RETURNING *;`,
          mssql: `INSERT INTO [myTable] ([name]) OUTPUT INSERTED.* VALUES (N'foo'),(N'bar');`,
          db2: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'));`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: oracleTwoStrings },
      });
    });

    it('returns all columns with returning: true, with bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery('myTable', rows, { returning: true, ...BIND }), {
        query: {
          default: `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          'postgres sqlite3': `INSERT INTO [myTable] ([name]) VALUES ($sequelize_1),($sequelize_2) RETURNING *;`,
          mssql: `INSERT INTO [myTable] ([name]) OUTPUT INSERTED.* VALUES (N'foo'),(N'bar');`,
          db2: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'));`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
        },
        bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
      });
    });

    it('returns the listed columns', () => {
      expectsql(
        queryGenerator.bulkInsertQuery('myTable', rows, { returning: ['id', 'sentToId'] }),
        {
          query: {
            default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
            'postgres sqlite3': `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar') RETURNING [id], [sentToId];`,
            mssql: `INSERT INTO [myTable] ([name]) OUTPUT INSERTED.[id], INSERTED.[sentToId] VALUES (N'foo'),(N'bar');`,
            db2: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'));`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
            oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
          },
          bind: { default: undefined, oracle: oracleTwoStrings },
        },
      );
    });

    it('combines with ignoreDuplicates', () => {
      expectsql(
        queryGenerator.bulkInsertQuery('myTable', rows, {
          ignoreDuplicates: true,
          returning: true,
        }),
        {
          query: {
            default: `INSERT INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
            postgres: `INSERT INTO "myTable" ("name") VALUES ('foo'),('bar') ON CONFLICT DO NOTHING RETURNING *;`,
            sqlite3: "INSERT OR IGNORE INTO `myTable` (`name`) VALUES ('foo'),('bar') RETURNING *;",
            'mysql mariadb snowflake': `INSERT IGNORE INTO [myTable] ([name]) VALUES ('foo'),('bar');`,
            mssql: `INSERT INTO [myTable] ([name]) OUTPUT INSERTED.* VALUES (N'foo'),(N'bar');`,
            db2: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'));`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("name") VALUES ('foo'),('bar'))`,
            oracle: `INSERT INTO "myTable" ("name") VALUES (:1)`,
          },
          bind: { default: undefined, oracle: oracleTwoStrings },
        },
      );
    });
  });

  describe('table names', () => {
    const table = { schema: 'mySchema', tableName: 'myTable' };

    it('supports schemas', () => {
      expectsql(queryGenerator.bulkInsertQuery(table, rows), {
        query: {
          default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ('foo'),('bar');`,
          sqlite3: "INSERT INTO `mySchema.myTable` (`name`) VALUES ('foo'),('bar');",
          mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "mySchema"."myTable" ("name") VALUES ('foo'),('bar'))`,
          oracle: `INSERT INTO "mySchema"."myTable" ("name") VALUES (:1)`,
        },
        bind: { default: undefined, oracle: oracleTwoStrings },
      });
    });

    it('supports schemas with bind parameters', () => {
      expectsql(queryGenerator.bulkInsertQuery(table, rows, BIND), {
        query: {
          default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
          sqlite3: 'INSERT INTO `mySchema.myTable` (`name`) VALUES ($sequelize_1),($sequelize_2);',
          mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar');`,
          db2: `INSERT INTO "mySchema"."myTable" ("name") VALUES ('foo'),('bar');`,
          ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "mySchema"."myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
          oracle: `INSERT INTO "mySchema"."myTable" ("name") VALUES (:1)`,
        },
        bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
      });
    });

    describe('with quoteIdentifiers: false', () => {
      allowDeprecationsInSuite(['SEQUELIZE0023']);

      const vars = beforeAll2(() => {
        return {
          queryGenerator: createSequelizeInstance({ quoteIdentifiers: false }).queryGenerator,
        };
      });

      it('does not quote identifiers in dialects that support it', () => {
        expectsql(vars.queryGenerator.bulkInsertQuery(table, rows), {
          query: {
            default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ('foo'),('bar');`,
            'postgres snowflake': `INSERT INTO mySchema.myTable (name) VALUES ('foo'),('bar');`,
            sqlite3: "INSERT INTO `mySchema.myTable` (`name`) VALUES ('foo'),('bar');",
            mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "mySchema"."myTable" ("name") VALUES ('foo'),('bar'))`,
            oracle: `INSERT INTO mySchema.myTable (name) VALUES (:1)`,
          },
          bind: { default: undefined, oracle: oracleTwoStrings },
        });
      });

      it('does not quote identifiers in dialects that support it, with bind parameters', () => {
        expectsql(vars.queryGenerator.bulkInsertQuery(table, rows, BIND), {
          query: {
            default: `INSERT INTO [mySchema].[myTable] ([name]) VALUES ($sequelize_1),($sequelize_2);`,
            'postgres snowflake': `INSERT INTO mySchema.myTable (name) VALUES ($sequelize_1),($sequelize_2);`,
            sqlite3:
              'INSERT INTO `mySchema.myTable` (`name`) VALUES ($sequelize_1),($sequelize_2);',
            mssql: `INSERT INTO [mySchema].[myTable] ([name]) VALUES (N'foo'),(N'bar');`,
            db2: `INSERT INTO "mySchema"."myTable" ("name") VALUES ('foo'),('bar');`,
            ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "mySchema"."myTable" ("name") VALUES ($sequelize_1),($sequelize_2))`,
            oracle: `INSERT INTO mySchema.myTable (name) VALUES (:1)`,
          },
          bind: { default: twoStrings, ...inlinesValues, oracle: oracleTwoStrings },
        });
      });
    });
  });
});
