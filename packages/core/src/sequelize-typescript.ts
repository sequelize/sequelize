import type { PartialBy } from '@sequelize/utils';
import {
  SortDirection,
  cloneDeepPlainValues,
  freezeDeep,
  inspect,
  isNullish,
  isString,
  join,
  localizedStringComparator,
  map,
  splitObject,
} from '@sequelize/utils';
import { cyan, red } from 'ansis';
import { AsyncLocalStorage } from 'node:async_hooks';
import semver from 'semver';
import type {
  Connection,
  CreateSchemaOptions,
  DataType,
  DataTypeClassOrInstance,
  DestroyOptions,
  ModelAttributes,
  ModelOptions,
  ModelStatic,
  QiListSchemasOptions,
  QueryOptions,
  RawConnectionOptions,
  SyncOptions,
  TruncateOptions,
} from '.';
import type {
  AbstractConnection,
  GetConnectionOptions,
} from './abstract-dialect/connection-manager.js';
import { normalizeDataType, validateDataType } from './abstract-dialect/data-types-utils.js';
import type { AbstractDataType } from './abstract-dialect/data-types.js';
import type { AbstractDialect, ConnectionOptions } from './abstract-dialect/dialect.js';
import type { EscapeOptions } from './abstract-dialect/query-generator-typescript.js';
import type { QiDropAllSchemasOptions } from './abstract-dialect/query-interface.types.js';
import type { AbstractQuery } from './abstract-dialect/query.js';
import type { AcquireConnectionOptions } from './abstract-dialect/replication-pool.js';
import { ReplicationPool } from './abstract-dialect/replication-pool.js';
import { initDecoratedAssociations } from './decorators/legacy/associations.js';
import { initDecoratedModel } from './decorators/shared/model.js';
import { ConnectionAcquireTimeoutError } from './errors/connection/connection-acquire-timeout-error.js';
import {
  legacyBuildAddAnyHook,
  legacyBuildAddHook,
  legacyBuildHasHook,
  legacyBuildRemoveHook,
  legacyBuildRunHook,
} from './hooks-legacy.js';
import type { AsyncHookReturn, HookHandler } from './hooks.js';
import { HookHandlerBuilder } from './hooks.js';
import { listenForModelDefinition, removeModelDefinition } from './model-definition.js';
import type { ModelHooks } from './model-hooks.js';
import { validModelHooks } from './model-hooks.js';
import { setTransactionFromCls } from './model-internals.js';
import { ModelSetView } from './model-set-view.js';
import {
  EPHEMERAL_SEQUELIZE_OPTIONS,
  PERSISTED_SEQUELIZE_OPTIONS,
  importDialect,
} from './sequelize.internals.js';
import type { QueryRawOptions } from './sequelize.js';
import { Sequelize } from './sequelize.js';
import type { NormalizedOptions, Options } from './sequelize.types.js';
import type { ManagedTransactionOptions, TransactionOptions } from './transaction.js';
import {
  Transaction,
  TransactionNestMode,
  TransactionType,
  assertTransactionIsCompatibleWithOptions,
  normalizeTransactionOptions,
} from './transaction.js';
import { getIntersection } from './utils/array.js';
import { normalizeReplicationConfig } from './utils/connection-options.js';
import * as Deprecations from './utils/deprecations.js';
import { showAllToListSchemas } from './utils/deprecations.js';
import { removeUndefined, untypedMultiSplitObject } from './utils/object.js';

export interface SequelizeHooks<Dialect extends AbstractDialect> extends ModelHooks {
  /**
   * A hook that is run at the start of {@link Sequelize#define} and {@link Model.init}
   */
  beforeDefine(attributes: ModelAttributes<any>, options: ModelOptions): void;

  /**
   * A hook that is run at the end of {@link Sequelize#define} and {@link Model.init}
   */
  afterDefine(model: ModelStatic): void;

  /**
   * A hook that is run before a connection is created
   */
  beforeConnect(config: ConnectionOptions<Dialect>): AsyncHookReturn;

  /**
   * A hook that is run after a connection is created
   */
  afterConnect(connection: AbstractConnection, config: ConnectionOptions<Dialect>): AsyncHookReturn;

  /**
   * A hook that is run before a connection is disconnected
   */
  beforeDisconnect(connection: AbstractConnection): AsyncHookReturn;

  /**
   * A hook that is run after a connection is disconnected
   */
  afterDisconnect(connection: unknown): AsyncHookReturn;
  beforeQuery(options: QueryOptions, query: AbstractQuery): AsyncHookReturn;
  afterQuery(options: QueryOptions, query: AbstractQuery): AsyncHookReturn;

  /**
   * A hook that is run at the start of {@link Sequelize#sync}
   */
  beforeBulkSync(options: SyncOptions): AsyncHookReturn;

  /**
   * A hook that is run at the end of {@link Sequelize#sync}
   */
  afterBulkSync(options: SyncOptions): AsyncHookReturn;

  /**
   * A hook that is run before a connection to the pool
   */
  beforePoolAcquire(options?: AcquireConnectionOptions): AsyncHookReturn;

  /**
   * A hook that is run after a connection to the pool
   */
  afterPoolAcquire(
    connection: AbstractConnection,
    options?: AcquireConnectionOptions,
  ): AsyncHookReturn;
}

