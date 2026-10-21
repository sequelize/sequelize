import type { AbstractDialect, BoundQuery, Options } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import type { PostgresDialect } from '@sequelize/postgres';
import { isNotString, pojo } from '@sequelize/utils';
import { isNodeError } from '@sequelize/utils/node';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiDatetime from 'chai-datetime';
import defaults from 'lodash/defaults';
import isObject from 'lodash/isObject';
import type { ExclusiveTestFunction, PendingTestFunction, TestFunction } from 'mocha';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { inspect, isDeepStrictEqual } from 'node:util';
import type { SinonFakeTimers } from 'sinon';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import type { Class } from 'type-fest';
import { CONFIG, SQLITE_DATABASES_DIR } from './config/config';

export { getSqliteDatabasePath } from './config/config';

export type DialectName =
  'mysql' | 'postgres' | 'sqlite3' | 'mariadb' | 'mssql' | 'db2' | 'snowflake' | 'ibmi' | 'oracle';

const expect = chai.expect;

const packagesDir = path.resolve(__dirname, '..', '..');

const NON_DIALECT_PACKAGES = Object.freeze(['utils', 'validator-js', 'core']);

chai.use(chaiDatetime);
chai.use(chaiAsPromised);
chai.use(sinonChai);

/**
 * `expect(fn).to.throwWithCause()` works like `expect(fn).to.throw()`, except
 * that is also checks whether the message is present in the error cause.
 */
chai.Assertion.addMethod('throwWithCause', function throwWithCause(errorConstructor, errorMessage) {
  expect(withInlineCause(this._obj)).to.throw(errorConstructor, errorMessage);
});

chai.Assertion.addMethod('beNullish', function nullish() {
  expect(this._obj).to.not.exist;
});

chai.Assertion.addMethod('notBeNullish', function nullish() {
  expect(this._obj).to.exist;
});

function withInlineCause(cb: () => any): () => void {
  return () => {
    try {
      return cb();
    } catch (error) {
      assert(error instanceof Error);

      error.message = inlineErrorCause(error);

      throw error;
    }
  };
}

export function inlineErrorCause(error: unknown): string {
  if (!(error instanceof Error)) {
    return inspect(error);
  }

  let message = error.message;

  const cause = error.cause;
  if (cause instanceof Error) {
    message += `\nCaused by: ${inlineErrorCause(cause)}`;
  }

  return message;
}

chai.config.includeStack = true;

// Make sure errors get thrown when testing
process.on('uncaughtException', e => {
  console.error('An unhandled exception occurred:');
  throw e;
});

let onNextUnhandledRejection: ((error: unknown) => any) | null = null;
let unhandledRejections: unknown[] | null = null;

process.on('unhandledRejection', e => {
  if (unhandledRejections) {
    unhandledRejections.push(e);
  }

  const onNext = onNextUnhandledRejection;
  if (onNext) {
    onNextUnhandledRejection = null;
    onNext(e);
  }

  if (onNext || unhandledRejections) {
    return;
  }

  console.error('An unhandled rejection occurred:');
  throw e;
});

// 'support' is requested by dev/check-connection, which is not a mocha context
if (typeof afterEach !== 'undefined') {
  afterEach(() => {
    onNextUnhandledRejection = null;
    unhandledRejections = null;
  });
}

/**
 * Returns a Promise that will reject with the next unhandled rejection that occurs
 * during this test (instead of failing the test)
 */
export async function nextUnhandledRejection() {
  return new Promise((resolve, reject) => {
    onNextUnhandledRejection = reject;
  });
}

export function createSequelizeInstance<Dialect extends AbstractDialect = AbstractDialect>(
  options?: Omit<Options<Dialect>, 'dialect'>,
): Sequelize<Dialect> {
  const dialectName = getTestDialect();
  const config = CONFIG[dialectName];

  const sequelizeOptions = defaults(options, config, {
    // the test suite was written before CLS was turned on by default.
    disableClsTransactions: true,
  } as const);

  if (dialectName === 'postgres') {
    const sequelizePostgresOptions: Options<PostgresDialect> = {
      ...(sequelizeOptions as Options<PostgresDialect>),
      native: process.env.DIALECT === 'postgres-native',
    };

    return new Sequelize(sequelizePostgresOptions) as unknown as Sequelize<Dialect>;
  }

  return new Sequelize<Dialect>(sequelizeOptions as unknown as Options<Dialect>);
}

