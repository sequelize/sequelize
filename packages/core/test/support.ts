import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { inspect, isDeepStrictEqual } from 'node:util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiDatetime from 'chai-datetime';
import defaults from 'lodash/defaults';
import isObject from 'lodash/isObject';
import type { ExclusiveTestFunction, PendingTestFunction, TestFunction } from 'mocha';
import sinonChai from 'sinon-chai';
import { Sequelize } from '@sequelize/core';
import type { Dialect, Options } from '@sequelize/core';
import {
  AbstractQueryGenerator,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator.js';
import { Config } from './config/config';

const expect = chai.expect;

const distDir = path.resolve(__dirname, '../lib');

chai.use(chaiDatetime);
chai.use(chaiAsPromised);
chai.use(sinonChai);

/**
 * `expect(fn).to.throwWithCause()` works like `expect(fn).to.throw()`, except
 * that is also checks whether the message is present in the error cause.
 */
chai.Assertion.addMethod('throwWithCause', function throwWithCause(errorConstructor, errorMessage) {
  // eslint-disable-next-line @typescript-eslint/no-invalid-this -- this is how chai works
  expect(withInlineCause(this._obj)).to.throw(errorConstructor, errorMessage);
});

chai.Assertion.addMethod('beNullish', function nullish() {
  // eslint-disable-next-line @typescript-eslint/no-invalid-this -- this is how chai works
  expect(this._obj).to.not.exist;
});

chai.Assertion.addMethod('notBeNullish', function nullish() {
  // eslint-disable-next-line @typescript-eslint/no-invalid-this -- this is how chai works
  expect(this._obj).to.exist;
});

function withInlineCause(cb: (() => any)): () => void {
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
    return String(error);
  }

  let message = error.message;

  // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
  // @ts-ignore -- TS < 4.6 doesn't include the typings for this property, but TS 4.6+ does.
  const cause = error.cause;
  if (cause instanceof Error) {
    message += `\nCaused by: ${inlineErrorCause(cause)}`;
  }

  return message;
}

chai.config.includeStack = true;
chai.should();

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

/**
 * Pushes all unhandled rejections that occur during this test onto destArray
 * (instead of failing the test).
 *
 * @param destArray the array to push unhandled rejections onto.  If you omit this,
 * one will be created and returned for you.
 *
 * @returns destArray
 */
export function captureUnhandledRejections(destArray = []) {
  unhandledRejections = destArray;

  return unhandledRejections;
}

export function createSequelizeInstance(options: Options = {}): Sequelize {
  options.dialect = getTestDialect();

  const config = Config[options.dialect];

  const sequelizeOptions = defaults(options, {
    host: options.host || config.host,
    logging: process.env.SEQ_LOG ? console.debug : false,
    dialect: options.dialect,
    port: options.port || process.env.SEQ_PORT || config.port,
    pool: config.pool,
    dialectOptions: options.dialectOptions || config.dialectOptions || {},
    minifyAliases: options.minifyAliases || config.minifyAliases,
    // the test suite was written before CLS was turned on by default.
    disableClsTransactions: true,
  });

  if (process.env.DIALECT === 'postgres-native') {
    sequelizeOptions.native = true;
  }

  if (config.storage || config.storage === '') {
    sequelizeOptions.storage = config.storage;
  }

  return getSequelizeInstance(config.database!, config.username!, config.password!, sequelizeOptions);
}

export function getConnectionOptionsWithoutPool() {
  // Do not break existing config object - shallow clone before `delete config.pool`
  const config = { ...Config[getTestDialect()] };
  delete config.pool;

  return config;
}

export function getSequelizeInstance(db: string, user: string, pass: string, options?: Options): Sequelize {
  options = options || {};
  options.dialect = options.dialect || getTestDialect();

  return new Sequelize(db, user, pass, options);
}

export function getSupportedDialects() {
  return fs.readdirSync(path.join(distDir, 'dialects'))
    .filter(file => !file.includes('.js') && !file.includes('abstract'));
}

