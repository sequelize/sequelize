import util from 'node:util';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';
import attempt from 'lodash/attempt';
import type {
  WhereOptions,
  WhereOperators,
  InferAttributes,
  Attributes,
  Range,
  Col,
  Literal,
  Fn,
  Cast,
} from '@sequelize/core';
import { DataTypes, QueryTypes, Op, literal, col, where, fn, json, cast, and, or, Model } from '@sequelize/core';
import type { WhereItemsQueryOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator.js';
import { createTester, sequelize, expectsql, getTestDialectTeaser } from '../../support';

const sql = sequelize.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character
// when there is no dialect specific expectation but only a default expectation

// TODO:
//  - fix and resolve any .skip test
//  - don't disable test suites if the dialect doesn't support. Instead, ensure dialect throws an error if these operators are used.
//  - drop Op.values & automatically determine if Op.any & Op.all need to use Op.values?

type Options = Omit<WhereItemsQueryOptions, 'model'>;

type Expectations = {
  [dialectName: string]: string | Error,
};

const dialectSupportsArray = () => sequelize.dialect.supports.dataTypes.ARRAY;
const dialectSupportsRange = () => sequelize.dialect.supports.dataTypes.RANGE;
const dialectSupportsJsonB = () => sequelize.dialect.supports.dataTypes.JSONB;
const dialectSupportsJson = () => sequelize.dialect.supports.dataTypes.JSON;

class TestModel extends Model<InferAttributes<TestModel>> {
  declare intAttr1: number;
  declare intAttr2: number;

  declare nullableIntAttr: number | null;

  declare intArrayAttr: number[];
  declare intRangeAttr: Range<number>;
  declare dateRangeAttr: Range<Date>;

  declare stringAttr: string;
  declare binaryAttr: Buffer;
  declare dateAttr: Date;
  declare booleanAttr: boolean;
  declare bigIntAttr: bigint;

  declare jsonAttr: object;
  declare jsonbAttr: object;

  declare aliasedInt: number;
  declare aliasedJsonAttr: object;
  declare aliasedJsonbAttr: object;
}

type TestModelWhere = WhereOptions<Attributes<TestModel>>;

// @ts-expect-error -- we only init a subset of datatypes based on feature support
TestModel.init({
  intAttr1: DataTypes.INTEGER,
  intAttr2: DataTypes.INTEGER,
  nullableIntAttr: DataTypes.INTEGER,

  ...(dialectSupportsArray() && {
    intArrayAttr: DataTypes.ARRAY(DataTypes.INTEGER),
    intRangeAttr: DataTypes.RANGE(DataTypes.INTEGER),
    dateRangeAttr: DataTypes.RANGE(DataTypes.DATE),
  }),

  stringAttr: DataTypes.STRING,
  binaryAttr: DataTypes.BLOB,
  dateAttr: DataTypes.DATE,
  booleanAttr: DataTypes.BOOLEAN,
  bigIntAttr: DataTypes.BIGINT,

  aliasedInt: { type: DataTypes.INTEGER, field: 'aliased_int' },

  ...(dialectSupportsJson() && {
    jsonAttr: { type: DataTypes.JSON },
    aliasedJsonAttr: { type: DataTypes.JSON, field: 'aliased_json' },
  }),

  ...(dialectSupportsJsonB() && {
    jsonbAttr: { type: DataTypes.JSONB },
    aliasedJsonbAttr: { type: DataTypes.JSONB, field: 'aliased_jsonb' },
  }),
}, { sequelize });

describe(getTestDialectTeaser('SQL'), () => {
  describe('whereQuery', () => {
    it('prefixes its output with WHERE when it is not empty', () => {
      expectsql(
        sql.whereQuery({ firstName: 'abc' }),
        {
          default: `WHERE [firstName] = 'abc'`,
          mssql: `WHERE [firstName] = N'abc'`,
        },
      );
    });

    it('returns an empty string if the input results in an empty query', () => {
      expectsql(
        sql.whereQuery({ firstName: { [Op.notIn]: [] } }),
        {
          default: '',
        },
      );
    });
  });

  describe('whereItemsQuery', () => {

    type IncludesType<Haystack, Needle> = Needle extends any
      ? Extract<Haystack, Needle> extends never ? false : true
      : never;

    /**
     * 'OperatorsSupportingSequelizeValueMethods' lists all operators
     * that accept values: `col()`, `literal()`, `fn()`, `cast()`, and { [Op.col] }
     */
    type OperatorsSupportingSequelizeValueMethods = keyof {
      [Key in keyof WhereOperators<number>
        as IncludesType<
          WhereOperators<number>[Key],
          Col | Literal | Fn | Cast | { [Op.col]: string }
        > extends true ? Key : never
      ]: WhereOperators<number>[Key]
    };

    /**
     * Tests whether an operator is compatible with the 5 sequelize methods that can be used as values:
     * - col()
     * - literal()
     * - fn()
     * - cast()
     * - legacy Op.col
     *
     * If there is a typescript error on the operator passed to this function, then
     * the typings in {@link WhereOperators} for the provided operator are incorrect.
     *
     * @param operator
     * @param sqlOperator
     */
    function testSequelizeValueMethods(
      operator: OperatorsSupportingSequelizeValueMethods,
      sqlOperator: string,
    ): void {
      testSql({ intAttr1: { [operator]: { [Op.col]: 'intAttr2' } } }, {
        default: `[intAttr1] ${sqlOperator} [intAttr2]`,
      });

      testSql({ intAttr1: { [operator]: col('intAttr2') } }, {
        default: `[intAttr1] ${sqlOperator} [intAttr2]`,
      });

      testSql({ intAttr1: { [operator]: literal('literal') } }, {
        default: `[intAttr1] ${sqlOperator} literal`,
      });

      testSql({ intAttr1: { [operator]: fn('NOW') } }, {
        default: `[intAttr1] ${sqlOperator} NOW()`,
      });

      testSql.skip({ intAttr1: { [operator]: fn('SUM', { [Op.col]: 'intAttr2' }) } }, {
        default: `[intAttr1] ${sqlOperator} SUM([intAttr2])`,
      });

      testSql({ intAttr1: { [operator]: cast(col('intAttr2'), 'string') } }, {
        default: `[intAttr1] ${sqlOperator} CAST([intAttr2] AS STRING)`,
      });

      testSql.skip({ intAttr1: { [operator]: cast({ [Op.col]: 'intAttr2' }, 'string') } }, {
        default: `[intAttr1] ${sqlOperator} CAST([intAttr2] AS STRING)`,
      });

      testSql({ intAttr1: { [operator]: cast(12, 'string') } }, {
        default: `[intAttr1] ${sqlOperator} CAST(12 AS STRING)`,
      });
    }

    /**
     * 'OperatorsSupportingSequelizeValueMethods' lists all operators
     * that accept values: `col()`, `literal()`, `fn()`, `cast()`, and { [Op.col] }
     */
    type OperatorsSupportingAnyAll<AttributeType> = keyof {
      [Key in keyof WhereOperators<AttributeType>
        as IncludesType<
          WhereOperators<AttributeType>[Key],
          | { [Op.all]: any[] | Literal | { [Op.values]: any[] } }
          | { [Op.any]: any[] | Literal | { [Op.values]: any[] } }
        > extends true ? Key : never
      ]: WhereOperators<AttributeType>[Key]
    };

    /**
     * Tests whether an operator is compatible with:
     * - Op.any (+ Op.values)
     * - Op.all (+ Op.values)
     *
     * If there is a typescript error on the operator passed to this function, then
     * the typings in {@link WhereOperators} for the provided operator are incorrect.
     *
     * @param operator
     * @param sqlOperator
     * @param testWithValues
     */
    function testSupportsAnyAll<TestWithValue>(
      operator: OperatorsSupportingAnyAll<TestWithValue>,
      sqlOperator: string,
      testWithValues: TestWithValue[],
    ) {
      if (!dialectSupportsArray()) {
        return;
      }

      const arrayOperators: Array<[jsOp: symbol, sqlOp: string]> = [
        [Op.any, 'ANY'],
        [Op.all, 'ALL'],
      ];
      for (const [arrayOperator, arraySqlOperator] of arrayOperators) {
        // doesn't work at all
        testSql.skip({ intAttr1: { [operator]: { [arrayOperator]: testWithValues } } }, {
          default: `[intAttr1] ${sqlOperator} ${arraySqlOperator} (ARRAY[${testWithValues.map(v => util.inspect(v)).join(',')}])`,
        });

        testSql({ intAttr1: { [operator]: { [arrayOperator]: literal('literal') } } }, {
          default: `[intAttr1] ${sqlOperator} ${arraySqlOperator} (literal)`,
        });

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql.skip({
          intAttr1: {
            [operator]: {
              [arrayOperator]: {
                [Op.values]: [
                  literal('literal'),
                  fn('UPPER', col('col2')),
                  col('col3'),
                  cast(col('col'), 'string'),
                  'abc',
                  12,
                ],
              },
            },
          },
        }, {
          default: `[intAttr1] ${sqlOperator} ${arraySqlOperator} (VALUES (literal), (UPPER("col2")), ("col3"), (CAST("col" AS STRING)), ('abc'), (12))`,
          mssql: `[intAttr1] ${sqlOperator} ${arraySqlOperator} (VALUES (literal), (UPPER("col2")), ("col3"), (CAST("col" AS STRING)), (N'abc'), (12))`,
        });
      }
    }

    const testSql = createTester(
      (it, whereObj: TestModelWhere, expectations: Expectations, options?: Options) => {
        it(util.inspect(whereObj, { depth: 10 }) + (options ? `, ${util.inspect(options)}` : ''), () => {
          const sqlOrError = attempt(() => sql.whereItemsQuery(whereObj, {
            ...options,
            model: TestModel,
          }));

          return expectsql(sqlOrError, expectations);
        });
      },
    );

    testSql({}, {
      default: '',
    });

    testSql([], {
      default: '',
    });

    // @ts-expect-error -- not supported, testing that it throws
    testSql.skip(10, {
      default: new Error('Unexpected value "10" received. Expected an object, array or a literal()'),
    });

    testSql({ intAttr1: undefined }, {
      default: new Error('WHERE parameter "intAttr1" has invalid "undefined" value'),
    });

    // @ts-expect-error -- user does not exist
    testSql({ intAttr1: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    });

    // @ts-expect-error -- user does not exist
    testSql({ intAttr1: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.SELECT });

    // @ts-expect-error -- user does not exist
    testSql({ intAttr1: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.BULKDELETE });

    // @ts-expect-error -- user does not exist
    testSql({ intAttr1: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.BULKUPDATE });

    testSql({ intAttr1: 1 }, {
      default: '[User].[intAttr1] = 1',
    }, { prefix: 'User' });

    testSql({ dateAttr: { $gte: '2022-11-06' } }, {
      default: new Error(`{ '$gte': '2022-11-06' } is not a valid date`),
    });

    it('{ id: 1 }, { prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, {schema: \'yolo\', tableName: \'User\'})) }', () => {
      expectsql(sql.whereItemsQuery({ id: 1 }, {
        prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, {
          schema: 'yolo',
          tableName: 'User',
        })),
      }), {
        default: '[yolo].[User].[id] = 1',
        sqlite: '`yolo.User`.`id` = 1',
      });
    });

    testSql(literal('raw sql'), {
      default: 'raw sql',
    });

    describe('value serialization', () => {
      // string
      testSql({ stringAttr: '1' }, {
        default: `[stringAttr] = '1'`,
        mssql: `[stringAttr] = N'1'`,
      });

      testSql({
        stringAttr: 'here is a null char: \0',
      }, {
        default: '[stringAttr] = \'here is a null char: \\0\'',
        snowflake: '"stringAttr" = \'here is a null char: \0\'',
        mssql: '[stringAttr] = N\'here is a null char: \0\'',
        db2: '"stringAttr" = \'here is a null char: \0\'',
        ibmi: '"stringAttr" = \'here is a null char: \0\'',
        sqlite: '`stringAttr` = \'here is a null char: \0\'',
      });

      testSql({
        dateAttr: 1_356_998_400_000,
      }, {
        default: `[dateAttr] = '2013-01-01 00:00:00.000 +00:00'`,
        'mariadb mysql': `\`dateAttr\` = '2013-01-01 00:00:00.000'`,
        mssql: `[dateAttr] = N'2013-01-01 00:00:00.000 +00:00'`,
        'db2 snowflake ibmi': `"dateAttr" = '2013-01-01 00:00:00.000'`,
      });

      describe('Buffer', () => {
        testSql({ binaryAttr: Buffer.from('Sequelize') }, {
          ibmi: `"binaryAttr" = BLOB(X'53657175656c697a65')`,
          postgres: `"binaryAttr" = '\\x53657175656c697a65'`,
          'sqlite mariadb mysql': '`binaryAttr` = X\'53657175656c697a65\'',
          db2: `"binaryAttr" = BLOB('Sequelize')`,
          snowflake: `"binaryAttr" = X'53657175656c697a65'`,
          mssql: '[binaryAttr] = 0x53657175656c697a65',
        });

        // Including a quote (') to ensure dialects that don't convert to hex are safe from SQL injection.
        testSql({ binaryAttr: [Buffer.from(`Seque'lize1`), Buffer.from('Sequelize2')] }, {
          ibmi: `"binaryAttr" IN (BLOB(X'5365717565276c697a6531'), BLOB(X'53657175656c697a6532'))`,
          postgres: `"binaryAttr" IN ('\\x5365717565276c697a6531', '\\x53657175656c697a6532')`,
          'sqlite mariadb mysql': '`binaryAttr` IN (X\'5365717565276c697a6531\', X\'53657175656c697a6532\')',
          db2: `"binaryAttr" IN (BLOB('Seque''lize1'), BLOB('Sequelize2'))`,
          snowflake: `"binaryAttr" IN (X'5365717565276c697a6531', X'53657175656c697a6532')`,
          mssql: '[binaryAttr] IN (0x5365717565276c697a6531, 0x53657175656c697a6532)',
        });
      });
    });

    describe('implicit operator', () => {
      testSql({ intAttr1: 1 }, {
        default: '[intAttr1] = 1',
      });

      testSql({ stringAttr: '1' }, {
        default: `[stringAttr] = '1'`,
        mssql: `[stringAttr] = N'1'`,
      });

      testSql({ intAttr1: [1, 2] }, {
        default: '[intAttr1] IN (1, 2)',
      });

      testSql({ stringAttr: ['1', '2'] }, {
        default: `[stringAttr] IN ('1', '2')`,
        mssql: `[stringAttr] IN (N'1', N'2')`,
      });

      testSql({ intAttr1: ['not-an-int'] }, {
        default: new Error(`'not-an-int' is not a valid integer`),
      });

      testSql.skip({ 'stringAttr::integer': 1 }, {
        default: 'CAST([stringAttr] AS INTEGER) = 1',
      });

      testSql({ $intAttr1$: 1 }, {
        default: '[intAttr1] = 1',
      });

      testSql.skip({ '$stringAttr$::integer': 1 }, {
        default: 'CAST([stringAttr] AS INTEGER) = 1',
      });

      testSql({ '$association.attribute$': 1 }, {
        default: '[association].[attribute] = 1',
      });

      testSql.skip({ '$association.attribute$::integer': 1 }, {
        default: 'CAST([association].[attribute] AS INTEGER) = 1',
      });

      testSql({ booleanAttr: true }, {
        default: `[booleanAttr] = true`,
        mssql: '[booleanAttr] = 1',
        sqlite: '`booleanAttr` = 1',
        ibmi: '"booleanAttr" = 1',
      });

      testSql({
        stringAttr: 'a project',
        intAttr1: {
          [Op.or]: [
            [1, 2, 3],
            { [Op.gt]: 10 },
          ],
        },
      }, {
        default: '[stringAttr] = \'a project\' AND ([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10)',
        mssql: '[stringAttr] = N\'a project\' AND ([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10)',
      });

      testSql({ nullableIntAttr: null }, {
        default: '[nullableIntAttr] IS NULL',
      });

      testSql({ dateAttr: new Date('2021-01-01T00:00:00Z') }, {
        default: `[dateAttr] = '2021-01-01 00:00:00.000 +00:00'`,
        mssql: `[dateAttr] = N'2021-01-01 00:00:00.000 +00:00'`,
        'mariadb mysql': `\`dateAttr\` = '2021-01-01 00:00:00.000'`,
        'db2 ibmi snowflake': `"dateAttr" = '2021-01-01 00:00:00.000'`,
      });

      testSql({ intAttr1: { [Op.col]: 'intAttr2' } }, {
        default: '[intAttr1] = [intAttr2]',
      });

      testSql.skip({ intAttr1: col('intAttr2') }, {
        default: '[intAttr1] = [intAttr2]',
      });

      testSql.skip({ intAttr1: literal('literal') }, {
        default: '[intAttr1] = literal',
      });

      testSql({ stringAttr: fn('UPPER', col('stringAttr')) }, {
        default: '[stringAttr] = UPPER([stringAttr])',
      });

      testSql({ stringAttr: fn('UPPER', { [Op.col]: col('stringAttr') }) }, {
        default: '[stringAttr] = UPPER([stringAttr])',
      });

      testSql.skip({ stringAttr: cast(col('intAttr1'), 'string') }, {
        default: '[stringAttr] = CAST([intAttr1] AS STRING)',
      });

      testSql.skip({ stringAttr: cast({ [Op.col]: 'intAttr1' }, 'string') }, {
        default: '[stringAttr] = CAST([intAttr1] AS STRING)',
      });

      testSql.skip({ stringAttr: cast('abc', 'string') }, {
        default: `[stringAttr] = CAST('abc' AS STRING)`,
        mssql: `[stringAttr] = CAST(N'abc' AS STRING)`,
      });

      if (dialectSupportsArray()) {
        testSql({ intArrayAttr: [1, 2] }, {
          default: `[intArrayAttr] = ARRAY[1,2]::INTEGER[]`,
        });

        testSql({ intArrayAttr: [] }, {
          default: `[intArrayAttr] = ARRAY[]::INTEGER[]`,
        });

        // when using arrays, Op.in is never included
        // @ts-expect-error -- Omitting the operator with an array attribute is always Op.eq, never Op.in
        testSql.skip({ intArrayAttr: [[1, 2]] }, {
          default: new Error(`"intArrayAttr" cannot be compared to [[1, 2]], did you mean to use Op.in?`),
        });

        testSql.skip({ intAttr1: { [Op.any]: [2, 3, 4] } }, {
          default: '[intAttr1] = ANY (ARRAY[2,3,4])',
        });

        testSql({ intAttr1: { [Op.any]: literal('literal') } }, {
          default: '[intAttr1] = ANY (literal)',
        });

        testSql({ intAttr1: { [Op.any]: { [Op.values]: [col('col')] } } }, {
          default: '[intAttr1] = ANY (VALUES ([col]))',
        });

        testSql.skip({ intAttr1: { [Op.all]: [2, 3, 4] } }, {
          default: '[intAttr1] = ALL (ARRAY[2,3,4])',
        });

        testSql({ intAttr1: { [Op.all]: literal('literal') } }, {
          default: '[intAttr1] = ALL (literal)',
        });

        testSql({ intAttr1: { [Op.all]: { [Op.values]: [col('col')] } } }, {
          default: '[intAttr1] = ALL (VALUES ([col]))',
        });

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql({
          intAttr1: {
            [Op.any]: {
              [Op.values]: [
                literal('literal'),
                fn('UPPER', col('col2')),
                col('col3'),
                cast(col('col'), 'string'),
                'abc',
                1,
              ],
            },
          },
        }, {
          default: `[intAttr1] = ANY (VALUES (literal), (UPPER([col2])), ([col3]), (CAST([col] AS STRING)), ('abc'), (1))`,
          mssql: `[intAttr1] = ANY (VALUES (literal), (UPPER([col2])), ([col3]), (CAST([col] AS STRING)), (N'abc'), (1))`,
        });
      }
    });

    describe('Op.eq', () => {
      testSql({ intAttr1: { [Op.eq]: 1 } }, {
        default: '[intAttr1] = 1',
      });

      testSql.skip({ 'intAttr1::integer': { [Op.eq]: 1 } }, {
        default: 'CAST([intAttr1] AS INTEGER) = 1',
      });

      testSql({ $intAttr1$: { [Op.eq]: 1 } }, {
        default: '[intAttr1] = 1',
      });

      testSql.skip({ '$intAttr1$::integer': { [Op.eq]: 1 } }, {
        default: 'CAST([intAttr1] AS INTEGER) = 1',
      });

      testSql({ '$association.attribute$': { [Op.eq]: 1 } }, {
        default: '[association].[attribute] = 1',
      });

      testSql.skip({ '$association.attribute$::integer': { [Op.eq]: 1 } }, {
        default: 'CAST([association].[attribute] AS INTEGER) = 1',
      });

      if (dialectSupportsArray()) {
        // @ts-expect-error -- intArrayAttr is not an array
        const ignore: TestModelWhere = { intAttr1: { [Op.eq]: [1, 2] } };

        testSql({ intArrayAttr: { [Op.eq]: [1, 2] } }, {
          default: '[intArrayAttr] = ARRAY[1,2]::INTEGER[]',
        });
      }

      {
        // @ts-expect-error -- intAttr1 is not nullable
        const ignore: TestModelWhere = { intAttr1: { [Op.eq]: null } };

        // this one is
        testSql({ nullableIntAttr: { [Op.eq]: null } }, {
          default: '[nullableIntAttr] IS NULL',
        });
      }

      testSql({ booleanAttr: { [Op.eq]: true } }, {
        default: '[booleanAttr] = true',
        mssql: '[booleanAttr] = 1',
        sqlite: '`booleanAttr` = 1',
        ibmi: '"booleanAttr" = 1',
      });

      testSequelizeValueMethods(Op.eq, '=');
      testSupportsAnyAll(Op.eq, '=', [2, 3, 4]);
    });

    describe('Op.ne', () => {
      testSql({ intAttr1: { [Op.ne]: 1 } }, {
        default: '[intAttr1] != 1',
      });

      if (dialectSupportsArray()) {
        testSql({ intArrayAttr: { [Op.ne]: [1, 2] } }, {
          default: '[intArrayAttr] != ARRAY[1,2]::INTEGER[]',
        });
      }

      testSql({ nullableIntAttr: { [Op.ne]: null } }, {
        default: '[nullableIntAttr] IS NOT NULL',
      });

      testSql({ booleanAttr: { [Op.ne]: true } }, {
        default: '[booleanAttr] != true',
        mssql: '[booleanAttr] != 1',
        ibmi: '"booleanAttr" != 1',
        sqlite: '`booleanAttr` != 1',
      });

      testSequelizeValueMethods(Op.ne, '!=');
      testSupportsAnyAll(Op.ne, '!=', [2, 3, 4]);
    });

    describe('Op.is', () => {
      {
        // @ts-expect-error -- intAttr is not nullable
        const ignore: TestModelWhere = { intAttr: { [Op.is]: null } };
      }

      {
        // @ts-expect-error -- stringAttr is not a boolean
        const ignore: TestModelWhere = { stringAttr: { [Op.is]: true } };
      }

      testSql({ nullableIntAttr: { [Op.is]: null } }, {
        default: '[nullableIntAttr] IS NULL',
      });

      testSql({ booleanAttr: { [Op.is]: false } }, {
        default: '[booleanAttr] IS false',
        mssql: '[booleanAttr] IS 0',
        ibmi: '"booleanAttr" IS 0',
        sqlite: '`booleanAttr` IS 0',
      });

      testSql({ booleanAttr: { [Op.is]: true } }, {
        default: '[booleanAttr] IS true',
        mssql: '[booleanAttr] IS 1',
        ibmi: '"booleanAttr" IS 1',
        sqlite: '`booleanAttr` IS 1',
      });

      // @ts-expect-error -- not supported, testing that it throws
      testSql.skip({ intAttr1: { [Op.is]: 1 } }, {
        default: new Error('Op.is expected a boolean or null, but received 1'),
      });

      // @ts-expect-error -- not supported, testing that it throws
      testSql.skip({ intAttr1: { [Op.is]: { [Op.col]: 'intAttr2' } } }, {
        default: new Error('column references are not supported by Op.is'),
      });

      // @ts-expect-error -- not supported, testing that it throws
      testSql.skip({ intAttr1: { [Op.is]: col('intAttr2') } }, {
        default: new Error('column references are not supported by Op.is'),
      });

      testSql({ intAttr1: { [Op.is]: literal('literal') } }, {
        default: '[intAttr1] IS literal',
      });

      // @ts-expect-error -- not supported, testing that it throws
      testSql.skip({ intAttr1: { [Op.is]: fn('UPPER', col('intAttr2')) } }, {
        default: new Error('SQL functions are not supported by Op.is'),
      });

      // @ts-expect-error -- not supported, testing that it throws
      testSql.skip({ intAttr1: { [Op.is]: cast(col('intAttr2'), 'boolean') } }, {
        default: new Error('CAST is not supported by Op.is'),
      });

      if (dialectSupportsArray()) {
        // @ts-expect-error -- not supported, testing that it throws
        testSql.skip({ intAttr1: { [Op.is]: { [Op.any]: [2, 3] } } }, {
          default: new Error('Op.any is not supported by Op.is'),
        });

        // @ts-expect-error -- not supported, testing that it throws
        testSql.skip({ intAttr1: { [Op.is]: { [Op.all]: [2, 3, 4] } } }, {
          default: new Error('Op.all is not supported by Op.is'),
        });
      }
    });

    describe('Op.not', () => {
      testSql({ [Op.not]: {} }, {
        default: '0 = 1',
      });

      testSql({ [Op.not]: [] }, {
        default: '0 = 1',
      });

      testSql({ nullableIntAttr: { [Op.not]: null } }, {
        default: '[nullableIntAttr] IS NOT NULL',
      });

      testSql({ booleanAttr: { [Op.not]: false } }, {
        default: '[booleanAttr] IS NOT false',
        mssql: '[booleanAttr] IS NOT 0',
        ibmi: '"booleanAttr" IS NOT 0',
        sqlite: '`booleanAttr` IS NOT 0',
      });

      testSql({ booleanAttr: { [Op.not]: true } }, {
        default: '[booleanAttr] IS NOT true',
        mssql: '[booleanAttr] IS NOT 1',
        ibmi: '"booleanAttr" IS NOT 1',
        sqlite: '`booleanAttr` IS NOT 1',
      });

      testSql({ intAttr1: { [Op.not]: 1 } }, {
        default: '[intAttr1] != 1',
      });

      testSql({ intAttr1: { [Op.not]: [1, 2] } }, {
        default: '[intAttr1] NOT IN (1, 2)',
      });

      testSequelizeValueMethods(Op.not, '!=');
      testSupportsAnyAll(Op.not, '!=', [2, 3, 4]);

      {
        // @ts-expect-error -- not a valid query: attribute does not exist.
        const ignore: TestModelWhere = { [Op.not]: { doesNotExist: 5 } };
      }

      testSql({ [Op.not]: { intAttr1: 5 } }, {
        default: 'NOT ([intAttr1] = 5)',
      });

      testSql({ [Op.not]: { intAttr1: { [Op.gt]: 5 } } }, {
        default: 'NOT ([intAttr1] > 5)',
      });

      testSql.skip({ [Op.not]: where(col('intAttr1'), Op.eq, '5') }, {
        default: 'NOT ([intAttr1] = 5)',
      });

      testSql.skip({ [Op.not]: json('data.key', 10) }, {
        default: 'NOT (([data]#>>\'{key}\') = 10)',
      });

      testSql.skip({ intAttr1: { [Op.not]: { [Op.gt]: 5 } } }, {
        default: 'NOT ([intAttr1] > 5)',
      });
    });

    function describeComparisonSuite(
      operator: typeof Op.gt | typeof Op.gte | typeof Op.lt | typeof Op.lte,
      sqlOperator: string,
    ) {
      // ensure gte, gt, lte, lt support the same typings, so we only have to test their typings once.
      // unfortunately, at time of writing (TS 4.5.5), TypeScript
      //  does not detect an error in `{ [operator]: null }`
      //  but it does detect an error in { [Op.gt]: null }`
      expectTypeOf<WhereOperators[typeof Op.gte]>().toEqualTypeOf<WhereOperators[typeof Op.gt]>();
      expectTypeOf<WhereOperators[typeof Op.lt]>().toEqualTypeOf<WhereOperators[typeof Op.gt]>();
      expectTypeOf<WhereOperators[typeof Op.lte]>().toEqualTypeOf<WhereOperators[typeof Op.gt]>();

      describe(`Op.${operator.description}`, () => {
        {
          const ignore: TestModelWhere = { intAttr1: { [Op.gt]: 1 } };
          testSql({ intAttr1: { [operator]: 1 } }, {
            default: `[intAttr1] ${sqlOperator} 1`,
          });
        }

        {
          const ignore: TestModelWhere = { stringAttr: { [Op.gt]: 'abc' } };
          testSql({ stringAttr: { [operator]: 'abc' } }, {
            default: `[stringAttr] ${sqlOperator} 'abc'`,
            mssql: `[stringAttr] ${sqlOperator} N'abc'`,
          });
        }

        if (dialectSupportsArray()) {
          const ignore: TestModelWhere = { intArrayAttr: { [Op.gt]: [1, 2] } };
          testSql({ intArrayAttr: { [operator]: [1, 2] } }, {
            default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2]::INTEGER[]`,
          });
        }

        expectTypeOf({ intAttr1: { [Op.gt]: null } }).not.toMatchTypeOf<WhereOperators>();
        testSql.skip({ intAttr1: { [operator]: null } }, {
          default: new Error(`Op.${operator.description} cannot be used with null`),
        });

        testSequelizeValueMethods(operator, sqlOperator);
        testSupportsAnyAll(operator, sqlOperator, [2, 3, 4]);
      });
    }

    describeComparisonSuite(Op.gt, '>');
    describeComparisonSuite(Op.gte, '>=');
    describeComparisonSuite(Op.lt, '<');
    describeComparisonSuite(Op.lte, '<=');

    function describeBetweenSuite(
      operator: typeof Op.between | typeof Op.notBetween,
      sqlOperator: string,
    ) {
      // ensure between and notBetween support the same typings, so we only have to test their typings once.
      // unfortunately, at time of writing (TS 4.5.5), TypeScript
      //  does not detect an error in `{ [operator]: null }`
      //  but it does detect an error in { [Op.gt]: null }`
      expectTypeOf<WhereOperators[typeof Op.between]>().toEqualTypeOf<WhereOperators[typeof Op.notBetween]>();

      describe(`Op.${operator.description}`, () => {
        expectTypeOf({ id: { [Op.between]: [1, 2] } }).toMatchTypeOf<TestModelWhere>();
        expectTypeOf({ id: { [Op.between]: [new Date(), new Date()] } }).toMatchTypeOf<TestModelWhere>();
        expectTypeOf({ id: { [Op.between]: ['a', 'b'] } }).toMatchTypeOf<TestModelWhere>();

        // expectTypeOf doesn't work with this one:
        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [1, 2] },
          };

          testSql({ intAttr1: { [operator]: [1, 2] } }, {
            default: `[intAttr1] ${sqlOperator} 1 AND 2`,
          });

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.between]: [1, 2, 3] } };

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong2: TestModelWhere = { intAttr1: { [Op.between]: [1] } };

          testSql.skip({ intAttr1: { [operator]: [1] } }, {
            default: new Error(`Op.${operator.description} expects an array of exactly 2 items.`),
          });

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong3: TestModelWhere = { intAttr1: { [Op.between]: [] } };
        }

        if (dialectSupportsArray()) {
          {
            const ignoreRight: TestModelWhere = { intArrayAttr: { [Op.between]: [[1, 2], [3, 4]] } };
            testSql({ intArrayAttr: { [operator]: [[1, 2], [3, 4]] } }, {
              default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2]::INTEGER[] AND ARRAY[3,4]::INTEGER[]`,
            });
          }

          {
            // @ts-expect-error -- this is not valid because intAttr1 is not an array and cannot be compared to arrays
            const ignore: TestModelWhere = { intAttr1: { [Op.between]: [[1, 2], [3, 4]] } };
          }
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: [col('col1'), col('col2')] } };
          testSql({ intAttr1: { [operator]: [col('col1'), col('col2')] } }, {
            default: `[intAttr1] ${sqlOperator} [col1] AND [col2]`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: [literal('literal1'), literal('literal2')] } };
          testSql({ intAttr1: { [operator]: [literal('literal1'), literal('literal2')] } }, {
            default: `[intAttr1] ${sqlOperator} literal1 AND literal2`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: [fn('NOW'), fn('NOW')] } };
          testSql({ intAttr1: { [operator]: [fn('NOW'), fn('NOW')] } }, {
            default: `[intAttr1] ${sqlOperator} NOW() AND NOW()`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } };
          testSql.skip({ intAttr1: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } }, {
            default: `[intAttr1] ${sqlOperator} "col1" AND "col2"`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } };
          testSql({ intAttr1: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } }, {
            default: `[intAttr1] ${sqlOperator} CAST([col] AS STRING) AND CAST([col] AS STRING)`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.between]: literal('literal1 AND literal2') } };
          testSql.skip({ intAttr1: { [operator]: literal('literal1 AND literal2') } }, {
            default: `[intAttr1] ${sqlOperator} BETWEEN literal1 AND literal2`,
          });
        }
      });
    }

    describeBetweenSuite(Op.between, 'BETWEEN');
    describeBetweenSuite(Op.notBetween, 'NOT BETWEEN');

    function describeInSuite(
      operator: typeof Op.in | typeof Op.notIn,
      sqlOperator: string,
      extraTests: () => void,
    ): void {
      // ensure between and notBetween support the same typings, so we only have to test their typings once.
      // unfortunately, at time of writing (TS 4.5.5), TypeScript
      //  does not detect an error in `{ [operator]: null }`
      //  but it does detect an error in { [Op.gt]: null }`
      expectTypeOf<WhereOperators[typeof Op.between]>().toEqualTypeOf<WhereOperators[typeof Op.notBetween]>();

      describe(`Op.${operator.description}`, () => {
        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [1, 2, 3] } };
          testSql({ intAttr1: { [operator]: [1, 2, 3] } }, {
            default: `[intAttr1] ${sqlOperator} (1, 2, 3)`,
          });
        }

        if (dialectSupportsArray()) {
          {
            // valid
            const ignore: TestModelWhere = { intArrayAttr: { [Op.in]: [[1, 2], [3, 4]] } };
            testSql({ intArrayAttr: { [operator]: [[1, 2], [3, 4]] } }, {
              default: `[intArrayAttr] ${sqlOperator} (ARRAY[1,2]::INTEGER[], ARRAY[3,4]::INTEGER[])`,
            });
          }

          {
            // @ts-expect-error -- intAttr1 is not an array
            const ignore: TestModelWhere = { intAttr1: { [Op.in]: [[1, 2], [3, 4]] } };
            testSql({ intArrayAttr: { [operator]: [[1, 2], [3, 4]] } }, {
              default: `[intArrayAttr] ${sqlOperator} (ARRAY[1,2]::INTEGER[], ARRAY[3,4]::INTEGER[])`,
            });
          }
        }

        {
          // @ts-expect-error -- this is invalid because intAttr1 is not an array and cannot be compared to arrays.
          const ignore: TestModelWhere = { intAttr1: { [Op.in]: [[1, 2], [3, 4]] } };
        }

        {
          // @ts-expect-error -- not supported, testing that it throws
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: 1 } };
          testSql.skip({ intAttr1: { [operator]: 1 } }, {
            default: new Error(`Op.${operator.description} expects an array.`),
          });
        }

        {
          // @ts-expect-error -- not supported, testing that it throws
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: col('col2') } };
          testSql.skip({ intAttr1: { [operator]: col('col1') } }, {
            default: new Error(`Op.${operator.description} expects an array.`),
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [col('col1'), col('col2')] } };
          testSql({ intAttr1: { [operator]: [col('col1'), col('col2')] } }, {
            default: `[intAttr1] ${sqlOperator} ([col1], [col2])`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [literal('literal1'), literal('literal2')] } };
          testSql({ intAttr1: { [operator]: [literal('literal1'), literal('literal2')] } }, {
            default: `[intAttr1] ${sqlOperator} (literal1, literal2)`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [fn('NOW'), fn('NOW')] } };
          testSql({ intAttr1: { [operator]: [fn('NOW'), fn('NOW')] } }, {
            default: `[intAttr1] ${sqlOperator} (NOW(), NOW())`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } };
          testSql.skip({ intAttr1: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } }, {
            default: `[intAttr1] ${sqlOperator} ("col1", "col2")`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } };
          testSql({ intAttr1: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } }, {
            default: `[intAttr1] ${sqlOperator} (CAST([col] AS STRING), CAST([col] AS STRING))`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: literal('literal') } };
          testSql({ intAttr1: { [operator]: literal('literal') } }, {
            default: `[intAttr1] ${sqlOperator} literal`,
          });
        }

        {
          // @ts-expect-error -- Op.all is not compatible with Op.in
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: { [Op.all]: [] } } };
        }

        extraTests();
      });
    }

    describeInSuite(Op.in, 'IN', () => {
      testSql({ intAttr1: { [Op.in]: [] } }, {
        default: '[intAttr1] IN (NULL)',
      });
    });

    describeInSuite(Op.notIn, 'NOT IN', () => {
      testSql({ intAttr1: { [Op.notIn]: [] } }, {
        default: '',
      });
    });

    function describeLikeSuite(
      operator: typeof Op.like | typeof Op.notLike | typeof Op.iLike | typeof Op.notILike,
      sqlOperator: string,
    ) {
      // ensure like ops support the same typings, so we only have to test their typings once.
      // unfortunately, at time of writing (TS 4.5.5), TypeScript
      //  does not detect an error in `{ [operator]: null }`
      //  but it does detect an error in { [Op.iLike]: null }`
      expectTypeOf<WhereOperators[typeof Op.notLike]>().toEqualTypeOf<WhereOperators[typeof Op.like]>();
      expectTypeOf<WhereOperators[typeof Op.iLike]>().toEqualTypeOf<WhereOperators[typeof Op.like]>();
      expectTypeOf<WhereOperators[typeof Op.notILike]>().toEqualTypeOf<WhereOperators[typeof Op.like]>();

      describe(`Op.${operator.description}`, () => {
        expectTypeOf({ stringAttr: { [Op.like]: '%id' } }).toMatchTypeOf<TestModelWhere>();
        testSql({ stringAttr: { [operator]: '%id' } }, {
          default: `[stringAttr] ${sqlOperator} '%id'`,
          mssql: `[stringAttr] ${sqlOperator} N'%id'`,
        });

        testSequelizeValueMethods(operator, sqlOperator);
        testSupportsAnyAll(operator, sqlOperator, ['a', 'b', 'c']);
      });
    }

    describeLikeSuite(Op.like, 'LIKE');
    describeLikeSuite(Op.notLike, 'NOT LIKE');
    describeLikeSuite(Op.iLike, 'ILIKE');
    describeLikeSuite(Op.notILike, 'NOT ILIKE');

    function describeOverlapSuite(
      operator: typeof Op.overlap | typeof Op.contains | typeof Op.contained,
      sqlOperator: string,
    ) {

      expectTypeOf<WhereOperators[typeof Op.contains]>().toEqualTypeOf<WhereOperators[typeof Op.overlap]>();
      expectTypeOf<WhereOperators[typeof Op.contained]>().toEqualTypeOf<WhereOperators[typeof Op.overlap]>();

      if (dialectSupportsArray()) {
        describe(`Op.${operator.description} on ARRAY`, () => {
          {
            const ignoreRight: TestModelWhere = { intArrayAttr: { [Op.overlap]: [1, 2, 3] } };
            testSql({ intArrayAttr: { [operator]: [1, 2, 3] } }, {
              default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2,3]::INTEGER[]`,
            });
          }

          testSequelizeValueMethods(operator, sqlOperator);
          // ARRAY Overlap ARRAY doesn't support ANY or ALL, except with VALUES
          // testSupportsAnyAll(operator, sqlOperator, [[1, 2], [1, 2]]);

          {
            // @ts-expect-error -- cannot compare an array with a range!
            const ignore: TestModelWhere = { intArrayAttr: { [Op.overlap]: [1, { value: 2, inclusive: true }] } };
            testSql.skip({ intArrayAttr: { [operator]: [1, { value: 2, inclusive: true }] } }, {
              default: new Error('"intArrayAttr" is an array and cannot be compared to a [1, { value: 2, inclusive: true }]'),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [col('col')] } };
            testSql.skip({ intArrayAttr: { [operator]: [col('col')] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of cols`),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [col('col')] } };
            testSql.skip({ intArrayAttr: { [operator]: [col('col')] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of cols`),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [{ [Op.col]: 'col' }] } };
            testSql.skip({ intArrayAttr: { [operator]: [{ [Op.col]: 'col' }] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of cols`),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [literal('literal')] } };
            testSql.skip({ intArrayAttr: { [operator]: [literal('literal')] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of literals`),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [fn('NOW')] } };
            testSql.skip({ intArrayAttr: { [operator]: [fn('NOW')] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of fn`),
            });
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [cast(col('col'), 'string')] } };
            testSql.skip({ intArrayAttr: { [operator]: [cast(col('col'), 'string')] } }, {
              default: new Error(`Op.${operator.description} does not support arrays of cast`),
            });
          }
        });
      }

      if (dialectSupportsRange()) {
        describe(`Op.${operator.description} on RANGE`, () => {
          {
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2] } };
            testSql({ intRangeAttr: { [operator]: [1, 2] } }, {
              default: `[intRangeAttr] ${sqlOperator} '[1,2)'`,
            });
          }

          {
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, { value: 2, inclusive: true }] } };
            testSql({ intRangeAttr: { [operator]: [1, { value: 2, inclusive: true }] } }, {
              // used 'postgres' because otherwise range is transformed to "1,2"
              postgres: `"intRangeAttr" ${sqlOperator} '[1,2]'`,
            });
          }

          {
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [{ value: 1, inclusive: false }, 2] } };
            testSql({ intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, 2] } }, {
              default: `[intRangeAttr] ${sqlOperator} '(1,2)'`,
            });
          }

          {
            const ignoreRight: TestModelWhere = {
              intRangeAttr: { [Op.overlap]: [{ value: 1, inclusive: false }, { value: 2, inclusive: false }] },
            };
            testSql({ intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, { value: 2, inclusive: false }] } }, {
              default: `[intRangeAttr] ${sqlOperator} '(1,2)'`,
            });
          }

          {
            // unbounded range (right)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [10, null] } };
            testSql({
              intRangeAttr: { [operator]: [10, null] },
            }, {
              postgres: `"intRangeAttr" ${sqlOperator} '[10,)'`,
            });
          }

          {
            // unbounded range (left)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [null, 10] } };
            testSql({
              intRangeAttr: { [operator]: [null, 10] },
            }, {
              postgres: `"intRangeAttr" ${sqlOperator} '[,10)'`,
            });
          }

          {
            // unbounded range (left)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [null, null] } };
            testSql({
              intRangeAttr: { [operator]: [null, null] },
            }, {
              postgres: `"intRangeAttr" ${sqlOperator} '[,)'`,
            });
          }

          {
            const ignoreRight: TestModelWhere = {
              dateRangeAttr: { [Op.overlap]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] },
            };

            testSql({
              dateRangeAttr: {
                [operator]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
              },
            }, {
              postgres: `"dateRangeAttr" ${sqlOperator} '[-infinity,infinity)'`,
            });
          }

          {
            // empty range
            const ignoreRight: TestModelWhere = { dateRangeAttr: { [Op.overlap]: [] } };

            testSql({
              dateRangeAttr: { [operator]: [] },
            }, {
              postgres: `"dateRangeAttr" ${sqlOperator} 'empty'`,
            });
          }

          {
            // @ts-expect-error -- 'intRangeAttr' is a range, but right-hand side is a regular Array
            const ignore: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2, 3] } };
            testSql.skip({ intRangeAttr: { [operator]: [1, 2, 3] } }, {
              default: new Error('"intRangeAttr" is a range and cannot be compared to array [1, 2, 3]'),
            });
          }

          testSequelizeValueMethods(operator, sqlOperator);
          testSupportsAnyAll(operator, sqlOperator, [1, 2]);
        });
      }
    }

    describeOverlapSuite(Op.overlap, '&&');
    describeOverlapSuite(Op.contains, '@>');

    if (dialectSupportsRange()) {
      describe('RANGE Op.contains ELEMENT', () => {
        testSql({
          intRangeAttr: { [Op.contains]: 1 },
        }, {
          postgres: `"intRangeAttr" @> 1`,
        });

        // @ts-expect-error -- `ARRAY Op.contains ELEMENT` is not a valid query
        testSql.skip({ intArrayAttr: { [Op.contains]: 1 } }, {
          default: new Error(`Op.contains doesn't support comparing with a non-array value.`),
        });
      });
    }

    describeOverlapSuite(Op.contained, '<@');

    describe('ELEMENT Op.contained RANGE', () => {
      testSql.skip({
        intAttr1: { [Op.contained]: [1, 2] },
      }, {
        postgres: '"intAttr1" <@ \'[1,2)\'::int4range',
      });

      testSql.skip({
        bigIntAttr: { [Op.contained]: [1, 2] },
      }, {
        postgres: '"intAttr1" <@ \'[1,2)\'::int8range',
      });

      testSql.skip({
        dateAttr: { [Op.contained]: [new Date('2020-01-01T00:00:00Z'), new Date('2021-01-01T00:00:00Z')] },
      }, {
        postgres: '"intAttr1" <@ \'["2020-01-01 00:00:00.000 +00:00", "2021-01-01 00:00:00.000 +00:00")\'::tstzrange',
      });

      /*
      TODO:
      numrange — Range of numeric
      tsrange — Range of timestamp without time zone
      daterange — Range of date
       */

    });

    describe('Op.startsWith', () => {
      testSql({
        stringAttr: {
          [Op.startsWith]: 'swagger',
        },
      }, {
        default: `[stringAttr] LIKE 'swagger%'`,
        mssql: `[stringAttr] LIKE N'swagger%'`,
      });

      testSql({
        stringAttr: {
          [Op.startsWith]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] LIKE 'sql''injection%'`,
        mysql: `\`stringAttr\` LIKE 'sql\\'injection%'`,
        mariadb: `\`stringAttr\` LIKE 'sql\\'injection%'`,
        mssql: `[stringAttr] LIKE N'sql''injection%'`,
      });

      // startsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.startsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] LIKE 'sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] LIKE N'sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.startsWith]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] LIKE 'swagger%'`,
        mssql: `[stringAttr] LIKE N'swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.startsWith]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT($bind, '%')`,
        mssql: `[stringAttr] LIKE CONCAT($bind, N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.startsWith]: col('username'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT("username", '%')`,
        mssql: `[stringAttr] LIKE CONCAT("username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.startsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] LIKE CONCAT("username", '%')`,
        mssql: `[stringAttr] LIKE CONCAT("username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.startsWith]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT(NOW(), '%')`,
        mssql: `[stringAttr] LIKE CONCAT(NOW(), N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.startsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[username] LIKE CONCAT(CAST(NOW() AS STRING), '%')`,
        mssql: `[username] LIKE CONCAT(CAST(NOW() AS STRING), N'%')`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPe is '\')
      // @ts-expect-error -- startsWith is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.startsWith]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.startsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.startsWith]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.startsWith is not compatible with Op.all'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.startsWith]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.startsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.startsWith]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.startsWith is not compatible with Op.all'),
      });
    });

    describe('Op.endsWith', () => {
      testSql({
        stringAttr: {
          [Op.endsWith]: 'swagger',
        },
      }, {
        default: `[stringAttr] LIKE '%swagger'`,
        mssql: `[stringAttr] LIKE N'%swagger'`,
      });

      testSql({
        stringAttr: {
          [Op.endsWith]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] LIKE '%sql''injection'`,
        mysql: `\`stringAttr\` LIKE '%sql\\'injection'`,
        mariadb: `\`stringAttr\` LIKE '%sql\\'injection'`,
        mssql: `[stringAttr] LIKE N'%sql''injection'`,
      });

      // endsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.endsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] LIKE '%sql\%injection' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] LIKE N'%sql\%injection' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.endsWith]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] LIKE '%swagger'`,
        mssql: `[stringAttr] LIKE N'%swagger'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.endsWith]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', $bind)`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', $bind)`,
      });

      testSql.skip({
        stringAttr: {
          [Op.endsWith]: col('username'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', "username")`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', "username")`,
      });

      testSql.skip({
        stringAttr: {
          [Op.endsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', "username")`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', "username")`,
      });

      testSql.skip({
        stringAttr: {
          [Op.endsWith]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', NOW())`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', NOW())`,
      });

      testSql.skip({
        stringAttr: {
          [Op.endsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', CAST(NOW() AS STRING))`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', CAST(NOW() AS STRING))`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      // @ts-expect-error -- startsWith is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.endsWith]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.endsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.endsWith]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.endsWith is not compatible with Op.all'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.endsWith]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.endsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.endsWith]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.endsWith is not compatible with Op.all'),
      });
    });

    describe('Op.substring', () => {
      testSql({
        stringAttr: {
          [Op.substring]: 'swagger',
        },
      }, {
        default: `[stringAttr] LIKE '%swagger%'`,
        mssql: `[stringAttr] LIKE N'%swagger%'`,
      });

      testSql({
        stringAttr: {
          [Op.substring]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] LIKE '%sql''injection%'`,
        mysql: `\`stringAttr\` LIKE '%sql\\'injection%'`,
        mariadb: `\`stringAttr\` LIKE '%sql\\'injection%'`,
        mssql: `[stringAttr] LIKE N'%sql''injection%'`,
      });

      // substring should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.substring]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] LIKE '%sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] LIKE N'%sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.substring]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] LIKE '%swagger%'`,
        mssql: `[stringAttr] LIKE N'%swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.substring]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', $bind, '%')`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', $bind, N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.substring]: col('username'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', "username", '%')`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', "username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.substring]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', "username", '%')`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', "username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.substring]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', NOW(), '%')`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', NOW(), N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.substring]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[stringAttr] LIKE CONCAT('%', CAST(NOW() AS STRING), '%')`,
        mssql: `[stringAttr] LIKE CONCAT(N'%', CAST(NOW() AS STRING), N'%')`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      // @ts-expect-error -- startsWith is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.substring]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.substring is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.substring]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.substring is not compatible with Op.all'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.substring]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.substring is not compatible with Op.any'),
      });

      // @ts-expect-error -- startsWith is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.substring]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.substring is not compatible with Op.all'),
      });
    });

    describe('Op.notStartsWith', () => {
      testSql({
        stringAttr: {
          [Op.notStartsWith]: 'swagger',
        },
      }, {
        default: `[stringAttr] NOT LIKE 'swagger%'`,
        mssql: `[stringAttr] NOT LIKE N'swagger%'`,
      });

      testSql({
        stringAttr: {
          [Op.notStartsWith]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] NOT LIKE 'sql''injection%'`,
        mysql: `\`stringAttr\` NOT LIKE 'sql\\'injection%'`,
        mariadb: `\`stringAttr\` NOT LIKE 'sql\\'injection%'`,
        mssql: `[stringAttr] NOT LIKE N'sql''injection%'`,
      });

      // startsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] NOT LIKE 'sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] NOT LIKE N'sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.notStartsWith]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] NOT LIKE 'swagger%'`,
        mssql: `[stringAttr] NOT LIKE N'swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT($bind, '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT($bind, N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: col('username'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT("username", '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT("username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT("username", '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT("username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT(NOW(), '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(NOW(), N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notStartsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[username] NOT LIKE CONCAT(CAST(NOW() AS STRING), '%')`,
        mssql: `[username] NOT LIKE CONCAT(CAST(NOW() AS STRING), N'%')`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPe is '\')
      // @ts-expect-error -- notStartsWith is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.notStartsWith]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.notStartsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- notStartsWith is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.notStartsWith]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.notStartsWith is not compatible with Op.all'),
      });

      // @ts-expect-error -- notStartsWith is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.notStartsWith]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notStartsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- notStartsWith is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.notStartsWith]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notStartsWith is not compatible with Op.all'),
      });
    });

    describe.skip('Op.notEndsWith', () => {
      testSql({
        stringAttr: {
          [Op.notEndsWith]: 'swagger',
        },
      }, {
        default: `[stringAttr] NOT LIKE '%swagger'`,
        mssql: `[stringAttr] NOT LIKE N'%swagger'`,
      });

      testSql({
        stringAttr: {
          [Op.notEndsWith]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] NOT LIKE '%sql''injection'`,
        mysql: `\`stringAttr\` NOT LIKE '%sql\\'injection'`,
        mariadb: `\`stringAttr\` NOT LIKE '%sql\\'injection'`,
        mssql: `[stringAttr] NOT LIKE N'%sql''injection'`,
      });

      // notEndsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] NOT LIKE '%sql\%injection' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] NOT LIKE N'%sql\%injection' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.notEndsWith]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] NOT LIKE '%swagger'`,
        mssql: `[stringAttr] NOT LIKE N'%swagger'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', $bind)`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', $bind)`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: col('username'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', "username")`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', "username")`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', "username")`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', "username")`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', NOW())`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', NOW())`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notEndsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', CAST(NOW() AS STRING))`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', CAST(NOW() AS STRING))`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      // @ts-expect-error -- notEndsWith is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.notEndsWith]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.notEndsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- notEndsWith is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.notEndsWith]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.notEndsWith is not compatible with Op.all'),
      });

      // @ts-expect-error -- notEndsWith is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.notEndsWith]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notEndsWith is not compatible with Op.any'),
      });

      // @ts-expect-error -- notEndsWith is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.notEndsWith]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notEndsWith is not compatible with Op.all'),
      });
    });

    describe.skip('Op.notSubstring', () => {
      testSql({
        stringAttr: {
          [Op.notSubstring]: 'swagger',
        },
      }, {
        default: `[stringAttr] NOT LIKE '%swagger%'`,
        mssql: `[stringAttr] NOT LIKE N'%swagger%'`,
      });

      testSql({
        stringAttr: {
          [Op.notSubstring]: 'sql\'injection',
        },
      }, {
        default: `[stringAttr] NOT LIKE '%sql''injection%'`,
        mysql: `\`stringAttr\` NOT LIKE '%sql\\'injection%'`,
        mariadb: `\`stringAttr\` NOT LIKE '%sql\\'injection%'`,
        mssql: `[stringAttr] NOT LIKE N'%sql''injection%'`,
      });

      // notSubstring should escape anything that has special meaning in LIKE
      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: 'like%injection',
        },
      }, {
        default: String.raw`[stringAttr] NOT LIKE '%sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[stringAttr] NOT LIKE N'%sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        stringAttr: {
          [Op.notSubstring]: literal('swagger'),
        },
      }, {
        default: `[stringAttr] NOT LIKE '%swagger%'`,
        mssql: `[stringAttr] NOT LIKE N'%swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: literal('$bind'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', $bind, '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', $bind, N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: col('username'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', "username", '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', "username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: { [Op.col]: 'username' },
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', "username", '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', "username", N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: fn('NOW'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', NOW(), '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', NOW(), N'%')`,
      });

      testSql.skip({
        stringAttr: {
          [Op.notSubstring]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[stringAttr] NOT LIKE CONCAT('%', CAST(NOW() AS STRING), '%')`,
        mssql: `[stringAttr] NOT LIKE CONCAT(N'%', CAST(NOW() AS STRING), N'%')`,
      });

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      // @ts-expect-error -- notSubstring is not compatible with Op.any
      testSql.skip({ stringAttr: { [Op.notSubstring]: { [Op.any]: ['test'] } } }, {
        default: new Error('Op.notSubstring is not compatible with Op.any'),
      });

      // @ts-expect-error -- notSubstring is not compatible with Op.all
      testSql.skip({ stringAttr: { [Op.notSubstring]: { [Op.all]: ['test'] } } }, {
        default: new Error('Op.notSubstring is not compatible with Op.all'),
      });

      // @ts-expect-error -- notSubstring is not compatible with Op.any + Op.values
      testSql.skip({ stringAttr: { [Op.notSubstring]: { [Op.any]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notSubstring is not compatible with Op.any'),
      });

      // @ts-expect-error -- notSubstring is not compatible with Op.all + Op.values
      testSql.skip({ stringAttr: { [Op.notSubstring]: { [Op.all]: { [Op.values]: ['test'] } } } }, {
        default: new Error('Op.notSubstring is not compatible with Op.all'),
      });
    });

    function describeRegexpSuite(
      operator: typeof Op.regexp | typeof Op.iRegexp | typeof Op.notRegexp | typeof Op.notIRegexp,
      sqlOperator: string,
    ) {
      expectTypeOf<WhereOperators[typeof Op.iRegexp]>().toEqualTypeOf<WhereOperators[typeof Op.regexp]>();
      expectTypeOf<WhereOperators[typeof Op.notRegexp]>().toEqualTypeOf<WhereOperators[typeof Op.regexp]>();
      expectTypeOf<WhereOperators[typeof Op.notIRegexp]>().toEqualTypeOf<WhereOperators[typeof Op.regexp]>();

      describe(`Op.${operator.description}`, () => {
        {
          const ignore: TestModelWhere = { stringAttr: { [Op.regexp]: '^sw.*r$' } };
        }

        testSql({ stringAttr: { [operator]: '^sw.*r$' } }, {
          default: `[stringAttr] ${sqlOperator} '^sw.*r$'`,
        });

        testSql({ stringAttr: { [operator]: '^new\nline$' } }, {
          default: `[stringAttr] ${sqlOperator} '^new\nline$'`,
          mariadb: `\`stringAttr\` ${sqlOperator} '^new\\nline$'`,
          mysql: `\`stringAttr\` ${sqlOperator} '^new\\nline$'`,
        });

        testSequelizeValueMethods(operator, sqlOperator);
        testSupportsAnyAll(operator, sqlOperator, ['^a$', '^b$']);
      });
    }

    if (sequelize.dialect.supports.REGEXP) {
      describeRegexpSuite(Op.regexp, sequelize.dialect.name === 'postgres' ? '~' : 'REGEXP');
      describeRegexpSuite(Op.notRegexp, sequelize.dialect.name === 'postgres' ? '!~' : 'NOT REGEXP');
    }

    if (sequelize.dialect.supports.IREGEXP) {
      describeRegexpSuite(Op.iRegexp, '~*');
      describeRegexpSuite(Op.notIRegexp, '!~*');
    }

    if (sequelize.dialect.supports.dataTypes.TSVECTOR) {
      describe('Op.match', () => {
        testSql({ stringAttr: { [Op.match]: fn('to_tsvector', 'swagger') } }, {
          default: `[stringAttr] @@ to_tsvector('swagger')`,
        });

        testSequelizeValueMethods(Op.match, '@@');
        testSupportsAnyAll(Op.match, '@@', [fn('to_tsvector', 'a'), fn('to_tsvector', 'b')]);
      });
    }

    function describeAdjacentRangeSuite(
      operator: typeof Op.adjacent | typeof Op.strictLeft | typeof Op.strictRight
              | typeof Op.noExtendLeft | typeof Op.noExtendRight,
      sqlOperator: string,
    ) {
      if (!dialectSupportsRange()) {
        return;
      }

      expectTypeOf<WhereOperators[typeof Op.strictLeft]>().toEqualTypeOf<WhereOperators[typeof Op.adjacent]>();
      expectTypeOf<WhereOperators[typeof Op.strictRight]>().toEqualTypeOf<WhereOperators[typeof Op.adjacent]>();
      expectTypeOf<WhereOperators[typeof Op.noExtendLeft]>().toEqualTypeOf<WhereOperators[typeof Op.adjacent]>();
      expectTypeOf<WhereOperators[typeof Op.noExtendRight]>().toEqualTypeOf<WhereOperators[typeof Op.adjacent]>();

      describe(`RANGE Op.${operator.description} RANGE`, () => {
        {
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [1, 2] } };
          testSql({ intRangeAttr: { [operator]: [1, 2] } }, {
            default: `[intRangeAttr] ${sqlOperator} '[1,2)'`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [1, { value: 2, inclusive: true }] } };
          testSql({ intRangeAttr: { [operator]: [1, { value: 2, inclusive: true }] } }, {
            // used 'postgres' because otherwise range is transformed to "1,2"
            postgres: `"intRangeAttr" ${sqlOperator} '[1,2]'`,
          });
        }

        {
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [{ value: 1, inclusive: false }, 2] } };
          testSql({ intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, 2] } }, {
            default: `[intRangeAttr] ${sqlOperator} '(1,2)'`,
          });
        }

        {
          const ignoreRight: TestModelWhere = {
            intRangeAttr: { [Op.adjacent]: [{ value: 1, inclusive: false }, { value: 2, inclusive: false }] },
          };
          testSql({ intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, { value: 2, inclusive: false }] } }, {
            default: `[intRangeAttr] ${sqlOperator} '(1,2)'`,
          });
        }

        {
          // unbounded range (right)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [10, null] } };
          testSql({
            intRangeAttr: { [operator]: [10, null] },
          }, {
            postgres: `"intRangeAttr" ${sqlOperator} '[10,)'`,
          });
        }

        {
          // unbounded range (left)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [null, 10] } };
          testSql({
            intRangeAttr: { [operator]: [null, 10] },
          }, {
            postgres: `"intRangeAttr" ${sqlOperator} '[,10)'`,
          });
        }

        {
          // unbounded range (left)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [null, null] } };
          testSql({
            intRangeAttr: { [operator]: [null, null] },
          }, {
            postgres: `"intRangeAttr" ${sqlOperator} '[,)'`,
          });
        }

        {
          const ignoreRight: TestModelWhere = {
            dateRangeAttr: { [Op.adjacent]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] },
          };

          testSql({
            dateRangeAttr: {
              [operator]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
            },
          }, {
            postgres: `"dateRangeAttr" ${sqlOperator} '[-infinity,infinity)'`,
          });
        }

        {
          // empty range
          const ignoreRight: TestModelWhere = { dateRangeAttr: { [Op.adjacent]: [] } };

          testSql({
            dateRangeAttr: { [operator]: [] },
          }, {
            postgres: `"dateRangeAttr" ${sqlOperator} 'empty'`,
          });
        }

        {
          // @ts-expect-error -- 'intRangeAttr' is a range, but right-hand side is a regular Array
          const ignore: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2, 3] } };
          testSql.skip({ intRangeAttr: { [operator]: [1, 2, 3] } }, {
            default: new Error('"intRangeAttr" is a range and cannot be compared to array [1, 2, 3]'),
          });
        }
      });
    }

    describeAdjacentRangeSuite(Op.adjacent, '-|-');
    describeAdjacentRangeSuite(Op.strictLeft, '<<');
    describeAdjacentRangeSuite(Op.strictRight, '>>');
    describeAdjacentRangeSuite(Op.noExtendLeft, '&>');
    describeAdjacentRangeSuite(Op.noExtendRight, '&<');

    if (sequelize.dialect.supports.jsonOperations) {
      describe('JSON Operations', () => {
        {
          // @ts-expect-error -- attribute 'doesNotExist' does not exist.
          const ignore: TestModelWhere = { 'doesNotExist.nested': 'value' };
        }

        {
          // @ts-expect-error -- attribute 'doesNotExist' does not exist.
          const ignore: TestModelWhere = { '$doesNotExist$.nested': 'value' };
        }

        testSql({
          'jsonAttr.nested': {
            attribute: 'value',
          },
        }, {
          mariadb: `json_unquote(json_extract(\`jsonAttr\`,'$.nested.attribute')) = 'value'`,
          mysql: `json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\".\\"attribute\\"')) = 'value'`,
          postgres: `("jsonAttr"#>>'{nested,attribute}') = 'value'`,
          sqlite: `json_extract(\`jsonAttr\`,'$.nested.attribute') = 'value'`,
        });

        testSql.skip({
          '$jsonAttr$.nested': {
            [Op.eq]: 'value',
          },
        }, {
          mariadb: `json_unquote(json_extract(\`jsonAttr\`,'$.nested')) = 'value'`,
          mysql: `json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\"')) = 'value'`,
          postgres: `("jsonAttr"#>>'{nested}') = 'value'`,
          sqlite: `json_extract(\`jsonAttr\`,'$.nested') = 'value'`,
        });

        testSql.skip({
          '$jsonAttr$.nested': {
            attribute: 'value',
          },
        }, {
          mariadb: `json_unquote(json_extract(\`jsonAttr\`,'$.nested.attribute')) = 'value'`,
          mysql: `json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\".\\"attribute\\"')) = 'value'`,
          postgres: `("jsonAttr"#>>'{nested,attribute}') = 'value'`,
          sqlite: `json_extract(\`jsonAttr\`,'$.nested.attribute') = 'value'`,
        });

        testSql.skip({
          '$association.jsonAttr$.nested': {
            attribute: 'value',
          },
        }, {
          mariadb: `json_unquote(json_extract(\`association\`.\`jsonAttr\`,'$.nested.attribute')) = 'value'`,
          mysql: `json_unquote(json_extract(\`association\`.\`jsonAttr\`,'$.\\"nested\\".\\"attribute\\"')) = 'value'`,
          postgres: `("association"."jsonAttr"#>>'{nested,attribute}') = 'value'`,
          sqlite: `json_extract(\`association\`.\`jsonAttr\`,'$.nested.attribute') = 'value'`,
        });

        testSql({
          'jsonAttr.nested::STRING': 'value',
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
          mysql: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\"')) AS STRING) = 'value'`,
          postgres: `CAST(("jsonAttr"#>>'{nested}') AS STRING) = 'value'`,
          sqlite: `CAST(json_extract(\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
        });

        testSql.skip({
          '$jsonAttr$.nested::STRING': 'value',
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
          mysql: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\"')) AS STRING) = 'value'`,
          postgres: `CAST(("jsonAttr"#>>'{nested}') AS STRING) = 'value'`,
          sqlite: `CAST(json_extract(\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
        });

        testSql.skip({
          '$association.jsonAttr$.nested::STRING': {
            attribute: 'value',
          },
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`association\`.\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
          mysql: `CAST(json_unquote(json_extract(\`association\`.\`jsonAttr\`,'$.\\"nested\\"')) AS STRING) = 'value'`,
          postgres: `CAST(("association"."jsonAttr"#>>'{nested}') AS STRING) = 'value'`,
          sqlite: `CAST(json_extract(\`association\`.\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
        });

        testSql.skip({
          $jsonAttr$: { nested: 'value' },
        }, {
          mariadb: `json_unquote(json_extract(\`jsonAttr\`,'$.nested.attribute')) = 'value'`,
          mysql: `json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\".\\"attribute\\"')) = 'value'`,
          postgres: `("jsonAttr"#>>'{nested,attribute}') = 'value'`,
          sqlite: `json_extract(\`jsonAttr\`,'$.nested.attribute') = 'value'`,
        });

        testSql.skip({
          $jsonAttr$: { 'nested::string': 'value' },
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
          mysql: `CAST(json_unquote(json_extract(\`jsonAttr\`,'$.\\"nested\\"')) AS STRING) = 'value'`,
          postgres: `CAST(("jsonAttr"#>>'{nested}') AS STRING) = 'value'`,
          sqlite: `CAST(json_extract(\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
        });

        testSql({ 'jsonAttr.nested.attribute': 4 }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonAttr`,\'$.nested.attribute\')) AS DECIMAL) = 4',
          mysql: 'CAST(json_unquote(json_extract(`jsonAttr`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) = 4',
          postgres: 'CAST(("jsonAttr"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) = 4',
          sqlite: 'CAST(json_extract(`jsonAttr`,\'$.nested.attribute\') AS DOUBLE PRECISION) = 4',
        });

        // aliases correctly
        testSql.skip({ 'aliasedJsonAttr.nested.attribute': 4 }, {
          mariadb: 'CAST(json_unquote(json_extract(`aliased_json`,\'$.nested.attribute\')) AS DECIMAL) = 4',
          mysql: 'CAST(json_unquote(json_extract(`aliased_json`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) = 4',
          postgres: 'CAST(("aliased_json"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) = 4',
          sqlite: 'CAST(json_extract(`aliased_json`,\'$.nested.attribute\') AS DOUBLE PRECISION) = 4',
        });
      });
    }

    if (dialectSupportsJsonB()) {
      describe('JSONB', () => {
        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: ['a', 'b'],
          },
        }, {
          default: `[jsonbAttr] ?| ARRAY['a', 'b']`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: ['a', 'b'],
          },
        }, {
          default: `[jsonbAttr] ?& ARRAY['a', 'b']`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: literal(`ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`),
          },
        }, {
          default: `[jsonbAttr] ?| ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: literal(`ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`),
          },
        }, {
          default: `[jsonbAttr] ?& ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: [literal(`"gamer"`)],
          },
        }, {
          default: `[jsonbAttr] ?| ARRAY["gamer"]`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: [literal(`"gamer"`)],
          },
        }, {
          default: `[jsonbAttr] ?& ARRAY["gamer"]`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: col('label'),
          },
        }, {
          default: `[jsonbAttr] ?| "label"`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: col('labels'),
          },
        }, {
          default: `[jsonbAttr] ?& "labels"`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: cast(col('labels'), 'STRING[]'),
          },
        }, {
          default: `[jsonbAttr] ?| CAST("labels" AS STRING[])`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: cast(col('labels'), 'STRING[]'),
          },
        }, {
          default: `[jsonbAttr] ?& CAST("labels" AS STRING[])`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: [],
          },
        }, {
          default: `[jsonbAttr] ?| ARRAY[]::text[]`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: [],
          },
        }, {
          default: `[jsonbAttr] ?& ARRAY[]::text[]`,
        });

        testSql({
          jsonbAttr: {
            [Op.anyKeyExists]: fn('get_label'),
          },
        }, {
          default: `[jsonbAttr] ?| get_label()`,
        });

        testSql({
          jsonbAttr: {
            [Op.allKeysExist]: fn('get_labels'),
          },
        }, {
          default: `[jsonbAttr] ?& get_labels()`,
        });

        // @ts-expect-error -- typings for `json` are broken, but `json()` is deprecated
        testSql({ id: { [Op.eq]: json('profile.id') } }, {
          default: '"id" = ("profile"#>>\'{id}\')',
        });

        // @ts-expect-error -- typings for `json` are broken, but `json()` is deprecated
        testSql(json('profile.id', cast('12346-78912', 'text')), {
          postgres: '("profile"#>>\'{id}\') = CAST(\'12346-78912\' AS TEXT)',
          sqlite: 'json_extract(`profile`,\'$.id\') = CAST(\'12346-78912\' AS TEXT)',
          mariadb: 'json_unquote(json_extract(`profile`,\'$.id\')) = CAST(\'12346-78912\' AS CHAR)',
          mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\"\')) = CAST(\'12346-78912\' AS CHAR)',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
          prefix: 'User',
        });

        testSql(json({ profile: { id: '12346-78912', name: 'test' } }), {
          postgres: '("profile"#>>\'{id}\') = \'12346-78912\' AND ("profile"#>>\'{name}\') = \'test\'',
          sqlite: 'json_extract(`profile`,\'$.id\') = \'12346-78912\' AND json_extract(`profile`,\'$.name\') = \'test\'',
          mariadb: 'json_unquote(json_extract(`profile`,\'$.id\')) = \'12346-78912\' AND json_unquote(json_extract(`profile`,\'$.name\')) = \'test\'',
          mysql: 'json_unquote(json_extract(`profile`,\'$.\\"id\\"\')) = \'12346-78912\' AND json_unquote(json_extract(`profile`,\'$.\\"name\\"\')) = \'test\'',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
          prefix: 'User',
        });

        testSql({
          jsonbAttr: {
            nested: {
              attribute: 'value',
            },
          },
        }, {
          mariadb: 'json_unquote(json_extract(`User`.`jsonbAttr`,\'$.nested.attribute\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`User`.`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\'',
          postgres: '("User"."jsonbAttr"#>>\'{nested,attribute}\') = \'value\'',
          sqlite: 'json_extract(`User`.`jsonbAttr`,\'$.nested.attribute\') = \'value\'',
        }, {
          prefix: 'User',
        });

        testSql({
          jsonbAttr: {
            nested: {
              [Op.in]: [1, 2],
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.nested\')) AS DECIMAL) IN (1, 2)',
          mysql: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\"\')) AS DECIMAL) IN (1, 2)',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested}\') AS DOUBLE PRECISION) IN (1, 2)',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested\') AS DOUBLE PRECISION) IN (1, 2)',
        });

        testSql({
          jsonbAttr: {
            nested: {
              [Op.between]: [1, 2],
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.nested\')) AS DECIMAL) BETWEEN 1 AND 2',
          mysql: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\"\')) AS DECIMAL) BETWEEN 1 AND 2',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested}\') AS DOUBLE PRECISION) BETWEEN 1 AND 2',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested\') AS DOUBLE PRECISION) BETWEEN 1 AND 2',
        });

        testSql({
          jsonbAttr: {
            nested: {
              attribute: 'value',
              prop: {
                [Op.ne]: 'None',
              },
            },
          },
        }, {
          mariadb: '(json_unquote(json_extract(`User`.`jsonbAttr`,\'$.nested.attribute\')) = \'value\' AND json_unquote(json_extract(`User`.`jsonbAttr`,\'$.nested.prop\')) != \'None\')',
          mysql: '(json_unquote(json_extract(`User`.`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\' AND json_unquote(json_extract(`User`.`jsonbAttr`,\'$.\\"nested\\".\\"prop\\"\')) != \'None\')',
          postgres: '(("User"."jsonbAttr"#>>\'{nested,attribute}\') = \'value\' AND ("User"."jsonbAttr"#>>\'{nested,prop}\') != \'None\')',
          sqlite: '(json_extract(`User`.`jsonbAttr`,\'$.nested.attribute\') = \'value\' AND json_extract(`User`.`jsonbAttr`,\'$.nested.prop\') != \'None\')',
        }, {
          prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, { tableName: 'User' })),
        });

        testSql({
          jsonbAttr: {
            name: {
              last: 'Simpson',
            },
            employment: {
              [Op.ne]: 'None',
            },
          },
        }, {
          mariadb: '(json_unquote(json_extract(`User`.`jsonbAttr`,\'$.name.last\')) = \'Simpson\' AND json_unquote(json_extract(`User`.`jsonbAttr`,\'$.employment\')) != \'None\')',
          mysql: '(json_unquote(json_extract(`User`.`jsonbAttr`,\'$.\\"name\\".\\"last\\"\')) = \'Simpson\' AND json_unquote(json_extract(`User`.`jsonbAttr`,\'$.\\"employment\\"\')) != \'None\')',
          postgres: '(("User"."jsonbAttr"#>>\'{name,last}\') = \'Simpson\' AND ("User"."jsonbAttr"#>>\'{employment}\') != \'None\')',
          sqlite: '(json_extract(`User`.`jsonbAttr`,\'$.name.last\') = \'Simpson\' AND json_extract(`User`.`jsonbAttr`,\'$.employment\') != \'None\')',
        }, {
          prefix: 'User',
        });

        testSql({
          jsonbAttr: {
            price: 5,
            name: 'Product',
          },
        }, {
          mariadb: '(CAST(json_unquote(json_extract(`jsonbAttr`,\'$.price\')) AS DECIMAL) = 5 AND json_unquote(json_extract(`jsonbAttr`,\'$.name\')) = \'Product\')',
          mysql: '(CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"price\\"\')) AS DECIMAL) = 5 AND json_unquote(json_extract(`jsonbAttr`,\'$.\\"name\\"\')) = \'Product\')',
          postgres: '(CAST(("jsonbAttr"#>>\'{price}\') AS DOUBLE PRECISION) = 5 AND ("jsonbAttr"#>>\'{name}\') = \'Product\')',
          sqlite: '(CAST(json_extract(`jsonbAttr`,\'$.price\') AS DOUBLE PRECISION) = 5 AND json_extract(`jsonbAttr`,\'$.name\') = \'Product\')',
        });

        testSql({
          'jsonbAttr.nested.attribute': {
            [Op.in]: [3, 7],
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.nested.attribute\')) AS DECIMAL) IN (3, 7)',
          mysql: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) IN (3, 7)',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) IN (3, 7)',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested.attribute\') AS DOUBLE PRECISION) IN (3, 7)',
        });

        testSql({
          jsonbAttr: {
            nested: {
              attribute: {
                [Op.gt]: 2,
              },
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.nested.attribute\')) AS DECIMAL) > 2',
          mysql: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) > 2',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) > 2',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested.attribute\') AS DOUBLE PRECISION) > 2',
        });

        testSql({
          jsonbAttr: {
            nested: {
              'attribute::integer': {
                [Op.gt]: 2,
              },
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.nested.attribute\')) AS DECIMAL) > 2',
          mysql: 'CAST(json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) > 2',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested,attribute}\') AS INTEGER) > 2',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested.attribute\') AS INTEGER) > 2',
        });

        const dt = new Date();
        testSql({
          jsonbAttr: {
            nested: {
              attribute: {
                [Op.gt]: dt,
              },
            },
          },
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`jsonbAttr\`,'$.nested.attribute')) AS DATETIME) > ${sql.escape(dt)}`,
          mysql: `CAST(json_unquote(json_extract(\`jsonbAttr\`,'$.\\"nested\\".\\"attribute\\"')) AS DATETIME) > ${sql.escape(dt)}`,
          postgres: `CAST(("jsonbAttr"#>>'{nested,attribute}') AS TIMESTAMPTZ) > ${sql.escape(dt)}`,
          sqlite: `json_extract(\`jsonbAttr\`,'$.nested.attribute') > ${sql.escape(dt.toISOString())}`,
        });

        testSql({
          jsonbAttr: {
            nested: {
              attribute: true,
            },
          },
        }, {
          mariadb: 'json_unquote(json_extract(`jsonbAttr`,\'$.nested.attribute\')) = \'true\'',
          mysql: 'json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) = \'true\'',
          postgres: 'CAST(("jsonbAttr"#>>\'{nested,attribute}\') AS BOOLEAN) = true',
          sqlite: 'CAST(json_extract(`jsonbAttr`,\'$.nested.attribute\') AS BOOLEAN) = 1',
        });

        testSql({ 'jsonbAttr.nested.attribute': 'value' }, {
          mariadb: 'json_unquote(json_extract(`jsonbAttr`,\'$.nested.attribute\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`jsonbAttr`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\'',
          postgres: '("jsonbAttr"#>>\'{nested,attribute}\') = \'value\'',
          sqlite: 'json_extract(`jsonbAttr`,\'$.nested.attribute\') = \'value\'',
        });

        testSql({
          jsonbAttr: {
            [Op.contains]: { company: 'Magnafone' },
          },
        }, {
          default: '[jsonbAttr] @> \'{"company":"Magnafone"}\'',
        });

        // aliases correctly

        testSql.skip({ aliasedJsonbAttr: { key: 'value' } }, {
          mariadb: 'json_unquote(json_extract(`aliased_jsonb`,\'$.key\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`aliased_jsonb`,\'$.\\"key\\"\')) = \'value\'',
          postgres: '("aliased_jsonb"#>>\'{key}\') = \'value\'',
          sqlite: 'json_extract(`aliased_jsonb`,\'$.key\') = \'value\'',
        });
      });
    }

    testSql({
      stringAttr: 'a project',
      [Op.or]: [
        { intAttr1: [1, 2, 3] },
        { intAttr1: { [Op.gt]: 10 } },
      ],
    }, {
      default: '([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10) AND [stringAttr] = \'a project\'',
      mssql: '([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10) AND [stringAttr] = N\'a project\'',
    });

    describe('Op.and', () => {
      it('and() is the same as Op.and', () => {
        expect(util.inspect(and('a', 'b'))).to.deep.equal(util.inspect({ [Op.and]: ['a', 'b'] }));
      });

      // by default: it already is Op.and
      testSql({ intAttr1: 1, intAttr2: 2 }, {
        default: `[intAttr1] = 1 AND [intAttr2] = 2`,
      });

      // top-level array is Op.and
      testSql([{ intAttr1: 1 }, { intAttr1: 2 }], {
        default: `([intAttr1] = 1 AND [intAttr1] = 2)`,
      });

      // $intAttr1$ doesn't override intAttr1
      testSql({ intAttr1: 1, $intAttr1$: 2 }, {
        default: `[intAttr1] = 1 AND [intAttr1] = 2`,
      });

      // can pass a simple object
      testSql({ [Op.and]: { intAttr1: 1, intAttr2: 2 } }, {
        default: `([intAttr1] = 1 AND [intAttr2] = 2)`,
      });

      // can pass an array
      testSql({ [Op.and]: [{ intAttr1: 1, intAttr2: 2 }, { stringAttr: '' }] }, {
        default: `(([intAttr1] = 1 AND [intAttr2] = 2) AND [stringAttr] = '')`,
        mssql: `(([intAttr1] = 1 AND [intAttr2] = 2) AND [stringAttr] = N'')`,
      });

      // can be used on attribute
      testSql({ intAttr1: { [Op.and]: [1, { [Op.gt]: 1 }] } }, {
        default: `([intAttr1] = 1 AND [intAttr1] > 1)`,
      });

      // @ts-expect-error -- cannot be used after operator
      testSql.skip({ intAttr1: { [Op.gt]: { [Op.and]: [1, 2] } } }, {
        default: new Error('Op.and cannot be used inside Op.gt'),
      });
    });

    describe('Op.or', () => {
      it('or() is the same as Op.or', () => {
        expect(util.inspect(or('a', 'b'))).to.deep.equal(util.inspect({ [Op.or]: ['a', 'b'] }));
      });

      testSql(or([]), {
        default: '0 = 1',
      });

      testSql(or({}), {
        default: '0 = 1',
      });

      // can pass a simple object
      testSql({ [Op.or]: { intAttr1: 1, intAttr2: 2 } }, {
        default: `([intAttr1] = 1 OR [intAttr2] = 2)`,
      });

      // can pass an array
      testSql({ [Op.or]: [{ intAttr1: 1, intAttr2: 2 }, { stringAttr: '' }] }, {
        default: `(([intAttr1] = 1 AND [intAttr2] = 2) OR [stringAttr] = '')`,
        mssql: `(([intAttr1] = 1 AND [intAttr2] = 2) OR [stringAttr] = N'')`,
      });

      // can be used on attribute
      testSql({ intAttr1: { [Op.or]: [1, { [Op.gt]: 1 }] } }, {
        default: `([intAttr1] = 1 OR [intAttr1] > 1)`,
      });

      // @ts-expect-error -- cannot be used after operator
      testSql.skip({ intAttr1: { [Op.gt]: { [Op.or]: [1, 2] } } }, {
        default: new Error('Op.or cannot be used inside Op.gt'),
      });

      testSql({
        [Op.or]: {
          intAttr1: [1, 3],
          intAttr2: {
            [Op.in]: [2, 4],
          },
        },
      }, {
        default: '([intAttr1] IN (1, 3) OR [intAttr2] IN (2, 4))',
      });
    });

    describe('Op.{and,or,not} combinations', () => {
      // both can be used in the same object
      testSql({
        [Op.and]: { intAttr1: 1, intAttr2: 2 },
        [Op.or]: { intAttr1: 1, intAttr2: 2 },
      }, {
        default: `([intAttr1] = 1 AND [intAttr2] = 2) AND ([intAttr1] = 1 OR [intAttr2] = 2)`,
      });

      // Op.or only applies to its direct Array, the nested array is still Op.and
      testSql({
        [Op.or]: [
          [{ intAttr1: 1 }, { intAttr1: 2 }],
          { intAttr1: 3 },
        ],
      }, {
        default: '((([intAttr1] = 1 AND [intAttr1] = 2)) OR [intAttr1] = 3)',
      });

      // can be nested *after* attribute
      testSql({
        intAttr1: {
          [Op.and]: [
            1, 2,
            { [Op.or]: [3, 4] },
            { [Op.not]: 5 },
            [6, 7],
          ],
        },
      }, {
        default: '([intAttr1] = 1 AND [intAttr1] = 2 AND ([intAttr1] = 3 OR [intAttr1] = 4) AND [intAttr1] != 5 AND [intAttr1] IN (6, 7))',
      });

      // can be nested
      testSql({
        [Op.not]: {
          [Op.and]: {
            [Op.or]: {
              [Op.and]: {
                intAttr1: 1,
                intAttr2: 2,
              },
            },
          },
        },
      }, {
        default: 'NOT (((([intAttr1] = 1 AND [intAttr2] = 2))))',
      });

      // Op.not, Op.and, Op.or can reside on the same object as attributes
      testSql({
        intAttr1: 1,
        [Op.not]: {
          intAttr1: { [Op.eq]: 2 },
          [Op.and]: {
            intAttr1: 3,
            [Op.or]: {
              intAttr1: 4,
              [Op.and]: {
                intAttr1: 5,
                intAttr2: 6,
              },
            },
          },
        },
      }, {
        default: 'NOT (((([intAttr1] = 5 AND [intAttr2] = 6) OR [intAttr1] = 4) AND [intAttr1] = 3) AND [intAttr1] = 2) AND [intAttr1] = 1',
      });
    });

    describe('where()', () => {
      {
        // @ts-expect-error -- 'intAttr1' is not a boolean and cannot be compared to the output of 'where'
        const ignore: TestModelWhere = { intAttr1: where(fn('lower', col('name')), null) };
      }

      testSql.skip({ booleanAttr: where(fn('lower', col('name')), null) }, {
        default: `[booleanAttr] = (lower([name]) IS NULL)`,
      });

      describe('where(leftOperand, operator, rightOperand)', () => {
        testSql(where(col('name'), Op.eq, fn('NOW')), {
          default: '[name] = NOW()',
        });

        // some dialects support having a filter inside aggregate functions:
        //  https://github.com/sequelize/sequelize/issues/6666
        testSql(where(fn('sum', { id: 1 }), Op.eq, 1), {
          default: 'sum([id] = 1) = 1',
        });

        // some dialects support having a filter inside aggregate functions, but require casting:
        //  https://github.com/sequelize/sequelize/issues/6666
        testSql(where(fn('sum', cast({ id: 1 }, 'int')), Op.eq, 1), {
          default: 'sum(CAST([id] = 1 AS INT)) = 1',
        });

        // comparing the output of `where` to `where`
        testSql.skip(
          where(
            where(col('col'), Op.eq, '1'),
            Op.eq,
            where(col('col'), Op.eq, '2'),
          ),
          {
            default: '([col] = 1) = ([col] = 2)',
          },
        );

        // TODO: v7
        // comparing literals
        // testSql(
        //   // @ts-expect-error -- not yet supported
        //   where(1, Op.eq, 2),
        //   {
        //     default: '1 = 2',
        //   },
        // );

        // testSql.skip(where(1, Op.eq, col('col')), {
        //   default: '1 = [col]',
        // });
        //
        // testSql.skip(where('string', Op.eq, col('col')), {
        //   default: `'string' = [col]`,
        // });

        testSql.skip(
          // @ts-expect-error -- not yet supported
          where('a', Op.eq, 'b'),
          {
            default: `N'a' = N'b'`,
          },
        );

        // TODO: remove support for string operators.
        //  They're inconsistent. It's better to use a literal or a supported Operator.
        testSql(where(fn('SUM', col('hours')), '>', 0), {
          default: 'SUM([hours]) > 0',
        });

        testSql(where(fn('SUM', col('hours')), Op.gt, 0), {
          default: 'SUM([hours]) > 0',
        });

        testSql(where(fn('lower', col('name')), Op.ne, null), {
          default: 'lower([name]) IS NOT NULL',
        });

        testSql(where(fn('lower', col('name')), Op.not, null), {
          default: 'lower([name]) IS NOT NULL',
        });

        testSql(where(col('hours'), Op.between, [0, 5]), {
          default: '[hours] BETWEEN 0 AND 5',
        });

        testSql(where(col('hours'), Op.notBetween, [0, 5]), {
          default: '[hours] NOT BETWEEN 0 AND 5',
        });

        testSql.skip(where({ [Op.col]: 'hours' }, Op.notBetween, [0, 5]), {
          default: '[hours] NOT BETWEEN 0 AND 5',
        });

        testSql.skip(where(cast({ [Op.col]: 'hours' }, 'integer'), Op.notBetween, [0, 5]), {
          default: 'CAST([hours] AS INTEGER) NOT BETWEEN 0 AND 5',
        });

        testSql.skip(where(fn('SUM', { [Op.col]: 'hours' }), Op.notBetween, [0, 5]), {
          default: 'SUM([hours]) NOT BETWEEN 0 AND 5',
        });

        testSql(where(literal(`'hours'`), Op.eq, 'hours'), {
          default: `'hours' = 'hours'`,
          mssql: `'hours' = N'hours'`,
        });

        // TODO: remove support for this:
        //   - it only works as the first argument of where when 3 parameters are used.
        //   - it's inconsistent with other ways to reference attributes.
        //   - the following variant does not work: where(TestModel.getAttributes().intAttr1, { [Op.eq]: 1 })
        //  to be replaced with Sequelize.attr()
        testSql(where(TestModel.getAttributes().intAttr1, Op.eq, 1), {
          default: '[TestModel].[intAttr1] = 1',
        });

        testSql.skip(where(col('col'), Op.eq, { [Op.in]: [1, 2] }), {
          default: new Error('Unexpected operator Op.in'),
        });
      });

      describe('where(leftOperand, whereAttributeHashValue)', () => {
        testSql(where(fn('lower', col('name')), null), {
          default: 'lower([name]) IS NULL',
        });

        testSql(where(cast(col('name'), 'int'), { [Op.eq]: 10 }), {
          default: 'CAST([name] AS INT) = 10',
        });

        testSql(where(literal('abc'), { [Op.eq]: 10 }), {
          default: 'abc = 10',
        });

        testSql.skip(
          where(col('name'), { [Op.eq]: '123', [Op.not]: { [Op.eq]: '456' } }),
          { default: `[name] = '123' AND NOT ([name] = '456')` },
        );

        testSql.skip(
          where(col('name'), or({ [Op.eq]: '123', [Op.not]: { [Op.eq]: '456' } })),
          { default: `[name] = '123' OR NOT ([name] = '456')` },
        );

        testSql(
          where(col('name'), { [Op.not]: '123' }),
          {
            default: `[name] != '123'`,
            mssql: `[name] != N'123'`,
          },
        );

        testSql(
          // Note: using `col()`, the following is not treated as a json.path.
          //   (yes, it's inconsistant with regular attribute notation. attr could be a good replacement)
          where(col('attribute.path'), 10),
          {
            default: '[attribute].[path] = 10',
          },
        );

        testSql(
          // Note: using `col()`, the following is not treated as a nested.attribute.path.
          //   (yes, it's inconsistant with regular attribute notation. attr could be a good replacement)
          where(col('$attribute.path$'), 10),
          {
            default: '[$attribute].[path$] = 10',
          },
        );

        testSql(where(col('col'), { [Op.and]: [1, 2] }), {
          default: '([col] = 1 AND [col] = 2)',
        });

        // TODO: Either allow json.path.syntax here, or remove WhereAttributeHash from what this version of where() accepts.
        testSql.skip(where(col('col'), { jsonPath: 'value' }), {
          default: new Error('Unexpected key "nested" found, expected an operator.'),
        });
      });
    });
  });
});