export function getSupportedDialects() {
  return fs.readdirSync(packagesDir).filter(file => !NON_DIALECT_PACKAGES.includes(file));
}

export function getTestDialectClass(): Class<AbstractDialect> {
  const dialectClass = CONFIG[getTestDialect()].dialect;

  isNotString.assert(dialectClass);

  return dialectClass;
}

export function getTestDialect(): DialectName {
  let envDialect = process.env.DIALECT || '';

  if (envDialect === 'postgres-native') {
    envDialect = 'postgres';
  }

  if (!getSupportedDialects().includes(envDialect)) {
    throw new Error(
      `The DIALECT environment variable was set to ${JSON.stringify(envDialect)}, which is not a supported dialect. Set it to one of ${getSupportedDialects()
        .map(d => JSON.stringify(d))
        .join(', ')} instead.`,
    );
  }

  return envDialect as DialectName;
}

export function getTestDialectTeaser(moduleName: string): string {
  let dialect: string = getTestDialect();

  if (process.env.DIALECT === 'postgres-native') {
    dialect = 'postgres-native';
  }

  return `[${dialect.toUpperCase()}] ${moduleName}`;
}

export function getPoolMax(): number {
  return CONFIG[getTestDialect()].pool?.max ?? 1;
}

type ExpectationKey = 'default' | Permutations<DialectName, 4>;

export type ExpectationRecord<V> = PartialRecord<ExpectationKey, V | Expectation<V> | Error>;

type DecrementedDepth = [never, 0, 1, 2, 3];

type Permutations<T extends string, Depth extends number, U extends string = T> = Depth extends 0
  ? never
  : T extends any
    ? T | `${T} ${Permutations<Exclude<U, T>, DecrementedDepth[Depth]>}`
    : never;

type PartialRecord<K extends keyof any, V> = Partial<Record<K, V>>;

/**
 * Runs `method` and checks its result, or the error it throws, against the expectation for the current dialect.
 * If `method` returns a promise, the check happens once it settles, and the returned promise must be awaited.
 * `method` must be typed precisely: if its return type is not a promise type (for example `any`),
 * the synchronous overload is used and a missing `await` is not reported by the linter.
 *
 * @param method The function to test.
 * @param assertions The expected result or error, per dialect. Keys are `default` or a space-separated list of dialect names.
 */
export function expectPerDialect<Out>(
  method: () => Promise<Out>,
  assertions: ExpectationRecord<Out>,
): Promise<void>;
export function expectPerDialect<Out>(method: () => Out, assertions: ExpectationRecord<Out>): void;
export function expectPerDialect<Out>(
  method: () => Out | Promise<Out>,
  assertions: ExpectationRecord<Out>,
): void | Promise<void> {
  const expectations =
    pojo<PartialRecord<'default' | DialectName, Out | Error | Expectation<Out>>>();

  for (const [key, value] of Object.entries(assertions)) {
    const acceptedDialects = key.split(' ') as Array<DialectName | 'default'>;

    for (const dialect of acceptedDialects) {
      if (dialect === 'default' && acceptedDialects.length > 1) {
        throw new Error(`The 'default' expectation cannot be combined with other dialects.`);
      }

      if (dialect in expectations) {
        throw new Error(`The expectation for ${dialect} was already defined.`);
      }

      expectations[dialect] = value;
    }
  }

  // Expectations are looked up by key, as null and undefined are valid expected values.
  const isDefault = !(sequelize.dialect.name in expectations);
  const expectationKey = isDefault ? 'default' : (sequelize.dialect.name as DialectName);
  if (!(expectationKey in expectations)) {
    throw new Error(
      `No expectation was defined for ${sequelize.dialect.name} and the 'default' expectation has not been defined.`,
    );
  }

  // The key is present, so the value is the expectation even when it is undefined.
  const expectation = expectations[expectationKey] as Out | Error | Expectation<Out>;

  let value: Out | Promise<Out>;

  try {
    value = method();
  } catch (error: unknown) {
    assert(error instanceof Error, 'method threw a non-error');

    assertOutcomeMatchesExpectation({ threw: true, error }, expectation, isDefault);

    return;
  }

  if (value instanceof Promise) {
    return value.then(
      resolvedValue => {
        assertOutcomeMatchesExpectation(
          { threw: false, value: resolvedValue },
          expectation,
          isDefault,
        );
      },
      (error: unknown) => {
        assert(error instanceof Error, 'method rejected with a non-error');

        assertOutcomeMatchesExpectation({ threw: true, error }, expectation, isDefault);
      },
    );
  }

  assertOutcomeMatchesExpectation({ threw: false, value }, expectation, isDefault);
}

