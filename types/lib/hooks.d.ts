import { ValidationOptions } from './instance-validator';
import Model, {
  BulkCreateOptions,
  CountOptions,
  CreateOptions,
  DestroyOptions,
  FindOptions,
  InstanceDestroyOptions,
  InstanceUpdateOptions,
  ModelAttributes,
  ModelOptions,
  UpdateOptions,
  SaveOptions,
  UpsertOptions,
  RestoreOptions,
} from './model';
import { Config, Options, Sequelize, SyncOptions } from './sequelize';
import { Association, AssociationOptions, Transaction } from '..';

export type HookReturn = Promise<void> | void;

export interface AssociateBeforeData<S extends Model = Model, T extends Model = Model> {
  source: S;
  target: T;
  type: typeof Association;
}

export interface AssociateAfterData<S extends Model = Model, T extends Model = Model> extends AssociateBeforeData<S, T> {
  association: Association<S, T>;
}

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

  beforeUpdate(instance: M, options: InstanceUpdateOptions): HookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions): HookReturn;

  beforeSave(instance: M, options: InstanceUpdateOptions | CreateOptions): HookReturn;
  afterSave(instance: M, options: InstanceUpdateOptions | CreateOptions): HookReturn;

  beforeBulkCreate(instances: M[], options: BulkCreateOptions): HookReturn;
  afterBulkCreate(instances: M[], options: BulkCreateOptions): HookReturn;

  beforeBulkDestroy(options: DestroyOptions): HookReturn;
  afterBulkDestroy(options: DestroyOptions): HookReturn;

  beforeBulkUpdate(options: UpdateOptions): HookReturn;
  afterBulkUpdate(options: UpdateOptions): HookReturn;

  beforeFind(options: FindOptions): HookReturn;
  afterFind(instancesOrInstance: M[] | M, options: FindOptions): HookReturn;

  beforeCount(options: CountOptions): HookReturn;

  beforeFindAfterExpandIncludeAll(options: FindOptions): HookReturn;
  beforeFindAfterOptions(options: FindOptions): HookReturn;
  afterFind(instancesOrInstance: M[] | M | null, options: FindOptions): HookReturn;
  beforeSync(options: SyncOptions): HookReturn;
  afterSync(options: SyncOptions): HookReturn;

  beforeBulkSync(options: SyncOptions): HookReturn;
  afterBulkSync(options: SyncOptions): HookReturn;

  beforeSave(instance: M, options: SaveOptions): HookReturn;
  afterSave(instance: M, options: SaveOptions): HookReturn;

  beforeUpsert(values: object, options: UpsertOptions): HookReturn;
  afterUpsert(instance: M, options: UpsertOptions): HookReturn;

  beforeAssociate(assoc: AssociateBeforeData, options: AssociationOptions): HookReturn;
  afterAssociate(assoc: AssociateAfterData, options: AssociationOptions): HookReturn;

  beforeRestore(instance: M, options: RestoreOptions): HookReturn;
  afterRestore(instance: M, options: RestoreOptions): HookReturn;

}

export interface SequelizeHooks extends ModelHooks {
  beforeDefine(attributes: ModelAttributes, options: ModelOptions<Model>): void;
  afterDefine(model: typeof Model): void;
  beforeInit(config: Config, options: Options): void;
  afterInit(sequelize: Sequelize): void;
  beforeConnect(config: Config): HookReturn;
  afterConnect(connection: unknown, config: Config): HookReturn;
}

export interface HooksBase<H extends object> {

}

export interface SequelizeHooksBase extends HooksBase<SequelizeHooks> {

}
/**
 * Virtual class for deduplication
 */
export class SequelizeHooksBase {
    /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  addHook<K extends keyof SequelizeHooks>(hookType: K, name: string, fn: SequelizeHooks[K]): this;
  addHook<K extends keyof SequelizeHooks>(hookType: K, fn: SequelizeHooks[K]): this;

  /**
   * Remove hook from the model
   */
  removeHook<K extends keyof SequelizeHooks>(hookType: K, name: string): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  hasHook<K extends keyof SequelizeHooks>(hookType: K): boolean;
  hasHooks<K extends keyof SequelizeHooks>(hookType: K): boolean;

  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<C extends typeof SequelizeHooksBase, K extends keyof SequelizeHooks>(
    hookType: K,
    name: string,
    fn: SequelizeHooks[K]
  ): C;
  public static addHook<C extends typeof SequelizeHooksBase, K extends keyof SequelizeHooks>(
    hookType: K,
    fn: SequelizeHooks[K]
  ): C;

  /**
   * Remove hook from the model
   */
  public static removeHook<C extends typeof SequelizeHooksBase, K extends keyof SequelizeHooks>(hookType: K, name: string): C;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<K extends keyof SequelizeHooks>(hookType: K): boolean;
  public static hasHooks<K extends keyof SequelizeHooks>(hookType: K): boolean;
}


export interface ModelHooksBase extends HooksBase<ModelHooks> {

}
/**
 * Virtual class for deduplication
 */
export class ModelHooksBase {
  /**
   * Add a hook to the model
   *
   * @param name Provide a name for the hook function. It can be used to remove the hook later or to order
   *   hooks based on some sort of priority system in the future.
   */
  public static addHook<M extends Model, C extends typeof ModelHooksBase, K extends keyof ModelHooks<M>>(
    this: { new (): M } & typeof Model,
    hookType: K,
    name: string,
    fn: ModelHooks<M>[K]
  ): C;
  public static addHook<M extends Model, C extends typeof ModelHooksBase, K extends keyof ModelHooks<M>>(
    this: { new (): M } & typeof Model,
    hookType: K,
    fn: ModelHooks<M>[K]
  ): C;

  /**
   * Remove hook from the model
   */
  public static removeHook<M extends Model, C extends typeof ModelHooksBase, K extends keyof ModelHooks>(
    this: { new (): M } & typeof Model,
    hookType: K,
    name: string
  ): C;

  /**
   * Check whether the mode has any hooks of this type
   */
  public static hasHook<M extends Model, K extends keyof ModelHooksBase>(
    this: { new (): M } & typeof Model,
    hookType: K,
  ): boolean;
  public static hasHooks<M extends Model, K extends keyof ModelHooksBase>(
    this: { new (): M } & typeof Model,
    hookType: K
  ): boolean;
}
