import { ValidationOptions } from './instance-validator';
import Model, {
  BulkCreateOptions,
  CountOptions,
  CreateOptions,
  DestroyOptions, FindOptions,
  InstanceDestroyOptions,
  InstanceRestoreOptions,
  InstanceUpdateOptions,
  ModelAttributes,
  ModelOptions, RestoreOptions, UpdateOptions, UpsertOptions,
  Attributes, CreationAttributes, ModelStatic,
} from './model';
import { AbstractQuery } from './dialects/abstract/query';
import { QueryOptions } from './dialects/abstract/query-interface';
import { Config, Options, Sequelize, SyncOptions } from './sequelize';
import { DeepWriteable } from './utils';

export type HookReturn = Promise<void> | void;

/**
 * Options for Model.init. We mostly duplicate the Hooks here, since there is no way to combine the two
 * interfaces.
 */
export interface ModelHooks<M extends Model = Model> {
  beforeValidate(instance: M, options: ValidationOptions): HookReturn;
  afterValidate(instance: M, options: ValidationOptions): HookReturn;
  beforeCreate(attributes: M, options: CreateOptions<Attributes<Model>>): HookReturn;
  afterCreate(attributes: M, options: CreateOptions<Attributes<Model>>): HookReturn;
  beforeDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  afterDestroy(instance: M, options: InstanceDestroyOptions): HookReturn;
  beforeRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  afterRestore(instance: M, options: InstanceRestoreOptions): HookReturn;
  beforeUpdate(instance: M, options: InstanceUpdateOptions<Attributes<Model>>): HookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions<Attributes<Model>>): HookReturn;
  beforeUpsert(attributes: M, options: UpsertOptions<Attributes<Model>>): HookReturn;
  afterUpsert(attributes: [ M, boolean | null ], options: UpsertOptions<Attributes<Model>>): HookReturn;
  beforeSave(
    instance: M,
    options: InstanceUpdateOptions<Attributes<Model>> | CreateOptions<Attributes<Model>>
  ): HookReturn;
  afterSave(
    instance: M,
    options: InstanceUpdateOptions<Attributes<Model>> | CreateOptions<Attributes<Model>>
  ): HookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions<Attributes<Model>>): HookReturn;
  afterBulkCreate(instances: readonly M[], options: BulkCreateOptions<Attributes<Model>>): HookReturn;
  beforeBulkDestroy(options: DestroyOptions<Attributes<Model>>): HookReturn;
  afterBulkDestroy(options: DestroyOptions<Attributes<Model>>): HookReturn;
  beforeBulkRestore(options: RestoreOptions<Attributes<Model>>): HookReturn;
  afterBulkRestore(options: RestoreOptions<Attributes<Model>>): HookReturn;
  beforeBulkUpdate(options: UpdateOptions<Attributes<Model>>): HookReturn;
  afterBulkUpdate(options: UpdateOptions<Attributes<Model>>): HookReturn;
  beforeFind(options: FindOptions<Attributes<Model>>): HookReturn;
  beforeCount(options: CountOptions<Attributes<Model>>): HookReturn;
  beforeFindAfterExpandIncludeAll(options: FindOptions<Attributes<Model>>): HookReturn;
  beforeFindAfterOptions(options: FindOptions<Attributes<Model>>): HookReturn;
  afterFind(instancesOrInstance: readonly M[] | M | null, options: FindOptions<Attributes<Model>>): HookReturn;
  beforeSync(options: SyncOptions): HookReturn;
  afterSync(options: SyncOptions): HookReturn;
  beforeBulkSync(options: SyncOptions): HookReturn;
  afterBulkSync(options: SyncOptions): HookReturn;
  beforeQuery(options: QueryOptions, query: AbstractQuery): HookReturn;
  afterQuery(options: QueryOptions, query: AbstractQuery): HookReturn;
}


export interface SequelizeHooks<
  M extends Model = Model,
> extends ModelHooks<M> {
  beforeDefine(attributes: ModelAttributes<M, CreationAttributes<M>>, options: ModelOptions<M>): void;
  afterDefine(model: ModelStatic<any>): void;
  beforeInit(config: Config, options: Options): void;
  afterInit(sequelize: Sequelize): void;
  beforeConnect(config: DeepWriteable<Config>): HookReturn;
  afterConnect(connection: unknown, config: Config): HookReturn;
  beforeDisconnect(connection: unknown): HookReturn;
  afterDisconnect(connection: unknown): HookReturn;
}

/**
 * Virtual class for deduplication
 */
export class Hooks<M extends Model = Model> {
  /**
   * A dummy variable that doesn't exist on the real object. This exists so
   * Typescript can infer the type of the attributes in static functions. Don't
   * try to access this!
   */
  _model: M;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<
    H extends Hooks,
    K extends keyof SequelizeHooks<H['_model']>
    >(
    this: HooksStatic<H>,
    hookType: K,
    name: string,
    fn: SequelizeHooks<H['_model']>[K]
  ): HooksCtor<H>;
  public static addHook<
    H extends Hooks,
    K extends keyof SequelizeHooks<H['_model']>
  >(
    this: HooksStatic<H>,
    hookType: K,
    fn: SequelizeHooks<H['_model']>[K]
  ): HooksCtor<H>;

  /**
   * Remove hook from the model
   */
  public static removeHook<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model']>,
    name: string,
  ): HooksCtor<H>;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model']>,
  ): boolean;
  public static hasHooks<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model']>,
  ): boolean;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public addHook<K extends keyof SequelizeHooks<M>>(
    hookType: K,
    name: string,
    fn: SequelizeHooks<Model>[K]
  ): this;
  public addHook<K extends keyof SequelizeHooks<M>>(
    hookType: K, fn: SequelizeHooks<M>[K]): this;
  /**
   * Remove hook from the model
   */
  public removeHook<K extends keyof SequelizeHooks<M>>(
    hookType: K,
    name: string
  ): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  public hasHook<K extends keyof SequelizeHooks<M>>(hookType: K): boolean;
  public hasHooks<K extends keyof SequelizeHooks<M>>(hookType: K): boolean;
}

export type HooksCtor<H extends Hooks> = typeof Hooks & { new(): H };

export type HooksStatic<H extends Hooks> = { new(): H };
