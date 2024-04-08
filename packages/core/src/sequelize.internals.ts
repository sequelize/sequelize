import type { Nullish } from '@sequelize/utils';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import type { Class } from 'type-fest';
import type { AbstractDialect } from './abstract-dialect/dialect.js';
import type { Logging, ModelOptions, ModelStatic } from './model.js';
import type { SequelizeHooks } from './sequelize-typescript.js';
import type {
  DefaultSetOptions,
  DialectName,
  QueryOptions,
  ReplicationOptions,
  RetryOptions,
  SyncOptions,
} from './sequelize.js';
import type { PoolOptions } from './sequelize.types.js';
import type { IsolationLevel, TransactionNestMode, TransactionType } from './transaction.js';

export function importDialect(dialect: string): typeof AbstractDialect {
  // Requiring the dialect in a switch-case to keep the
  // require calls static. (Browserify fix)
  switch (dialect) {
    case 'mariadb':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/mariadb').MariaDbDialect;
    case 'mssql':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/mssql').MsSqlDialect;
    case 'mysql':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/mysql').MySqlDialect;
    case 'postgres':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/postgres').PostgresDialect;
    case 'sqlite':
    case 'sqlite3':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/sqlite3').SqliteDialect;
    case 'ibmi':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/db2-ibmi').IBMiDialect;
    case 'db2':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/db2').Db2Dialect;
    case 'snowflake':
      // eslint-disable-next-line import/no-extraneous-dependencies -- legacy function, will be removed. User needs to install the dependency themselves
      return require('@sequelize/snowflake').SnowflakeDialect;
    default:
      throw new Error(
        `The dialect ${dialect} is not natively supported. Native dialects: mariadb, mssql, mysql, postgres, sqlite3, ibmi, db2 and snowflake.`,
      );
  }
}

export const PERSISTED_SEQUELIZE_OPTIONS = getSynchronizedTypeKeys<
  PersistedSequelizeOptions<AbstractDialect>
>({
  benchmark: undefined,
  defaultTimestampPrecision: undefined,
  defaultTransactionNestMode: undefined,
  define: undefined,
  disableClsTransactions: undefined,
  isolationLevel: undefined,
  keepDefaultTimezone: undefined,
  logQueryParameters: undefined,
  logging: undefined,
  minifyAliases: undefined,
  noTypeValidation: undefined,
  nullJsonStringification: undefined,
  omitNull: undefined,
  prependSearchPath: undefined,
  query: undefined,
  quoteIdentifiers: undefined,
  replication: undefined,
  retry: undefined,
  schema: undefined,
  set: undefined,
  sync: undefined,
  timezone: undefined,
  transactionType: undefined,
});

/**
 * The options that are accessible via {@link Sequelize#options}.
 */
export interface PersistedSequelizeOptions<Dialect extends AbstractDialect> extends Logging {
  /**
   * The precision for the `createdAt`/`updatedAt`/`deletedAt` DATETIME columns that Sequelize adds to models.
   * Can be a number between 0 and 6, or null to use the default precision of the database. Defaults to 6.
   *
   * @default 6
   */
  defaultTimestampPrecision?: number | null;

  /**
   * How nested transaction blocks behave by default.
   * See {@link ManagedTransactionOptions#nestMode} for more information.
   *
   * @default TransactionNestMode.reuse
   */
  defaultTransactionNestMode?: TransactionNestMode;

  /**
   * Default options for model definitions. See Model.init.
   */
  define?: Omit<ModelOptions, 'name' | 'modelName' | 'tableName'>;

  /**
   * Disable the use of AsyncLocalStorage to automatically pass transactions started by {@link Sequelize#transaction}.
   * You will need to pass transactions around manually if you disable this.
   */
  disableClsTransactions?: boolean;

  /**
   * Set the default transaction isolation level.
   * If not set, does not change the database's default transaction isolation level.
   */
  isolationLevel?: IsolationLevel | undefined;

  /**
   * A flag that defines if the default timezone is used to convert dates from the database.
   *
   * @default false
   */
  keepDefaultTimezone?: boolean;

  /**
   * Set to `true` to show bind parameters in log.
   *
   * @default false
   */
  logQueryParameters?: boolean;

  /**
   * Set to `true` to automatically minify aliases generated by sequelize.
   * Mostly useful to circumvent the POSTGRES alias limit of 64 characters.
   *
   * @default false
   */
  minifyAliases?: boolean;

  /**
   * Disable built in type validators on insert and update, e.g. don't validate that arguments passed to integer
   * fields are integer-like.
   *
   * @default false
   */
  noTypeValidation?: boolean;

