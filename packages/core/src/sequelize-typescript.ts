import { AsyncLocalStorage } from 'node:async_hooks';
import { initDecoratedAssociations } from './decorators/legacy/associations.js';
import { initDecoratedModel } from './decorators/shared/model.js';
import type { AbstractConnectionManager, Connection, GetConnectionOptions } from './dialects/abstract/connection-manager.js';
import type { AbstractDialect } from './dialects/abstract/index.js';
import type { AbstractQuery } from './dialects/abstract/query.js';
import {
  legacyBuildAddAnyHook,
  legacyBuildAddHook,
  legacyBuildHasHook,
  legacyBuildRemoveHook,
  legacyBuildRunHook,
} from './hooks-legacy.js';
import type { AsyncHookReturn, HookHandler } from './hooks.js';
import { HookHandlerBuilder } from './hooks.js';
import type { ModelHooks } from './model-hooks.js';
import { validModelHooks } from './model-hooks.js';
import type { ModelManager } from './model-manager.js';
import type { ConnectionOptions, Options, Sequelize } from './sequelize.js';
import type { TransactionOptions } from './transaction.js';
import { Transaction } from './transaction.js';
import type { PartialBy } from './utils/types.js';
import type {
  AbstractQueryInterface,
  DestroyOptions,
  ModelAttributes,
  ModelOptions,
  ModelStatic,
  QueryOptions,
  SyncOptions,
  TruncateOptions,
} from '.';

export interface SequelizeHooks extends ModelHooks {
  /**
   * A hook that is run at the start of {@link Sequelize#define} and {@link Model.init}
   */
  beforeDefine(attributes: ModelAttributes, options: ModelOptions): void;

  /**
   * A hook that is run at the end of {@link Sequelize#define} and {@link Model.init}
   */
  afterDefine(model: ModelStatic): void;

  /**
   * A hook that is run before a connection is created
   */
  beforeConnect(config: ConnectionOptions): AsyncHookReturn;

  /**
   * A hook that is run after a connection is created
   */
  afterConnect(connection: Connection, config: ConnectionOptions): AsyncHookReturn;

  /**
   * A hook that is run before a connection is disconnected
   */
  beforeDisconnect(connection: Connection): AsyncHookReturn;

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
  beforePoolAcquire(options?: GetConnectionOptions): AsyncHookReturn;

  /**
   * A hook that is run after a connection to the pool
   */
  afterPoolAcquire(connection: Connection, options?: GetConnectionOptions): AsyncHookReturn;
}

export interface StaticSequelizeHooks {
  /**
   * A hook that is run at the beginning of the creation of a Sequelize instance.
   */
  beforeInit(options: Options): void;

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
  'beforeInit', 'afterInit',
]);

const instanceSequelizeHooks = new HookHandlerBuilder<SequelizeHooks>([
  'beforeQuery', 'afterQuery',
  'beforeBulkSync', 'afterBulkSync',
  'beforeConnect', 'afterConnect',
  'beforeDisconnect', 'afterDisconnect',
  'beforeDefine', 'afterDefine',
  'beforePoolAcquire', 'afterPoolAcquire',
  ...validModelHooks,
]);

type TransactionCallback<T> = (t: Transaction) => PromiseLike<T> | T;
type SessionCallback<T> = (connection: Connection) => PromiseLike<T> | T;

// DO NOT MAKE THIS CLASS PUBLIC!
/**
 * This is a temporary class used to progressively migrate the Sequelize class to TypeScript by slowly moving its functions here.
 * Always use {@link Sequelize} instead.
 */
export abstract class SequelizeTypeScript {
  // created by the Sequelize subclass. Will eventually be migrated here.
  abstract readonly modelManager: ModelManager;
  abstract readonly dialect: AbstractDialect;
  abstract readonly queryInterface: AbstractQueryInterface;
  declare readonly connectionManager: AbstractConnectionManager;

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

