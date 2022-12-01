import {
  legacyBuildAddAnyHook,
  legacyBuildAddHook,
  legacyBuildHasHook,
  legacyBuildRemoveHook,
  legacyBuildRunHook,
} from './hooks-legacy.js';
import type { AsyncHookReturn } from './hooks.js';
import { HookHandlerBuilder } from './hooks.js';
import type { ValidationOptions } from './instance-validator.js';
import type {
  AfterAssociateEventData,
  AssociationOptions,
  BeforeAssociateEventData,
  BulkCreateOptions,
  CountOptions,
  CreateOptions,
  DestroyOptions,
  FindOptions,
  InstanceDestroyOptions,
  InstanceRestoreOptions,
  InstanceUpdateOptions,
  Model, ModelStatic,
  RestoreOptions,
  SyncOptions,
  UpdateOptions,
  UpsertOptions,
  Sequelize,
  AbstractQueryGenerator,
  QueryInterface,
} from '.';

export interface ModelHooks<M extends Model = Model, TAttributes = any> {
  beforeValidate(instance: M, options: ValidationOptions): AsyncHookReturn;
  afterValidate(instance: M, options: ValidationOptions): AsyncHookReturn;
  validationFailed(instance: M, options: ValidationOptions, error: unknown): AsyncHookReturn;
  beforeCreate(attributes: M, options: CreateOptions<TAttributes>): AsyncHookReturn;
  afterCreate(attributes: M, options: CreateOptions<TAttributes>): AsyncHookReturn;
  beforeDestroy(instance: M, options: InstanceDestroyOptions): AsyncHookReturn;
  afterDestroy(instance: M, options: InstanceDestroyOptions): AsyncHookReturn;
  beforeRestore(instance: M, options: InstanceRestoreOptions): AsyncHookReturn;
  afterRestore(instance: M, options: InstanceRestoreOptions): AsyncHookReturn;
  beforeUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): AsyncHookReturn;
  afterUpdate(instance: M, options: InstanceUpdateOptions<TAttributes>): AsyncHookReturn;
  beforeUpsert(attributes: M, options: UpsertOptions<TAttributes>): AsyncHookReturn;
  afterUpsert(attributes: [ M, boolean | null ], options: UpsertOptions<TAttributes>): AsyncHookReturn;
  beforeSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): AsyncHookReturn;
  afterSave(
    instance: M,
    options: InstanceUpdateOptions<TAttributes> | CreateOptions<TAttributes>
  ): AsyncHookReturn;
  beforeBulkCreate(instances: M[], options: BulkCreateOptions<TAttributes>): AsyncHookReturn;
  afterBulkCreate(instances: readonly M[], options: BulkCreateOptions<TAttributes>): AsyncHookReturn;
  beforeBulkDestroy(options: DestroyOptions<TAttributes>): AsyncHookReturn;
  afterBulkDestroy(options: DestroyOptions<TAttributes>): AsyncHookReturn;
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
   * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
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
  afterFind(instancesOrInstance: readonly M[] | M | null, options: FindOptions<TAttributes>): AsyncHookReturn;

  /**
   * A hook that is run at the start of {@link Model#sync}
   */
  beforeSync(options: SyncOptions): AsyncHookReturn;

  /**
   * A hook that is run at the end of {@link Model#sync}
   */
  afterSync(options: SyncOptions): AsyncHookReturn;
  beforeAssociate(data: BeforeAssociateEventData, options: AssociationOptions<any>): AsyncHookReturn;
  afterAssociate(data: AfterAssociateEventData, options: AssociationOptions<any>): AsyncHookReturn;
}

export const validModelHooks: Array<keyof ModelHooks> = [
  'beforeValidate', 'afterValidate', 'validationFailed',
  'beforeCreate', 'afterCreate',
  'beforeDestroy', 'afterDestroy',
  'beforeRestore', 'afterRestore',
  'beforeUpdate', 'afterUpdate',
  'beforeUpsert', 'afterUpsert',
  'beforeSave', 'afterSave',
  'beforeBulkCreate', 'afterBulkCreate',
  'beforeBulkDestroy', 'afterBulkDestroy',
  'beforeBulkRestore', 'afterBulkRestore',
  'beforeBulkUpdate', 'afterBulkUpdate',
  'beforeCount',
  'beforeFind', 'beforeFindAfterExpandIncludeAll', 'beforeFindAfterOptions', 'afterFind',
  'beforeSync', 'afterSync',
  'beforeAssociate', 'afterAssociate',
];

const staticModelHooks = new HookHandlerBuilder<ModelHooks>(validModelHooks, async (
  eventTarget,
  isAsync,
  hookName,
  args,
) => {
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
});

const staticPrivateStates = new WeakMap<typeof ModelTypeScript, { sequelize?: Sequelize }>();

// DO NOT EXPORT THIS CLASS!
// This is a temporary class to progressively migrate the Sequelize class to TypeScript by slowly moving its functions here.
export class ModelTypeScript {
  static get queryInterface(): QueryInterface {
    return this.sequelize.queryInterface;
  }

  static get queryGenerator(): AbstractQueryGenerator {
    return this.queryInterface.queryGenerator;
  }