export function getAbstractQueryGenerator(sequelize: Sequelize): AbstractQueryGenerator {
  class ModdedQueryGenerator extends AbstractQueryGenerator {
    quoteIdentifier(x: string): string {
      return x;
    }
  }

  return new ModdedQueryGenerator({ sequelize, dialect: sequelize.dialect });
}

export function getTestDialect(): Dialect {
  let envDialect = process.env.DIALECT || '';

  if (envDialect === 'postgres-native') {
    envDialect = 'postgres';
  }

  if (!getSupportedDialects().includes(envDialect)) {
    throw new Error(`The DIALECT environment variable was set to ${JSON.stringify(envDialect)}, which is not a supported dialect. Set it to one of ${getSupportedDialects().map(d => JSON.stringify(d)).join(', ')} instead.`);
  }

  return envDialect as Dialect;
}

export function getTestDialectTeaser(moduleName: string): string {
  let dialect: string = getTestDialect();

  if (process.env.DIALECT === 'postgres-native') {
    dialect = 'postgres-native';
  }

  return `[${dialect.toUpperCase()}] ${moduleName}`;
}

export function getPoolMax(): number {
  return Config[getTestDialect()].pool?.max ?? 1;
}

type ExpectationKey = 'default' | Permutations<Dialect, 4>;

export type ExpectationRecord<V> = PartialRecord<ExpectationKey, V | Expectation<V> | Error>;

type DecrementedDepth = [never, 0, 1, 2, 3];

type Permutations<T extends string, Depth extends number, U extends string = T> = Depth extends 0
  ? never
  : T extends any
    ? T | `${T} ${Permutations<Exclude<U, T>, DecrementedDepth[Depth]>}`
    : never;

type PartialRecord<K extends keyof any, V> = Partial<Record<K, V>>;

