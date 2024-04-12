import type {
  AttributeNames,
  Attributes,
  Cast,
  Col,
  Fn,
  InferAttributes,
  Literal,
  Range,
  WhereOperators,
  WhereOptions,
} from '@sequelize/core';
import { DataTypes, JSON_NULL, Model, Op, SQL_NULL, and, json, or, sql } from '@sequelize/core';
import type { FormatWhereOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';
import { expect } from 'chai';
import { expectTypeOf } from 'expect-type';
import attempt from 'lodash/attempt';
import util from 'node:util';
import { createTester, expectsql, getTestDialectTeaser, sequelize } from '../../support';

const { literal, col, where, fn, cast, attribute } = sql;

const queryGen = sequelize.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character
// when there is no dialect specific expectation but only a default expectation

// TODO: fix and resolve any .skip test

type Expectations = {
  [dialectName: string]: string | Error;
};

const dialectSupportsBigInt = () => sequelize.dialect.supports.dataTypes.BIGINT;
const dialectSupportsArray = () => sequelize.dialect.supports.dataTypes.ARRAY;
const dialectSupportsRange = () => sequelize.dialect.supports.dataTypes.RANGE;
const dialectSupportsJsonB = () => sequelize.dialect.supports.dataTypes.JSONB;
const dialectSupportsJson = () => sequelize.dialect.supports.dataTypes.JSON;
const dialectSupportsJsonOperations = () => sequelize.dialect.supports.jsonOperations;
const dialectSupportsJsonQuotedExtraction = () => sequelize.dialect.supports.jsonExtraction.quoted;
const dialectSupportsJsonUnquotedExtraction = () =>
  sequelize.dialect.supports.jsonExtraction.unquoted;

interface SomeInterface {
  foo: string;
}

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

  declare jsonAttr: object | null;
  declare jsonbAttr: object | null;

  declare aliasedInt: number;
  declare aliasedJsonAttr: object;
  declare aliasedJsonbAttr: object;

  declare jsonbTypeLiteralAttr: { foo: string };
  declare jsonbInterfaceAttr: SomeInterface;

  declare uuidAttr: string;
}

type TestModelWhere = WhereOptions<Attributes<TestModel>>;

