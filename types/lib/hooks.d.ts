import { ModelType } from '../index';
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
  ModelOptions, RestoreOptions, UpdateOptions, UpsertOptions
} from './model';
import { AbstractQuery } from './query';
import { QueryOptions } from './query-interface';
import { Config, Options, Sequelize, SyncOptions } from './sequelize';
import { DeepWriteable } from './utils';

export type HookReturn = Promise<void> | void;

/**
 * Options for Model.init. We mostly duplicate the Hooks here, since there is no way to combine the two
 * interfaces.
 */
export interface ModelHooks<M extends Model = Model, TAttributes = any> {
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
  beforeUpsert(attributes: M, options: UpsertOptions<TAttributes>): HookReturn;
  afterUpsert(attributes: [ M,  boolean | null ], options: UpsertOptions<TAttributes>): HookReturn;
  beforeSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): HookReturn;
  afterSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): HookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions<TAttributes>): HookReturn;
  afterBulkCreate(instances: readonly M[], options: BulkCreateOptions<TAttributes>): HookReturn;
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
  afterFind(instancesOrInstance: readonly M[] | M | null, options: FindOptions<TAttributes>): HookReturn;
  beforeSync(options: SyncOptions): HookReturn;
  afterSync(options: SyncOptions): HookReturn;
  beforeBulkSync(options: SyncOptions): HookReturn;
  afterBulkSync(options: SyncOptions): HookReturn;
  beforeQuery(options: QueryOptions, query: AbstractQuery): HookReturn;
  afterQuery(options: QueryOptions, query: AbstractQuery): HookReturn;
}


export interface SequelizeHooks<
  M extends Model<TAttributes, TCreationAttributes> = Model,
  TAttributes = any,
  TCreationAttributes = TAttributes
> extends ModelHooks<M, TAttributes> {
  beforeDefine(attributes: ModelAttributes<M, TCreationAttributes>, options: ModelOptions<M>): void;
  afterDefine(model: ModelType): void;
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
export class Hooks<
  M extends Model<TModelAttributes, TCreationAttributes> = Model,
  TModelAttributes extends {} = any,
  TCreationAttributes extends {} = TModelAttributes
> {
  /**
   * A dummy variable that doesn't exist on the real object. This exists so
   * Typescript can infer the type of the attributes in static functions. Don't
   * try to access this!
   */
  _model: M;
  /**
   * A similar dummy variable that doesn't exist on the real object. Do not
   * try to access this in real code.
   */
  _attributes: TModelAttributes;
  /**
   * A similar dummy variable that doesn't exist on the real object. Do not
   * try to access this in real code.
   */
  _creationAttributes: TCreationAttributes;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<
    H extends Hooks,
    K extends keyof SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>
    >(
    this: HooksStatic<H>,
    hookType: K,
    name: string,
    fn: SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>[K]
  ): HooksCtor<H>;
  public static addHook<
    H extends Hooks,
    K extends keyof SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>
  >(
    this: HooksStatic<H>,
    hookType: K,
    fn: SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>[K]
  ): HooksCtor<H>;

  /**
   * Remove hook from the model
   */
  public static removeHook<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>,
    name: string,
  ): HooksCtor<H>;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>,
  ): boolean;
  public static hasHooks<H extends Hooks>(
    this: HooksStatic<H>,
    hookType: keyof SequelizeHooks<H['_model'], H['_attributes'], H['_creationAttributes']>,
  ): boolean;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public addHook<K extends keyof SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(
    hookType: K,
    name: string,
    fn: SequelizeHooks<Model, TModelAttributes, TCreationAttributes>[K]
  ): this;
  public addHook<K extends keyof SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(
    hookType: K, fn: SequelizeHooks<M, TModelAttributes, TCreationAttributes>[K]): this;
  /**
   * Remove hook from the model
   */
  public removeHook<K extends keyof SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(
    hookType: K,
    name: string
  ): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  public hasHook<K extends keyof SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
  public hasHooks<K extends keyof SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
}

export type HooksCtor<H extends Hooks> = typeof Hooks & { new(): H };

export type HooksStatic<H extends Hooks> = { new(): H };