type Outcome<Out> = { threw: false; value: Out } | { threw: true; error: Error };

function assertOutcomeMatchesExpectation<Out>(
  outcome: Outcome<Out>,
  expectation: Out | Error | Expectation<Out>,
  isDefault: boolean,
): void {
  if (expectation instanceof Error) {
    if (!outcome.threw) {
      assert.fail(
        `Expected method to error with "${expectation.message}", but it returned ${inspect(outcome.value)}.`,
      );
    }

    expect(inlineErrorCause(outcome.error)).to.include(expectation.message);
  } else {
    if (outcome.threw) {
      assert.fail(
        `Did not expect method to error, but it errored with ${inlineErrorCause(outcome.error)}`,
      );
    }

    assertMatchesExpectation(outcome.value, expectation, isDefault);
  }
}

function assertMatchesExpectation<V>(
  result: V,
  expectation: V | Expectation<V>,
  isDefault: boolean,
): void {
  if (expectation instanceof Expectation) {
    expectation.assert(result, isDefault);
  } else {
    expect(result).to.deep.equal(expectation);
  }
}

abstract class Expectation<Value> {
  abstract assert(value: Value, isDefault: boolean): void;
}

interface SqlExpectationOptions {
  genericQuotes?: boolean;
}

class SqlExpectation extends Expectation<string | string[]> {
  readonly #sql: string | readonly string[];
  readonly #options: SqlExpectationOptions | undefined;

  constructor(sql: string | readonly string[], options?: SqlExpectationOptions) {
    super();

    this.#sql = sql;
    this.#options = options;
  }

  #prepareSql(sql: string | readonly string[], isDefault: boolean): string | string[] {
    if (Array.isArray(sql)) {
      return sql.map(part => this.#prepareSql(part, isDefault)) as string[];
    }

    if (isDefault) {
      sql = replaceGenericIdentifierQuotes(sql as string, sequelize.dialect);
    }

    return minifySql(sql as string);
  }

  assert(value: string | readonly string[], isDefault: boolean) {
    expect(this.#prepareSql(value, false)).to.deep.equal(
      this.#prepareSql(this.#sql, isDefault || this.#options?.genericQuotes === true),
    );
  }
}

export function toMatchSql(sql: string | string[], options?: SqlExpectationOptions) {
  return new SqlExpectation(sql, options);
}

class RegexExpectation extends Expectation<string> {
  constructor(private readonly regex: RegExp) {
    super();
  }

  assert(value: string) {
    expect(value).to.match(this.regex);
  }
}

export function toMatchRegex(regex: RegExp) {
  return new RegexExpectation(regex);
}

type HasPropertiesInput<Obj extends Record<string, unknown>> = {
  [K in keyof Obj]?: any | Expectation<Obj[K]> | Error;
};

class HasPropertiesExpectation<Obj extends Record<string, unknown>> extends Expectation<Obj> {
  constructor(private readonly properties: HasPropertiesInput<Obj>) {
    super();
  }

  assert(value: Obj, isDefault: boolean) {
    for (const key of Object.keys(this.properties) as Array<keyof Obj>) {
      assertMatchesExpectation(value[key], this.properties[key], isDefault);
    }
  }
}

export function toHaveProperties<Obj extends Record<string, unknown>>(
  properties: HasPropertiesInput<Obj>,
) {
  return new HasPropertiesExpectation<Obj>(properties);
}

type MaybeLazy<T> = T | (() => T);

/**
 * Notice: For default expectations, [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation
 *
 * @param query The SQL that was generated
 * @param assertions The SQL to compare against
 */
export type SqlExpectations = PartialRecord<ExpectationKey, string | Error>;