describe(getTestDialectTeaser('SQL'), () => {
  before(() => {
    TestModel.init(
      {
        intAttr1: DataTypes.INTEGER,
        intAttr2: DataTypes.INTEGER,
        nullableIntAttr: DataTypes.INTEGER,

        ...(dialectSupportsArray() && {
          intArrayAttr: DataTypes.ARRAY(DataTypes.INTEGER),
          intRangeAttr: DataTypes.RANGE(DataTypes.INTEGER),
          dateRangeAttr: DataTypes.RANGE(DataTypes.DATE(3)),
        }),

        stringAttr: DataTypes.STRING,
        binaryAttr: DataTypes.BLOB,
        dateAttr: DataTypes.DATE(3),
        booleanAttr: DataTypes.BOOLEAN,
        ...(dialectSupportsBigInt() && { bigIntAttr: DataTypes.BIGINT }),

        aliasedInt: { type: DataTypes.INTEGER, field: 'aliased_int' },

        ...(dialectSupportsJson() && {
          jsonAttr: { type: DataTypes.JSON },
          aliasedJsonAttr: { type: DataTypes.JSON, field: 'aliased_json' },
        }),

        ...(dialectSupportsJsonB() && {
          jsonbAttr: { type: DataTypes.JSONB },
          aliasedJsonbAttr: { type: DataTypes.JSONB, field: 'aliased_jsonb' },
          jsonbTypeLiteralAttr: { type: DataTypes.JSONB },
          jsonbInterfaceAttr: { type: DataTypes.JSONB },
        }),

        uuidAttr: DataTypes.UUID,
      },
      { sequelize },
    );
  });

  describe('whereQuery', () => {
    it('prefixes its output with WHERE when it is not empty', () => {
      expectsql(queryGen.whereQuery({ firstName: 'abc' }), {
        default: `WHERE [firstName] = 'abc'`,
        mssql: `WHERE [firstName] = N'abc'`,
      });
    });

    it('returns an empty string if the input results in an empty query', () => {
      expectsql(queryGen.whereQuery({ firstName: { [Op.notIn]: [] } }), {
        default: '',
      });
    });
  });

  describe('whereItemsQuery', () => {
    type IncludesType<Haystack, Needle> = Needle extends any
      ? Extract<Haystack, Needle> extends never
        ? false
        : true
      : never;

    /**
     * 'OperatorsSupportingSequelizeValueMethods' lists all operators
     * that accept values: `col()`, `literal()`, `fn()`, `cast()`, and { [Op.col] }
     */
    type OperatorsSupportingSequelizeValueMethods = keyof {
      [Key in keyof WhereOperators<number> as IncludesType<
        WhereOperators<number>[Key],
        Col | Literal | Fn | Cast | { [Op.col]: string }
      > extends true
        ? Key
        : never]: WhereOperators<number>[Key];
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
      testSql(
        { intAttr1: { [operator]: { [Op.col]: 'intAttr2' } } },
        {
          default: `[intAttr1] ${sqlOperator} [intAttr2]`,
        },
      );

      testSql(
        { intAttr1: { [operator]: col('intAttr2') } },
        {
          default: `[intAttr1] ${sqlOperator} [intAttr2]`,
        },
      );

      testSql(
        { intAttr1: { [operator]: literal('literal') } },
        {
          default: `[intAttr1] ${sqlOperator} literal`,
        },
      );

      testSql(
        { intAttr1: { [operator]: fn('NOW') } },
        {
          default: `[intAttr1] ${sqlOperator} NOW()`,
        },
      );

      testSql(
        { intAttr1: { [operator]: fn('SUM', { [Op.col]: 'intAttr2' }) } },
        {
          default: `[intAttr1] ${sqlOperator} SUM([intAttr2])`,
        },
      );

      testSql(
        { intAttr1: { [operator]: cast(col('intAttr2'), 'string') } },
        {
          default: `[intAttr1] ${sqlOperator} CAST([intAttr2] AS STRING)`,
        },
      );

      testSql(
        { intAttr1: { [operator]: cast({ [Op.col]: 'intAttr2' }, 'string') } },
        {
          default: `[intAttr1] ${sqlOperator} CAST([intAttr2] AS STRING)`,
        },
      );

      testSql(
        { intAttr1: { [operator]: cast(12, 'string') } },
        {
          default: `[intAttr1] ${sqlOperator} CAST(12 AS STRING)`,
        },
      );
    }

    /**
     * 'OperatorsSupportingSequelizeValueMethods' lists all operators
     * that accept values: `col()`, `literal()`, `fn()`, `cast()`, and { [Op.col] }
     */
    type OperatorsSupportingAnyAll<AttributeType> = keyof {
      [Key in keyof WhereOperators<AttributeType> as IncludesType<
        WhereOperators<AttributeType>[Key],
        | { [Op.all]: any[] | Literal | { [Op.values]: any[] } }
        | { [Op.any]: any[] | Literal | { [Op.values]: any[] } }
      > extends true
        ? Key
        : never]: WhereOperators<AttributeType>[Key];
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
     * @param attributeName
     */
    function testSupportsAnyAll<TestWithValue>(
      operator: OperatorsSupportingAnyAll<TestWithValue>,
      sqlOperator: string,
      testWithValues: TestWithValue[],
      attributeName: AttributeNames<TestModel> = 'intAttr1',
    ) {
      if (!dialectSupportsArray()) {
        return;
      }

      const arrayOperators: Array<[jsOp: symbol, sqlOp: string]> = [
        [Op.any, 'ANY'],
        [Op.all, 'ALL'],
      ];

      for (const [arrayOperator, arraySqlOperator] of arrayOperators) {
        testSql(
          { [attributeName]: { [operator]: { [arrayOperator]: testWithValues } } },
          {
            default: `[${attributeName}] ${sqlOperator} ${arraySqlOperator} (ARRAY[${testWithValues.map(v => util.inspect(v)).join(',')}])`,
            postgres: `"${attributeName}" ${sqlOperator} ${arraySqlOperator} (ARRAY[${testWithValues.map(v => util.inspect(v)).join(',')}]${attributeName === 'stringAttr' ? '::VARCHAR(255)[]' : ''})`,
          },
        );

        testSql(
          { [attributeName]: { [operator]: { [arrayOperator]: literal('literal') } } },
          {
            default: `[${attributeName}] ${sqlOperator} ${arraySqlOperator} (literal)`,
          },
        );

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql(
          {
            [attributeName]: {
              [operator]: {
                [arrayOperator]: {
                  [Op.values]: [
                    literal('literal'),
                    fn('UPPER', col('col2')),
                    col('col3'),
                    cast(col('col'), 'string'),
                    testWithValues[0],
                  ],
                },
              },
            },
          },
          {
            default: `[${attributeName}] ${sqlOperator} ${arraySqlOperator} (VALUES (literal), (UPPER("col2")), ("col3"), (CAST("col" AS STRING)), (${util.inspect(testWithValues[0])}))`,
          },
        );
      }
    }

    const testSql = createTester(
      (it, whereObj: TestModelWhere, expectations: Expectations, options?: FormatWhereOptions) => {
        it(
          util.inspect(whereObj, { depth: 10 }) + (options ? `, ${util.inspect(options)}` : ''),
          () => {
            const sqlOrError = attempt(() =>
              queryGen.whereItemsQuery(whereObj, {
                ...options,
                model: TestModel,
              }),
            );

            return expectsql(sqlOrError, expectations);
          },
        );
      },
    );

    // "where" is typically optional. If the user sets it to undefined, we treat is as if the option was not set.
    testSql(undefined, {
      default: '',
    });

    testSql(
      {},
      {
        default: '',
      },
    );

    testSql([], {
      default: '',
    });

    // @ts-expect-error -- not supported, testing that it throws
    testSql(null, {
      default:
        new Error(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.
Value: null
Caused by: Invalid Query: expected a plain object, an array or a sequelize SQL method but got null`),
    });

    // @ts-expect-error -- not supported, testing that it throws
    testSql(10, {
      default:
        new Error(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.
Value: 10
Caused by: Invalid Query: expected a plain object, an array or a sequelize SQL method but got 10`),
    });

    testSql(
      { intAttr1: undefined },
      {
        default:
          new Error(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.
Value: { intAttr1: undefined }
Caused by: "undefined" cannot be escaped`),
      },
    );

    testSql(
      // @ts-expect-error -- user does not exist
      { intAttr1: 1, user: undefined },
      { default: new Error('"undefined" cannot be escaped') },
    );

    testSql(
      { intAttr1: 1 },
      {
        default: '[User].[intAttr1] = 1',
      },
      { mainAlias: 'User' },
    );

    testSql(
      { dateAttr: { $gte: '2022-11-06' } },
      { default: new Error(`{ '$gte': '2022-11-06' } is not a valid date`) },
    );

    testSql(literal('raw sql'), {
      default: 'raw sql',
    });

    describe('value serialization', () => {
      // string
      testSql(
        { stringAttr: '1' },
        {
          default: `[stringAttr] = '1'`,
          mssql: `[stringAttr] = N'1'`,
        },
      );

      testSql(
        {
          stringAttr: 'here is a null char: \0',
        },
        {
          default: "[stringAttr] = 'here is a null char: \\0'",
          snowflake: '"stringAttr" = \'here is a null char: \0\'',
          mssql: "[stringAttr] = N'here is a null char: \0'",
          db2: '"stringAttr" = \'here is a null char: \0\'',
          ibmi: '"stringAttr" = \'here is a null char: \0\'',
          sqlite3: "`stringAttr` = 'here is a null char: \0'",
        },
      );

      testSql(
        {
          dateAttr: 1_356_998_400_000,
        },
        {
          default: `[dateAttr] = '2013-01-01 00:00:00.000 +00:00'`,
          'mariadb mysql': `\`dateAttr\` = '2013-01-01 00:00:00.000'`,
          mssql: `[dateAttr] = N'2013-01-01 00:00:00.000 +00:00'`,
          'db2 snowflake ibmi': `"dateAttr" = '2013-01-01 00:00:00.000'`,
        },
      );

      describe('Buffer', () => {
        testSql(
          { binaryAttr: Buffer.from('Sequelize') },
          {
            ibmi: `"binaryAttr" = BLOB(X'53657175656c697a65')`,
            postgres: `"binaryAttr" = '\\x53657175656c697a65'`,
            'sqlite3 mariadb mysql': "`binaryAttr` = X'53657175656c697a65'",
            db2: `"binaryAttr" = BLOB('Sequelize')`,
            snowflake: `"binaryAttr" = X'53657175656c697a65'`,
            mssql: '[binaryAttr] = 0x53657175656c697a65',
          },
        );

        // Including a quote (') to ensure dialects that don't convert to hex are safe from SQL injection.
        testSql(
          { binaryAttr: [Buffer.from(`Seque'lize1`), Buffer.from('Sequelize2')] },
          {
            ibmi: `"binaryAttr" IN (BLOB(X'5365717565276c697a6531'), BLOB(X'53657175656c697a6532'))`,
            postgres: `"binaryAttr" IN ('\\x5365717565276c697a6531', '\\x53657175656c697a6532')`,
            'sqlite3 mariadb mysql':
              "`binaryAttr` IN (X'5365717565276c697a6531', X'53657175656c697a6532')",
            db2: `"binaryAttr" IN (BLOB('Seque''lize1'), BLOB('Sequelize2'))`,
            snowflake: `"binaryAttr" IN (X'5365717565276c697a6531', X'53657175656c697a6532')`,
            mssql: '[binaryAttr] IN (0x5365717565276c697a6531, 0x53657175656c697a6532)',
          },
        );
      });
    });

    describe('implicit operator', () => {
      testSql(
        { intAttr1: 1 },
        {
          default: '[intAttr1] = 1',
        },
      );

      testSql(
        { stringAttr: '1' },
        {
          default: `[stringAttr] = '1'`,
          mssql: `[stringAttr] = N'1'`,
        },
      );

      testSql(
        { intAttr1: [1, 2] },
        {
          default: '[intAttr1] IN (1, 2)',
        },
      );

      testSql(
        { stringAttr: ['1', '2'] },
        {
          default: `[stringAttr] IN ('1', '2')`,
          mssql: `[stringAttr] IN (N'1', N'2')`,
        },
      );

      testSql(
        { intAttr1: ['not-an-int'] },
        { default: new Error(`'not-an-int' is not a valid integer`) },
      );

      testSql(
        { 'stringAttr::integer': 1 },
        {
          default: 'CAST([stringAttr] AS INTEGER) = 1',
        },
      );

      testSql(
        { $intAttr1$: 1 },
        {
          default: '[intAttr1] = 1',
        },
      );

      testSql(
        { '$stringAttr$::integer': 1 },
        {
          default: 'CAST([stringAttr] AS INTEGER) = 1',
        },
      );

      testSql(
        { '$association.attribute$': 1 },
        {
          default: '[association].[attribute] = 1',
        },
      );

      testSql(
        { '$association.attribute$::integer': 1 },
        {
          default: 'CAST([association].[attribute] AS INTEGER) = 1',
        },
      );

      testSql(
        { booleanAttr: true },
        {
          default: `[booleanAttr] = true`,
          mssql: '[booleanAttr] = 1',
          sqlite3: '`booleanAttr` = 1',
          ibmi: '"booleanAttr" = 1',
        },
      );

      testSql(
        {
          stringAttr: 'a project',
          intAttr1: {
            [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }],
          },
        },
        {
          default: "[stringAttr] = 'a project' AND ([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10)",
          mssql: "[stringAttr] = N'a project' AND ([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10)",
        },
      );

      testSql(
        { nullableIntAttr: null },
        {
          default: '[nullableIntAttr] IS NULL',
        },
      );

      testSql(
        { nullableIntAttr: SQL_NULL },
        {
          default: '[nullableIntAttr] IS NULL',
        },
      );

      testSql(
        { dateAttr: new Date('2021-01-01T00:00:00Z') },
        {
          default: `[dateAttr] = '2021-01-01 00:00:00.000 +00:00'`,
          mssql: `[dateAttr] = N'2021-01-01 00:00:00.000 +00:00'`,
          'mariadb mysql': `\`dateAttr\` = '2021-01-01 00:00:00.000'`,
          'db2 ibmi snowflake': `"dateAttr" = '2021-01-01 00:00:00.000'`,
        },
      );

      testSql(
        { intAttr1: { [Op.col]: 'intAttr2' } },
        {
          default: '[intAttr1] = [intAttr2]',
        },
      );

      testSql(
        { intAttr1: col('intAttr2') },
        {
          default: '[intAttr1] = [intAttr2]',
        },
      );

      testSql(
        { intAttr1: literal('literal') },
        {
          default: '[intAttr1] = literal',
        },
      );

      testSql(
        { stringAttr: fn('UPPER', col('stringAttr')) },
        {
          default: '[stringAttr] = UPPER([stringAttr])',
        },
      );

      testSql(
        { stringAttr: fn('UPPER', { [Op.col]: 'stringAttr' }) },
        {
          default: '[stringAttr] = UPPER([stringAttr])',
        },
      );

      testSql(
        { stringAttr: cast(col('intAttr1'), 'string') },
        {
          default: '[stringAttr] = CAST([intAttr1] AS STRING)',
        },
      );

      testSql(
        { stringAttr: cast({ [Op.col]: 'intAttr1' }, 'string') },
        {
          default: '[stringAttr] = CAST([intAttr1] AS STRING)',
        },
      );

      testSql(
        { stringAttr: cast('abc', 'string') },
        {
          default: `[stringAttr] = CAST('abc' AS STRING)`,
          mssql: `[stringAttr] = CAST(N'abc' AS STRING)`,
        },
      );

      if (dialectSupportsArray()) {
        testSql(
          { intArrayAttr: [1, 2] },
          {
            default: `[intArrayAttr] = ARRAY[1,2]`,
          },
        );

        testSql(
          { intArrayAttr: [] },
          {
            default: `[intArrayAttr] = ARRAY[]::INTEGER[]`,
          },
        );

        // when using arrays, Op.in is never included
        testSql(
          // @ts-expect-error -- Omitting the operator with an array attribute is always Op.eq, never Op.in
          { intArrayAttr: [[1, 2]] },
          { default: new Error('[ 1, 2 ] is not a valid integer') },
        );

        testSql(
          { intAttr1: { [Op.any]: [2, 3, 4] } },
          {
            default: '[intAttr1] = ANY (ARRAY[2,3,4])',
          },
        );

        testSql(
          { intAttr1: { [Op.any]: literal('literal') } },
          {
            default: '[intAttr1] = ANY (literal)',
          },
        );

        testSql(
          { intAttr1: { [Op.any]: { [Op.values]: [col('col')] } } },
          {
            default: '[intAttr1] = ANY (VALUES ([col]))',
          },
        );

        testSql(
          { intAttr1: { [Op.all]: [2, 3, 4] } },
          {
            default: '[intAttr1] = ALL (ARRAY[2,3,4])',
          },
        );

        testSql(
          { intAttr1: { [Op.all]: literal('literal') } },
          {
            default: '[intAttr1] = ALL (literal)',
          },
        );

        testSql(
          { intAttr1: { [Op.all]: { [Op.values]: [col('col')] } } },
          {
            default: '[intAttr1] = ALL (VALUES ([col]))',
          },
        );

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql(
          {
            intAttr1: {
              [Op.any]: {
                [Op.values]: [
                  literal('literal'),
                  fn('UPPER', col('col2')),
                  col('col3'),
                  cast(col('col'), 'string'),
                  1,
                ],
              },
            },
          },
          {
            default: `[intAttr1] = ANY (VALUES (literal), (UPPER([col2])), ([col3]), (CAST([col] AS STRING)), (1))`,
          },
        );
      }
    });

    describe('Op.eq', () => {
      testSql(
        { intAttr1: { [Op.eq]: 1 } },
        {
          default: '[intAttr1] = 1',
        },
      );

      testSql(
        { 'intAttr1::integer': { [Op.eq]: 1 } },
        {
          default: 'CAST([intAttr1] AS INTEGER) = 1',
        },
      );

      testSql(
        { $intAttr1$: { [Op.eq]: 1 } },
        {
          default: '[intAttr1] = 1',
        },
      );

      testSql(
        { '$intAttr1$::integer': { [Op.eq]: 1 } },
        {
          default: 'CAST([intAttr1] AS INTEGER) = 1',
        },
      );

      testSql(
        { '$association.attribute$': { [Op.eq]: 1 } },
        {
          default: '[association].[attribute] = 1',
        },
      );

      testSql(
        { '$association.attribute$::integer': { [Op.eq]: 1 } },
        {
          default: `CAST([association].[attribute] AS INTEGER) = 1`,
        },
      );

      if (dialectSupportsArray()) {
        // @ts-expect-error -- intArrayAttr is not an array
        const ignore: TestModelWhere = { intAttr1: { [Op.eq]: [1, 2] } };

        testSql(
          { intArrayAttr: { [Op.eq]: [1, 2] } },
          {
            default: '[intArrayAttr] = ARRAY[1,2]',
          },
        );
      }

      {
        // @ts-expect-error -- intAttr1 is not nullable
        const ignore: TestModelWhere = { intAttr1: { [Op.eq]: null } };

        // this one is
        testSql(
          { nullableIntAttr: { [Op.eq]: null } },
          {
            default: '[nullableIntAttr] IS NULL',
          },
        );
      }

      testSql(
        { booleanAttr: { [Op.eq]: true } },
        {
          default: '[booleanAttr] = true',
          'mssql sqlite3 ibmi': '[booleanAttr] = 1',
        },
      );

      testSequelizeValueMethods(Op.eq, '=');
      testSupportsAnyAll(Op.eq, '=', [2, 3, 4]);
    });

    describe('Op.ne', () => {
      testSql(
        { intAttr1: { [Op.ne]: 1 } },
        {
          default: '[intAttr1] != 1',
        },
      );

      if (dialectSupportsArray()) {
        testSql(
          { intArrayAttr: { [Op.ne]: [1, 2] } },
          {
            default: '[intArrayAttr] != ARRAY[1,2]',
          },
        );
      }

      testSql(
        { nullableIntAttr: { [Op.ne]: null } },
        {
          default: '[nullableIntAttr] IS NOT NULL',
        },
      );

      testSql(
        { booleanAttr: { [Op.ne]: true } },
        {
          default: '[booleanAttr] != true',
          'mssql ibmi sqlite3': '[booleanAttr] != 1',
        },
      );

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

      testSql(
        { nullableIntAttr: { [Op.is]: null } },
        {
          default: '[nullableIntAttr] IS NULL',
        },
      );

      testSql(
        { nullableIntAttr: { [Op.is]: SQL_NULL } },
        {
          default: '[nullableIntAttr] IS NULL',
        },
      );

      testSql(
        { booleanAttr: { [Op.is]: false } },
        {
          default: '[booleanAttr] IS false',
          'mssql ibmi sqlite3': '[booleanAttr] IS 0',
        },
      );

      testSql(
        { booleanAttr: { [Op.is]: true } },
        {
          default: '[booleanAttr] IS true',
          'mssql ibmi sqlite3': '[booleanAttr] IS 1',
        },
      );

      testSql(
        // @ts-expect-error -- not supported, testing that it throws
        { intAttr1: { [Op.is]: 1 } },
        {
          default: new Error(
            'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
          ),
        },
      );

      testSql(
        // @ts-expect-error -- not supported, testing that it throws
        { intAttr1: { [Op.is]: { [Op.col]: 'intAttr2' } } },
        {
          default: new Error(
            'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
          ),
        },
      );

      testSql(
        // @ts-expect-error -- not supported, testing that it throws
        { intAttr1: { [Op.is]: col('intAttr2') } },
        {
          default: new Error(
            'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
          ),
        },
      );

      testSql(
        { intAttr1: { [Op.is]: literal('UNKNOWN') } },
        {
          default: '[intAttr1] IS UNKNOWN',
        },
      );

      testSql(
        // @ts-expect-error -- not supported, testing that it throws
        { intAttr1: { [Op.is]: fn('UPPER', col('intAttr2')) } },
        {
          default: new Error(
            'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
          ),
        },
      );

      testSql(
        // @ts-expect-error -- not supported, testing that it throws
        { intAttr1: { [Op.is]: cast(col('intAttr2'), 'boolean') } },
        {
          default: new Error(
            'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
          ),
        },
      );

      if (dialectSupportsArray()) {
        testSql(
          // @ts-expect-error -- not supported, testing that it throws
          { intAttr1: { [Op.is]: { [Op.any]: [2, 3] } } },
          {
            default: new Error(
              'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
            ),
          },
        );

        testSql(
          // @ts-expect-error -- not supported, testing that it throws
          { intAttr1: { [Op.is]: { [Op.all]: [2, 3, 4] } } },
          {
            default: new Error(
              'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
            ),
          },
        );
      }
    });

    describe('Op.isNot', () => {
      testSql(
        { nullableIntAttr: { [Op.isNot]: null } },
        {
          default: '[nullableIntAttr] IS NOT NULL',
        },
      );

      testSql(
        { booleanAttr: { [Op.isNot]: false } },
        {
          default: '[booleanAttr] IS NOT false',
          'mssql ibmi sqlite3': '[booleanAttr] IS NOT 0',
        },
      );

      testSql(
        { booleanAttr: { [Op.isNot]: true } },
        {
          default: '[booleanAttr] IS NOT true',
          'mssql ibmi sqlite3': '[booleanAttr] IS NOT 1',
        },
      );
    });

    describe('Op.not', () => {
      testSql(
        { [Op.not]: {} },
        {
          default: '',
        },
      );

      testSql(
        {
          [Op.not]: {
            [Op.not]: {},
          },
        },
        {
          default: '',
        },
      );

      testSql(
        { [Op.not]: [] },
        {
          default: '',
        },
      );

      testSql(
        { nullableIntAttr: { [Op.not]: {} } },
        {
          default: '',
        },
      );

      testSql(
        { nullableIntAttr: { [Op.not]: null } },
        {
          default: 'NOT ([nullableIntAttr] IS NULL)',
        },
      );

      testSql(
        { booleanAttr: { [Op.not]: false } },
        {
          default: 'NOT ([booleanAttr] = false)',
          mssql: 'NOT ([booleanAttr] = 0)',
          ibmi: 'NOT ("booleanAttr" = 0)',
          sqlite3: 'NOT (`booleanAttr` = 0)',
        },
      );

      testSql(
        { booleanAttr: { [Op.not]: true } },
        {
          default: 'NOT ([booleanAttr] = true)',
          mssql: 'NOT ([booleanAttr] = 1)',
          ibmi: 'NOT ("booleanAttr" = 1)',
          sqlite3: 'NOT (`booleanAttr` = 1)',
        },
      );

      testSql(
        { intAttr1: { [Op.not]: 1 } },
        {
          default: 'NOT ([intAttr1] = 1)',
        },
      );

      testSql(
        { intAttr1: { [Op.not]: [1, 2] } },
        {
          default: 'NOT ([intAttr1] IN (1, 2))',
        },
      );

      {
        // @ts-expect-error -- not a valid query: attribute does not exist.
        const ignore: TestModelWhere = { [Op.not]: { doesNotExist: 5 } };
      }

      testSql(
        { [Op.not]: { intAttr1: 5 } },
        {
          default: 'NOT ([intAttr1] = 5)',
        },
      );

      testSql(
        { [Op.not]: { intAttr1: { [Op.gt]: 5 } } },
        {
          default: 'NOT ([intAttr1] > 5)',
        },
      );

      testSql(
        { [Op.not]: where(col('intAttr1'), Op.eq, '5') },
        {
          default: `NOT ([intAttr1] = '5')`,
          mssql: `NOT ([intAttr1] = N'5')`,
        },
      );

      if (dialectSupportsJsonOperations() && dialectSupportsJsonQuotedExtraction()) {
        testSql(
          { [Op.not]: json('data.key', 10) },
          {
            postgres: `NOT ("data"->'key' = '10')`,
            sqlite3: `NOT (json_extract(\`data\`,'$.key') = '10')`,
            mariadb: `NOT (json_compact(json_extract(\`data\`,'$.key')) = '10')`,
            mysql: `NOT (json_extract(\`data\`,'$.key') = CAST('10' AS JSON))`,
          },
        );
      }

      testSql(
        { intAttr1: { [Op.not]: { [Op.gt]: 5 } } },
        {
          default: 'NOT ([intAttr1] > 5)',
        },
      );
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
          testSql(
            { intAttr1: { [operator]: 1 } },
            {
              default: `[intAttr1] ${sqlOperator} 1`,
            },
          );
        }

        {
          const ignore: TestModelWhere = { stringAttr: { [Op.gt]: 'abc' } };
          testSql(
            { stringAttr: { [operator]: 'abc' } },
            {
              default: `[stringAttr] ${sqlOperator} 'abc'`,
              mssql: `[stringAttr] ${sqlOperator} N'abc'`,
            },
          );
        }

        if (dialectSupportsArray()) {
          const ignore: TestModelWhere = { intArrayAttr: { [Op.gt]: [1, 2] } };
          testSql(
            { intArrayAttr: { [operator]: [1, 2] } },
            {
              default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2]`,
            },
          );
        }

        expectTypeOf({ intAttr1: { [Op.gt]: null } }).not.toMatchTypeOf<WhereOperators>();
        testSql(
          { intAttr1: { [operator]: null } },
          {
            default: `[intAttr1] ${sqlOperator} NULL`,
          },
        );

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
      expectTypeOf<WhereOperators[typeof Op.between]>().toEqualTypeOf<
        WhereOperators[typeof Op.notBetween]
      >();

      describe(`Op.${operator.description}`, () => {
        expectTypeOf({ id: { [Op.between]: [1, 2] } }).toMatchTypeOf<TestModelWhere>();
        expectTypeOf({
          id: { [Op.between]: [new Date(), new Date()] },
        }).toMatchTypeOf<TestModelWhere>();
        expectTypeOf({ id: { [Op.between]: ['a', 'b'] } }).toMatchTypeOf<TestModelWhere>();

        // expectTypeOf doesn't work with this one:
        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [1, 2] },
          };

          testSql(
            { intAttr1: { [operator]: [1, 2] } },
            {
              default: `[intAttr1] ${sqlOperator} 1 AND 2`,
            },
          );

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.between]: [1, 2, 3] } };

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong2: TestModelWhere = { intAttr1: { [Op.between]: [1] } };

          testSql(
            { intAttr1: { [operator]: [1] } },
            {
              default: new Error(
                'Operators Op.between and Op.notBetween must be used with an array of two values, or a literal.',
              ),
            },
          );

          // @ts-expect-error -- must pass exactly 2 items
          const ignoreWrong3: TestModelWhere = { intAttr1: { [Op.between]: [] } };
        }

        if (dialectSupportsArray()) {
          {
            const ignoreRight: TestModelWhere = {
              intArrayAttr: {
                [Op.between]: [
                  [1, 2],
                  [3, 4],
                ],
              },
            };
            testSql(
              {
                intArrayAttr: {
                  [operator]: [
                    [1, 2],
                    [3, 4],
                  ],
                },
              },
              {
                default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2] AND ARRAY[3,4]`,
              },
            );
          }

          {
            // @ts-expect-error -- this is not valid because intAttr1 is not an array and cannot be compared to arrays
            const ignore: TestModelWhere = {
              intAttr1: {
                [Op.between]: [
                  [1, 2],
                  [3, 4],
                ],
              },
            };
          }
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [col('col1'), col('col2')] },
          };
          testSql(
            { intAttr1: { [operator]: [col('col1'), col('col2')] } },
            {
              default: `[intAttr1] ${sqlOperator} [col1] AND [col2]`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [literal('literal1'), literal('literal2')] },
          };
          testSql(
            { intAttr1: { [operator]: [literal('literal1'), literal('literal2')] } },
            {
              default: `[intAttr1] ${sqlOperator} literal1 AND literal2`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [fn('NOW'), fn('NOW')] },
          };
          testSql(
            { intAttr1: { [operator]: [fn('NOW'), fn('NOW')] } },
            {
              default: `[intAttr1] ${sqlOperator} NOW() AND NOW()`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] },
          };
          testSql(
            { intAttr1: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } },
            {
              default: `[intAttr1] ${sqlOperator} [col1] AND [col2]`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: [cast(col('col'), 'string'), cast(col('col'), 'string')] },
          };
          testSql(
            { intAttr1: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } },
            {
              default: `[intAttr1] ${sqlOperator} CAST([col] AS STRING) AND CAST([col] AS STRING)`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.between]: literal('literal1 AND literal2') },
          };
          testSql(
            { intAttr1: { [operator]: literal('literal1 AND literal2') } },
            {
              default: `[intAttr1] ${sqlOperator} literal1 AND literal2`,
            },
          );
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
      expectTypeOf<WhereOperators[typeof Op.between]>().toEqualTypeOf<
        WhereOperators[typeof Op.notBetween]
      >();

      describe(`Op.${operator.description}`, () => {
        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [1, 2, 3] } };
          testSql(
            { intAttr1: { [operator]: [1, 2, 3] } },
            {
              default: `[intAttr1] ${sqlOperator} (1, 2, 3)`,
            },
          );
        }

        if (dialectSupportsArray()) {
          {
            // valid
            const ignore: TestModelWhere = {
              intArrayAttr: {
                [Op.in]: [
                  [1, 2],
                  [3, 4],
                ],
              },
            };
            testSql(
              {
                intArrayAttr: {
                  [operator]: [
                    [1, 2],
                    [3, 4],
                  ],
                },
              },
              {
                default: `[intArrayAttr] ${sqlOperator} (ARRAY[1,2], ARRAY[3,4])`,
              },
            );
          }

          {
            // @ts-expect-error -- intAttr1 is not an array
            const ignore: TestModelWhere = {
              intAttr1: {
                [Op.in]: [
                  [1, 2],
                  [3, 4],
                ],
              },
            };
            testSql(
              {
                intArrayAttr: {
                  [operator]: [
                    [1, 2],
                    [3, 4],
                  ],
                },
              },
              {
                default: `[intArrayAttr] ${sqlOperator} (ARRAY[1,2], ARRAY[3,4])`,
              },
            );
          }
        }

        {
          // @ts-expect-error -- this is invalid because intAttr1 is not an array and cannot be compared to arrays.
          const ignore: TestModelWhere = {
            intAttr1: {
              [Op.in]: [
                [1, 2],
                [3, 4],
              ],
            },
          };
        }

        {
          // @ts-expect-error -- not supported, testing that it throws
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: 1 } };
          testSql(
            { intAttr1: { [operator]: 1 } },
            {
              default: new Error(
                'Operators Op.in and Op.notIn must be called with an array of values, or a literal',
              ),
            },
          );
        }

        {
          // @ts-expect-error -- not supported, testing that it throws
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: col('col2') } };
          testSql(
            { intAttr1: { [operator]: col('col1') } },
            {
              default: new Error(
                'Operators Op.in and Op.notIn must be called with an array of values, or a literal',
              ),
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [col('col1'), col('col2')] } };
          testSql(
            { intAttr1: { [operator]: [col('col1'), col('col2')] } },
            {
              default: `[intAttr1] ${sqlOperator} ([col1], [col2])`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.in]: [literal('literal1'), literal('literal2')] },
          };
          testSql(
            { intAttr1: { [operator]: [literal('literal1'), literal('literal2')] } },
            {
              default: `[intAttr1] ${sqlOperator} (literal1, literal2)`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: [fn('NOW'), fn('NOW')] } };
          testSql(
            { intAttr1: { [operator]: [fn('NOW'), fn('NOW')] } },
            {
              default: `[intAttr1] ${sqlOperator} (NOW(), NOW())`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.in]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] },
          };
          testSql(
            { intAttr1: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } },
            {
              default: `[intAttr1] ${sqlOperator} ([col1], [col2])`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intAttr1: { [Op.in]: [cast(col('col'), 'string'), cast(col('col'), 'string')] },
          };
          testSql(
            { intAttr1: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } },
            {
              default: `[intAttr1] ${sqlOperator} (CAST([col] AS STRING), CAST([col] AS STRING))`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = { intAttr1: { [Op.in]: literal('literal') } };
          testSql(
            { intAttr1: { [operator]: literal('literal') } },
            {
              default: `[intAttr1] ${sqlOperator} literal`,
            },
          );
        }

        {
          // @ts-expect-error -- Op.all is not compatible with Op.in
          const ignoreWrong: TestModelWhere = { intAttr1: { [Op.in]: { [Op.all]: [] } } };
        }

        extraTests();
      });
    }

    describeInSuite(Op.in, 'IN', () => {
      testSql(
        { intAttr1: { [Op.in]: [] } },
        {
          default: '[intAttr1] IN (NULL)',
        },
      );
    });

    describeInSuite(Op.notIn, 'NOT IN', () => {
      testSql(
        { intAttr1: { [Op.notIn]: [] } },
        {
          default: '',
        },
      );
    });

    function describeLikeSuite(
      operator: typeof Op.like | typeof Op.notLike | typeof Op.iLike | typeof Op.notILike,
      sqlOperator: string,
    ) {
      // ensure like ops support the same typings, so we only have to test their typings once.
      // unfortunately, at time of writing (TS 4.5.5), TypeScript
      //  does not detect an error in `{ [operator]: null }`
      //  but it does detect an error in { [Op.iLike]: null }`
      expectTypeOf<WhereOperators[typeof Op.notLike]>().toEqualTypeOf<
        WhereOperators[typeof Op.like]
      >();
      expectTypeOf<WhereOperators[typeof Op.iLike]>().toEqualTypeOf<
        WhereOperators[typeof Op.like]
      >();
      expectTypeOf<WhereOperators[typeof Op.notILike]>().toEqualTypeOf<
        WhereOperators[typeof Op.like]
      >();

      describe(`Op.${operator.description}`, () => {
        expectTypeOf({ stringAttr: { [Op.like]: '%id' } }).toMatchTypeOf<TestModelWhere>();
        testSql(
          { stringAttr: { [operator]: '%id' } },
          {
            default: `[stringAttr] ${sqlOperator} '%id'`,
            mssql: `[stringAttr] ${sqlOperator} N'%id'`,
          },
        );

        // This test checks that the right data type is used to stringify the right operand
        testSql(
          { 'intAttr1::text': { [operator]: '%id' } },
          {
            default: `CAST([intAttr1] AS TEXT) ${sqlOperator} '%id'`,
            mssql: `CAST([intAttr1] AS TEXT) ${sqlOperator} N'%id'`,
          },
        );

        testSequelizeValueMethods(operator, sqlOperator);
        testSupportsAnyAll(operator, sqlOperator, ['a', 'b', 'c'], 'stringAttr');
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
      expectTypeOf<WhereOperators[typeof Op.contains]>().toEqualTypeOf<
        WhereOperators[typeof Op.overlap]
      >();
      expectTypeOf<WhereOperators[typeof Op.contained]>().toEqualTypeOf<
        WhereOperators[typeof Op.overlap]
      >();

      if (dialectSupportsArray()) {
        describe(`Op.${operator.description} on ARRAY`, () => {
          {
            const ignoreRight: TestModelWhere = { intArrayAttr: { [Op.overlap]: [1, 2, 3] } };
            testSql(
              { intArrayAttr: { [operator]: [1, 2, 3] } },
              {
                default: `[intArrayAttr] ${sqlOperator} ARRAY[1,2,3]`,
              },
            );
          }

          testSequelizeValueMethods(operator, sqlOperator);
          // ARRAY Overlap ARRAY doesn't support ANY or ALL, except with VALUES
          // testSupportsAnyAll(operator, sqlOperator, [[1, 2], [1, 2]]);

          {
            const ignore: TestModelWhere = {
              // @ts-expect-error -- cannot compare an array with a range!
              intArrayAttr: { [Op.overlap]: [1, { value: 2, inclusive: true }] },
            };
            testSql(
              { intArrayAttr: { [operator]: [1, { value: 2, inclusive: true }] } },
              {
                default: new Error('{ value: 2, inclusive: true } is not a valid integer'),
              },
            );
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = { intArrayAttr: { [Op.overlap]: [col('col')] } };
            testSql(
              { intArrayAttr: { [operator]: [col('col')] } },
              {
                default: new Error(`Col { identifiers: [ 'col' ] } is not a valid integer`),
              },
            );
          }

          {
            const ignoreWrong: TestModelWhere = {
              // @ts-expect-error -- not supported, testing that it throws
              intArrayAttr: { [Op.overlap]: [{ [Op.col]: 'col' }] },
            };
            testSql(
              { intArrayAttr: { [operator]: [{ [Op.col]: 'col' }] } },
              {
                default: new Error(`{ [Symbol(col)]: 'col' } is not a valid integer`),
              },
            );
          }

          {
            // @ts-expect-error -- not supported, testing that it throws
            const ignoreWrong: TestModelWhere = {
              intArrayAttr: { [Op.overlap]: [literal('literal')] },
            };
            testSql(
              { intArrayAttr: { [operator]: [literal('literal')] } },
              {
                default: new Error(`Literal { val: [ 'literal' ] } is not a valid integer`),
              },
            );
          }
        });
      }

      if (dialectSupportsRange()) {
        describe(`Op.${operator.description} on RANGE`, () => {
          {
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2] } };
            testSql(
              { intRangeAttr: { [operator]: [1, 2] } },
              {
                default: `[intRangeAttr] ${sqlOperator} '[1,2)'::int4range`,
              },
            );
          }

          {
            const ignoreRight: TestModelWhere = {
              intRangeAttr: { [Op.overlap]: [1, { value: 2, inclusive: true }] },
            };
            testSql(
              { intRangeAttr: { [operator]: [1, { value: 2, inclusive: true }] } },
              {
                // used 'postgres' because otherwise range is transformed to "1,2"
                postgres: `"intRangeAttr" ${sqlOperator} '[1,2]'::int4range`,
              },
            );
          }

          {
            const ignoreRight: TestModelWhere = {
              intRangeAttr: { [Op.overlap]: [{ value: 1, inclusive: false }, 2] },
            };
            testSql(
              { intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, 2] } },
              {
                default: `[intRangeAttr] ${sqlOperator} '(1,2)'::int4range`,
              },
            );
          }

          {
            const ignoreRight: TestModelWhere = {
              intRangeAttr: {
                [Op.overlap]: [
                  { value: 1, inclusive: false },
                  { value: 2, inclusive: false },
                ],
              },
            };
            testSql(
              {
                intRangeAttr: {
                  [operator]: [
                    { value: 1, inclusive: false },
                    { value: 2, inclusive: false },
                  ],
                },
              },
              {
                default: `[intRangeAttr] ${sqlOperator} '(1,2)'::int4range`,
              },
            );
          }

          {
            // unbounded range (right)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [10, null] } };
            testSql(
              {
                intRangeAttr: { [operator]: [10, null] },
              },
              {
                postgres: `"intRangeAttr" ${sqlOperator} '[10,)'::int4range`,
              },
            );
          }

          {
            // unbounded range (left)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [null, 10] } };
            testSql(
              {
                intRangeAttr: { [operator]: [null, 10] },
              },
              {
                postgres: `"intRangeAttr" ${sqlOperator} '[,10)'::int4range`,
              },
            );
          }

          {
            // unbounded range (left)
            const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.overlap]: [null, null] } };
            testSql(
              {
                intRangeAttr: { [operator]: [null, null] },
              },
              {
                postgres: `"intRangeAttr" ${sqlOperator} '[,)'::int4range`,
              },
            );
          }

          {
            const ignoreRight: TestModelWhere = {
              dateRangeAttr: { [Op.overlap]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] },
            };

            testSql(
              {
                dateRangeAttr: {
                  [operator]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
                },
              },
              {
                postgres: `"dateRangeAttr" ${sqlOperator} '[-infinity,infinity)'::tstzrange`,
              },
            );
          }

          {
            // empty range
            const ignoreRight: TestModelWhere = { dateRangeAttr: { [Op.overlap]: [] } };

            testSql(
              {
                dateRangeAttr: { [operator]: [] },
              },
              {
                postgres: `"dateRangeAttr" ${sqlOperator} 'empty'::tstzrange`,
              },
            );
          }

          {
            // @ts-expect-error -- 'intRangeAttr' is a range, but right-hand side is a regular Array
            const ignore: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2, 3] } };
            testSql(
              { intRangeAttr: { [operator]: [1, 2, 3] } },
              {
                default: new Error(
                  'A range must either be an array with two elements, or an empty array for the empty range. Got [ 1, 2, 3 ].',
                ),
              },
            );
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
        testSql(
          {
            intRangeAttr: { [Op.contains]: 1 },
          },
          {
            postgres: `"intRangeAttr" @> 1`,
          },
        );

        testSql(
          // @ts-expect-error -- `ARRAY Op.contains ELEMENT` is not a valid query
          { intArrayAttr: { [Op.contains]: 1 } },
          {
            default: new Error('1 is not a valid array'),
          },
        );
      });
    }

    describeOverlapSuite(Op.contained, '<@');

    describe('ELEMENT Op.contained RANGE', () => {
      if (!dialectSupportsRange()) {
        return;
      }

      testSql(
        {
          intAttr1: { [Op.contained]: [1, 2] },
        },
        {
          postgres: `"intAttr1" <@ '[1,2)'::int4range`,
        },
      );

      testSql(
        {
          bigIntAttr: { [Op.contained]: [1, 2] },
        },
        {
          postgres: `"bigIntAttr" <@ '[1,2)'::int8range`,
        },
      );

      testSql(
        {
          dateAttr: {
            [Op.contained]: [new Date('2020-01-01T00:00:00Z'), new Date('2021-01-01T00:00:00Z')],
          },
        },
        {
          postgres: `"dateAttr" <@ '[2020-01-01 00:00:00.000 +00:00,2021-01-01 00:00:00.000 +00:00)'::tstzrange`,
        },
      );

      /*
      TODO:
      numrange — Range of numeric
      tsrange — Range of timestamp without time zone
      daterange — Range of date
       */
    });

    describe('Op.startsWith', () => {
      // TODO: use implementation not based on "LIKE"
      //  mysql, mariadb: locate()
      //  postgres:, ^@
      //  snowflake, ibmi, db2: position()
      //  mssql: CHARINDEX()
      //  sqlite3: INSTR()

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: 'swagger',
          },
        },
        {
          default: `[stringAttr] LIKE 'swagger%'`,
          mssql: `[stringAttr] LIKE N'swagger%'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] LIKE 'sql''injection%'`,
          mysql: `\`stringAttr\` LIKE 'sql\\'injection%'`,
          mariadb: `\`stringAttr\` LIKE 'sql\\'injection%'`,
          mssql: `[stringAttr] LIKE N'sql''injection%'`,
        },
      );

      // startsWith should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.startsWith]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] LIKE 'sql\%injection%' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] LIKE N'sql\%injection%' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT($bind, '%')`,
          mssql: `[stringAttr] LIKE CONCAT($bind, N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: col('username'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT([username], '%')`,
          mssql: `[stringAttr] LIKE CONCAT([username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT([username], '%')`,
          mssql: `[stringAttr] LIKE CONCAT([username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT(NOW(), '%')`,
          mssql: `[stringAttr] LIKE CONCAT(NOW(), N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.startsWith]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT(CAST(NOW() AS STRING), '%')`,
          mssql: `[stringAttr] LIKE CONCAT(CAST(NOW() AS STRING), N'%')`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPe is '\')

      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.any
        { stringAttr: { [Op.startsWith]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.all
        { stringAttr: { [Op.startsWith]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    describe('Op.endsWith', () => {
      testSql(
        {
          stringAttr: {
            [Op.endsWith]: 'swagger',
          },
        },
        {
          default: `[stringAttr] LIKE '%swagger'`,
          mssql: `[stringAttr] LIKE N'%swagger'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] LIKE '%sql''injection'`,
          mysql: `\`stringAttr\` LIKE '%sql\\'injection'`,
          mariadb: `\`stringAttr\` LIKE '%sql\\'injection'`,
          mssql: `[stringAttr] LIKE N'%sql''injection'`,
        },
      );

      // endsWith should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.endsWith]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] LIKE '%sql\%injection' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] LIKE N'%sql\%injection' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', $bind)`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', $bind)`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: col('username'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', [username])`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', [username])`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', [username])`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', [username])`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', NOW())`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', NOW())`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.endsWith]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', CAST(NOW() AS STRING))`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', CAST(NOW() AS STRING))`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.any
        { stringAttr: { [Op.endsWith]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.all
        { stringAttr: { [Op.endsWith]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    describe('Op.substring', () => {
      // TODO: use implementation not based on "LIKE"
      //  mysql, mariadb: locate()
      //  postgres:, position()
      //  snowflake, ibmi, db2: position()
      //  mssql: CHARINDEX()
      //  sqlite3: INSTR()

      testSql(
        {
          stringAttr: {
            [Op.substring]: 'swagger',
          },
        },
        {
          default: `[stringAttr] LIKE '%swagger%'`,
          mssql: `[stringAttr] LIKE N'%swagger%'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] LIKE '%sql''injection%'`,
          mysql: `\`stringAttr\` LIKE '%sql\\'injection%'`,
          mariadb: `\`stringAttr\` LIKE '%sql\\'injection%'`,
          mssql: `[stringAttr] LIKE N'%sql''injection%'`,
        },
      );

      // substring should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.substring]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] LIKE '%sql\%injection%' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] LIKE N'%sql\%injection%' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', $bind, '%')`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', $bind, N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: col('username'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', [username], '%')`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', [username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', [username], '%')`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', [username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', NOW(), '%')`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', NOW(), N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.substring]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] LIKE CONCAT('%', CAST(NOW() AS STRING), '%')`,
          mssql: `[stringAttr] LIKE CONCAT(N'%', CAST(NOW() AS STRING), N'%')`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.any
        { stringAttr: { [Op.substring]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- startsWith is not compatible with Op.all
        { stringAttr: { [Op.substring]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    describe('Op.notStartsWith', () => {
      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: 'swagger',
          },
        },
        {
          default: `[stringAttr] NOT LIKE 'swagger%'`,
          mssql: `[stringAttr] NOT LIKE N'swagger%'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] NOT LIKE 'sql''injection%'`,
          mysql: `\`stringAttr\` NOT LIKE 'sql\\'injection%'`,
          mariadb: `\`stringAttr\` NOT LIKE 'sql\\'injection%'`,
          mssql: `[stringAttr] NOT LIKE N'sql''injection%'`,
        },
      );

      // startsWith should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.notStartsWith]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] NOT LIKE 'sql\%injection%' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] NOT LIKE N'sql\%injection%' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT($bind, '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT($bind, N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: col('username'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT([username], '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT([username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT([username], '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT([username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT(NOW(), '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(NOW(), N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notStartsWith]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT(CAST(NOW() AS STRING), '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(CAST(NOW() AS STRING), N'%')`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPe is '\')
      testSql(
        // @ts-expect-error -- notStartsWith is not compatible with Op.any
        { stringAttr: { [Op.notStartsWith]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- notStartsWith is not compatible with Op.all
        { stringAttr: { [Op.notStartsWith]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    describe('Op.notEndsWith', () => {
      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: 'swagger',
          },
        },
        {
          default: `[stringAttr] NOT LIKE '%swagger'`,
          mssql: `[stringAttr] NOT LIKE N'%swagger'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] NOT LIKE '%sql''injection'`,
          mysql: `\`stringAttr\` NOT LIKE '%sql\\'injection'`,
          mariadb: `\`stringAttr\` NOT LIKE '%sql\\'injection'`,
          mssql: `[stringAttr] NOT LIKE N'%sql''injection'`,
        },
      );

      // notEndsWith should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.notEndsWith]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] NOT LIKE '%sql\%injection' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] NOT LIKE N'%sql\%injection' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', $bind)`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', $bind)`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: col('username'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', [username])`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', [username])`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', [username])`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', [username])`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', NOW())`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', NOW())`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notEndsWith]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', CAST(NOW() AS STRING))`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', CAST(NOW() AS STRING))`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      testSql(
        // @ts-expect-error -- notEndsWith is not compatible with Op.any
        { stringAttr: { [Op.notEndsWith]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- notEndsWith is not compatible with Op.all
        { stringAttr: { [Op.notEndsWith]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    describe('Op.notSubstring', () => {
      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: 'swagger',
          },
        },
        {
          default: `[stringAttr] NOT LIKE '%swagger%'`,
          mssql: `[stringAttr] NOT LIKE N'%swagger%'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: "sql'injection",
          },
        },
        {
          default: `[stringAttr] NOT LIKE '%sql''injection%'`,
          mysql: `\`stringAttr\` NOT LIKE '%sql\\'injection%'`,
          mariadb: `\`stringAttr\` NOT LIKE '%sql\\'injection%'`,
          mssql: `[stringAttr] NOT LIKE N'%sql''injection%'`,
        },
      );

      // notSubstring should escape anything that has special meaning in LIKE
      testSql.skip(
        {
          stringAttr: {
            [Op.notSubstring]: 'like%injection',
          },
        },
        {
          default: String.raw`[stringAttr] NOT LIKE '%sql\%injection%' ESCAPE '\'`,
          mssql: String.raw`[stringAttr] NOT LIKE N'%sql\%injection%' ESCAPE '\'`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: literal('$bind'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', $bind, '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', $bind, N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: col('username'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', [username], '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', [username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: { [Op.col]: 'username' },
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', [username], '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', [username], N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: fn('NOW'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', NOW(), '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', NOW(), N'%')`,
        },
      );

      testSql(
        {
          stringAttr: {
            [Op.notSubstring]: cast(fn('NOW'), 'string'),
          },
        },
        {
          default: `[stringAttr] NOT LIKE CONCAT('%', CAST(NOW() AS STRING), '%')`,
          mssql: `[stringAttr] NOT LIKE CONCAT(N'%', CAST(NOW() AS STRING), N'%')`,
        },
      );

      // these cannot be compatible because it's not possible to provide a ESCAPE clause (although the default ESCAPE is '\')
      testSql(
        // @ts-expect-error -- notSubstring is not compatible with Op.any
        { stringAttr: { [Op.notSubstring]: { [Op.any]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(any)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );

      testSql(
        // @ts-expect-error -- notSubstring is not compatible with Op.all
        { stringAttr: { [Op.notSubstring]: { [Op.all]: ['test'] } } },
        {
          default: new Error(
            `{ [Symbol(all)]: [ 'test' ] } is not a valid string. Only the string type is accepted for non-binary strings.`,
          ),
        },
      );
    });

    function describeRegexpSuite(
      operator: typeof Op.regexp | typeof Op.iRegexp | typeof Op.notRegexp | typeof Op.notIRegexp,
      sqlOperator: string,
    ) {
      expectTypeOf<WhereOperators[typeof Op.iRegexp]>().toEqualTypeOf<
        WhereOperators[typeof Op.regexp]
      >();
      expectTypeOf<WhereOperators[typeof Op.notRegexp]>().toEqualTypeOf<
        WhereOperators[typeof Op.regexp]
      >();
      expectTypeOf<WhereOperators[typeof Op.notIRegexp]>().toEqualTypeOf<
        WhereOperators[typeof Op.regexp]
      >();

      describe(`Op.${operator.description}`, () => {
        {
          const ignore: TestModelWhere = { stringAttr: { [Op.regexp]: '^sw.*r$' } };
        }

        testSql(
          { stringAttr: { [operator]: '^sw.*r$' } },
          {
            default: `[stringAttr] ${sqlOperator} '^sw.*r$'`,
          },
        );

        testSql(
          { stringAttr: { [operator]: '^new\nline$' } },
          {
            default: `[stringAttr] ${sqlOperator} '^new\nline$'`,
            mariadb: `\`stringAttr\` ${sqlOperator} '^new\\nline$'`,
            mysql: `\`stringAttr\` ${sqlOperator} '^new\\nline$'`,
          },
        );

        testSequelizeValueMethods(operator, sqlOperator);
        testSupportsAnyAll(operator, sqlOperator, ['^a$', '^b$'], 'stringAttr');
      });
    }

    if (sequelize.dialect.supports.REGEXP) {
      describeRegexpSuite(Op.regexp, sequelize.dialect.name === 'postgres' ? '~' : 'REGEXP');
      describeRegexpSuite(
        Op.notRegexp,
        sequelize.dialect.name === 'postgres' ? '!~' : 'NOT REGEXP',
      );
    }

    if (sequelize.dialect.supports.IREGEXP) {
      describeRegexpSuite(Op.iRegexp, '~*');
      describeRegexpSuite(Op.notIRegexp, '!~*');
    }

    if (sequelize.dialect.supports.dataTypes.TSVECTOR) {
      describe('Op.match', () => {
        testSql(
          { stringAttr: { [Op.match]: fn('to_tsvector', 'swagger') } },
          {
            default: `[stringAttr] @@ to_tsvector('swagger')`,
          },
        );

        testSequelizeValueMethods(Op.match, '@@');
        // TODO
        // testSupportsAnyAll(Op.match, '@@', [fn('to_tsvector', 'a'), fn('to_tsvector', 'b')]);
      });
    }

    function describeAdjacentRangeSuite(
      operator:
        | typeof Op.adjacent
        | typeof Op.strictLeft
        | typeof Op.strictRight
        | typeof Op.noExtendLeft
        | typeof Op.noExtendRight,
      sqlOperator: string,
    ) {
      if (!dialectSupportsRange()) {
        return;
      }

      expectTypeOf<WhereOperators[typeof Op.strictLeft]>().toEqualTypeOf<
        WhereOperators[typeof Op.adjacent]
      >();
      expectTypeOf<WhereOperators[typeof Op.strictRight]>().toEqualTypeOf<
        WhereOperators[typeof Op.adjacent]
      >();
      expectTypeOf<WhereOperators[typeof Op.noExtendLeft]>().toEqualTypeOf<
        WhereOperators[typeof Op.adjacent]
      >();
      expectTypeOf<WhereOperators[typeof Op.noExtendRight]>().toEqualTypeOf<
        WhereOperators[typeof Op.adjacent]
      >();

      describe(`RANGE Op.${operator.description} RANGE`, () => {
        {
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [1, 2] } };
          testSql(
            { intRangeAttr: { [operator]: [1, 2] } },
            {
              default: `[intRangeAttr] ${sqlOperator} '[1,2)'::int4range`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intRangeAttr: { [Op.adjacent]: [1, { value: 2, inclusive: true }] },
          };
          testSql(
            { intRangeAttr: { [operator]: [1, { value: 2, inclusive: true }] } },
            {
              // used 'postgres' because otherwise range is transformed to "1,2"
              postgres: `"intRangeAttr" ${sqlOperator} '[1,2]'::int4range`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intRangeAttr: { [Op.adjacent]: [{ value: 1, inclusive: false }, 2] },
          };
          testSql(
            { intRangeAttr: { [operator]: [{ value: 1, inclusive: false }, 2] } },
            {
              default: `[intRangeAttr] ${sqlOperator} '(1,2)'::int4range`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            intRangeAttr: {
              [Op.adjacent]: [
                { value: 1, inclusive: false },
                { value: 2, inclusive: false },
              ],
            },
          };
          testSql(
            {
              intRangeAttr: {
                [operator]: [
                  { value: 1, inclusive: false },
                  { value: 2, inclusive: false },
                ],
              },
            },
            {
              default: `[intRangeAttr] ${sqlOperator} '(1,2)'::int4range`,
            },
          );
        }

        {
          // unbounded range (right)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [10, null] } };
          testSql(
            {
              intRangeAttr: { [operator]: [10, null] },
            },
            {
              postgres: `"intRangeAttr" ${sqlOperator} '[10,)'::int4range`,
            },
          );
        }

        {
          // unbounded range (left)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [null, 10] } };
          testSql(
            {
              intRangeAttr: { [operator]: [null, 10] },
            },
            {
              postgres: `"intRangeAttr" ${sqlOperator} '[,10)'::int4range`,
            },
          );
        }

        {
          // unbounded range (left)
          const ignoreRight: TestModelWhere = { intRangeAttr: { [Op.adjacent]: [null, null] } };
          testSql(
            {
              intRangeAttr: { [operator]: [null, null] },
            },
            {
              postgres: `"intRangeAttr" ${sqlOperator} '[,)'::int4range`,
            },
          );
        }

        {
          const ignoreRight: TestModelWhere = {
            dateRangeAttr: { [Op.adjacent]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] },
          };

          testSql(
            {
              dateRangeAttr: {
                [operator]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
              },
            },
            {
              postgres: `"dateRangeAttr" ${sqlOperator} '[-infinity,infinity)'::tstzrange`,
            },
          );
        }

        {
          // empty range
          const ignoreRight: TestModelWhere = { dateRangeAttr: { [Op.adjacent]: [] } };

          testSql(
            {
              dateRangeAttr: { [operator]: [] },
            },
            {
              postgres: `"dateRangeAttr" ${sqlOperator} 'empty'::tstzrange`,
            },
          );
        }

        {
          // @ts-expect-error -- 'intRangeAttr' is a range, but right-hand side is a regular Array
          const ignore: TestModelWhere = { intRangeAttr: { [Op.overlap]: [1, 2, 3] } };
          testSql(
            { intRangeAttr: { [operator]: [1, 2, 3] } },
            {
              default: new Error(
                'A range must either be an array with two elements, or an empty array for the empty range. Got [ 1, 2, 3 ].',
              ),
            },
          );
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

        testSql(
          { jsonAttr: 'value' },
          {
            default: `[jsonAttr] = '"value"'`,
            mysql: `\`jsonAttr\` = CAST('"value"' AS JSON)`,
            mssql: `[jsonAttr] = N'"value"'`,
          },
        );

        testSql(
          { jsonAttr: null },
          {
            default: new Error('You must be explicit'),
          },
        );

        testSql(
          { jsonAttr: { [Op.eq]: null } },
          {
            default: `[jsonAttr] = 'null'`,
            mysql: `\`jsonAttr\` = CAST('null' AS JSON)`,
            mssql: `[jsonAttr] = N'null'`,
          },
        );

        testSql(
          { jsonAttr: { [Op.is]: null } },
          {
            default: `[jsonAttr] IS NULL`,
          },
        );

        testSql(
          { jsonAttr: JSON_NULL },
          {
            default: `[jsonAttr] = 'null'`,
            mysql: `\`jsonAttr\` = CAST('null' AS JSON)`,
            mssql: `[jsonAttr] = N'null'`,
          },
        );

        testSql(
          { jsonAttr: SQL_NULL },
          {
            default: `[jsonAttr] IS NULL`,
          },
        );

        if (dialectSupportsJsonQuotedExtraction()) {
          testSql(
            { 'jsonAttr.nested': 'value' },
            {
              postgres: `"jsonAttr"->'nested' = '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') = '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) = '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            { 'jsonAttr.nested': null },
            {
              default: new Error('You must be explicit'),
            },
          );

          testSql(
            { 'jsonAttr.nested': JSON_NULL },
            {
              postgres: `"jsonAttr"->'nested' = 'null'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') = 'null'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) = 'null'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') = CAST('null' AS JSON)`,
            },
          );

          testSql(
            { 'jsonAttr.nested': SQL_NULL },
            {
              postgres: `"jsonAttr"->'nested' IS NULL`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') IS NULL`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) IS NULL`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') IS NULL`,
            },
          );

          testSql(
            { 'jsonAttr.nested': { [Op.eq]: null } },
            {
              postgres: `"jsonAttr"->'nested' = 'null'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') = 'null'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) = 'null'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') = CAST('null' AS JSON)`,
            },
          );

          testSql(
            { 'jsonAttr.nested': { [Op.is]: null } },
            {
              postgres: `"jsonAttr"->'nested' IS NULL`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') IS NULL`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) IS NULL`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') IS NULL`,
            },
          );

          testSql(where('value', Op.eq, attribute('jsonAttr.nested')), {
            postgres: `'"value"' = "jsonAttr"->'nested'`,
            sqlite3: `'"value"' = json_extract(\`jsonAttr\`,'$.nested')`,
            mariadb: `'"value"' = json_compact(json_extract(\`jsonAttr\`,'$.nested'))`,
            mysql: `CAST('"value"' AS JSON) = json_extract(\`jsonAttr\`,'$.nested')`,
          });

          testSql(
            { 'jsonAttr.nested.twice': 'value' },
            {
              postgres: `"jsonAttr"#>ARRAY['nested','twice']::VARCHAR(255)[] = '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested.twice') = '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested.twice')) = '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested.twice') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              jsonAttr: { nested: 'value' },
            },
            {
              postgres: `"jsonAttr"->'nested' = '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') = '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) = '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              'jsonAttr.nested': { twice: 'value' },
            },
            {
              postgres: `"jsonAttr"#>ARRAY['nested','twice']::VARCHAR(255)[] = '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested.twice') = '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested.twice')) = '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested.twice') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              jsonAttr: { [Op.eq]: { key: 'value' } },
            },
            {
              default: `[jsonAttr] = '{"key":"value"}'`,
              mysql: `\`jsonAttr\` = CAST('{"key":"value"}' AS JSON)`,
            },
          );

          testSql(
            {
              'jsonAttr.nested': { [Op.ne]: 'value' },
            },
            {
              postgres: `"jsonAttr"->'nested' != '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') != '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) != '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') != CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              '$jsonAttr$.nested': 'value',
            },
            {
              postgres: `"jsonAttr"->'nested' = '"value"'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested') = '"value"'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested')) = '"value"'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              '$association.jsonAttr$.nested': 'value',
            },
            {
              postgres: `"association"."jsonAttr"->'nested' = '"value"'`,
              sqlite3: `json_extract(\`association\`.\`jsonAttr\`,'$.nested') = '"value"'`,
              mariadb: `json_compact(json_extract(\`association\`.\`jsonAttr\`,'$.nested')) = '"value"'`,
              mysql: `json_extract(\`association\`.\`jsonAttr\`,'$.nested') = CAST('"value"' AS JSON)`,
            },
          );

          testSql(
            {
              'jsonAttr.nested::STRING': 'value',
            },
            {
              // with the left value cast to a string, we serialize the right value as a string, not as a JSON value
              postgres: `CAST("jsonAttr"->'nested' AS STRING) = 'value'`,
              mariadb: `CAST(json_compact(json_extract(\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
              'sqlite3 mysql': `CAST(json_extract(\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
            },
          );

          testSql(
            {
              '$association.jsonAttr$.nested::STRING': {
                attribute: 'value',
              },
            },
            {
              default: new Error(`Could not guess type of value { attribute: 'value' }`),
            },
          );

          testSql(
            {
              '$association.jsonAttr$.nested.deep::STRING': 'value',
            },
            {
              postgres: `CAST("association"."jsonAttr"#>ARRAY['nested','deep']::VARCHAR(255)[] AS STRING) = 'value'`,
              mariadb: `CAST(json_compact(json_extract(\`association\`.\`jsonAttr\`,'$.nested.deep')) AS STRING) = 'value'`,
              'sqlite3 mysql': `CAST(json_extract(\`association\`.\`jsonAttr\`,'$.nested.deep') AS STRING) = 'value'`,
            },
          );

          testSql(
            {
              $jsonAttr$: { 'nested::string': 'value' },
            },
            {
              postgres: `CAST("jsonAttr"->'nested' AS STRING) = 'value'`,
              mariadb: `CAST(json_compact(json_extract(\`jsonAttr\`,'$.nested')) AS STRING) = 'value'`,
              'sqlite3 mysql': `CAST(json_extract(\`jsonAttr\`,'$.nested') AS STRING) = 'value'`,
            },
          );

          testSql(
            { 'jsonAttr.nested.attribute': 4 },
            {
              postgres: `"jsonAttr"#>ARRAY['nested','attribute']::VARCHAR(255)[] = '4'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$.nested.attribute') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$.nested.attribute')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$.nested.attribute') = CAST('4' AS JSON)`,
            },
          );

          // 0 is treated as a string key here, not an array index
          testSql(
            { 'jsonAttr.0': 4 },
            {
              postgres: `"jsonAttr"->'0' = '4'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$."0"') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$."0"')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$."0"') = CAST('4' AS JSON)`,
            },
          );

          // 0 is treated as an index here, not a string key
          testSql(
            { 'jsonAttr[0]': 4 },
            {
              postgres: `"jsonAttr"->0 = '4'`,

              // these tests cannot be deduplicated because [0] will be replaced by `0` by expectsql
              sqlite3: `json_extract(\`jsonAttr\`,'$[0]') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$[0]')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$[0]') = CAST('4' AS JSON)`,
            },
          );

          testSql(
            { 'jsonAttr.0.attribute': 4 },
            {
              postgres: `"jsonAttr"#>ARRAY['0','attribute']::VARCHAR(255)[] = '4'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$."0".attribute') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$."0".attribute')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$."0".attribute') = CAST('4' AS JSON)`,
            },
          );

          // Regression test: https://github.com/sequelize/sequelize/issues/8718
          testSql(
            { jsonAttr: { 'hyphenated-key': 4 } },
            {
              postgres: `"jsonAttr"->'hyphenated-key' = '4'`,
              sqlite3: `json_extract(\`jsonAttr\`,'$."hyphenated-key"') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$."hyphenated-key"')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$."hyphenated-key"') = CAST('4' AS JSON)`,
            },
          );

          // SQL injection test
          testSql(
            { jsonAttr: { '"a\')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- "': 1 } },
            {
              postgres: `"jsonAttr"->'a'')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- ' = '1'`,
              mysql: `json_extract(\`jsonAttr\`,'$."a\\')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- "') = CAST('1' AS JSON)`,
              sqlite3: `json_extract(\`jsonAttr\`,'$."a'')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- "') = '1'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$."a\\')) AS DECIMAL) = 1 DELETE YOLO INJECTIONS; -- "')) = '1'`,
            },
          );

          testSql(
            { 'jsonAttr[0].nested.attribute': 4 },
            {
              postgres: `"jsonAttr"#>ARRAY['0','nested','attribute']::VARCHAR(255)[] = '4'`,

              // these tests cannot be deduplicated because [0] will be replaced by `0` by expectsql
              sqlite3: `json_extract(\`jsonAttr\`,'$[0].nested.attribute') = '4'`,
              mariadb: `json_compact(json_extract(\`jsonAttr\`,'$[0].nested.attribute')) = '4'`,
              mysql: `json_extract(\`jsonAttr\`,'$[0].nested.attribute') = CAST('4' AS JSON)`,
            },
          );

          // aliases attribute -> column correctly
          testSql(
            { 'aliasedJsonAttr.nested.attribute': 4 },
            {
              postgres: `"aliased_json"#>ARRAY['nested','attribute']::VARCHAR(255)[] = '4'`,
              sqlite3: `json_extract(\`aliased_json\`,'$.nested.attribute') = '4'`,
              mariadb: `json_compact(json_extract(\`aliased_json\`,'$.nested.attribute')) = '4'`,
              mysql: `json_extract(\`aliased_json\`,'$.nested.attribute') = CAST('4' AS JSON)`,
            },
          );
        }

        if (dialectSupportsJsonUnquotedExtraction()) {
          testSql(
            { 'jsonAttr:unquote': 0 },
            {
              postgres: `"jsonAttr"#>>ARRAY[]::TEXT[] = 0`,
              mssql: `JSON_VALUE([jsonAttr]) = 0`,
              'sqlite3 mysql mariadb': `json_unquote([jsonAttr]) = 0`,
            },
          );

          testSql(
            { 'jsonAttr.key:unquote': 0 },
            {
              postgres: `"jsonAttr"->>'key' = 0`,
              mssql: `JSON_VALUE([jsonAttr], N'$.key') = 0`,
              'sqlite3 mysql mariadb': `json_unquote(json_extract([jsonAttr],'$.key')) = 0`,
            },
          );

          testSql(
            { 'jsonAttr.nested.key:unquote': 0 },
            {
              postgres: `"jsonAttr"#>>ARRAY['nested','key']::VARCHAR(255)[] = 0`,
              mssql: `JSON_VALUE([jsonAttr], N'$.nested.key') = 0`,
              'sqlite3 mysql mariadb': `json_unquote(json_extract([jsonAttr],'$.nested.key')) = 0`,
            },
          );

          testSql(
            { 'jsonAttr[0]:unquote': 0 },
            {
              postgres: `"jsonAttr"->>0 = 0`,

              // must be separate because [0] will be replaced by `0` by expectsql
              sqlite3: `json_unquote(json_extract(\`jsonAttr\`,'$[0]')) = 0`,
              mysql: `json_unquote(json_extract(\`jsonAttr\`,'$[0]')) = 0`,
              mariadb: `json_unquote(json_extract(\`jsonAttr\`,'$[0]')) = 0`,
              mssql: `JSON_VALUE([jsonAttr], N'$[0]') = 0`,
            },
          );
        }
      });
    }

    if (dialectSupportsJsonB()) {
      describe('JSONB', () => {
        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: ['a', 'b'],
            },
          },
          {
            default: `[jsonbAttr] ?| ARRAY['a','b']`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: ['a', 'b'],
            },
          },
          {
            default: `[jsonbAttr] ?& ARRAY['a','b']`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: literal(
                `ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
              ),
            },
          },
          {
            default: `[jsonbAttr] ?| ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: literal(
                `ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
              ),
            },
          },
          {
            default: `[jsonbAttr] ?& ARRAY(SELECT jsonb_array_elements_text('ARRAY["a","b"]'))`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: col('label'),
            },
          },
          {
            default: `[jsonbAttr] ?| "label"`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: col('labels'),
            },
          },
          {
            default: `[jsonbAttr] ?& "labels"`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: cast(col('labels'), 'STRING[]'),
            },
          },
          {
            default: `[jsonbAttr] ?| CAST("labels" AS STRING[])`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: cast(col('labels'), 'STRING[]'),
            },
          },
          {
            default: `[jsonbAttr] ?& CAST("labels" AS STRING[])`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: [],
            },
          },
          {
            default: `[jsonbAttr] ?| ARRAY[]::TEXT[]`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: [],
            },
          },
          {
            default: `[jsonbAttr] ?& ARRAY[]::TEXT[]`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.anyKeyExists]: fn('get_label'),
            },
          },
          {
            default: `[jsonbAttr] ?| get_label()`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.allKeysExist]: fn('get_labels'),
            },
          },
          {
            default: `[jsonbAttr] ?& get_labels()`,
          },
        );

        testSql(
          // @ts-expect-error -- typings for `json` are broken, but `json()` is deprecated
          { id: { [Op.eq]: json('profile.id') } },
          {
            default: `"id" = "profile"->'id'`,
          },
        );

        testSql(
          // @ts-expect-error -- typings for `json` are broken, but `json()` is deprecated
          json('profile.id', cast('12346-78912', 'text')),
          {
            postgres: `"User"."profile"->'id' = CAST('12346-78912' AS TEXT)`,
          },
          {
            mainAlias: 'User',
          },
        );

        testSql(
          json({ profile: { id: '12346-78912', name: 'test' } }),
          {
            postgres: `"User"."profile"->'id' = '"12346-78912"' AND "User"."profile"->'name' = '"test"'`,
          },
          {
            mainAlias: 'User',
          },
        );

        testSql(
          {
            jsonbAttr: {
              nested: {
                attribute: 'value',
              },
            },
          },
          {
            postgres: `"User"."jsonbAttr"#>ARRAY['nested','attribute']::VARCHAR(255)[] = '"value"'`,
          },
          {
            mainAlias: 'User',
          },
        );

        testSql(
          {
            jsonbAttr: {
              nested: {
                [Op.in]: [1, 2],
              },
            },
          },
          {
            postgres: `"jsonbAttr"->'nested' IN ('1', '2')`,
          },
        );

        testSql(
          {
            'jsonbAttr.nested.attribute': {
              [Op.in]: [3, 7],
            },
          },
          {
            postgres: `"jsonbAttr"#>ARRAY['nested','attribute']::VARCHAR(255)[] IN ('3', '7')`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              nested: {
                [Op.between]: [1, 2],
              },
            },
          },
          {
            postgres: `"jsonbAttr"->'nested' BETWEEN '1' AND '2'`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              price: 5,
              name: 'Product',
            },
          },
          {
            postgres: `"jsonbAttr"->'price' = '5' AND "jsonbAttr"->'name' = '"Product"'`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              name: {
                last: 'Simpson',
              },
              employment: {
                [Op.ne]: 'None',
              },
            },
          },
          {
            postgres: `"User"."jsonbAttr"#>ARRAY['name','last']::VARCHAR(255)[] = '"Simpson"' AND "User"."jsonbAttr"->'employment' != '"None"'`,
          },
          {
            mainAlias: 'User',
          },
        );

        const dt = new Date();
        const jsonDt = JSON.stringify(dt);
        testSql(
          {
            jsonbAttr: {
              nested: {
                attribute: {
                  [Op.gt]: dt,
                },
              },
            },
          },
          {
            postgres: `"jsonbAttr"#>ARRAY['nested','attribute']::VARCHAR(255)[] > ${queryGen.escape(jsonDt)}`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              nested: {
                attribute: true,
              },
            },
          },
          {
            postgres: `"jsonbAttr"#>ARRAY['nested','attribute']::VARCHAR(255)[] = 'true'`,
          },
        );

        testSql(
          {
            jsonbAttr: {
              [Op.contains]: { company: 'Magnafone' },
            },
          },
          {
            default: `[jsonbAttr] @> '{"company":"Magnafone"}'`,
          },
        );

        testSql(
          {
            jsonbTypeLiteralAttr: { [Op.contains]: { foo: 'bar' } },
          },
          {
            postgres: '"jsonbTypeLiteralAttr" @> \'{"foo":"bar"}\'',
          },
        );

        testSql(
          {
            // @ts-expect-error -- key `bad` isn't known
            jsonbTypeLiteralAttr: { [Op.contains]: { bad: 'bad' } },
          },
          {
            postgres: '"jsonbTypeLiteralAttr" @> \'{"bad":"bad"}\'',
          },
        );

        testSql(
          {
            jsonbInterfaceAttr: { [Op.contains]: { foo: 'bar' } },
          },
          {
            postgres: '"jsonbInterfaceAttr" @> \'{"foo":"bar"}\'',
          },
        );

        testSql(
          {
            // @ts-expect-error -- key `bad` isn't known
            jsonbInterfaceAttr: { [Op.contains]: { bad: 'bad' } },
          },
          {
            postgres: '"jsonbInterfaceAttr" @> \'{"bad":"bad"}\'',
          },
        );

        // aliases correctly

        testSql(
          { aliasedJsonbAttr: { key: 'value' } },
          {
            postgres: `"aliased_jsonb"->'key' = '"value"'`,
          },
        );
      });
    }

    testSql(
      {
        stringAttr: 'a project',
        [Op.or]: [{ intAttr1: [1, 2, 3] }, { intAttr1: { [Op.gt]: 10 } }],
      },
      {
        default: "([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10) AND [stringAttr] = 'a project'",
        mssql: "([intAttr1] IN (1, 2, 3) OR [intAttr1] > 10) AND [stringAttr] = N'a project'",
      },
    );

    describe('Op.and', () => {
      it('and() is the same as Op.and', () => {
        expect(util.inspect(and('a', 'b'))).to.deep.equal(util.inspect({ [Op.and]: ['a', 'b'] }));
      });

      testSql(and([]), {
        default: '',
      });

      testSql(and({}), {
        default: '',
      });

      // by default: it already is Op.and
      testSql(
        { intAttr1: 1, intAttr2: 2 },
        {
          default: `[intAttr1] = 1 AND [intAttr2] = 2`,
        },
      );

      // top-level array is Op.and
      testSql([{ intAttr1: 1 }, { intAttr1: 2 }], {
        default: `[intAttr1] = 1 AND [intAttr1] = 2`,
      });

      // $intAttr1$ doesn't override intAttr1
      testSql(
        { intAttr1: 1, $intAttr1$: 2 },
        {
          default: `[intAttr1] = 1 AND [intAttr1] = 2`,
        },
      );

      // can pass a simple object
      testSql(
        { [Op.and]: { intAttr1: 1, intAttr2: 2 } },
        {
          default: `[intAttr1] = 1 AND [intAttr2] = 2`,
        },
      );

      // can pass an array
      testSql(
        { [Op.and]: [{ intAttr1: 1, intAttr2: 2 }, { stringAttr: '' }] },
        {
          default: `([intAttr1] = 1 AND [intAttr2] = 2) AND [stringAttr] = ''`,
          mssql: `([intAttr1] = 1 AND [intAttr2] = 2) AND [stringAttr] = N''`,
        },
      );

      // can be used on attribute
      testSql(
        { intAttr1: { [Op.and]: [1, { [Op.gt]: 1 }] } },
        {
          default: `[intAttr1] = 1 AND [intAttr1] > 1`,
        },
      );

      testSql(
        // @ts-expect-error -- cannot be used after operator
        { intAttr1: { [Op.gt]: { [Op.and]: [1, 2] } } },
        {
          default: new Error(`{ [Symbol(and)]: [ 1, 2 ] } is not a valid integer`),
        },
      );
    });

    describe('Op.or', () => {
      it('or() is the same as Op.or', () => {
        expect(util.inspect(or('a', 'b'))).to.deep.equal(util.inspect({ [Op.or]: ['a', 'b'] }));
      });

      testSql(or([]), {
        default: '',
      });

      testSql(or({}), {
        default: '',
      });

      // can pass a simple object
      testSql(
        { [Op.or]: { intAttr1: 1, intAttr2: 2 } },
        {
          default: `[intAttr1] = 1 OR [intAttr2] = 2`,
        },
      );

      // can pass an array
      testSql(
        { [Op.or]: [{ intAttr1: 1, intAttr2: 2 }, { stringAttr: '' }] },
        {
          default: `([intAttr1] = 1 AND [intAttr2] = 2) OR [stringAttr] = ''`,
          mssql: `([intAttr1] = 1 AND [intAttr2] = 2) OR [stringAttr] = N''`,
        },
      );

      // can be used on attribute
      testSql(
        { intAttr1: { [Op.or]: [1, { [Op.gt]: 1 }] } },
        {
          default: `[intAttr1] = 1 OR [intAttr1] > 1`,
        },
      );

      testSql(
        // @ts-expect-error -- cannot be used after operator
        { intAttr1: { [Op.gt]: { [Op.or]: [1, 2] } } },
        {
          default: new Error(`{ [Symbol(or)]: [ 1, 2 ] } is not a valid integer`),
        },
      );

      testSql(
        {
          [Op.or]: {
            intAttr1: [1, 3],
            intAttr2: {
              [Op.in]: [2, 4],
            },
          },
        },
        {
          default: '[intAttr1] IN (1, 3) OR [intAttr2] IN (2, 4)',
        },
      );
    });

    describe('Op.{and,or,not} combinations', () => {
      // both can be used in the same object
      testSql(
        {
          [Op.and]: { intAttr1: 1, intAttr2: 2 },
          [Op.or]: { intAttr1: 1, intAttr2: 2 },
        },
        {
          default: `([intAttr1] = 1 AND [intAttr2] = 2) AND ([intAttr1] = 1 OR [intAttr2] = 2)`,
        },
      );

      // Op.or only applies to its direct Array, the nested array is still Op.and
      testSql(
        {
          [Op.or]: [[{ intAttr1: 1 }, { intAttr1: 2 }], { intAttr1: 3 }],
        },
        {
          default: '([intAttr1] = 1 AND [intAttr1] = 2) OR [intAttr1] = 3',
        },
      );

      // can be nested *after* attribute
      testSql(
        {
          intAttr1: {
            [Op.and]: [1, 2, { [Op.or]: [3, 4] }, { [Op.not]: 5 }, [6, 7]],
          },
        },
        {
          default:
            '[intAttr1] = 1 AND [intAttr1] = 2 AND ([intAttr1] = 3 OR [intAttr1] = 4) AND NOT ([intAttr1] = 5) AND [intAttr1] IN (6, 7)',
        },
      );

      // can be nested
      testSql(
        {
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
        },
        {
          default: 'NOT ([intAttr1] = 1 AND [intAttr2] = 2)',
        },
      );

      testSql(
        {
          [Op.not]: {
            [Op.or]: {
              [Op.and]: {
                intAttr1: 1,
                intAttr2: 2,
              },
              [Op.or]: {
                intAttr1: 1,
                intAttr2: 2,
              },
            },
          },
        },
        {
          default:
            'NOT (([intAttr1] = 1 AND [intAttr2] = 2) OR ([intAttr1] = 1 OR [intAttr2] = 2))',
        },
      );

      // Op.not, Op.and, Op.or can reside on the same object as attributes
      testSql(
        {
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
        },
        {
          default:
            '(NOT (((([intAttr1] = 5 AND [intAttr2] = 6) OR [intAttr1] = 4) AND [intAttr1] = 3) AND [intAttr1] = 2)) AND [intAttr1] = 1',
        },
      );
    });

    describe('where()', () => {
      {
        // @ts-expect-error -- 'intAttr1' is not a boolean and cannot be compared to the output of 'where'
        const ignore: TestModelWhere = { intAttr1: where(fn('lower', col('name')), null) };
      }

      testSql(
        { booleanAttr: where(fn('lower', col('name')), null) },
        {
          default: `[booleanAttr] = (lower([name]) IS NULL)`,
        },
      );

      testSql(
        { booleanAttr: where(fn('lower', col('name')), null) },
        {
          default: `[booleanAttr] = (lower([name]) IS NULL)`,
        },
      );

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
          default: 'sum(CAST(([id] = 1) AS INT)) = 1',
        });

        // comparing the output of `where` to `where`
        testSql(where(where(col('col'), Op.eq, '1'), Op.eq, where(col('col'), Op.eq, '2')), {
          default: `([col] = '1') = ([col] = '2')`,
          mssql: `([col] = N'1') = ([col] = N'2')`,
        });

        testSql(where(1, Op.eq, 2), {
          default: '1 = 2',
        });

        testSql(where(1, Op.eq, col('col')), {
          default: '1 = [col]',
        });

        testSql(where('string', Op.eq, col('col')), {
          default: `'string' = [col]`,
          mssql: `N'string' = [col]`,
        });

        testSql(where('a', Op.eq, 'b'), {
          default: `'a' = 'b'`,
          mssql: `N'a' = N'b'`,
        });

        it('does not allow string operators', () => {
          // @ts-expect-error -- testing that this errors
          expect(() => where(fn('SUM', col('hours')), '>', 0)).to.throw(
            'where(left, operator, right) does not accept a string as the operator',
          );
        });

        testSql(where(fn('SUM', col('hours')), Op.gt, 0), {
          default: 'SUM([hours]) > 0',
        });

        testSql(where(fn('lower', col('name')), Op.ne, null), {
          default: 'lower([name]) IS NOT NULL',
        });

        // @ts-expect-error -- While these are supported for backwards compatibility, they are not documented. Users should use isNot
        testSql(where(fn('lower', col('name')), Op.not, null), {
          default: 'NOT (lower([name]) IS NULL)',
        });

        testSql(where(fn('lower', col('name')), Op.isNot, null), {
          default: 'lower([name]) IS NOT NULL',
        });

        testSql(where(col('hours'), Op.between, [0, 5]), {
          default: '[hours] BETWEEN 0 AND 5',
        });

        testSql(where(col('hours'), Op.notBetween, [0, 5]), {
          default: '[hours] NOT BETWEEN 0 AND 5',
        });

        testSql(where({ [Op.col]: 'hours' }, Op.notBetween, [0, 5]), {
          default: '[hours] NOT BETWEEN 0 AND 5',
        });

        testSql(where(cast({ [Op.col]: 'hours' }, 'integer'), Op.notBetween, [0, 5]), {
          default: 'CAST([hours] AS INTEGER) NOT BETWEEN 0 AND 5',
        });

        testSql(where(fn('SUM', { [Op.col]: 'hours' }), Op.notBetween, [0, 5]), {
          default: 'SUM([hours]) NOT BETWEEN 0 AND 5',
        });

        testSql(where(literal(`'hours'`), Op.eq, 'hours'), {
          default: `'hours' = 'hours'`,
          mssql: `'hours' = N'hours'`,
        });

        testSql(where(col('col'), Op.eq, { [Op.in]: [1, 2] }), {
          default: new Error('Could not guess type of value { [Symbol(in)]: [ 1, 2 ] }'),
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

        testSql(where(col('name'), { [Op.eq]: '123', [Op.not]: { [Op.eq]: '456' } }), {
          default: `[name] = '123' AND NOT ([name] = '456')`,
          mssql: `[name] = N'123' AND NOT ([name] = N'456')`,
        });

        testSql(where(col('name'), or({ [Op.eq]: '123', [Op.not]: { [Op.eq]: '456' } })), {
          default: `[name] = '123' OR NOT ([name] = '456')`,
          mssql: `[name] = N'123' OR NOT ([name] = N'456')`,
        });

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
          default: '[col] = 1 AND [col] = 2',
        });

        if (dialectSupportsJsonOperations() && dialectSupportsJsonQuotedExtraction()) {
          testSql(where(col('col'), { jsonPath: 'value' }), {
            postgres: `"col"->'jsonPath' = '"value"'`,
            sqlite3: `json_extract(\`col\`,'$.jsonPath') = '"value"'`,
            mariadb: `json_compact(json_extract(\`col\`,'$.jsonPath')) = '"value"'`,
            mysql: `json_extract(\`col\`,'$.jsonPath') = CAST('"value"' AS JSON)`,
          });
        }
      });
    });
  });
});
