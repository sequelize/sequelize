import { ValidationOptions } from './instance-validator';
import Model, {
  BulkCreateOptions,
  CountOptions,
  CreateOptions,
  DestroyOptions,
  RestoreOptions,
  FindOptions,
  InstanceDestroyOptions,
  InstanceRestoreOptions,
  InstanceUpdateOptions,
  ModelAttributes,
  ModelOptions,
  UpdateOptions,
} from './model';
import { Config, Options, Sequelize, SyncOptions } from './sequelize';

export type HookReturn = Promise<void> | void;

/**
 * Options for Model.init. We mostly duplicate the Hooks here, since there is no way to combine the two
 * interfaces.
 */
export interface ModelHooks<M extends Model = Model> {
  beforeValidate(instance: M, options: ValidationOptions): HookReturn;
  afterValidate(instance: M, options: ValidationOptions): HookReturn;
  beforeCreate(attributes: M, options: CreateOptions): HookReturn;
  afterCreate(attributes: M, options: CreateOptions): HookReturn;
  beforeDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  afterDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  beforeRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  afterRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  beforeUpdate(instance: M, options: InstanceUpdateOptions): HookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions): HookReturn;
  beforeSave(instance: M, options: InstanceUpdateOptions | CreateOptions): HookReturn;
  afterSave(instance: M, options: InstanceUpdateOptions | CreateOptions): HookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions): HookReturn;
  afterBulkCreate(instances: M[], options: BulkCreateOptions): HookReturn;
  beforeBulkDestroy(options: DestroyOptions): HookReturn;
  afterBulkDestroy(options: DestroyOptions): HookReturn;
  beforeBulkRestore(options: RestoreOptions): HookReturn;
  afterBulkRestore(options: RestoreOptions): HookReturn;
  beforeBulkUpdate(options: UpdateOptions): HookReturn;
  afterBulkUpdate(options: UpdateOptions): HookReturn;
  beforeFind(options: FindOptions): HookReturn;
  beforeCount(options: CountOptions): HookReturn;
  beforeFindAfterExpandIncludeAll(options: FindOptions): HookReturn;
  beforeFindAfterOptions(options: FindOptions): HookReturn;
  afterFind(instancesOrInstance: M[] | M | null, options: FindOptions): HookReturn;
  beforeSync(options: SyncOptions): HookReturn;
  afterSync(options: SyncOptions): HookReturn;
  beforeBulkSync(options: SyncOptions): HookReturn;
  afterBulkSync(options: SyncOptions): HookReturn;
}

export interface SequelizeHooks extends ModelHooks {
  beforeDefine(attributes: ModelAttributes, options: ModelOptions<Model>): void;
  afterDefine(model: typeof Model): void;
  beforeInit(config: Config, options: Options): void;
  afterInit(sequelize: Sequelize): void;
  beforeConnect(config: Config): HookReturn;
  afterConnect(connection: unknown, config: Config): HookReturn;
  beforeDisconnect(connection: unknown): HookReturn;
  afterDisconnect(connection: unknown): HookReturn;
}

/**
 * Virtual class for deduplication
 */
export class Hooks {
  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<C extends typeof Hooks, K extends keyof SequelizeHooks>(
    hookType: K,
    name: string,
    fn: SequelizeHooks[K]
  ): C;
  public static addHook<C extends typeof Hooks, K extends keyof SequelizeHooks>(
    hookType: K,
    fn: SequelizeHooks[K]
  ): C;

  /**
   * Remove hook from the model
   */
  public static removeHook<C extends typeof Hooks, K extends keyof SequelizeHooks>(hookType: K, name: string): C;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<K extends keyof SequelizeHooks>(hookType: K): boolean;
  public static hasHooks<K extends keyof SequelizeHooks>(hookType: K): boolean;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public addHook<K extends keyof SequelizeHooks>(hookType: K, name: string, fn: SequelizeHooks[K]): this;
  public addHook<K extends keyof SequelizeHooks>(hookType: K, fn: SequelizeHooks[K]): this;
  /**
   * Remove hook from the model
   */
  public removeHook<K extends keyof SequelizeHooks>(hookType: K, name: string): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  public hasHook<K extends keyof SequelizeHooks>(hookType: K): boolean;
  public hasHooks<K extends keyof SequelizeHooks>(hookType: K): boolean;
}