export function expectsql(query: MaybeLazy<string | Error>, assertions: SqlExpectations): void;
export function expectsql(
  query: MaybeLazy<BoundQuery | Error>,
  assertions: {
    query: PartialRecord<ExpectationKey, string | Error>;
    bind: PartialRecord<ExpectationKey, unknown>;
  },
): void;
export function expectsql(
  query: MaybeLazy<string | Error | BoundQuery>,
  assertions:
    | {
        query: PartialRecord<ExpectationKey, string | Error>;
        bind: PartialRecord<ExpectationKey, unknown>;
      }
    | PartialRecord<ExpectationKey, string | Error>,
): void {
  const rawExpectationMap: PartialRecord<ExpectationKey, string | Error> =
    'query' in assertions ? assertions.query : assertions;
  const expectations = pojo<PartialRecord<'default' | DialectName, string | Error>>();

  /**
   * The list of expectations that are run against more than one dialect, which enables the transformation of
   * identifier quoting to match the dialect.
   */
  const combinedExpectations = new Set<DialectName | 'default'>();
  combinedExpectations.add('default');

  for (const [key, value] of Object.entries(rawExpectationMap)) {
    const acceptedDialects = key.split(' ') as Array<DialectName | 'default'>;

    if (acceptedDialects.length > 1) {
      for (const dialect of acceptedDialects) {
        combinedExpectations.add(dialect);
      }
    }

    for (const dialect of acceptedDialects) {
      if (dialect === 'default' && acceptedDialects.length > 1) {
        throw new Error(`The 'default' expectation cannot be combined with other dialects.`);
      }

      if (expectations[dialect] !== undefined) {
        throw new Error(`The expectation for ${dialect} was already defined.`);
      }

      expectations[dialect] = value;
    }
  }

  const dialect = sequelize.dialect;
  const usedExpectationName =
    dialect.name in expectations ? (dialect.name as DialectName) : 'default';

  let expectation = expectations[usedExpectationName];
  if (expectation == null) {
    throw new Error(
      `Undefined expectation for "${sequelize.dialect.name}"! (expectations: ${JSON.stringify(expectations)})`,
    );
  }

  if (combinedExpectations.has(usedExpectationName) && typeof expectation === 'string') {
    // replace [...] with the proper quote character for the dialect
    // except for ARRAY[...]
    expectation = replaceGenericIdentifierQuotes(expectation, dialect);
    if (dialect.name === 'ibmi') {
      expectation = expectation.trim().replace(/;$/, '');
    }
  }

  if (typeof query === 'function') {
    try {
      query = query();
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        throw new TypeError(
          'expectsql: function threw something that is not an instance of Error.',
        );
      }

      query = error;
    }
  }

  if (expectation instanceof Error) {
    assert(
      query instanceof Error,
      `Expected query to error with "${expectation.message}", but it is equal to ${JSON.stringify(query)}.`,
    );

    expect(inlineErrorCause(query)).to.include(expectation.message);
  } else {
    assert(
      !(query instanceof Error),
      `Expected query to equal:\n${minifySql(expectation)}\n\nBut it errored with:\n${inlineErrorCause(query)}`,
    );

    expect(minifySql(isObject(query) ? query.query : query)).to.equal(minifySql(expectation));
  }

  if ('bind' in assertions) {
    const bind =
      assertions.bind[sequelize.dialect.name as DialectName] ||
      assertions.bind.default ||
      assertions.bind;
    // @ts-expect-error -- too difficult to type, but this is safe
    expect(query.bind).to.deep.equal(bind);
  }
}

function replaceGenericIdentifierQuotes(sql: string, dialect: AbstractDialect): string {
  return sql.replaceAll(
    /(?<!ARRAY)\[([^\]]+)]/g,
    `${dialect.TICK_CHAR_LEFT}$1${dialect.TICK_CHAR_RIGHT}`,
  );
}

/**
 * Installs sinon's fake timers, except for `process.nextTick` and `queueMicrotask`.
 *
 * sinon 22 (fake-timers 13+) fakes those two by default, which stalls the socket I/O
 * of the database drivers and makes every query hang.
 */
export function useFakeTimers(): SinonFakeTimers {
  return sinon.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'Date',
      'hrtime',
      'performance',
    ],
  });
}

export function rand() {
  return Math.floor(Math.random() * 10e5);
}

export function isDeepEqualToOneOf(actual: unknown, expectedOptions: unknown[]): boolean {
  return expectedOptions.some(expected => isDeepStrictEqual(actual, expected));
}

/**
 * Reduces insignificant whitespace from SQL string.
 *
 * @param sql the SQL string
 * @returns the SQL string with insignificant whitespace removed.
 */
export function minifySql(sql: string): string {
  // replace all consecutive whitespaces with a single plain space character
  return (
    sql
      .replaceAll(/\s+/g, ' ')
      // remove space before comma
      .replaceAll(' ,', ',')
      // remove space before )
      .replaceAll(' )', ')')
      // replace space after (
      .replaceAll('( ', '(')
      // remove whitespace at start & end
      .trim()
  );
}

