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

/**
 * Virtual class for deduplication
 */
export class Hooks<H extends object> {
  /**
   * Add a hook to the model
   */
  add<K extends keyof H>(hookType: K, fn: H[K]): this;

  /**
   * Remove hook from the model
   */
  remove<K extends keyof H>(hookType: K, fn: Function): this;

  /**
   * Check whether the mode has any hooks of this type
   */
  has<K extends keyof H>(hookType: K): boolean;
}