export function expectPerDialect<Out>(
  method: () => Out,
  assertions: ExpectationRecord<Out>,
) {
  const expectations: PartialRecord<'default' | Dialect, Out | Error | Expectation<Out>> = Object.create(null);

  for (const [key, value] of Object.entries(assertions)) {
    const acceptedDialects = key.split(' ') as Array<Dialect | 'default'>;

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

  let result: Out | Error;

  try {
    result = method();
  } catch (error: unknown) {
    assert(error instanceof Error, 'method threw a non-error');

    result = error;
  }

  const expectation = expectations[sequelize.dialect.name] ?? expectations.default;
  if (expectation === undefined) {
    throw new Error(`No expectation was defined for ${sequelize.dialect.name} and the 'default' expectation has not been defined.`);
  }

  if (expectation instanceof Error) {
    assert(result instanceof Error, `Expected method to error with "${expectation.message}", but it returned ${inspect(result)}.`);

    expect(inlineErrorCause(result)).to.include(expectation.message);
  } else {
    assert(!(result instanceof Error), `Did not expect query to error, but it errored with ${inlineErrorCause(result)}`);

    assertMatchesExpectation(result, expectation);
  }
}

function assertMatchesExpectation<V>(result: V, expectation: V | Expectation<V>): void {
  if (expectation instanceof Expectation) {
    expectation.assert(result);
  } else {
    expect(result).to.deep.equal(expectation);
  }
}

abstract class Expectation<Value> {
  abstract assert(value: Value): void;
}

class SqlExpectation extends Expectation<string> {
  constructor(private readonly sql: string) {
    super();
  }

  assert(value: string) {
    expect(minifySql(value)).to.equal(minifySql(this.sql));
  }
}

export function toMatchSql(sql: string) {
  return new SqlExpectation(sql);
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

  assert(value: Obj) {
    for (const key of Object.keys(this.properties) as Array<keyof Obj>) {
      assertMatchesExpectation(value[key], this.properties[key]);
    }
  }
}

export function toHaveProperties<Obj extends Record<string, unknown>>(properties: HasPropertiesInput<Obj>) {
  return new HasPropertiesExpectation<Obj>(properties);
}

type MaybeLazy<T> = T | (() => T);

export function expectsql(
  query: MaybeLazy<{ query: string, bind?: unknown } | Error>,
  assertions: {
    query: PartialRecord<ExpectationKey, string | Error>,
    bind: PartialRecord<ExpectationKey, unknown>,
   },
): void;
export function expectsql(
  query: MaybeLazy<string | Error>,
  assertions: PartialRecord<ExpectationKey, string | Error>,
): void;
export function expectsql(
  query: MaybeLazy<string | Error | { query: string, bind?: unknown }>,
  assertions:
    | { query: PartialRecord<ExpectationKey, string | Error>, bind: PartialRecord<ExpectationKey, unknown> }
    | PartialRecord<ExpectationKey, string | Error>,
): void {
  const rawExpectationMap: PartialRecord<ExpectationKey, string | Error> = 'query' in assertions ? assertions.query : assertions;
  const expectations: PartialRecord<'default' | Dialect, string | Error> = Object.create(null);

  /**
   * The list of expectations that are run against more than one dialect, which enables the transformation of
   * identifier quoting to match the dialect.
   */
  const combinedExpectations = new Set<Dialect | 'default'>();
  combinedExpectations.add('default');

  for (const [key, value] of Object.entries(rawExpectationMap)) {
    const acceptedDialects = key.split(' ') as Array<Dialect | 'default'>;

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
  const usedExpectationName = dialect.name in expectations ? dialect.name : 'default';

  let expectation = expectations[usedExpectationName];
  if (expectation == null) {
    throw new Error(`Undefined expectation for "${sequelize.dialect.name}"! (expectations: ${JSON.stringify(expectations)})`);
  }

  if (combinedExpectations.has(usedExpectationName) && typeof expectation === 'string') {
    // replace [...] with the proper quote character for the dialect
    // except for ARRAY[...]
    expectation = expectation.replace(/(?<!ARRAY)\[([^\]]+)]/g, `${dialect.TICK_CHAR_LEFT}$1${dialect.TICK_CHAR_RIGHT}`);
    if (dialect.name === 'ibmi') {
      expectation = expectation.trim().replace(/;$/, '');
    }
  }

  if (typeof query === 'function') {
    try {
      query = query();
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        throw new TypeError('expectsql: function threw something that is not an instance of Error.');
      }

      query = error;
    }
  }

  if (expectation instanceof Error) {
    assert(query instanceof Error, `Expected query to error with "${expectation.message}", but it is equal to ${JSON.stringify(query)}.`);

    expect(inlineErrorCause(query)).to.include(expectation.message);
  } else {
    assert(!(query instanceof Error), `Expected query to equal:\n${minifySql(expectation)}\n\nBut it errored with:\n${inlineErrorCause(query)}`);

    expect(minifySql(isObject(query) ? query.query : query)).to.equal(minifySql(expectation));
  }

  if ('bind' in assertions) {
    const bind = assertions.bind[sequelize.dialect.name] || assertions.bind.default || assertions.bind;
    // @ts-expect-error -- too difficult to type, but this is safe
    expect(query.bind).to.deep.equal(bind);
  }
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
  return sql.replace(/\s+/g, ' ')
    // remove space before comma
    .replace(/ ,/g, ',')
    // remove space before )
    .replace(/ \)/g, ')')
    // replace space after (
    .replace(/\( /g, '(')
    // remove whitespace at start & end
    .trim();
}

export const sequelize = createSequelizeInstance();

export function resetSequelizeInstance(sequelizeInstance: Sequelize = sequelize): void {
  for (const model of sequelizeInstance.modelManager.all) {
    sequelizeInstance.modelManager.removeModel(model);
  }
}

// 'support' is requested by dev/check-connection, which is not a mocha context
if (typeof before !== 'undefined') {
  before(function onBefore() {
    // legacy, remove once all tests have been migrated to not use "this" anymore
    // eslint-disable-next-line @typescript-eslint/no-invalid-this
    Object.defineProperty(this, 'sequelize', {
      value: sequelize,
      writable: false,
      configurable: false,
    });
  });
}

type Tester<Params extends any[]> = {
  (...params: Params): void,
  skip(...params: Params): void,
  only(...params: Params): void,
};
type TestFunctions = ExclusiveTestFunction | TestFunction | PendingTestFunction;

export function createTester<Params extends any[]>(
  cb: ((testFunction: TestFunctions, ...args: Params) => void),
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