export const sequelize = createSequelizeInstance<AbstractDialect>();

export function resetSequelizeInstance(sequelizeInstance: Sequelize = sequelize): void {
  sequelizeInstance.removeAllModels();
}

// 'support' is requested by dev/check-connection, which is not a mocha context
if (typeof before !== 'undefined') {
  before(function onBefore() {
    // legacy, remove once all tests have been migrated to not use "this" anymore
    Object.defineProperty(this, 'sequelize', {
      value: sequelize,
      writable: false,
      configurable: false,
    });
  });
}

type Tester<Params extends any[]> = {
  (...params: Params): void;
  skip(...params: Params): void;
  only(...params: Params): void;
};
type TestFunctions = ExclusiveTestFunction | TestFunction | PendingTestFunction;

export function createTester<Params extends any[]>(
  cb: (testFunction: TestFunctions, ...args: Params) => void,
): Tester<Params> {
  function tester(...params: Params) {
    cb(it, ...params);
  }

  tester.skip = function skippedTester(...params: Params) {
    cb(it.skip, ...params);
  };

  tester.only = function onlyTester(...params: Params) {
    cb(it.only, ...params);
  };

  return tester;
}

/**
 * Works like {@link beforeEach}, but returns an object that contains the values returned by its latest execution.
 *
 * @param cb
 */
export function beforeEach2<T extends Record<string, any>>(cb: () => Promise<T> | T): T {
  // it's not the right shape but we're cheating. We'll be updating the value of this object before each test!
  const out = {} as T;

  beforeEach(async () => {
    const out2 = await cb();

    Object.assign(out, out2);
  });

  return out;
}

/**
 * Works like {@link before}, but returns an object that contains the values returned by its latest execution.
 *
 * @param cb
 */
export function beforeAll2<T extends Record<string, any>>(cb: () => Promise<T> | T): T {
  // it's not the right shape but we're cheating. We'll be updating the value of this object before each test!
  const out = {} as T;

  before(async () => {
    const out2 = await cb();

    Object.assign(out, out2);
  });

  return out;
}

export function typeTest(_name: string, _callback: () => void): void {
  // This function doesn't do anything. a type test is only checked by TSC and never runs.
}

export async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (isNodeError(error) && error.code !== 'ENOENT') {
      throw error;
    }
  }
}

let isIntegrationTestSuite = false;

export function setIsIntegrationTestSuite(value: boolean): void {
  isIntegrationTestSuite = value;
}

// 'support' is requested by dev/check-connection, which is not a mocha context
if (typeof after !== 'undefined') {
  after('delete SQLite databases', async () => {
    if (isIntegrationTestSuite) {
      // all Sequelize instances must be closed to be able to delete the database files, including the default one.
      // Closing is not possible in non-integration test suites,
      // as _all_ connections must be mocked (even for sqlite, even though it's a file-based database).
      await sequelize.close();
    }

    return fs.promises.rm(SQLITE_DATABASES_DIR, { recursive: true, force: true });
  });
}

// TODO: ignoredDeprecations should be removed in favour of EMPTY_ARRAY
const ignoredDeprecations: readonly string[] = [
  'SEQUELIZE0013',
  'SEQUELIZE0018',
  'SEQUELIZE0019',
  'SEQUELIZE0021',
  'SEQUELIZE0022',
];

const ignoredDeprecationMessages: readonly RegExp[] = [
  // TODO: remove once Sequelize serializes shared postgres client queries without relying on pg's deprecated internal queue.
  /^Calling client\.query\(\) when the client is already executing a query is deprecated and will be removed in pg@9\.0\./,
];

let allowedDeprecations: readonly string[] = ignoredDeprecations;
export function allowDeprecationsInSuite(codes: readonly string[]) {
  before(() => {
    allowedDeprecations = [...codes, ...ignoredDeprecations];
  });

  after(() => {
    allowedDeprecations = ignoredDeprecations;
  });
}

// TODO: the DeprecationWarning is only thrown once. We should figure out a way to reset that or move all tests that use deprecated tests to one suite per deprecation.
process.on('warning', (warning: NodeJS.ErrnoException) => {
  if (
    warning.name === 'DeprecationWarning' &&
    !allowedDeprecations.includes(warning.code!) &&
    !ignoredDeprecationMessages.some(pattern => pattern.test(warning.message))
  ) {
    throw warning;
  }
});