export interface StaticSequelizeHooks {
  /**
   * A hook that is run at the beginning of the creation of a Sequelize instance.
   */
  beforeInit(options: Options<AbstractDialect>): void;

  /**
   * A hook that is run at the end of the creation of a Sequelize instance.
   */
  afterInit(sequelize: Sequelize): void;
}

export interface SequelizeTruncateOptions extends TruncateOptions {
  /**
   * Most dialects will not allow you to truncate a table while other tables have foreign key references to it (even if they are empty).
   * This option will disable those checks while truncating all tables, and re-enable them afterwards.
   *
   * This option is currently only supported for MySQL, SQLite, and MariaDB.
   *
   * Postgres can use {@link TruncateOptions.cascade} to achieve a similar goal.
   *
   * If you're experiencing this problem in other dialects, consider using {@link Sequelize.destroyAll} instead.
   */
  withoutForeignKeyChecks?: boolean;
}

export interface WithConnectionOptions extends PartialBy<GetConnectionOptions, 'type'> {
  /**
   * Close the connection when the callback finishes instead of returning it to the pool.
   * This is useful if you want to ensure that the connection is not reused,
   * for example if you ran queries that changed session options.
   */
  destroyConnection?: boolean;
}

const staticSequelizeHooks = new HookHandlerBuilder<StaticSequelizeHooks>([
  'beforeInit',
  'afterInit',
]);

const instanceSequelizeHooks = new HookHandlerBuilder<SequelizeHooks<AbstractDialect>>([
  'beforeQuery',
  'afterQuery',
  'beforeBulkSync',
  'afterBulkSync',
  'beforeConnect',
  'afterConnect',
  'beforeDisconnect',
  'afterDisconnect',
  'beforeDefine',
  'afterDefine',
  'beforePoolAcquire',
  'afterPoolAcquire',
  ...validModelHooks,
]);

type TransactionCallback<T> = (t: Transaction) => PromiseLike<T> | T;
type SessionCallback<T> = (connection: AbstractConnection) => PromiseLike<T> | T;

export const SUPPORTED_DIALECTS = Object.freeze([
  'mysql',
  'postgres',
  'sqlite3',
  'mariadb',
  'mssql',
  'mariadb',
  'mssql',
  'db2',
  'snowflake',
  'ibmi',
] as const);

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the Sequelize class to TypeScript by slowly moving its functions here.
 * Always use {@link Sequelize} instead.
 */
export abstract class SequelizeTypeScript<Dialect extends AbstractDialect> {
  // created by the Sequelize subclass. Will eventually be migrated here.
  readonly dialect: Dialect;
  readonly options: NormalizedOptions<Dialect>;

  /**
   * The options that were used to create this Sequelize instance.
   * These are an unmodified copy of the options passed to the constructor.
   * They are not normalized or validated.
   *
   * Mostly available for cloning the Sequelize instance.
   * For other uses, we recommend using {@link options} instead.
   */
  readonly rawOptions: Options<Dialect>;

  static get hooks(): HookHandler<StaticSequelizeHooks> {
    return staticSequelizeHooks.getFor(this);
  }

  static addHook = legacyBuildAddAnyHook(staticSequelizeHooks);
  static removeHook = legacyBuildRemoveHook(staticSequelizeHooks);
  static hasHook = legacyBuildHasHook(staticSequelizeHooks);
  static hasHooks = legacyBuildHasHook(staticSequelizeHooks);
  static runHooks = legacyBuildRunHook(staticSequelizeHooks);

  static beforeInit = legacyBuildAddHook(staticSequelizeHooks, 'beforeInit');
  static afterInit = legacyBuildAddHook(staticSequelizeHooks, 'afterInit');

  get hooks(): HookHandler<SequelizeHooks<Dialect>> {
    return instanceSequelizeHooks.getFor(this);
  }

  addHook = legacyBuildAddAnyHook(instanceSequelizeHooks);
  removeHook = legacyBuildRemoveHook(instanceSequelizeHooks);
  hasHook = legacyBuildHasHook(instanceSequelizeHooks);
  hasHooks = legacyBuildHasHook(instanceSequelizeHooks);
  runHooks = legacyBuildRunHook(instanceSequelizeHooks);

  beforeQuery = legacyBuildAddHook(instanceSequelizeHooks, 'beforeQuery');
  afterQuery = legacyBuildAddHook(instanceSequelizeHooks, 'afterQuery');

  beforeBulkSync = legacyBuildAddHook(instanceSequelizeHooks, 'beforeBulkSync');
  afterBulkSync = legacyBuildAddHook(instanceSequelizeHooks, 'afterBulkSync');

  beforeConnect = legacyBuildAddHook(instanceSequelizeHooks, 'beforeConnect');
  afterConnect = legacyBuildAddHook(instanceSequelizeHooks, 'afterConnect');

  beforeDisconnect = legacyBuildAddHook(instanceSequelizeHooks, 'beforeDisconnect');
  afterDisconnect = legacyBuildAddHook(instanceSequelizeHooks, 'afterDisconnect');

  beforeDefine = legacyBuildAddHook(instanceSequelizeHooks, 'beforeDefine');
  afterDefine = legacyBuildAddHook(instanceSequelizeHooks, 'afterDefine');

