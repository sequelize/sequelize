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
export interface ModelHooks<M extends Model, TAttributes> {
  beforeValidate(instance: M, options: ValidationOptions): HookReturn;
  afterValidate(instance: M, options: ValidationOptions): HookReturn;
  beforeCreate(attributes: M, options: CreateOptions<TAttributes>): HookReturn;
  afterCreate(attributes: M, options: CreateOptions<TAttributes>): HookReturn;
  beforeDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  afterDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  beforeRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  afterRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  beforeUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): HookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): HookReturn;
  beforeSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): HookReturn;
  afterSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): HookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions<TAttributes>): HookReturn;
  afterBulkCreate(instances: M[], options: BulkCreateOptions<TAttributes>): HookReturn;
  beforeBulkDestroy(options: DestroyOptions<TAttributes>): HookReturn;
  afterBulkDestroy(options: DestroyOptions<TAttributes>): HookReturn;
  beforeBulkRestore(options: RestoreOptions<TAttributes>): HookReturn;
  afterBulkRestore(options: RestoreOptions<TAttributes>): HookReturn;
  beforeBulkUpdate(options: UpdateOptions<TAttributes>): HookReturn;
  afterBulkUpdate(options: UpdateOptions<TAttributes>): HookReturn;
  beforeFind(options: FindOptions<TAttributes>): HookReturn;
  beforeCount(options: CountOptions<TAttributes>): HookReturn;
  beforeFindAfterExpandIncludeAll(options: FindOptions<TAttributes>): HookReturn;
  beforeFindAfterOptions(options: FindOptions<TAttributes>): HookReturn;
  afterFind(instancesOrInstance: M[] | M | null, options: FindOptions<TAttributes>): HookReturn;
  beforeSync(options: SyncOptions): HookReturn;
  afterSync(options: SyncOptions): HookReturn;
  beforeBulkSync(options: SyncOptions): HookReturn;
  afterBulkSync(options: SyncOptions): HookReturn;
}

export interface SequelizeHooks<M extends Model, TAttributes, TCreationAttributes> extends ModelHooks<M, TAttributes> {
  beforeDefine(attributes: ModelAttributes<M, TCreationAttributes>, options: ModelOptions<M>): void;
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
export class Hooks<TModelAttributes extends {} = any, TCreationAttributes extends {} = TModelAttributes> {
  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<C extends typeof Hooks, K extends keyof SequelizeHooks<Model, any, any>>(
    hookType: K,
    name: string,
    fn: SequelizeHooks<Model, any, any>[K]
  ): C;
  public static addHook<C extends typeof Hooks, K extends keyof SequelizeHooks<Model, any, any>>(
    hookType: K,
    fn: SequelizeHooks<Model, any, any>[K]
  ): C;

  /**
   * Remove hook from the model
   */
  public static removeHook<C extends typeof Hooks, K extends keyof SequelizeHooks<Model, any, any>>(
    hookType: K,
    name: string
  ): C;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<K extends keyof SequelizeHooks<Model, any, any>>(hookType: K): boolean;
  public static hasHooks<K extends keyof SequelizeHooks<Model, any, any>>(hookType: K): boolean;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public addHook<K extends keyof SequelizeHooks<Model, TModelAttributes, TCreationAttributes>>(
    hookType: K,
    name: string,
    fn: SequelizeHooks<Model, TModelAttributes, TCreationAttributes>[K]
  ): this;
  public addHook<K extends keyof SequelizeHooks<Model, TModelAttributes, TCreationAttributes>>(
    hookType: K, fn: SequelizeHooks<Model, TModelAttributes, TCreationAttributes>[K]): this;
  /**
   * Remove hook from the model
   */
  public removeHook<K extends keyof SequelizeHooks<Model, TModelAttributes, TCreationAttributes>>(
    hookType: K,
    name: string
  ): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  public hasHook<K extends keyof SequelizeHooks<Model, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
  public hasHooks<K extends keyof SequelizeHooks<Model, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
}
