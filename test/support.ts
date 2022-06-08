import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { inspect, isDeepStrictEqual } from 'util';
import type { Dialect, Options } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import { AbstractQueryGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator.js';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiDatetime from 'chai-datetime';
import defaults from 'lodash/defaults';
import isObject from 'lodash/isObject';
import type { ExclusiveTestFunction, PendingTestFunction, TestFunction } from 'mocha';
import sinonChai from 'sinon-chai';
import { Config } from './config/config';

const expect = chai.expect;

const distDir = path.resolve(__dirname, '../lib');

chai.use(chaiDatetime);
chai.use(chaiAsPromised);
chai.use(sinonChai);

// Using util.inspect to correctly assert objects with symbols
// Because expect.deep.equal does not test non iterator keys such as symbols (https://github.com/chaijs/chai/issues/1054)
chai.Assertion.addMethod('deepEqual', function deepEqual(expected, depth = 5) {
  // eslint-disable-next-line @typescript-eslint/no-invalid-this -- this is how chai functions
  expect(inspect(this._obj, { depth })).to.deep.equal(inspect(expected, { depth }));
});

/**
 * `expect(fn).to.throwWithCause()` works like `expect(fn).to.throw()`, except
 * that is also checks whether the message is present in the error cause.
 */
chai.Assertion.addMethod('throwWithCause', function throwWithCause(errorConstructor, errorMessage) {
  // eslint-disable-next-line @typescript-eslint/no-invalid-this -- this is how chai functions
  expect(withInlineCause(this._obj)).to.throw(errorConstructor, errorMessage);
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

function inlineErrorCause(error: Error) {
  let message = error.message;

  // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
  // @ts-ignore -- TS < 4.6 doesn't include the typings for this property, but TS 4.6+ does.
  const cause = error.cause;
  if (cause) {
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

afterEach(() => {
  onNextUnhandledRejection = null;
  unhandledRejections = null;
});

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

let lastSqliteInstance: Sequelize | undefined;
export async function prepareTransactionTest(sequelize: Sequelize) {
  const dialect = getTestDialect();

  if (dialect === 'sqlite') {
    const p = path.join(__dirname, 'tmp', 'db.sqlite');
    if (lastSqliteInstance) {
      await lastSqliteInstance.close();
    }

    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }

    const options = { ...sequelize.options, storage: p };
    const _sequelize = new Sequelize(sequelize.config.database, '', '', options);

    await _sequelize.sync({ force: true });
    lastSqliteInstance = _sequelize;

    return _sequelize;
  }

  return sequelize;
}

export function createSequelizeInstance(options: Options = {}) {
  options.dialect = getTestDialect(); // only returns translated dialectName "mysql8"->"mysql"

  // pass process.env.DIALECT b/c it may contain version "postgres12" config can use
  const config = Config(process.env.DIALECT);

  const sequelizeOptions = defaults(options, {
    host: options.host || config.host,
    logging: process.env.SEQ_LOG ? console.debug : false,
    dialect: getDialectName(options.dialect),
    port: options.port || process.env.SEQ_PORT || config.port,
    pool: config.pool,
    dialectOptions: options.dialectOptions || config.dialectOptions || {},
    minifyAliases: options.minifyAliases || config.minifyAliases,
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
  const config = { ...Config(getTestDialect()) };
  delete config.pool;

  return config;
}

export function getSequelizeInstance(db: string, user: string, pass: string, options?: Options) {
  options = options || {};
  options.dialect = options.dialect || getTestDialect();

  return new Sequelize(db, user, pass, options);
}

export async function clearDatabase(sequelize: Sequelize) {
  const qi = sequelize.getQueryInterface();
  await qi.dropAllTables();
  sequelize.modelManager.models = [];
  sequelize.models = {};

  if (qi.dropAllEnums) {
    await qi.dropAllEnums();
  }

  await dropTestSchemas(sequelize);
}

export async function dropTestSchemas(sequelize: Sequelize) {
  const queryInterface = sequelize.getQueryInterface();

  if (!queryInterface.queryGenerator._dialect.supports.schemas) {
    await sequelize.drop({});

    return;
  }

  const schemas = await sequelize.showAllSchemas();
  const schemasPromise = [];
  for (const schema of schemas) {
    // @ts-expect-error
    const schemaName = schema.name ? schema.name : schema;
    if (schemaName !== sequelize.config.database) {
      schemasPromise.push(sequelize.dropSchema(schemaName));
    }
  }

  await Promise.all(schemasPromise.map(async p => p.catch((error: unknown) => error)));
}

export function getSupportedDialects() {
  return fs.readdirSync(path.join(distDir, 'dialects'))
    .filter(file => !file.includes('.js') && !file.includes('abstract'));
}

// TODO: type once QueryGenerator has been migrated to TS
export function getAbstractQueryGenerator(sequelize: Sequelize): unknown {
  class ModdedQueryGenerator extends AbstractQueryGenerator {
    quoteIdentifier(x: string): string {
      return x;
    }
  }

  // @ts-expect-error
  return new ModdedQueryGenerator({ sequelize, _dialect: sequelize.dialect });
}

export function getDialectName(dialect: string): Dialect | string {
  if (!dialect) {
    return '';
  }

  // dialects that end with a nubmer in their name
  let _dialectVersion: string;
  let _fullString: string;
  let dialectName: Dialect | string;
  let didEncounterSpecialCase = false;

  const specialCases: [Dialect] = ['db2'];
  for (const specialCase of specialCases) {
    if (dialect.startsWith(specialCase)) {
      didEncounterSpecialCase = true;
      const re: RegExp = new RegExp(`(${specialCase})(.*)`);

      // can use `.match()!` (with bang) b/c we know `re` will match based on `if` condition
      [_fullString, dialectName, _dialectVersion] = dialect.match(re)!;
      dialectName = dialectName || '';
      break;
    }
  }

  if (!didEncounterSpecialCase) {
    // strip off version
    dialectName = dialect.replace(/(?:[^a-z-]+)$/, '');
  }

  // bang used because we know it was set as special-case or in follow-up
  return dialectName!;
}

export function getTestDialect(): Dialect {
  const envDialect = process.env.DIALECT || '';
  let dialectName = getDialectName(envDialect);

  if (dialectName === 'postgres-native') {
    dialectName = 'postgres';
  }

  if (!getSupportedDialects().includes(dialectName)) {
    throw new Error(`The DIALECT environment variable was set to ${JSON.stringify(envDialect)}, which is not a supported dialect. Set it to one of ${getSupportedDialects().map(d => JSON.stringify(d)).join(', ')} instead.`);
  }

  return dialectName as Dialect;
}

export function getTestDialectTeaser(moduleName: string): string {
  let dialect: string = getTestDialect();

  if (getDialectName(process.env.DIALECT || '') === 'postgres-native') {
    dialect = 'postgres-native';
  }

  return `[${dialect.toUpperCase()}] ${moduleName}`;
}

export function getPoolMax(): number {
  return Config(getTestDialect()).pool?.max ?? 1;
}

type ExpectationKey = Dialect | 'default';
type PartialRecord<K extends keyof any, V> = Partial<Record<K, V>>;

export function expectsql(
  query: { query: string, bind: unknown } | Error,
  assertions: { query: PartialRecord<ExpectationKey, string | Error>, bind: PartialRecord<ExpectationKey, unknown> },
): void;
export function expectsql(
  query: string | Error,
  assertions: PartialRecord<ExpectationKey, string | Error>,
): void;
export function expectsql(
  query: string | Error | { query: string, bind: unknown },
  assertions:
    | { query: PartialRecord<ExpectationKey, string | Error>, bind: PartialRecord<ExpectationKey, unknown> }
    | PartialRecord<ExpectationKey, string | Error>,
): void {
  const expectations: PartialRecord<ExpectationKey, string | Error> = 'query' in assertions ? assertions.query : assertions;
  let expectation = expectations[sequelize.dialect.name];

  const dialect = sequelize.dialect;

  if (!expectation) {
    if (expectations.default !== undefined) {
      expectation = expectations.default;
      if (typeof expectation === 'string') {
        // replace [...] with the proper quote character for the dialect
        // except for ARRAY[...]
        expectation = expectation.replace(/(?<!ARRAY)\[([^\]]+)]/g, `${dialect.TICK_CHAR_LEFT}$1${dialect.TICK_CHAR_RIGHT}`);
        if (dialect.name === 'ibmi') {
          expectation = expectation.trim().replace(/;$/, '');
        }
      }
    } else {
      throw new Error(`Undefined expectation for "${sequelize.dialect.name}"! (expectations: ${JSON.stringify(expectations)})`);
    }
  }

  if (expectation instanceof Error) {
    assert(query instanceof Error, `Expected query to error with "${expectation.message}", but it is equal to ${JSON.stringify(query)}.`);

    expect(query.message).to.equal(expectation.message);
  } else {
    assert(!(query instanceof Error), `Expected query to equal ${minifySql(expectation)}, but it errored with ${query instanceof Error ? query.message : ''}`);

    expect(minifySql(isObject(query) ? query.query : query)).to.equal(minifySql(expectation));
  }

  if ('bind' in assertions) {
    const bind = assertions.bind[sequelize.dialect.name] || assertions.bind.default || assertions.bind;
    // @ts-expect-error
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

export function resetSequelizeInstance(): void {
  for (const model of sequelize.modelManager.all) {
    sequelize.modelManager.removeModel(model);
  }
}

before(function onBefore() {
  // legacy, remove once all tests have been migrated
  // eslint-disable-next-line @typescript-eslint/no-invalid-this
  this.sequelize = sequelize;
});

beforeEach(function onBeforeEach() {
  // legacy, remove once all tests have been migrated
  // eslint-disable-next-line @typescript-eslint/no-invalid-this
  this.sequelize = sequelize;
});

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