  beforePoolAcquire = legacyBuildAddHook(instanceSequelizeHooks, 'beforePoolAcquire');
  afterPoolAcquire = legacyBuildAddHook(instanceSequelizeHooks, 'afterPoolAcquire');

  beforeValidate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeValidate');
  afterValidate = legacyBuildAddHook(instanceSequelizeHooks, 'afterValidate');
  validationFailed = legacyBuildAddHook(instanceSequelizeHooks, 'validationFailed');

  beforeCreate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeCreate');
  afterCreate = legacyBuildAddHook(instanceSequelizeHooks, 'afterCreate');

  beforeDestroy = legacyBuildAddHook(instanceSequelizeHooks, 'beforeDestroy');
  afterDestroy = legacyBuildAddHook(instanceSequelizeHooks, 'afterDestroy');

  beforeRestore = legacyBuildAddHook(instanceSequelizeHooks, 'beforeRestore');
  afterRestore = legacyBuildAddHook(instanceSequelizeHooks, 'afterRestore');

  beforeUpdate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeUpdate');
  afterUpdate = legacyBuildAddHook(instanceSequelizeHooks, 'afterUpdate');

  beforeUpsert = legacyBuildAddHook(instanceSequelizeHooks, 'beforeUpsert');
  afterUpsert = legacyBuildAddHook(instanceSequelizeHooks, 'afterUpsert');

  beforeSave = legacyBuildAddHook(instanceSequelizeHooks, 'beforeSave');
  afterSave = legacyBuildAddHook(instanceSequelizeHooks, 'afterSave');

  beforeBulkCreate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeBulkCreate');
  afterBulkCreate = legacyBuildAddHook(instanceSequelizeHooks, 'afterBulkCreate');

  beforeBulkDestroy = legacyBuildAddHook(instanceSequelizeHooks, 'beforeBulkDestroy');
  afterBulkDestroy = legacyBuildAddHook(instanceSequelizeHooks, 'afterBulkDestroy');

  beforeBulkRestore = legacyBuildAddHook(instanceSequelizeHooks, 'beforeBulkRestore');
  afterBulkRestore = legacyBuildAddHook(instanceSequelizeHooks, 'afterBulkRestore');

  beforeBulkUpdate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeBulkUpdate');
  afterBulkUpdate = legacyBuildAddHook(instanceSequelizeHooks, 'afterBulkUpdate');

  beforeCount = legacyBuildAddHook(instanceSequelizeHooks, 'beforeCount');

  beforeFind = legacyBuildAddHook(instanceSequelizeHooks, 'beforeFind');
  beforeFindAfterExpandIncludeAll = legacyBuildAddHook(
    instanceSequelizeHooks,
    'beforeFindAfterExpandIncludeAll',
  );

  beforeFindAfterOptions = legacyBuildAddHook(instanceSequelizeHooks, 'beforeFindAfterOptions');
  afterFind = legacyBuildAddHook(instanceSequelizeHooks, 'afterFind');

  beforeSync = legacyBuildAddHook(instanceSequelizeHooks, 'beforeSync');
  afterSync = legacyBuildAddHook(instanceSequelizeHooks, 'afterSync');

  beforeAssociate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeAssociate');
  afterAssociate = legacyBuildAddHook(instanceSequelizeHooks, 'afterAssociate');

  readonly #transactionCls: AsyncLocalStorage<Transaction> | undefined;
  #databaseVersion: string | undefined;

  /**
   * The QueryInterface instance, dialect dependant.
   */
  get queryInterface(): Dialect['queryInterface'] {
    return this.dialect.queryInterface;
  }

  /**
   * The QueryGenerator instance, dialect dependant.
   */
  get queryGenerator(): Dialect['queryGenerator'] {
    return this.dialect.queryGenerator;
  }

  get connectionManager(): never {
    throw new Error(`Accessing the connection manager is unlikely to be necessary anymore.
If you need to access the pool, you can access it directly through \`sequelize.pool\`.
If you really need to access the connection manager, access it through \`sequelize.dialect.connectionManager\`.`);
  }

