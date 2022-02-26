import util from 'util';
import type {
  WhereOptions,
  ModelAttributeColumnOptions,
  Utils, WhereOperators,
} from '@sequelize/core';
import {
  DataTypes,
  QueryTypes,
  Op,
  literal,
  col,
  where,
  fn,
  json,
  cast,
  and,
  or,
} from '@sequelize/core';
import { expectTypeOf } from 'expect-type';
import attempt from 'lodash/attempt';
// eslint-disable-next-line import/order -- issue with mixing require & import
import { createTester } from '../../support2';

const support = require('../support');

const { sequelize, expectsql } = support;

const sql = sequelize.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character
// when there is no dialect specific expectation but only a default expectation

// TODO:
//  - fix and resolve any .skip test
//  - add tests for using where() in wrong places
//  - add tests for using cast() on a value
//  - accept arrays in Op.gt, Op.lt, etc
//  - accept arrays in Op.in
//  - test Op.overlap on [date, date]
//  - test Op.overlap with ANY & VALUES:
//      ANY (VALUES (ARRAY[1]), (ARRAY[2])) is valid
//      ANY (ARRAY[ARRAY[1,2]]) is not valid
//  - restrict columns to valid attributes
//  - test binding values
// TODO: don't disable test suites if the dialect doesn't support.
//  instead, ensure dialect throws an error if these operators are used.

type Options = {
  type?: QueryTypes,
  prefix?: string | Utils.Literal,
  field?: ModelAttributeColumnOptions,
  model?: {
    rawAttributes: { [attribute: string]: ModelAttributeColumnOptions },
  },
};

type Expectations = {
  [dialectName: string]: string | Error,
};

const dialectSupportsArray = () => sequelize.dialect.supports.ARRAY;
const dialectSupportsRange = () => sequelize.dialect.supports.RANGE;