  get hooks(): HookHandler<SequelizeHooks> {
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
  beforeFindAfterExpandIncludeAll = legacyBuildAddHook(instanceSequelizeHooks, 'beforeFindAfterExpandIncludeAll');
  beforeFindAfterOptions = legacyBuildAddHook(instanceSequelizeHooks, 'beforeFindAfterOptions');
  afterFind = legacyBuildAddHook(instanceSequelizeHooks, 'afterFind');

  beforeSync = legacyBuildAddHook(instanceSequelizeHooks, 'beforeSync');
  afterSync = legacyBuildAddHook(instanceSequelizeHooks, 'afterSync');

  beforeAssociate = legacyBuildAddHook(instanceSequelizeHooks, 'beforeAssociate');
  afterAssociate = legacyBuildAddHook(instanceSequelizeHooks, 'afterAssociate');

  #transactionCls: AsyncLocalStorage<Transaction> | undefined;

  private _setupTransactionCls() {
    this.#transactionCls = new AsyncLocalStorage<Transaction>();
  }

  addModels(models: ModelStatic[]) {
    for (const model of models) {
      initDecoratedModel(
        model,
        // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
        this,
      );
    }

    for (const model of models) {
      initDecoratedAssociations(
        model,
        // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
        this,
      );
    }
  }

  /**
   * Returns the transaction that is associated to the current asynchronous operation.
   * This method returns undefined if no transaction is active in the current asynchronous operation,
   * or if {@link Options.disableClsTransactions} is true.
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
   * This can be disabled by setting {@link Options.disableClsTransactions} to true. You will then need to pass transactions to your queries manually.
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
  transaction<T>(options: TransactionOptions, callback: TransactionCallback<T>): Promise<T>;
  async transaction<T>(
    optionsOrCallback: TransactionOptions | TransactionCallback<T>,
    maybeCallback?: TransactionCallback<T>,
  ): Promise<T> {
    let options: TransactionOptions;
    let callback: TransactionCallback<T>;
    if (typeof optionsOrCallback === 'function') {
      callback = optionsOrCallback;
      options = {};
    } else {
      callback = maybeCallback!;
      options = optionsOrCallback;
    }

    if (!callback) {
      throw new Error('sequelize.transaction requires a callback. If you wish to start an unmanaged transaction, please use sequelize.startUnmanagedTransaction instead');
    }

    const transaction = new Transaction(
      // @ts-expect-error -- remove once this class has been merged back with the Sequelize class
      this,
      options,
    );

    const wrappedCallback = async () => {
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
   * even if {@link Options.disableClsTransactions} is false.
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
    const sortedModels = this.modelManager.getModelsTopoSortedByForeignKey();
    const models = sortedModels || this.modelManager.models;

    // It does not make sense to apply a limit to something that will run on all models
    if (options && 'limit' in options) {
      throw new Error('sequelize.destroyAll does not support the limit option.');
    }

    // We will eventually remove the "truncate" option from Model.destroy, in favor of using Model.truncate,
    // so we don't support it in new methods.
    if (options && 'truncate' in options) {
      throw new Error('sequelize.destroyAll does not support the truncate option. Use sequelize.truncate instead.');
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
    const sortedModels = this.modelManager.getModelsTopoSortedByForeignKey();
    const models = sortedModels || this.modelManager.models;
    const hasCyclicDependencies = sortedModels == null;

    if (hasCyclicDependencies && !options?.cascade && !options?.withoutForeignKeyChecks) {
      throw new Error('Sequelize#truncate: Some of your models have cyclic references (foreign keys). You need to use the "cascade" or "withoutForeignKeyChecks" options to be able to delete rows from models that have cyclic references.');
    }

    if (options?.withoutForeignKeyChecks) {
      if (!this.dialect.supports.constraints.foreignKeyChecksDisableable) {
        throw new Error(`Sequelize#truncate: ${this.dialect.name} does not support disabling foreign key checks. The "withoutForeignKeyChecks" option cannot be used.`);
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

    const connection = await this.connectionManager.getConnection(options as GetConnectionOptions);

    try {
      return await callback(connection);
    } finally {
      if (options.destroyConnection) {
        await this.connectionManager.destroyConnection(connection);
      } else {
        this.connectionManager.releaseConnection(connection);
      }
    }
  }
}
