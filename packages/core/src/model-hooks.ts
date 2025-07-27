import type {
  AfterAssociateEventData,
  AssociationOptions,
  BeforeAssociateEventData,
} from './associations/index.js';
import type { AsyncHookReturn } from './hooks.js';
import { HookHandlerBuilder } from './hooks.js';
import type { ValidationOptions } from './instance-validator.js';
import type { DestroyManyOptions } from './model-repository.types.js';
import type {
  BulkCreateOptions,
  CountOptions,
  CreateOptions,
  DestroyOptions,
  FindOptions,
  InstanceDestroyOptions,
  InstanceRestoreOptions,
  InstanceUpdateOptions,
  Model,
  ModelStatic,
  RestoreOptions,
  UpdateOptions,
  UpsertOptions,
} from './model.js';
import type { SyncOptions } from './sequelize.js';

export interface ModelHooks<M extends Model = Model, TAttributes = any> {
  beforeValidate(instance: M, options: ValidationOptions): AsyncHookReturn;
  afterValidate(instance: M, options: ValidationOptions): AsyncHookReturn;
  validationFailed(instance: M, options: ValidationOptions, error: unknown): AsyncHookReturn;
  beforeCreate(attributes: M, options: CreateOptions<TAttributes>): AsyncHookReturn;
  afterCreate(attributes: M, options: CreateOptions<TAttributes>): AsyncHookReturn;
  beforeDestroy(instance: M, options: InstanceDestroyOptions): AsyncHookReturn;
  afterDestroy(instance: M, options: InstanceDestroyOptions): AsyncHookReturn;
  beforeDestroyMany(instances: M[], options: DestroyManyOptions): AsyncHookReturn;
  afterDestroyMany(
    instances: readonly M[],
    options: DestroyManyOptions,
    deletedCount: number,
  ): AsyncHookReturn;
  beforeRestore(instance: M, options: InstanceRestoreOptions): AsyncHookReturn;
  afterRestore(instance: M, options: InstanceRestoreOptions): AsyncHookReturn;
  beforeUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): AsyncHookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): AsyncHookReturn;
  beforeUpsert(attributes: M, options: UpsertOptions<TAttributes>): AsyncHookReturn;
  afterUpsert(
    attributes: [M, boolean | null],
    options: UpsertOptions<TAttributes>,
  ): AsyncHookReturn;
  beforeSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>,
  ): AsyncHookReturn;
  afterSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>,
  ): AsyncHookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions<TAttributes>): AsyncHookReturn;
  afterBulkCreate(
    instances: readonly M[],
    options: BulkCreateOptions<TAttributes>,
  ): AsyncHookReturn;
  beforeBulkDestroy(options: DestroyOptions<TAttributes>): AsyncHookReturn;
  afterBulkDestroy(options: DestroyOptions<TAttributes>): AsyncHookReturn;
  _UNSTABLE_beforeBulkDestroy(options: DestroyOptions<TAttributes>): AsyncHookReturn;
  _UNSTABLE_afterBulkDestroy(
    options: DestroyOptions<TAttributes>,
    deletedCount: number,
  ): AsyncHookReturn;
  beforeBulkRestore(options: RestoreOptions<TAttributes>): AsyncHookReturn;
  afterBulkRestore(options: RestoreOptions<TAttributes>): AsyncHookReturn;
  beforeBulkUpdate(options: UpdateOptions<TAttributes>): AsyncHookReturn;
  afterBulkUpdate(options: UpdateOptions<TAttributes>): AsyncHookReturn;

  /**
   * A hook that is run at the start of {@link Model.count}
   */
  beforeCount(options: CountOptions<TAttributes>): AsyncHookReturn;

  /**
   * A hook that is run before a find (select) query
   */
  beforeFind(options: FindOptions<TAttributes>): AsyncHookReturn;

  /**
   * A hook that is run before a find (select) query, after any `{ include: {all: ...} }` options are expanded
   *
   * @deprecated use `beforeFind` instead
   */
  beforeFindAfterExpandIncludeAll(options: FindOptions<TAttributes>): AsyncHookReturn;

  /**
   * A hook that is run before a find (select) query, after all option have been normalized
   *
   * @deprecated use `beforeFind` instead
   */
  beforeFindAfterOptions(options: FindOptions<TAttributes>): AsyncHookReturn;
  /**
   * A hook that is run after a find (select) query
   */
  afterFind(
    instancesOrInstance: readonly M[] | M | null,
    options: FindOptions<TAttributes>,
  ): AsyncHookReturn;

  /**
   * A hook that is run at the start of {@link Model.sync}
   */
  beforeSync(options: SyncOptions): AsyncHookReturn;

  /**
   * A hook that is run at the end of {@link Model.sync}
   */
  afterSync(options: SyncOptions): AsyncHookReturn;
  beforeAssociate(
    data: BeforeAssociateEventData,
    options: AssociationOptions<any>,
  ): AsyncHookReturn;
  afterAssociate(data: AfterAssociateEventData, options: AssociationOptions<any>): AsyncHookReturn;

  /**
   * Runs before the definition of the model changes because {@link ModelDefinition#refreshAttributes} was called.
   */
  beforeDefinitionRefresh(): void;

  /**
   * Runs after the definition of the model has changed because {@link ModelDefinition#refreshAttributes} was called.
   */
  afterDefinitionRefresh(): void;
}

export const validModelHooks: Array<keyof ModelHooks> = [
  'beforeValidate',
  'afterValidate',
  'validationFailed',
  'beforeCreate',
  'afterCreate',
  'beforeDestroy',
  'afterDestroy',
  'beforeDestroyMany',
  'afterDestroyMany',
  'beforeRestore',
  'afterRestore',
  'beforeUpdate',
  'afterUpdate',
  'beforeUpsert',
  'afterUpsert',
  'beforeSave',
  'afterSave',
  'beforeBulkCreate',
  'afterBulkCreate',
  'beforeBulkDestroy',
  'afterBulkDestroy',
  '_UNSTABLE_beforeBulkDestroy',
  '_UNSTABLE_afterBulkDestroy',
  'beforeBulkRestore',
  'afterBulkRestore',
  'beforeBulkUpdate',
  'afterBulkUpdate',
  'beforeCount',
  'beforeFind',
  'beforeFindAfterExpandIncludeAll',
  'beforeFindAfterOptions',
  'afterFind',
  'beforeSync',
  'afterSync',
  'beforeAssociate',
  'afterAssociate',
  'beforeDefinitionRefresh',
  'afterDefinitionRefresh',
];

export const staticModelHooks = new HookHandlerBuilder<ModelHooks>(
  validModelHooks,
  async (eventTarget, isAsync, hookName: keyof ModelHooks, args) => {
    // This forwards hooks run on Models to the Sequelize instance's hooks.
    const model = eventTarget as ModelStatic;

    if (!model.sequelize) {
      throw new Error('Model must be initialized before running hooks on it.');
    }

    if (isAsync) {
      await model.sequelize.hooks.runAsync(hookName, ...args);
    } else {
      model.sequelize.hooks.runSync(hookName, ...args);
    }
  },
);