describe(support.getTestDialectTeaser('SQL'), () => {
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
      [Key in keyof WhereOperators
        as IncludesType<
          WhereOperators[Key],
          Utils.Col | Utils.Literal | Utils.Fn | Utils.Cast | { [Op.col]: string }
        > extends true ? Key : never
      ]: WhereOperators[Key]
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
      testSql({ col1: { [operator]: { [Op.col]: 'col2' } } }, {
        default: `[col1] ${sqlOperator} [col2]`,
      });

      testSql({ col1: { [operator]: col('col2') } }, {
        default: `[col1] ${sqlOperator} [col2]`,
      });

      testSql({ col: { [operator]: literal('literal') } }, {
        default: `[col] ${sqlOperator} literal`,
      });

      testSql({ col: { [operator]: fn('NOW') } }, {
        default: `[col] ${sqlOperator} NOW()`,
      });

      testSql({ col: { [operator]: cast(col('col'), 'string') } }, {
        default: `[col] ${sqlOperator} CAST([col] AS STRING)`,
      });
    }

    /**
     * 'OperatorsSupportingSequelizeValueMethods' lists all operators
     * that accept values: `col()`, `literal()`, `fn()`, `cast()`, and { [Op.col] }
     */
    type OperatorsSupportingAnyAll = keyof {
      [Key in keyof WhereOperators
        as IncludesType<
          WhereOperators[Key],
          | { [Op.all]: any[] | Utils.Literal | { [Op.values]: any[] } }
          | { [Op.any]: any[] | Utils.Literal | { [Op.values]: any[] } }
        > extends true ? Key : never
      ]: WhereOperators[Key]
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
      operator: OperatorsSupportingAnyAll,
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
        testSql({ col: { [operator]: { [arrayOperator]: testWithValues } } }, {
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: `"col" ${sqlOperator} ${arraySqlOperator} (ARRAY[${testWithValues.map(v => util.inspect(v)).join(',')}])`,
        });

        testSql({ col: { [operator]: { [arrayOperator]: literal('literal') } } }, {
          default: `[col] ${sqlOperator} ${arraySqlOperator} (literal)`,
        });

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql.skip({
          col: {
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
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: `"col" ${sqlOperator} ${arraySqlOperator} (VALUES (literal), (UPPER("col2")), ("col3"), (CAST("col" AS STRING)), ('abc'), (12))`,
        });
      }
    }

    const testSql = createTester((it, whereObj: WhereOptions, expectations: Expectations, options?: Options) => {
      it(util.inspect(whereObj, { depth: 10 }) + (options ? `, ${util.inspect(options)}` : ''), () => {
        const sqlOrError = attempt(sql.whereItemsQuery.bind(sql), whereObj, options);

        return expectsql(sqlOrError, expectations);
      });
    });

    testSql({}, {
      default: '',
    });

    testSql([], {
      default: '',
    });

    // @ts-expect-error id is not allowed to be undefined
    testSql({ id: undefined }, {
      default: new Error('WHERE parameter "id" has invalid "undefined" value'),
    });

    // @ts-expect-error user is not allowed to be undefined
    testSql({ id: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    });

    // @ts-expect-error user is not allowed to be undefined
    testSql({ id: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.SELECT });

    // @ts-expect-error user is not allowed to be undefined
    testSql({ id: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.BULKDELETE });

    // @ts-expect-error user is not allowed to be undefined
    testSql({ id: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value'),
    }, { type: QueryTypes.BULKUPDATE });

    testSql({ id: 1 }, {
      default: '[User].[id] = 1',
    }, { prefix: 'User' });

    it('{ id: 1 }, { prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, {schema: \'yolo\', tableName: \'User\'})) }', () => {
      expectsql(sql.whereItemsQuery({ id: 1 }, { prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, { schema: 'yolo', tableName: 'User' })) }), {
        default: '[yolo.User].[id] = 1',
        ibmi: 'WHERE "yolo"."User"."id" = 1',
        postgres: '"yolo"."User"."id" = 1',
        db2: '"yolo"."User"."id" = 1',
        snowflake: '"yolo"."User"."id" = 1',
        mariadb: '`yolo`.`User`.`id` = 1',
        mssql: '[yolo].[User].[id] = 1',
      });
    });

    testSql(literal('raw sql'), {
      default: 'raw sql',
    });

    describe('value serialization', () => {
      // string
      testSql({ id: '1' }, {
        default: `[id] = '1'`,
        mssql: `[id] = N'1'`,
      });

      testSql({
        name: 'here is a null char: \0',
      }, {
        default: '[name] = \'here is a null char: \\0\'',
        snowflake: '"name" = \'here is a null char: \0\'',
        mssql: '[name] = N\'here is a null char: \0\'',
        db2: '"name" = \'here is a null char: \0\'',
        ibmi: 'WHERE "name" = \'here is a null char: \0\'',
        sqlite: '`name` = \'here is a null char: \0\'',
      });

      testSql({
        date: 1_356_998_400_000,
      }, {
        default: '[date] = \'2013-01-01 00:00:00.000 +00:00\'',
        mssql: '[date] = N\'2013-01-01 00:00:00.000 +00:00\'',
      }, {
        model: {
          rawAttributes: {
            date: {
              type: new DataTypes.DATE(),
            },
          },
        },
      });

      describe('Buffer', () => {
        testSql({ field: Buffer.from('Sequelize') }, {
          ibmi: '"field" = BLOB(X\'53657175656c697a65\')',
          postgres: '"field" = E\'\\\\x53657175656c697a65\'',
          sqlite: '`field` = X\'53657175656c697a65\'',
          mariadb: '`field` = X\'53657175656c697a65\'',
          mysql: '`field` = X\'53657175656c697a65\'',
          db2: '"field" = BLOB(\'Sequelize\')',
          snowflake: '"field" = X\'53657175656c697a65\'',
          mssql: '[field] = 0x53657175656c697a65',
        });

        testSql({ field: [Buffer.from('Sequelize1'), Buffer.from('Sequelize2')] }, {
          postgres: '"field" IN (E\'\\\\x53657175656c697a6531\', E\'\\\\x53657175656c697a6532\')',
          sqlite: '`field` IN (X\'53657175656c697a6531\', X\'53657175656c697a6532\')',
          mariadb: '`field` IN (X\'53657175656c697a6531\', X\'53657175656c697a6532\')',
          mysql: '`field` IN (X\'53657175656c697a6531\', X\'53657175656c697a6532\')',
          db2: '"field" IN (BLOB(\'Sequelize1\'), BLOB(\'Sequelize2\'))',
          snowflake: '"field" IN (X\'53657175656c697a6531\', X\'53657175656c697a6532\')',
          mssql: '[field] IN (0x53657175656c697a6531, 0x53657175656c697a6532)',
        });
      });
    });

    describe('implicit operator', () => {
      testSql({ id: 1 }, {
        default: '[id] = 1',
      });

      testSql({ id: '1' }, {
        default: `[id] = '1'`,
        mssql: `[id] = N'1'`,
      });

      testSql({ id: [1, 2] }, {
        default: '[id] IN (1, 2)',
      });

      testSql({ id: ['1', '2'] }, {
        default: `[id] IN ('1', '2')`,
        mssql: `[id] IN (N'1', N'2')`,
      });

      testSql.skip({ 'id::integer': 1 }, {
        default: 'CAST([id] AS INTEGER) = 1',
      });

      testSql({ active: true }, {
        default: `[active] = true`,
        mssql: '[active] = 1',
        sqlite: '`active` = 1',
      });

      testSql({
        name: 'a project',
        id: {
          [Op.or]: [
            [1, 2, 3],
            { [Op.gt]: 10 },
          ],
        },
      }, {
        default: '[name] = \'a project\' AND ([id] IN (1, 2, 3) OR [id] > 10)',
        mssql: '[name] = N\'a project\' AND ([id] IN (1, 2, 3) OR [id] > 10)',
      });

      testSql({ deleted: null }, {
        default: '[deleted] IS NULL',
      });

      testSql({ birthday: new Date('2021-01-01T00:00:00Z') }, {
        default: `[birthday] = '2021-01-01 00:00:00.000 +00:00'`,
        mariadb: `\`birthday\` = '2021-01-01 00:00:00.000'`,
        mysql: `\`birthday\` = '2021-01-01 00:00:00'`,
        snowflake: `"birthday" = '2021-01-01 00:00:00'`,
        db2: `"birthday" = '2021-01-01 00:00:00'`,
      });

      testSql({ col1: { [Op.col]: 'col2' } }, {
        default: '[col1] = [col2]',
      });

      testSql.skip({ col1: col('col2') }, {
        default: '[col1] = [col2]',
      });

      testSql.skip({ col: literal('literal') }, {
        default: '[col] = literal',
      });

      testSql({ col1: fn('UPPER', col('col2')) }, {
        default: '[col1] = UPPER([col2])',
      });

      testSql.skip({ col: cast(col('col'), 'string') }, {
        default: '[col] = CAST([col] AS STRING)',
      });

      if (dialectSupportsArray()) {
        testSql({ col: { [Op.any]: [2, 3, 4] } }, {
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: '"col" = ANY (ARRAY[2,3,4])',
        });

        testSql({ col: { [Op.any]: literal('literal') } }, {
          default: '[col] = ANY (literal)',
        });

        testSql({ col: { [Op.any]: { [Op.values]: [col('col')] } } }, {
          default: '[col] = ANY (VALUES ([col]))',
        });

        testSql({ col: { [Op.all]: [2, 3, 4] } }, {
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: '"col" = ALL (ARRAY[2,3,4])',
        });

        testSql({ col: { [Op.all]: literal('literal') } }, {
          default: '[col] = ALL (literal)',
        });

        testSql({ col: { [Op.all]: { [Op.values]: [col('col')] } } }, {
          default: '[col] = ALL (VALUES ([col]))',
        });

        // e.g. "col" LIKE ANY (VALUES ("col2"))
        testSql({
          col: {
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
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: `"col" = ANY (VALUES (literal), (UPPER("col2")), ("col3"), (CAST("col" AS STRING)), ('abc'), (1))`,
        });
      }
    });

    describe('Op.eq', () => {
      testSql({ id: { [Op.eq]: 1 } }, {
        default: '[id] = 1',
      });

      testSql.skip({ 'id::integer': { [Op.eq]: 1 } }, {
        default: 'CAST([id] AS INTEGER) = 1',
      });

      if (dialectSupportsArray()) {
        testSql({ id: { [Op.eq]: [1, 2] } }, {
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: '"id" = ARRAY[1,2]',
        });
      }

      testSql({ deleted: { [Op.eq]: null } }, {
        default: '[deleted] IS NULL',
      });

      testSql({ deleted: { [Op.eq]: true } }, {
        default: '[deleted] = true',
      });

      testSequelizeValueMethods(Op.eq, '=');
      testSupportsAnyAll(Op.eq, '=', [2, 3, 4]);
    });

    describe('Op.ne', () => {
      testSql({ id: { [Op.ne]: 1 } }, {
        default: '[id] != 1',
      });

      if (dialectSupportsArray()) {
        testSql({ id: { [Op.ne]: [1, 2] } }, {
          // 'default' is not used because ARRAY[2,3,4] is transformed into ARRAY"2,3,4"
          postgres: '"id" != ARRAY[1,2]',
        });
      }

      testSql({ deleted: { [Op.ne]: null } }, {
        default: '[deleted] IS NOT NULL',
      });

      testSql({ deleted: { [Op.ne]: true } }, {
        default: '[deleted] != true',
      });

      testSequelizeValueMethods(Op.ne, '!=');
      testSupportsAnyAll(Op.ne, '!=', [2, 3, 4]);
    });

    describe('Op.is', () => {
      testSql({ deleted: { [Op.is]: null } }, {
        default: '[deleted] IS NULL',
      });

      testSql({ deleted: { [Op.is]: false } }, {
        default: '[deleted] IS false',
        mssql: '[deleted] IS 0',
        ibmi: '"deleted" IS 0',
        sqlite: '`deleted` IS 0',
      });

      testSql({ deleted: { [Op.is]: true } }, {
        default: '[deleted] IS true',
        mssql: '[deleted] IS 1',
        ibmi: '"deleted" IS 1',
        sqlite: '`deleted` IS 1',
      });

      // @ts-expect-error
      testSql.skip({ deleted: { [Op.is]: 1 } }, {
        default: new Error('Op.is expected a boolean or null, but received 1'),
      });

      // @ts-expect-error
      testSql.skip({ col1: { [Op.is]: { [Op.col]: 'col2' } } }, {
        default: new Error('column references are not supported by Op.is'),
      });

      // @ts-expect-error
      testSql.skip({ col1: { [Op.is]: col('col2') } }, {
        default: new Error('column references are not supported by Op.is'),
      });

      testSql({ col: { [Op.is]: literal('literal') } }, {
        default: '[col] IS literal',
      });

      // @ts-expect-error
      testSql.skip({ col1: { [Op.is]: fn('UPPER', col('col2')) } }, {
        default: new Error('SQL functions are not supported by Op.is'),
      });

      // @ts-expect-error
      testSql.skip({ col: { [Op.is]: cast(col('col'), 'boolean') } }, {
        default: new Error('CAST is not supported by Op.is'),
      });

      if (dialectSupportsArray()) {
        // @ts-expect-error
        testSql.skip({ col: { [Op.is]: { [Op.any]: [2, 3] } } }, {
          default: new Error('Op.any is not supported by Op.is'),
        });

        // @ts-expect-error
        testSql.skip({ col: { [Op.is]: { [Op.all]: [2, 3, 4] } } }, {
          default: new Error('Op.all is not supported by Op.is'),
        });
      }
    });

    describe('Op.not', () => {
      testSql({ deleted: { [Op.not]: null } }, {
        default: '[deleted] IS NOT NULL',
      });

      testSql({ deleted: { [Op.not]: false } }, {
        default: '[deleted] IS NOT false',
        mssql: '[deleted] IS NOT 0',
        ibmi: '"deleted" IS NOT 0',
        sqlite: '`deleted` IS NOT 0',
      });

      testSql({ deleted: { [Op.not]: true } }, {
        default: '[deleted] IS NOT true',
        mssql: '[deleted] IS NOT 1',
        ibmi: '"deleted" IS NOT 1',
        sqlite: '`deleted` IS NOT 1',
      });

      testSql({ deleted: { [Op.not]: 1 } }, {
        default: '[deleted] != 1',
      });

      testSequelizeValueMethods(Op.not, '!=');
      testSupportsAnyAll(Op.not, '!=', [2, 3, 4]);

      testSql({ [Op.not]: { col: 5 } }, {
        default: 'NOT ([col] = 5)',
      });

      testSql({ [Op.not]: { col: { [Op.gt]: 5 } } }, {
        default: 'NOT ([col] > 5)',
      });

      testSql.skip({ [Op.not]: where(col('col'), Op.eq, '5') }, {
        default: 'NOT ([col] = 5)',
      });

      testSql.skip({ [Op.not]: json('data.key', 10) }, {
        default: 'NOT (([data]#>>\'{key}\') = 10)',
      });

      testSql.skip({ col: { [Op.not]: { [Op.gt]: 5 } } }, {
        default: 'NOT ([col] > 5)',
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
        testSql({ id: { [operator]: 1 } }, {
          default: `[id] ${sqlOperator} 1`,
        });

        expectTypeOf({ col: { [Op.gt]: null } }).not.toMatchTypeOf<WhereOperators>();
        testSql.skip({ deleted: { [operator]: null } }, {
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
        expectTypeOf({ id: { [Op.between]: [1, 2] } }).toMatchTypeOf<WhereOptions>();
        expectTypeOf({ id: { [Op.between]: [new Date(), new Date()] } }).toMatchTypeOf<WhereOptions>();
        expectTypeOf({ id: { [Op.between]: ['a', 'b'] } }).toMatchTypeOf<WhereOptions>();

        // expectTypeOf doesn't work with this one:
        {
          const ignoreRight: WhereOptions = {
            id: { [Op.between]: [1, 2] },
          };

          // @ts-expect-error
          const ignoreWrong: WhereOptions = {
            id: { [Op.between]: [1, 2, 3] },
          };

          // @ts-expect-error
          const ignoreWrong2: WhereOptions = {
            id: { [Op.between]: [1] },
          };

          // @ts-expect-error
          const ignoreWrong3: WhereOptions = {
            id: { [Op.between]: [] },
          };
        }

        testSql({ id: { [operator]: [1, 2] } }, {
          default: `[id] ${sqlOperator} 1 AND 2`,
        });

        testSql.skip({ id: { [operator]: [1] } }, {
          default: new Error(`Op.${operator.description} expects an array of exactly 2 items.`),
        });

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: [col('col1'), col('col2')] } };
          testSql({ id: { [operator]: [col('col1'), col('col2')] } }, {
            default: `[id] ${sqlOperator} [col1] AND [col2]`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: [literal('literal1'), literal('literal2')] } };
          testSql({ id: { [operator]: [literal('literal1'), literal('literal2')] } }, {
            default: `[id] ${sqlOperator} literal1 AND literal2`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: [fn('NOW'), fn('NOW')] } };
          testSql({ id: { [operator]: [fn('NOW'), fn('NOW')] } }, {
            default: `[id] ${sqlOperator} NOW() AND NOW()`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } };
          testSql.skip({ id: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } }, {
            default: `[id] ${sqlOperator} "col1" AND "col2"`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } };
          testSql({ id: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } }, {
            default: `[id] ${sqlOperator} CAST([col] AS STRING) AND CAST([col] AS STRING)`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.between]: literal('literal1 AND literal2') } };
          testSql.skip({ id: { [operator]: literal('literal1 AND literal2') } }, {
            default: `[id] ${sqlOperator} BETWEEN literal1 AND literal2`,
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
          const ignoreRight: WhereOptions = { id: { [Op.in]: [1, 2, 3] } };
          testSql({ id: { [operator]: [1, 2, 3] } }, {
            default: `[id] ${sqlOperator} (1, 2, 3)`,
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.in]: 1 } };
          testSql.skip({ id: { [operator]: 1 } }, {
            default: new Error(`Op.${operator.description} expects an array.`),
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.in]: col('col2') } };
          testSql.skip({ id: { [operator]: col('col1') } }, {
            default: new Error(`Op.${operator.description} expects an array.`),
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: [col('col1'), col('col2')] } };
          testSql({ id: { [operator]: [col('col1'), col('col2')] } }, {
            default: `[id] ${sqlOperator} ([col1], [col2])`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: [literal('literal1'), literal('literal2')] } };
          testSql({ id: { [operator]: [literal('literal1'), literal('literal2')] } }, {
            default: `[id] ${sqlOperator} (literal1, literal2)`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: [fn('NOW'), fn('NOW')] } };
          testSql({ id: { [operator]: [fn('NOW'), fn('NOW')] } }, {
            default: `[id] ${sqlOperator} (NOW(), NOW())`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } };
          testSql.skip({ id: { [operator]: [{ [Op.col]: 'col1' }, { [Op.col]: 'col2' }] } }, {
            default: `[id] ${sqlOperator} ("col1", "col2")`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } };
          testSql({ id: { [operator]: [cast(col('col'), 'string'), cast(col('col'), 'string')] } }, {
            default: `[id] ${sqlOperator} (CAST([col] AS STRING), CAST([col] AS STRING))`,
          });
        }

        {
          const ignoreRight: WhereOptions = { id: { [Op.in]: literal('literal') } };
          testSql({ id: { [operator]: literal('literal') } }, {
            default: `[id] ${sqlOperator} literal`,
          });
        }

        extraTests();
      });
    }

    describeInSuite(Op.in, 'IN', () => {
      testSql({ equipment: { [Op.in]: [] } }, {
        default: '[equipment] IN (NULL)',
      });
    });

    describeInSuite(Op.notIn, 'NOT IN', () => {
      testSql({ equipment: { [Op.notIn]: [] } }, {
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
        expectTypeOf({ id: { [Op.like]: '%id' } }).toMatchTypeOf<WhereOptions>();
        testSql({ id: { [operator]: '%id' } }, {
          default: `[id] ${sqlOperator} '%id'`,
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

      if (!dialectSupportsArray()) {
        return;
      }

      expectTypeOf<WhereOperators[typeof Op.contains]>().toEqualTypeOf<WhereOperators[typeof Op.overlap]>();
      expectTypeOf<WhereOperators[typeof Op.contained]>().toEqualTypeOf<WhereOperators[typeof Op.overlap]>();

      describe(`Op.${operator.description}`, () => {
        {
          const ignoreRight: WhereOptions = { id: { [Op.overlap]: [1, 2, 3] } };
          testSql({ id: { [operator]: [1, 2, 3] } }, {
            postgres: `"id" ${sqlOperator} ARRAY[1,2,3]`,
          });
        }

        testSequelizeValueMethods(operator, sqlOperator);
        // testSupportsAnyAll(operator, sqlOperator, [[1, 2], [1, 2]]);

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.overlap]: [col('col')] } };
          testSql.skip({ id: { [operator]: [col('col')] } }, {
            default: new Error(`Op.${operator.description} does not support arrays of cols`),
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.overlap]: [{ [Op.col]: 'col' }] } };
          testSql.skip({ id: { [operator]: [{ [Op.col]: 'col' }] } }, {
            default: new Error(`Op.${operator.description} does not support arrays of cols`),
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.overlap]: [literal('literal')] } };
          testSql.skip({ id: { [operator]: [literal('literal')] } }, {
            default: new Error(`Op.${operator.description} does not support arrays of literals`),
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.overlap]: [fn('NOW')] } };
          testSql.skip({ id: { [operator]: [fn('NOW')] } }, {
            default: new Error(`Op.${operator.description} does not support arrays of fn`),
          });
        }

        {
          // @ts-expect-error
          const ignoreWrong: WhereOptions = { id: { [Op.overlap]: [cast(col('col'), 'string')] } };
          testSql.skip({ id: { [operator]: [cast(col('col'), 'string')] } }, {
            default: new Error(`Op.${operator.description} does not support arrays of cast`),
          });
        }
      });
    }

    describeOverlapSuite(Op.overlap, '&&');
    describeOverlapSuite(Op.contains, '@>');
    describeOverlapSuite(Op.contained, '<@');

    describe('Op.startsWith', () => {
      testSql({
        username: {
          [Op.startsWith]: 'swagger',
        },
      }, {
        default: `[username] LIKE 'swagger%'`,
        mssql: `[username] LIKE N'swagger%'`,
      });

      testSql({
        username: {
          [Op.startsWith]: 'sql\'injection',
        },
      }, {
        default: `[username] LIKE 'sql''injection%'`,
        mssql: `[username] LIKE N'sql''injection%'`,
      });

      // startsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        username: {
          [Op.startsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[username] LIKE 'sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[username] LIKE N'sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        username: {
          [Op.startsWith]: literal('swagger'),
        },
      }, {
        default: `[username] LIKE 'swagger%'`,
        mssql: `[username] LIKE N'swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        username: {
          [Op.startsWith]: literal('$bind'),
        },
      }, {
        default: `[username] LIKE CONCAT($bind, '%')`,
        mssql: `[username] LIKE CONCAT($bind, N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.startsWith]: col('username'),
        },
      }, {
        default: `[username] LIKE CONCAT("username", '%')`,
        mssql: `[username] LIKE CONCAT("username", N'%')`,
      });

      testSql.skip({
        username: {
          // @ts-expect-error not possible in v6 yet
          [Op.startsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[username] LIKE CONCAT("username", '%')`,
        mssql: `[username] LIKE CONCAT("username", N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.startsWith]: fn('NOW'),
        },
      }, {
        default: `[username] LIKE CONCAT(NOW(), '%')`,
        mssql: `[username] LIKE CONCAT(NOW(), N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.startsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[username] LIKE CONCAT(CAST(NOW() AS STRING), '%')`,
        mssql: `[username] LIKE CONCAT(CAST(NOW() AS STRING), N'%')`,
      });
    });

    describe('Op.endsWith', () => {
      testSql({
        username: {
          [Op.endsWith]: 'swagger',
        },
      }, {
        default: `[username] LIKE '%swagger'`,
        mssql: `[username] LIKE N'%swagger'`,
      });

      testSql({
        username: {
          [Op.endsWith]: 'sql\'injection',
        },
      }, {
        default: `[username] LIKE '%sql''injection'`,
        mssql: `[username] LIKE N'%sql''injection'`,
      });

      // endsWith should escape anything that has special meaning in LIKE
      testSql.skip({
        username: {
          [Op.endsWith]: 'like%injection',
        },
      }, {
        default: String.raw`[username] LIKE '%sql\%injection' ESCAPE '\'`,
        mssql: String.raw`[username] LIKE N'%sql\%injection' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        username: {
          [Op.endsWith]: literal('swagger'),
        },
      }, {
        default: `[username] LIKE '%swagger'`,
        mssql: `[username] LIKE N'%swagger'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        username: {
          [Op.endsWith]: literal('$bind'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', $bind)`,
        mssql: `[username] LIKE CONCAT(N'%', $bind)`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.endsWith]: col('username'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', "username")`,
        mssql: `[username] LIKE CONCAT(N'%', "username")`,
      });

      testSql.skip({
        username: {
          // @ts-expect-error not possible in v6 yet
          [Op.endsWith]: { [Op.col]: 'username' },
        },
      }, {
        default: `[username] LIKE CONCAT('%', "username")`,
        mssql: `[username] LIKE CONCAT(N'%', "username")`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.endsWith]: fn('NOW'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', NOW())`,
        mssql: `[username] LIKE CONCAT(N'%', NOW())`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.endsWith]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', CAST(NOW() AS STRING))`,
        mssql: `[username] LIKE CONCAT(N'%', CAST(NOW() AS STRING))`,
      });
    });

    describe('Op.substring', () => {
      testSql({
        username: {
          [Op.substring]: 'swagger',
        },
      }, {
        default: `[username] LIKE '%swagger%'`,
        mssql: `[username] LIKE N'%swagger%'`,
      });

      testSql({
        username: {
          [Op.substring]: 'sql\'injection',
        },
      }, {
        default: `[username] LIKE '%sql''injection%'`,
        mssql: `[username] LIKE N'%sql''injection%'`,
      });

      // substring should escape anything that has special meaning in LIKE
      testSql.skip({
        username: {
          [Op.substring]: 'like%injection',
        },
      }, {
        default: String.raw`[username] LIKE '%sql\%injection%' ESCAPE '\'`,
        mssql: String.raw`[username] LIKE N'%sql\%injection%' ESCAPE '\'`,
      });

      // TODO: remove this test in v7 (breaking change)
      testSql({
        username: {
          [Op.substring]: literal('swagger'),
        },
      }, {
        default: `[username] LIKE '%swagger%'`,
        mssql: `[username] LIKE N'%swagger%'`,
      });

      // TODO: in v7: support `col`, `literal`, and others
      // TODO: these would require escaping LIKE values in SQL itself
      //  output should be something like:
      //  `LIKE CONCAT(ESCAPE($bind, '%', '\\%'), '%') ESCAPE '\\'`
      //  with missing special characters.
      testSql.skip({
        username: {
          [Op.substring]: literal('$bind'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', $bind, '%')`,
        mssql: `[username] LIKE CONCAT(N'%', $bind, N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.substring]: col('username'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', "username", '%')`,
        mssql: `[username] LIKE CONCAT(N'%', "username", N'%')`,
      });

      testSql.skip({
        username: {
          // @ts-expect-error not possible in v6 yet
          [Op.substring]: { [Op.col]: 'username' },
        },
      }, {
        default: `[username] LIKE CONCAT('%', "username", '%')`,
        mssql: `[username] LIKE CONCAT(N'%', "username", N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.substring]: fn('NOW'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', NOW(), '%')`,
        mssql: `[username] LIKE CONCAT(N'%', NOW(), N'%')`,
      });

      // @ts-expect-error not possible in v6 yet
      testSql.skip({
        username: {
          [Op.substring]: cast(fn('NOW'), 'string'),
        },
      }, {
        default: `[username] LIKE CONCAT('%', CAST(NOW() AS STRING), '%')`,
        mssql: `[username] LIKE CONCAT(N'%', CAST(NOW() AS STRING), N'%')`,
      });
    });

    // TODO: Op.regexp, Op.notRegexp, Op.iRegexp, Op.notIRegexp
    // TODO: Op.match
    // TODO: Op.strictLeft, strictRight, noExtendLeft, noExtendRight

    if (sequelize.dialect.supports.REGEXP) {
      describe('Op.regexp', () => {
        testSql({
          username: {
            [Op.regexp]: '^sw.*r$',
          },
        }, {
          mariadb: '`username` REGEXP \'^sw.*r$\'',
          mysql: '`username` REGEXP \'^sw.*r$\'',
          snowflake: '"username" REGEXP \'^sw.*r$\'',
          postgres: '"username" ~ \'^sw.*r$\'',
        });
      });

      describe('Op.regexp', () => {
        testSql({
          newline: {
            [Op.regexp]: '^new\nline$',
          },
        }, {
          mariadb: '`newline` REGEXP \'^new\\nline$\'',
          mysql: '`newline` REGEXP \'^new\\nline$\'',
          snowflake: '"newline" REGEXP \'^new\nline$\'',
          postgres: '"newline" ~ \'^new\nline$\'',
        });
      });

      describe('Op.notRegexp', () => {
        testSql({
          username: {
            [Op.notRegexp]: '^sw.*r$',
          },
        }, {
          mariadb: '`username` NOT REGEXP \'^sw.*r$\'',
          mysql: '`username` NOT REGEXP \'^sw.*r$\'',
          snowflake: '"username" NOT REGEXP \'^sw.*r$\'',
          postgres: '"username" !~ \'^sw.*r$\'',
        });
      });

      describe('Op.notRegexp', () => {
        testSql({
          newline: {
            [Op.notRegexp]: '^new\nline$',
          },
        }, {
          mariadb: '`newline` NOT REGEXP \'^new\\nline$\'',
          mysql: '`newline` NOT REGEXP \'^new\\nline$\'',
          snowflake: '"newline" NOT REGEXP \'^new\nline$\'',
          postgres: '"newline" !~ \'^new\nline$\'',
        });
      });

      if (sequelize.dialect.name === 'postgres') {
        describe('Op.iRegexp', () => {
          testSql({
            username: {
              [Op.iRegexp]: '^sw.*r$',
            },
          }, {
            postgres: '"username" ~* \'^sw.*r$\'',
          });
        });

        describe('Op.iRegexp', () => {
          testSql({
            newline: {
              [Op.iRegexp]: '^new\nline$',
            },
          }, {
            postgres: '"newline" ~* \'^new\nline$\'',
          });
        });

        describe('Op.notIRegexp', () => {
          testSql({
            username: {
              [Op.notIRegexp]: '^sw.*r$',
            },
          }, {
            postgres: '"username" !~* \'^sw.*r$\'',
          });
        });

        describe('Op.notIRegexp', () => {
          testSql({
            newline: {
              [Op.notIRegexp]: '^new\nline$',
            },
          }, {
            postgres: '"newline" !~* \'^new\nline$\'',
          });
        });
      }
    }

    if (sequelize.dialect.supports.TSVESCTOR) {
      describe('Op.match', () => {
        testSql({
          username: {
            [Op.match]: fn('to_tsvector', 'swagger'),
          },
        }, {
          postgres: '[username] @@ to_tsvector(\'swagger\')',
        });
      });
    }

    if (dialectSupportsArray()) {
      describe('Op.any', () => {
        testSql({
          userId: {
            [Op.any]: [4, 5, 6],
          },
        }, {
          postgres: '"userId" = ANY (ARRAY[4,5,6])',
        });

        testSql({
          userId: {
            [Op.any]: [2, 5],
          },
        }, {
          postgres: '"userId" = ANY (ARRAY[2,5]::INTEGER[])',
        }, {
          field: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
          },
        });
      });

      describe('Op.all', () => {
        testSql({
          userId: {
            [Op.all]: [4, 5, 6],
          },
        }, {
          postgres: '"userId" = ALL (ARRAY[4,5,6])',
        });

        testSql({
          userId: {
            [Op.all]: [2, 5],
          },
        }, {
          postgres: '"userId" = ALL (ARRAY[2,5]::INTEGER[])',
        }, {
          field: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
          },
        });
      });
    }

    if (dialectSupportsRange()) {
      describe('RANGE', () => {

        testSql({
          range: {
            [Op.contains]: new Date(Date.UTC(2000, 1, 1)),
          },
        }, {
          postgres: '"Timeline"."range" @> \'2000-02-01 00:00:00.000 +00:00\'::timestamptz',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE),
          },
          prefix: 'Timeline',
        });

        testSql({
          range: {
            [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))],
          },
        }, {
          postgres: '"Timeline"."range" @> \'["2000-02-01 00:00:00.000 +00:00","2000-03-01 00:00:00.000 +00:00")\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE),
          },
          prefix: 'Timeline',
        });

        testSql({
          unboundedRange: {
            [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), null],
          },
        }, {
          postgres: '"Timeline"."unboundedRange" @> \'["2000-02-01 00:00:00.000 +00:00",)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE),
          },
          prefix: 'Timeline',
        });

        testSql({
          unboundedRange: {
            [Op.contains]: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
          },
        }, {
          postgres: '"Timeline"."unboundedRange" @> \'[-infinity,infinity)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE),
          },
          prefix: 'Timeline',
        });

        testSql({
          range: {
            [Op.contained]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))],
          },
        }, {
          postgres: '"Timeline"."range" <@ \'["2000-02-01 00:00:00.000 +00:00","2000-03-01 00:00:00.000 +00:00")\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE),
          },
          prefix: 'Timeline',
        });

        testSql({
          reservedSeats: {
            [Op.overlap]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" && \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });

        testSql({
          reservedSeats: {
            [Op.adjacent]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" -|- \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });

        testSql({
          reservedSeats: {
            [Op.strictLeft]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" << \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });

        testSql({
          reservedSeats: {
            [Op.strictRight]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" >> \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });

        testSql({
          reservedSeats: {
            [Op.noExtendRight]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" &< \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });

        testSql({
          reservedSeats: {
            [Op.noExtendLeft]: [1, 4],
          },
        }, {
          postgres: '"Room"."reservedSeats" &> \'[1,4)\'',
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(),
          },
          prefix: 'Room',
        });
      });
    }

    if (sequelize.dialect.supports.JSON) {
      describe('JSON', () => {
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
          data: {
            nested: {
              attribute: 'value',
            },
          },
        }, {
          mariadb: 'json_unquote(json_extract(`User`.`data`,\'$.nested.attribute\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`User`.`data`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\'',
          postgres: '("User"."data"#>>\'{nested,attribute}\') = \'value\'',
          sqlite: 'json_extract(`User`.`data`,\'$.nested.attribute\') = \'value\'',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
          prefix: 'User',
        });

        testSql({
          data: {
            nested: {
              [Op.in]: [1, 2],
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested\')) AS DECIMAL) IN (1, 2)',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\"\')) AS DECIMAL) IN (1, 2)',
          postgres: 'CAST(("data"#>>\'{nested}\') AS DOUBLE PRECISION) IN (1, 2)',
          sqlite: 'CAST(json_extract(`data`,\'$.nested\') AS DOUBLE PRECISION) IN (1, 2)',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({
          data: {
            nested: {
              [Op.between]: [1, 2],
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested\')) AS DECIMAL) BETWEEN 1 AND 2',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\"\')) AS DECIMAL) BETWEEN 1 AND 2',
          postgres: 'CAST(("data"#>>\'{nested}\') AS DOUBLE PRECISION) BETWEEN 1 AND 2',
          sqlite: 'CAST(json_extract(`data`,\'$.nested\') AS DOUBLE PRECISION) BETWEEN 1 AND 2',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({
          data: {
            nested: {
              attribute: 'value',
              prop: {
                [Op.ne]: 'None',
              },
            },
          },
        }, {
          mariadb: '(json_unquote(json_extract(`User`.`data`,\'$.nested.attribute\')) = \'value\' AND json_unquote(json_extract(`User`.`data`,\'$.nested.prop\')) != \'None\')',
          mysql: '(json_unquote(json_extract(`User`.`data`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\' AND json_unquote(json_extract(`User`.`data`,\'$.\\"nested\\".\\"prop\\"\')) != \'None\')',
          postgres: '(("User"."data"#>>\'{nested,attribute}\') = \'value\' AND ("User"."data"#>>\'{nested,prop}\') != \'None\')',
          sqlite: '(json_extract(`User`.`data`,\'$.nested.attribute\') = \'value\' AND json_extract(`User`.`data`,\'$.nested.prop\') != \'None\')',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
          prefix: literal(sql.quoteTable.call(sequelize.dialect.queryGenerator, { tableName: 'User' })),
        });

        testSql({
          data: {
            name: {
              last: 'Simpson',
            },
            employment: {
              [Op.ne]: 'None',
            },
          },
        }, {
          mariadb: '(json_unquote(json_extract(`User`.`data`,\'$.name.last\')) = \'Simpson\' AND json_unquote(json_extract(`User`.`data`,\'$.employment\')) != \'None\')',
          mysql: '(json_unquote(json_extract(`User`.`data`,\'$.\\"name\\".\\"last\\"\')) = \'Simpson\' AND json_unquote(json_extract(`User`.`data`,\'$.\\"employment\\"\')) != \'None\')',
          postgres: '(("User"."data"#>>\'{name,last}\') = \'Simpson\' AND ("User"."data"#>>\'{employment}\') != \'None\')',
          sqlite: '(json_extract(`User`.`data`,\'$.name.last\') = \'Simpson\' AND json_extract(`User`.`data`,\'$.employment\') != \'None\')',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
          prefix: 'User',
        });

        testSql({
          data: {
            price: 5,
            name: 'Product',
          },
        }, {
          mariadb: '(CAST(json_unquote(json_extract(`data`,\'$.price\')) AS DECIMAL) = 5 AND json_unquote(json_extract(`data`,\'$.name\')) = \'Product\')',
          mysql: '(CAST(json_unquote(json_extract(`data`,\'$.\\"price\\"\')) AS DECIMAL) = 5 AND json_unquote(json_extract(`data`,\'$.\\"name\\"\')) = \'Product\')',
          postgres: '(CAST(("data"#>>\'{price}\') AS DOUBLE PRECISION) = 5 AND ("data"#>>\'{name}\') = \'Product\')',
          sqlite: '(CAST(json_extract(`data`,\'$.price\') AS DOUBLE PRECISION) = 5 AND json_extract(`data`,\'$.name\') = \'Product\')',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({ 'data.nested.attribute': 'value' }, {
          mariadb: 'json_unquote(json_extract(`data`,\'$.nested.attribute\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\'',
          postgres: '("data"#>>\'{nested,attribute}\') = \'value\'',
          sqlite: 'json_extract(`data`,\'$.nested.attribute\') = \'value\'',
        }, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSONB(),
              },
            },
          },
        });

        testSql({ 'data.nested.attribute': 4 }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested.attribute\')) AS DECIMAL) = 4',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) = 4',
          postgres: 'CAST(("data"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) = 4',
          sqlite: 'CAST(json_extract(`data`,\'$.nested.attribute\') AS DOUBLE PRECISION) = 4',
        }, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSON(),
              },
            },
          },
        });

        testSql({
          'data.nested.attribute': {
            [Op.in]: [3, 7],
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested.attribute\')) AS DECIMAL) IN (3, 7)',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) IN (3, 7)',
          postgres: 'CAST(("data"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) IN (3, 7)',
          sqlite: 'CAST(json_extract(`data`,\'$.nested.attribute\') AS DOUBLE PRECISION) IN (3, 7)',
        }, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSONB(),
              },
            },
          },
        });

        testSql({
          data: {
            nested: {
              attribute: {
                [Op.gt]: 2,
              },
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested.attribute\')) AS DECIMAL) > 2',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) > 2',
          postgres: 'CAST(("data"#>>\'{nested,attribute}\') AS DOUBLE PRECISION) > 2',
          sqlite: 'CAST(json_extract(`data`,\'$.nested.attribute\') AS DOUBLE PRECISION) > 2',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({
          data: {
            nested: {
              'attribute::integer': {
                [Op.gt]: 2,
              },
            },
          },
        }, {
          mariadb: 'CAST(json_unquote(json_extract(`data`,\'$.nested.attribute\')) AS DECIMAL) > 2',
          mysql: 'CAST(json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) AS DECIMAL) > 2',
          postgres: 'CAST(("data"#>>\'{nested,attribute}\') AS INTEGER) > 2',
          sqlite: 'CAST(json_extract(`data`,\'$.nested.attribute\') AS INTEGER) > 2',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        const dt = new Date();
        testSql({
          data: {
            nested: {
              attribute: {
                [Op.gt]: dt,
              },
            },
          },
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`data\`,'$.nested.attribute')) AS DATETIME) > ${sql.escape(dt)}`,
          mysql: `CAST(json_unquote(json_extract(\`data\`,'$.\\"nested\\".\\"attribute\\"')) AS DATETIME) > ${sql.escape(dt)}`,
          postgres: `CAST(("data"#>>'{nested,attribute}') AS TIMESTAMPTZ) > ${sql.escape(dt)}`,
          sqlite: `json_extract(\`data\`,'$.nested.attribute') > ${sql.escape(dt.toISOString())}`,
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({
          data: {
            nested: {
              attribute: true,
            },
          },
        }, {
          mariadb: 'json_unquote(json_extract(`data`,\'$.nested.attribute\')) = \'true\'',
          mysql: 'json_unquote(json_extract(`data`,\'$.\\"nested\\".\\"attribute\\"\')) = \'true\'',
          postgres: 'CAST(("data"#>>\'{nested,attribute}\') AS BOOLEAN) = true',
          sqlite: 'CAST(json_extract(`data`,\'$.nested.attribute\') AS BOOLEAN) = 1',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });

        testSql({ 'metaData.nested.attribute': 'value' }, {
          mariadb: 'json_unquote(json_extract(`meta_data`,\'$.nested.attribute\')) = \'value\'',
          mysql: 'json_unquote(json_extract(`meta_data`,\'$.\\"nested\\".\\"attribute\\"\')) = \'value\'',
          postgres: '("meta_data"#>>\'{nested,attribute}\') = \'value\'',
          sqlite: 'json_extract(`meta_data`,\'$.nested.attribute\') = \'value\'',
        }, {
          model: {
            rawAttributes: {
              metaData: {
                field: 'meta_data',
                fieldName: 'metaData',
                type: new DataTypes.JSONB(),
              },
            },
          },
        });
      });
    }

    if (sequelize.dialect.supports.JSONB) {
      describe('JSONB', () => {
        testSql({
          data: {
            [Op.contains]: {
              company: 'Magnafone',
            },
          },
        }, {
          default: '[data] @> \'{"company":"Magnafone"}\'',
        }, {
          field: {
            type: new DataTypes.JSONB(),
          },
        });
      });
    }

    // TODO: OR, AND

    testSql({
      name: 'a project',
      [Op.or]: [
        { id: [1, 2, 3] },
        { id: { [Op.gt]: 10 } },
      ],
    }, {
      default: '([id] IN (1, 2, 3) OR [id] > 10) AND [name] = \'a project\'',
      mssql: '([id] IN (1, 2, 3) OR [id] > 10) AND [name] = N\'a project\'',
    });
  });

  describe('whereItemQuery', () => {
    function testSql(key: string | undefined, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(`${String(key)}: ${util.inspect(value, { depth: 10 })}${options && `, ${util.inspect(options)}` || ''}`, () => {
        return expectsql(sql.whereItemQuery(key, value, options), expectation);
      });
    }

    testSql(undefined, 'lol=1', {
      default: 'lol=1',
    });

    describe('Op.and/Op.or/Op.not', () => {
      describe('Op.or', () => {
        testSql('email', {
          [Op.or]: ['maker@mhansen.io', 'janzeh@gmail.com'],
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')',
        });

        testSql('rank', {
          [Op.or]: {
            [Op.lt]: 100,
            [Op.eq]: null,
          },
        }, {
          default: '([rank] < 100 OR [rank] IS NULL)',
        });

        testSql(Op.or, [
          { email: 'maker@mhansen.io' },
          { email: 'janzeh@gmail.com' },
        ], {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')',
        });

        testSql(Op.or, {
          email: 'maker@mhansen.io',
          name: 'Mick Hansen',
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [name] = \'Mick Hansen\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [name] = N\'Mick Hansen\')',
        });

        testSql(Op.or, {
          equipment: [1, 3],
          muscles: {
            [Op.in]: [2, 4],
          },
        }, {
          default: '([equipment] IN (1, 3) OR [muscles] IN (2, 4))',
        });

        testSql(Op.or, [
          {
            roleName: 'NEW',
          }, {
            roleName: 'CLIENT',
            type: 'CLIENT',
          },
        ], {
          default: '([roleName] = \'NEW\' OR ([roleName] = \'CLIENT\' AND [type] = \'CLIENT\'))',
          mssql: '([roleName] = N\'NEW\' OR ([roleName] = N\'CLIENT\' AND [type] = N\'CLIENT\'))',
        });

        it('or({group_id: 1}, {user_id: 2})', () => {
          expectsql(sql.whereItemQuery(undefined, or({ group_id: 1 }, { user_id: 2 })), {
            default: '([group_id] = 1 OR [user_id] = 2)',
          });
        });

        it('or({group_id: 1}, {user_id: 2, role: \'admin\'})', () => {
          expectsql(sql.whereItemQuery(undefined, or({ group_id: 1 }, { user_id: 2, role: 'admin' })), {
            default: '([group_id] = 1 OR ([user_id] = 2 AND [role] = \'admin\'))',
            mssql: '([group_id] = 1 OR ([user_id] = 2 AND [role] = N\'admin\'))',
          });
        });

        testSql(Op.or, [], {
          default: '0 = 1',
        });

        testSql(Op.or, {}, {
          default: '0 = 1',
        });

        it('or()', () => {
          expectsql(sql.whereItemQuery(undefined, or()), {
            default: '0 = 1',
          });
        });
      });

      describe('Op.and', () => {
        testSql(Op.and, {
          [Op.or]: {
            group_id: 1,
            user_id: 2,
          },
          shared: 1,
        }, {
          default: '(([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)',
        });

        testSql(Op.and, [
          {
            name: {
              [Op.like]: '%hello',
            },
          },
          {
            name: {
              [Op.like]: 'hello%',
            },
          },
        ], {
          default: '([name] LIKE \'%hello\' AND [name] LIKE \'hello%\')',
          mssql: '([name] LIKE N\'%hello\' AND [name] LIKE N\'hello%\')',
        });

        testSql('rank', {
          [Op.and]: {
            [Op.ne]: 15,
            [Op.between]: [10, 20],
          },
        }, {
          default: '([rank] != 15 AND [rank] BETWEEN 10 AND 20)',
        });

        testSql('name', {
          [Op.and]: [
            { [Op.like]: '%someValue1%' },
            { [Op.like]: '%someValue2%' },
          ],
        }, {
          default: '([name] LIKE \'%someValue1%\' AND [name] LIKE \'%someValue2%\')',
          mssql: '([name] LIKE N\'%someValue1%\' AND [name] LIKE N\'%someValue2%\')',
        });

        it('and({shared: 1, or({group_id: 1}, {user_id: 2}))', () => {
          expectsql(sql.whereItemQuery(undefined, and({ shared: 1 }, or({ group_id: 1 }, { user_id: 2 }))), {
            default: '([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))',
          });
        });
      });

      describe('Op.not', () => {
        testSql(Op.not, {
          [Op.or]: {
            group_id: 1,
            user_id: 2,
          },
          shared: 1,
        }, {
          default: 'NOT (([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)',
        });

        testSql(Op.not, [], {
          default: '0 = 1',
        });

        testSql(Op.not, {}, {
          default: '0 = 1',
        });
      });
    });

    describe('Op.col', () => {
      testSql('userId', {
        [Op.col]: 'user.id',
      }, {
        default: '[userId] = [user].[id]',
      });

      testSql('userId', {
        [Op.eq]: {
          [Op.col]: 'user.id',
        },
      }, {
        default: '[userId] = [user].[id]',
      });

      testSql('userId', {
        [Op.gt]: {
          [Op.col]: 'user.id',
        },
      }, {
        default: '[userId] > [user].[id]',
      });

      testSql(Op.or, [
        { ownerId: { [Op.col]: 'user.id' } },
        { ownerId: { [Op.col]: 'organization.id' } },
      ], {
        default: '([ownerId] = [user].[id] OR [ownerId] = [organization].[id])',
      });

      testSql('$organization.id$', {
        [Op.col]: 'user.organizationId',
      }, {
        default: '[organization].[id] = [user].[organizationId]',
      });

      testSql('$offer.organization.id$', {
        [Op.col]: 'offer.user.organizationId',
      }, {
        default: '[offer->organization].[id] = [offer->user].[organizationId]',
      });
    });

    describe('fn', () => {
      it('{name: fn(\'LOWER\', \'DERP\')}', () => {
        expectsql(sql.whereQuery({ name: fn('LOWER', 'DERP') }), {
          default: 'WHERE [name] = LOWER(\'DERP\')',
          mssql: 'WHERE [name] = LOWER(N\'DERP\')',
        });
      });
    });
  });

  describe('getWhereConditions', () => {
    function testSql(value, expectation) {
      const User = sequelize.define('user', {});

      it(util.inspect(value, { depth: 10 }), () => {
        return expectsql(sql.getWhereConditions(value, User.tableName, User), expectation);
      });
    }

    testSql(where(fn('lower', col('name')), null), {
      default: 'lower([name]) IS NULL',
    });

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

    testSql([where(fn('SUM', col('hours')), Op.gt, 0),
      where(fn('lower', col('name')), null)], {
      default: '(SUM([hours]) > 0 AND lower([name]) IS NULL)',
    });

    testSql(where(col('hours'), Op.between, [0, 5]), {
      default: '[hours] BETWEEN 0 AND 5',
    });

    testSql(where(col('hours'), Op.notBetween, [0, 5]), {
      default: '[hours] NOT BETWEEN 0 AND 5',
    });

    testSql(where(literal(`'hours'`), Op.eq, 'hours'), {
      default: `'hours' = 'hours'`,
      mssql: `'hours' = N'hours'`,
    });

    it('where(left: ModelAttributeColumnOptions, op, right)', () => {
      const User = sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          field: 'internal_id',
          primaryKey: true,
        },
      });

      const whereObj = where(User.getAttributes().id, Op.eq, 1);
      const expectations = { default: '[user].[internal_id] = 1' };

      return expectsql(sql.getWhereConditions(whereObj, User.tableName, User), expectations);
    });
  });
});