  /**
   * A reference to the sequelize instance.
   */
  get sequelize(): Sequelize {
    return (this.constructor as typeof ModelTypeScript).sequelize;
  }

  /**
   * A reference to the sequelize instance.
   *
   * Accessing this property throws if the model has not been registered with a Sequelize instance yet.
   */
  static get sequelize(): Sequelize {
    const sequelize = staticPrivateStates.get(this)?.sequelize;

    if (sequelize == null) {
      throw new Error(`Model "${this.name}" has not been initialized yet. You can check whether a model has been initialized by calling its isInitialized method.`);
    }

    return sequelize;
  }

  static assertIsInitialized(): void {
    const sequelize = staticPrivateStates.get(this)?.sequelize;

    if (sequelize == null) {
      throw new Error(`Model "${this.name}" has not been initialized yet. You can check whether a model has been initialized by calling its isInitialized method.`);
    }
  }

  static isInitialized(): boolean {
    const sequelize = staticPrivateStates.get(this)?.sequelize;

    return sequelize != null;
  }

  // TODO: make this hard-private once Model.init has been moved here
  private static _setSequelize(sequelize: Sequelize) {
    const privateState = staticPrivateStates.get(this) ?? {};

    if (privateState.sequelize != null && privateState.sequelize !== sequelize) {
      throw new Error(`Model "${this.name}" already belongs to a different Sequelize instance.`);
    }

    privateState.sequelize = sequelize;
    staticPrivateStates.set(this, privateState);
  }

  static get hooks() {
    return staticModelHooks.getFor(this);
  }

  static addHook = legacyBuildAddAnyHook(staticModelHooks);
  static hasHook = legacyBuildHasHook(staticModelHooks);
  static hasHooks = legacyBuildHasHook(staticModelHooks);
  static removeHook = legacyBuildRemoveHook(staticModelHooks);
  static runHooks = legacyBuildRunHook(staticModelHooks);

  static beforeValidate = legacyBuildAddHook(staticModelHooks, 'beforeValidate');
  static afterValidate = legacyBuildAddHook(staticModelHooks, 'afterValidate');
  static validationFailed = legacyBuildAddHook(staticModelHooks, 'validationFailed');

  static beforeCreate = legacyBuildAddHook(staticModelHooks, 'beforeCreate');
  static afterCreate = legacyBuildAddHook(staticModelHooks, 'afterCreate');

  static beforeDestroy = legacyBuildAddHook(staticModelHooks, 'beforeDestroy');
  static afterDestroy = legacyBuildAddHook(staticModelHooks, 'afterDestroy');

  static beforeRestore = legacyBuildAddHook(staticModelHooks, 'beforeRestore');
  static afterRestore = legacyBuildAddHook(staticModelHooks, 'afterRestore');

  static beforeUpdate = legacyBuildAddHook(staticModelHooks, 'beforeUpdate');
  static afterUpdate = legacyBuildAddHook(staticModelHooks, 'afterUpdate');

  static beforeUpsert = legacyBuildAddHook(staticModelHooks, 'beforeUpsert');
  static afterUpsert = legacyBuildAddHook(staticModelHooks, 'afterUpsert');

  static beforeSave = legacyBuildAddHook(staticModelHooks, 'beforeSave');
  static afterSave = legacyBuildAddHook(staticModelHooks, 'afterSave');

  static beforeBulkCreate = legacyBuildAddHook(staticModelHooks, 'beforeBulkCreate');
  static afterBulkCreate = legacyBuildAddHook(staticModelHooks, 'afterBulkCreate');

  static beforeBulkDestroy = legacyBuildAddHook(staticModelHooks, 'beforeBulkDestroy');
  static afterBulkDestroy = legacyBuildAddHook(staticModelHooks, 'afterBulkDestroy');

  static beforeBulkRestore = legacyBuildAddHook(staticModelHooks, 'beforeBulkRestore');
  static afterBulkRestore = legacyBuildAddHook(staticModelHooks, 'afterBulkRestore');

  static beforeBulkUpdate = legacyBuildAddHook(staticModelHooks, 'beforeBulkUpdate');
  static afterBulkUpdate = legacyBuildAddHook(staticModelHooks, 'afterBulkUpdate');

  static beforeCount = legacyBuildAddHook(staticModelHooks, 'beforeCount');

  static beforeFind = legacyBuildAddHook(staticModelHooks, 'beforeFind');
  static beforeFindAfterExpandIncludeAll = legacyBuildAddHook(staticModelHooks, 'beforeFindAfterExpandIncludeAll');
  static beforeFindAfterOptions = legacyBuildAddHook(staticModelHooks, 'beforeFindAfterOptions');
  static afterFind = legacyBuildAddHook(staticModelHooks, 'afterFind');

  static beforeSync = legacyBuildAddHook(staticModelHooks, 'beforeSync');
  static afterSync = legacyBuildAddHook(staticModelHooks, 'afterSync');

  static beforeAssociate = legacyBuildAddHook(staticModelHooks, 'beforeAssociate');
  static afterAssociate = legacyBuildAddHook(staticModelHooks, 'afterAssociate');
}