  /**
   * When representing the JavaScript null primitive in a JSON column, Sequelize can
   * use either the SQL NULL value, or a JSON 'null'.
   *
   * Set this to "json" if you want the null to be stored as a JSON 'null'.
   * Set this to "sql" if you want the null to be stored as the SQL NULL value.
   * Set this to "explicit" if you don't want Sequelize to make any assumptions.
   * This means that you won't be able to use the JavaScript null primitive as the top level value of a JSON column,
   * you will have to use {@link SQL_NULL} or {@link JSON_NULL} instead.
   *
   * This only impacts serialization when inserting or updating values.
   * Comparing always requires to be explicit.
   *
   * Read more: https://sequelize.org/docs/v7/querying/json/
   *
   * @default json
   */
  nullJsonStringification?: 'explicit' | 'json' | 'sql';

  /**
   * A flag that defines if null values should be passed to SQL queries or not.
   *
   * @default false
   */
  omitNull?: boolean;

  // TODO [>7]: remove this option
  prependSearchPath?: boolean | undefined;

  /**
   * Default options for sequelize.query
   */
  query?: QueryOptions;

  /**
   * Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of
   * them.
   *
   * @default true
   */
  quoteIdentifiers?: boolean;

  /**
   * Use read / write replication. To enable replication, pass an object, with two properties, read and write.
   * Write should be an object (a single server for handling writes), and read an array of object (several
   * servers to handle reads). Each read/write server can have the following properties: `host`, `port`,
   * `username`, `password`, `database`.  Connection strings can be used instead of objects.
   *
   * @default false
   */
  replication?: ReplicationOptions<Dialect> | false | Nullish;

  retry?: RetryOptions;

  /**
   * If defined, the connection will use the provided schema instead of the default ("public").
   */
  schema?: string;

  /**
   * Default options for sequelize.set
   */
  set?: DefaultSetOptions;

  /**
   * Default options for sequelize.sync
   */
  sync?: SyncOptions;

  /**
   * The timezone used when converting a date from the database into a JavaScript date. The timezone is also
   * used to SET TIMEZONE when connecting to the server, to ensure that the result of NOW, CURRENT_TIMESTAMP
   * and other time related functions have in the right timezone. For best cross platform performance use the
   * format
   * +/-HH:MM. Will also accept string versions of timezones supported by Intl.Locale (e.g. 'America/Los_Angeles');
   * this is useful to capture daylight savings time changes.
   *
   * @default '+00:00'
   */
  timezone?: string;

  /**
   * Set the default transaction type. See Sequelize.Transaction.TYPES for possible options. Sqlite only.
   *
   * @default 'DEFERRED'
   */
  transactionType?: TransactionType;
}

export const EPHEMERAL_SEQUELIZE_OPTIONS = getSynchronizedTypeKeys<
  EphemeralSequelizeOptions<AbstractDialect>
>({
  databaseVersion: undefined,
  dialect: undefined,
  hooks: undefined,
  models: undefined,
  pool: undefined,
  url: undefined,
});

/**
 * Sequelize options that are not persisted in the Sequelize instance.
 */
export interface EphemeralSequelizeOptions<Dialect extends AbstractDialect> {
  /**
   * The version of the Database Sequelize will connect to.
   * If unspecified, or set to 0, Sequelize will retrieve it during its first connection to the Database.
   */
  databaseVersion?: string;

  /**
   * The dialect of the database you are connecting to. Either the name of the dialect, or a dialect class.
   */
  dialect: DialectName | Class<Dialect>;

  /**
   * Sets global permanent hooks.
   */
  hooks?: Partial<SequelizeHooks<Dialect>>;

  /**
   * A list of models to load and init.
   *
   * This option is only useful if you created your models using decorators.
   * Models created using {@link Model.init} or {@link Sequelize#define} don't need to be specified in this option.
   *
   * Use {@link importModels} to load models dynamically:
   *
   * @example
   * ```ts
   * import { User } from './models/user.js';
   *
   * new Sequelize({
   *   models: [User],
   * });
   * ```
   *
   * @example
   * ```ts
   * new Sequelize({
   *   models: await importModels(__dirname + '/*.model.ts'),
   * });
   * ```
   */
  models?: ModelStatic[];

  /**
   * Connection pool options
   */
  pool?: PoolOptions<Dialect> | undefined;

  /**
   * The connection URL.
   * If other connection options are set, they will override the values set in this URL.
   */
  url?: string | undefined;
}