  readonly #models = new Set<ModelStatic>();
  readonly models = new ModelSetView<Dialect>(this, this.#models);
  #isClosed: boolean = false;
  readonly pool: ReplicationPool<Connection<Dialect>, ConnectionOptions<Dialect>>;

  get modelManager(): never {
    throw new Error('Sequelize#modelManager was removed. Use Sequelize#models instead.');
  }

  /**
   * Instantiates sequelize.
   *
   * The options to connect to the database are specific to your dialect.
   * Please refer to the documentation of your dialect on https://sequelize.org to learn about the options you can use.
   *
   * @param options The option bag.
   * @example
   * import { PostgresDialect } from '@sequelize/postgres';
   *
   * // with database, username, and password in the options object
   * const sequelize = new Sequelize({ database, user, password, dialect: PostgresDialect });
   *
   * @example
   * // with url
   * import { MySqlDialect } from '@sequelize/mysql';
   *
   * const sequelize = new Sequelize({
   *   dialect: MySqlDialect,
   *   url: 'mysql://localhost:3306/database',
   * })
   *
   * @example
   * // option examples
   * import { MsSqlDialect } from '@sequelize/mssql';
   *
   * const sequelize = new Sequelize('database', 'username', 'password', {
   *   // the dialect of the database
   *   // It is a Dialect class exported from the dialect package
   *   dialect: MsSqlDialect,
   *
   *   // custom host;
   *   host: 'my.server.tld',
   *   // for postgres, you can also specify an absolute path to a directory
   *   // containing a UNIX socket to connect over
   *   // host: '/sockets/psql_sockets'.
   *
   *   // custom port;
   *   port: 12345,
   *
   *   // disable logging or provide a custom logging function; default: console.log
   *   logging: false,
   *
   *   // This option is specific to MySQL and MariaDB
   *   socketPath: '/Applications/MAMP/tmp/mysql/mysql.sock',
   *
   *   // the storage engine for sqlite
   *   // - default ':memory:'
   *   storage: 'path/to/database.sqlite',
   *
   *   // disable inserting undefined values as NULL
   *   // - default: false
   *   omitNull: true,
   *
   *   // A flag that defines if connection should be over ssl or not
   *   // Dialect-dependent, check the dialect documentation
   *   ssl: true,
   *
   *   // Specify options, which are used when sequelize.define is called.
   *   // The following example:
   *   //   define: { timestamps: false }
   *   // is basically the same as:
   *   //   Model.init(attributes, { timestamps: false });
   *   //   sequelize.define(name, attributes, { timestamps: false });
   *   // so defining the timestamps for each model will be not necessary
   *   define: {
   *     underscored: false,
   *     freezeTableName: false,
   *     charset: 'utf8',
   *     collate: 'utf8_general_ci'
   *     timestamps: true
   *   },
   *
   *   // similar for sync: you can define this to always force sync for models
   *   sync: { force: true },
   *
   *   // pool configuration used to pool database connections
   *   pool: {
   *     max: 5,
   *     idle: 30000,
   *     acquire: 60000,
   *   },
   *
   *   // isolation level of each transaction
   *   // defaults to dialect default
   *   isolationLevel: IsolationLevel.REPEATABLE_READ
   * })
   */
  constructor(options: Options<Dialect>) {
    if (arguments.length > 2) {
      throw new Error(
        'The Sequelize constructor no longer accepts multiple arguments. Please use an options object instead.',
      );
    }

    if (isString(options)) {
      throw new Error(`The Sequelize constructor no longer accepts a string as the first argument. Please use the "url" option instead.

Example for Postgres:

new Sequelize({
  dialect: PostgresDialect,
  url: 'postgres://user:pass@localhost/dbname',
});`);
    }

    // @ts-expect-error -- sanity check
    if (options.pool === false) {
      throw new Error(
        'Setting the "pool" option to "false" is not supported since Sequelize 4. To disable the pool, set the "pool"."max" option to 1.',
      );
    }

    // @ts-expect-error -- sanity check
    if (options.logging === true) {
      throw new Error(
        'The "logging" option must be set to a function or false, not true. If you want to log all queries, set it to `console.log`.',
      );
    }

    // @ts-expect-error -- sanity check
    if (options.operatorsAliases) {
      throw new Error(
        'String based operators have been removed. Please use Symbol operators, read more at https://sequelize.org/docs/v7/core-concepts/model-querying-basics/#deprecated-operator-aliases',
      );
    }

    if ('dialectModulePath' in options) {
      throw new Error(
        'The "dialectModulePath" option has been removed, as it is not compatible with bundlers. Please refer to the documentation of your dialect at https://sequelize.org to learn about the alternative.',
      );
    }

    if ('dialectModule' in options) {
      throw new Error(
        'The "dialectModule" option has been replaced with an equivalent option specific to your dialect. Please refer to the documentation of your dialect at https://sequelize.org to learn about the alternative.',
      );
    }

    if ('typeValidation' in options) {
      throw new Error(
        'The typeValidation has been renamed to noTypeValidation, and is false by default',
      );
    }

    if (!options.dialect) {
      throw new Error('The "dialect" option must be explicitly supplied since Sequelize 4');
    }

    // Synchronize ModelDefinition map with the registered models set
    listenForModelDefinition(model => {
      const modelName = model.modelDefinition.modelName;

      // @ts-expect-error -- remove this disable once all sequelize.js has been migrated to TS
      if (model.sequelize === (this as Sequelize)) {
        const existingModel = this.models.get(modelName);
        if (existingModel) {
          this.#models.delete(existingModel);
          // TODO: require the user to explicitly remove the previous model first.
          // throw new Error(`A model with the name ${inspect(model.name)} was already registered in this Sequelize instance.`);
        }

        this.#models.add(model);
      }
    });

    Sequelize.hooks.runSync('beforeInit', options);

    this.rawOptions = freezeDeep(cloneDeepPlainValues(options, true));

    const DialectClass: typeof AbstractDialect = isString(options.dialect)
      ? importDialect(options.dialect)
      : (options.dialect as unknown as typeof AbstractDialect);

    const nonUndefinedOptions = removeUndefined(options);

    if (options.hooks) {
      this.hooks.addListeners(options.hooks);
    }

    const [persistedSequelizeOptions, remainingOptions] = splitObject(
      nonUndefinedOptions,
      PERSISTED_SEQUELIZE_OPTIONS,
    );

    const dialectOptionNames = DialectClass.getSupportedOptions();
    const connectionOptionNames = [...DialectClass.getSupportedConnectionOptions(), 'url'];
    const allSequelizeOptionNames = [
      ...PERSISTED_SEQUELIZE_OPTIONS,
      // "url" is a special case. It's a connection option, but it's one that Sequelize accepts, instead of the dialect.
      ...EPHEMERAL_SEQUELIZE_OPTIONS.filter(option => option !== 'url'),
    ];

    const allDialectOptionNames = [...dialectOptionNames, ...connectionOptionNames];

    const conflictingOptions = getIntersection(allSequelizeOptionNames, allDialectOptionNames);
    if (conflictingOptions.length > 0) {
      throw new Error(
        `The following options from ${DialectClass.name} conflict with built-in Sequelize options: ${join(
          map(conflictingOptions, option => red(option)),
          ', ',
        )}.
This is a bug in the dialect implementation itself, not in the user's code.
Please rename these options to a name that is not already used by Sequelize.`,
      );
    }

    const [{ dialectOptions, connectionOptions }, unseenKeys] = untypedMultiSplitObject(
      remainingOptions,
      {
        dialectOptions: dialectOptionNames,
        connectionOptions: connectionOptionNames,
      },
    );

    for (const key of EPHEMERAL_SEQUELIZE_OPTIONS) {
      unseenKeys.delete(key);
    }

    if (unseenKeys.size > 0) {
      const caseInsensitiveEnComparator = localizedStringComparator('en', SortDirection.ASC, {
        sensitivity: 'base',
      });

      throw new Error(
        `The following options are not recognized by Sequelize nor ${DialectClass.name}: ${join(
          map(unseenKeys, option => red(option)),
          ', ',
        )}.

Sequelize accepts the following options: ${allSequelizeOptionNames
          .sort(caseInsensitiveEnComparator)
          .map(option => cyan(option))
          .join(', ')}.

${DialectClass.name} accepts the following options (in addition to the Sequelize options): ${[
          ...dialectOptionNames,
        ]
          .sort(caseInsensitiveEnComparator)
          .map(option => cyan(option))
          .join(', ')}.
${DialectClass.name} options can be set at the root of the option bag, like Sequelize options.

The following options can be used to configure the connection to the database: ${connectionOptionNames
          .sort(caseInsensitiveEnComparator)
          .map(option => cyan(option))
          .join(', ')}.
Connection options can be used at the root of the option bag, in the "replication" option, and can be modified by the "beforeConnect" hook.
`,
      );
    }

    // @ts-expect-error -- The Dialect class must respect this interface
    this.dialect = new DialectClass(this, dialectOptions);

    this.options = freezeDeep({
      define: {},
      query: {},
      sync: {},
      timezone: '+00:00',
      keepDefaultTimezone: false,
      logging: false,
      omitNull: false,
      // TODO [>7]: remove this option
      quoteIdentifiers: true,
      retry: {
        max: 5,
        match: ['SQLITE_BUSY: database is locked'],
      },
      transactionType: TransactionType.DEFERRED,
      isolationLevel: undefined,
      noTypeValidation: false,
      benchmark: false,
      minifyAliases: false,
      logQueryParameters: false,
      disableClsTransactions: false,
      defaultTransactionNestMode: TransactionNestMode.reuse,
      defaultTimestampPrecision: 6,
      nullJsonStringification: 'json',
      ...persistedSequelizeOptions,
      replication: normalizeReplicationConfig(
        this.dialect,
        connectionOptions as RawConnectionOptions<Dialect>,
        options.replication,
      ),
    });

    if (options.databaseVersion) {
      this.setDatabaseVersion(options.databaseVersion);
    }

    if (!this.options.disableClsTransactions) {
      this.#transactionCls = new AsyncLocalStorage<Transaction>();
    }

    //     if (this.options.define.hooks) {
    //       throw new Error(`The "define" Sequelize option cannot be used to add hooks to all models. Please remove the "hooks" property from the "define" option you passed to the Sequelize constructor.
    // Instead of using this option, you can listen to the same event on all models by adding the listener to the Sequelize instance itself, since all model hooks are forwarded to the Sequelize instance.`);
    //     }

    if (this.options.quoteIdentifiers === false) {
      Deprecations.alwaysQuoteIdentifiers();
    }

    if (!this.dialect.supports.globalTimeZoneConfig && this.options.timezone !== '+00:00') {
      throw new Error(
        `Setting a custom timezone is not supported by ${this.dialect.name}, dates are always returned as UTC. Please remove the custom timezone option.`,
      );
    }

    this.pool = new ReplicationPool<Connection<Dialect>, ConnectionOptions<Dialect>>({
      pool: {
        max: 5,
        min: 0,
        idle: 10_000,
        acquire: 60_000,
        evict: 1000,
        maxUses: Infinity,
        ...(options.pool ? removeUndefined(options.pool) : undefined),
      },
      connect: async (connectOptions: ConnectionOptions<Dialect>): Promise<Connection<Dialect>> => {
        if (this.isClosed()) {
          throw new Error(
            'sequelize.close was called, new connections cannot be established. If you did not mean for the Sequelize instance to be closed permanently, prefer using sequelize.pool.destroyAllNow instead.',
          );
        }

        const clonedConnectOptions = cloneDeepPlainValues(connectOptions, true);
        await this.hooks.runAsync('beforeConnect', clonedConnectOptions);

        const connection = await this.dialect.connectionManager.connect(clonedConnectOptions);
        await this.hooks.runAsync('afterConnect', connection, clonedConnectOptions);

        if (!this.getDatabaseVersionIfExist()) {
          await this.#initializeDatabaseVersion(connection);
        }

        return connection;
      },
      disconnect: async (connection: Connection<Dialect>): Promise<void> => {
        await this.hooks.runAsync('beforeDisconnect', connection);
        await this.dialect.connectionManager.disconnect(connection);
        await this.hooks.runAsync('afterDisconnect', connection);
      },
      validate: (connection: Connection<Dialect>): boolean => {
        if (options.pool?.validate) {
          return options.pool.validate(connection);
        }

        return this.dialect.connectionManager.validate(connection);
      },
      beforeAcquire: async (acquireOptions: AcquireConnectionOptions): Promise<void> => {
        return this.hooks.runAsync('beforePoolAcquire', acquireOptions);
      },
      afterAcquire: async (
        connection: Connection<Dialect>,
        acquireOptions: AcquireConnectionOptions,
      ) => {
        return this.hooks.runAsync('afterPoolAcquire', connection, acquireOptions);
      },
      timeoutErrorClass: ConnectionAcquireTimeoutError,
      readConfig: this.options.replication.read,
      writeConfig: this.options.replication.write,
    });

    if (options.models) {
      this.addModels(options.models);
    }

    // TODO: remove this cast once sequelize-typescript and sequelize have been fully merged
    Sequelize.hooks.runSync('afterInit', this as unknown as Sequelize);
  }

  #databaseVersionPromise: Promise<void> | null = null;
  async #initializeDatabaseVersion(connection: Connection<Dialect>) {
    if (this.#databaseVersion) {
      return;
    }

    if (this.#databaseVersionPromise) {
      await this.#databaseVersionPromise;

      return;
    }

    this.#databaseVersionPromise = (async () => {
      try {
        const version = await this.fetchDatabaseVersion({
          logging: false,
          connection,
        });

        const parsedVersion = semver.coerce(version)?.version || version;

        this.setDatabaseVersion(
          semver.valid(parsedVersion) ? parsedVersion : this.dialect.minimumDatabaseVersion,
        );
      } finally {
        this.#databaseVersionPromise = null;
      }
    })();

    await this.#databaseVersionPromise;
  }

  /**
   * Close all connections used by this sequelize instance, and free all references so the instance can be garbage collected.
   *
   * Normally this is done on process exit, so you only need to call this method if you are creating multiple instances, and want
   * to garbage collect some of them.
   *
   * @returns
   */
  async close() {
    this.#isClosed = true;

    await this.pool.destroyAllNow();
  }

  isClosed() {
    return this.#isClosed;
  }

  addModels(models: ModelStatic[]) {
    const registeredModels = models.filter(model =>
      initDecoratedModel(
        model,
        // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
        this,
      ),
    );

    for (const model of registeredModels) {
      initDecoratedAssociations(
        model,
        // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
        this,
      );
    }
  }

  removeAllModels() {
    for (const model of this.#models) {
      removeModelDefinition(model);
    }

    this.#models.clear();
  }

  /**
   * Escape value to be used in raw SQL.
   *
   * If you are using this to use the value in a {@link literal}, consider using {@link sql} instead, which automatically
   * escapes interpolated values.
   *
   * @param value The value to escape
   * @param options
   */
  escape(value: unknown, options?: EscapeOptions) {
    return this.dialect.queryGenerator.escape(value, options);
  }

  /**
   * Returns the transaction that is associated to the current asynchronous operation.
   * This method returns undefined if no transaction is active in the current asynchronous operation,
   * or if the Sequelize "disableClsTransactions" option is true.
   */
  getCurrentClsTransaction(): Transaction | undefined {
    return this.#transactionCls?.getStore();
  }

  /**
   * Start a managed transaction: Sequelize will create a transaction, pass it to your callback, and commit
   * it once the promise returned by your callback resolved, or execute a rollback if the promise rejects.
   *
   * ```ts
   * try {
   *   await sequelize.transaction(() => {
   *     const user = await User.findOne(...);
   *     await user.update(...);
   *   });
   *
   *   // By now, the transaction has been committed
   * } catch {
   *   // If the transaction callback threw an error, the transaction has been rolled back
   * }
   * ```
   *
   * By default, Sequelize uses AsyncLocalStorage to automatically pass the transaction to all queries executed inside the callback (unless you already pass one or set the `transaction` option to null).
   * This can be disabled by setting the Sequelize "disableClsTransactions" option to true. You will then need to pass transactions to your queries manually.
   *
   * ```ts
   * const sequelize = new Sequelize({
   *   // ...
   *   disableClsTransactions: true,
   * })
   *
   * await sequelize.transaction(transaction => {
   *   // transactions are not automatically passed around anymore, you need to do it yourself:
   *   const user = await User.findOne(..., { transaction });
   *   await user.update(..., { transaction });
   * });
   * ```
   *
   * If you want to manage your transaction yourself, use {@link startUnmanagedTransaction}.
   *
   * @param callback Async callback during which the transaction will be active
   */
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;
  /**
   * @param options Transaction Options
   * @param callback Async callback during which the transaction will be active
   */
  transaction<T>(options: ManagedTransactionOptions, callback: TransactionCallback<T>): Promise<T>;
  async transaction<T>(
    optionsOrCallback: ManagedTransactionOptions | TransactionCallback<T>,
    maybeCallback?: TransactionCallback<T>,
  ): Promise<T> {
    let options: ManagedTransactionOptions;
    let callback: TransactionCallback<T>;
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
      options = {};
    } else {
      callback = maybeCallback!;
      options = optionsOrCallback;
    }

    if (!callback) {
      throw new Error(
        'sequelize.transaction requires a callback. If you wish to start an unmanaged transaction, please use sequelize.startUnmanagedTransaction instead',
      );
    }

    const nestMode: TransactionNestMode =
      options.nestMode ?? this.options.defaultTransactionNestMode;

    // @ts-expect-error -- will be fixed once this class has been merged back with the Sequelize class
    const normalizedOptions = normalizeTransactionOptions(this, options);

    if (nestMode === TransactionNestMode.separate) {
      delete normalizedOptions.transaction;
    } else {
      // @ts-expect-error -- will be fixed once this class has been merged back with the Sequelize class
      setTransactionFromCls(normalizedOptions, this);

      // in reuse & savepoint mode,
      // we use the same transaction, so we need to make sure it's compatible with the requested options
      if (normalizedOptions.transaction) {
        assertTransactionIsCompatibleWithOptions(normalizedOptions.transaction, normalizedOptions);
      }
    }

    const transaction =
      nestMode === TransactionNestMode.reuse && normalizedOptions.transaction
        ? normalizedOptions.transaction
        : new Transaction(
            // @ts-expect-error -- will be fixed once this class has been merged back with the Sequelize class
            this,
            normalizedOptions,
          );

    const isReusedTransaction = transaction === normalizedOptions.transaction;

    const wrappedCallback = async () => {
      // We did not create this transaction, so we're not responsible for managing it.
      if (isReusedTransaction) {
        return callback(transaction);
      }

      await transaction.prepareEnvironment();

      let result;
      try {
        result = await callback(transaction);
      } catch (error) {
        try {
          await transaction.rollback();
        } catch {
          // ignore, because 'rollback' will already print the error before killing the connection
        }

        throw error;
      }

      await transaction.commit();

      return result;
    };

    const cls = this.#transactionCls;
    if (!cls) {
      return wrappedCallback();
    }

    return cls.run(transaction, wrappedCallback);
  }

  /**
   * We highly recommend using {@link Sequelize#transaction} instead.
   * If you really want to use the manual solution, don't forget to commit or rollback your transaction once you are done with it.
   *
   * Transactions started by this method are not automatically passed to queries. You must pass the transaction object manually,
   * even if the Sequelize "disableClsTransactions" option is false.
   *
   * @example
   * ```ts
   * try {
   *   const transaction = await sequelize.startUnmanagedTransaction();
   *   const user = await User.findOne(..., { transaction });
   *   await user.update(..., { transaction });
   *   await transaction.commit();
   * } catch(err) {
   *   await transaction.rollback();
   * }
   * ```
   *
   * @param options
   */
  async startUnmanagedTransaction(options?: TransactionOptions): Promise<Transaction> {
    const transaction = new Transaction(
      // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
      this,
      options,
    );

    await transaction.prepareEnvironment();

    return transaction;
  }

  /**
   * A slower alternative to {@link truncate} that uses DELETE FROM instead of TRUNCATE,
   * but which works with foreign key constraints in dialects that don't support TRUNCATE CASCADE (postgres),
   * or temporarily disabling foreign key constraints (mysql, mariadb, sqlite).
   *
   * @param options
   */
  async destroyAll(options?: Omit<DestroyOptions, 'where' | 'limit' | 'truncate'>) {
    const sortedModels = this.models.getModelsTopoSortedByForeignKey();
    const models: Iterable<ModelStatic> = sortedModels ?? this.models;

    // It does not make sense to apply a limit to something that will run on all models
    if (options && 'limit' in options) {
      throw new Error('sequelize.destroyAll does not support the limit option.');
    }

    if (options && 'truncate' in options) {
      throw new Error(
        'sequelize.destroyAll does not support the truncate option. Use sequelize.truncate instead.',
      );
    }

    for (const model of models) {
      // eslint-disable-next-line no-await-in-loop
      await model.destroy({ ...options, where: {} });
    }
  }

  /**
   * Truncate all models registered in this instance.
   * This is done by calling {@link Model.truncate} on each model.
   *
   * @param options The options passed to {@link Model.truncate}, plus "withoutForeignKeyChecks".
   */
  async truncate(options?: SequelizeTruncateOptions): Promise<void> {
    const sortedModels = this.models.getModelsTopoSortedByForeignKey();
    const models: ModelStatic[] = sortedModels ?? [...this.models];

    const hasCyclicDependencies = sortedModels == null;

    if (hasCyclicDependencies && !options?.cascade && !options?.withoutForeignKeyChecks) {
      throw new Error(
        'Sequelize#truncate: Some of your models have cyclic references (foreign keys). You need to use the "cascade" or "withoutForeignKeyChecks" options to be able to delete rows from models that have cyclic references.',
      );
    }

    if (options?.withoutForeignKeyChecks) {
      if (!this.dialect.supports.constraints.foreignKeyChecksDisableable) {
        throw new Error(
          `Sequelize#truncate: ${this.dialect.name} does not support disabling foreign key checks. The "withoutForeignKeyChecks" option cannot be used.`,
        );
      }

      // Dialects that don't support cascade will throw if a foreign key references a table that is truncated,
      // even if there are no actual rows in the referencing table. To work around this, we disable foreign key.
      return this.queryInterface.withoutForeignKeyChecks(options, async connection => {
        const truncateOptions = { ...options, connection };

        await Promise.all(models.map(async model => model.truncate(truncateOptions)));
      });
    }

    if (options?.cascade) {
      for (const model of models) {
        // If cascade is enabled, we can assume there are foreign keys between the models, so we must truncate them sequentially.
        // eslint-disable-next-line no-await-in-loop
        await model.truncate(options);
      }

      return;
    }

    await Promise.all(models.map(async model => model.truncate(options)));
  }

  async withConnection<T>(options: WithConnectionOptions, callback: SessionCallback<T>): Promise<T>;
  async withConnection<T>(callback: SessionCallback<T>): Promise<T>;
  async withConnection<T>(
    optionsOrCallback: SessionCallback<T> | WithConnectionOptions,
    maybeCallback?: SessionCallback<T>,
  ): Promise<T> {
    let options: WithConnectionOptions;
    let callback: SessionCallback<T>;
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
      options = { type: 'write' };
    } else {
      callback = maybeCallback!;
      options = { type: 'write', ...optionsOrCallback };
    }

    const connection = await this.pool.acquire(options as GetConnectionOptions);

    try {
      return await callback(connection);
    } finally {
      if (options.destroyConnection) {
        await this.pool.destroy(connection);
      } else {
        this.pool.release(connection);
      }
    }
  }

  /**
   * Alias of {@link AbstractQueryInterface#createSchema}
   *
   * @param schema Name of the schema
   * @param options
   */
  async createSchema(schema: string, options?: CreateSchemaOptions): Promise<void> {
    return this.queryInterface.createSchema(schema, options);
  }

  /**
   * Alias of {@link AbstractQueryInterface#showAllSchemas}
   *
   * @deprecated Use {@link AbstractQueryInterface#listSchemas} instead
   * @param options
   */
  async showAllSchemas(options?: QiListSchemasOptions) {
    showAllToListSchemas();

    return this.queryInterface.listSchemas(options);
  }

  /**
   * Alias of {@link AbstractQueryInterface#dropSchema}
   *
   * @param schema
   * @param options
   */
  async dropSchema(schema: string, options?: QueryRawOptions) {
    return this.queryInterface.dropSchema(schema, options);
  }

  /**
   * Alias of {@link AbstractQueryInterface#dropAllSchemas}
   *
   * @param options
   */
  async dropAllSchemas(options?: QiDropAllSchemasOptions) {
    return this.queryInterface.dropAllSchemas(options);
  }

  /**
   * Throws if the database version hasn't been loaded yet.
   * It is automatically loaded the first time Sequelize connects to your database.
   *
   * You can use {@link Sequelize#authenticate} to cause a first connection.
   *
   * @returns current version of the dialect that is internally loaded
   */
  getDatabaseVersion(): string {
    const databaseVersion = this.getDatabaseVersionIfExist();

    if (databaseVersion == null) {
      throw new Error(
        'The current database version is unknown. Please call `sequelize.authenticate()` first to fetch it, or manually configure it through options.',
      );
    }

    return databaseVersion;
  }

  getDatabaseVersionIfExist(): string | null {
    return this.#databaseVersion || null;
  }

  setDatabaseVersion(version: string) {
    try {
      if (semver.lt(version, this.dialect.minimumDatabaseVersion)) {
        console.warn(
          `Database ${this.dialect.name} version ${inspect(version)} is not supported. The minimum supported version is ${this.dialect.minimumDatabaseVersion}.`,
        );

        Deprecations.unsupportedEngine();
      }
    } catch (error) {
      console.warn(
        `Could not validate the database version, as it is not a valid semver version: ${version}.`,
      );

      console.warn(error);
    }

    this.#databaseVersion = version;
  }

  /**
   * Alias of {@link AbstractQueryInterface#fetchDatabaseVersion}
   *
   * @param options
   */
  async fetchDatabaseVersion(options?: QueryRawOptions) {
    return this.queryInterface.fetchDatabaseVersion(options);
  }

  /**
   * Validate a value against a field specification
   *
   * @param value The value to validate
   * @param type The DataType to validate against
   */
  validateValue(value: unknown, type: DataType) {
    if (this.options.noTypeValidation || isNullish(value)) {
      return;
    }

    if (isString(type)) {
      return;
    }

    type = this.normalizeDataType(type);

    const error = validateDataType(value, type);
    if (error) {
      throw error;
    }
  }

  normalizeDataType(Type: string): string;
  normalizeDataType(Type: DataTypeClassOrInstance): AbstractDataType<any>;
  normalizeDataType(Type: string | DataTypeClassOrInstance): string | AbstractDataType<any>;
  normalizeDataType(Type: string | DataTypeClassOrInstance): string | AbstractDataType<any> {
    return normalizeDataType(Type, this.dialect);
  }
}
