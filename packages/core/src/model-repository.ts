import { mayRunHook } from './hooks.js';
import type { ModelDefinition } from './model-definition.js';
import {
  assertHasPrimaryKey,
  getModelPkWhere,
  getPrimaryKeyValueOrThrow,
  setTransactionFromCls,
} from './model-internals.js';
import type { DestroyManyOptions } from './model-repository.types.js';
import type { Model } from './model.js';
import { Op } from './operators.js';
import { EMPTY_OBJECT } from './utils/object.js';

/**
 * The goal of this class is to become the new home of all the static methods that are currently present on the Model class,
 * as a way to enable a true Repository Mode for Sequelize.
 *
 * Currently this class is not usable as a repository (due to having a dependency on ModelStatic), but as we migrate all of
 * Model to this class, we will be able to remove the dependency on ModelStatic, and make this class usable as a repository.
 *
 * See https://github.com/sequelize/sequelize/issues/15389 for more details.
 *
 * Unlike {@link ModelDefinition}, it's possible to have multiple different repositories for the same model (as users can provide their own implementation).
 */
export class ModelRepository<M extends Model = Model> {
  readonly #modelDefinition: ModelDefinition;

  constructor(modelDefinition: ModelDefinition) {
    this.#modelDefinition = modelDefinition;
  }

  get #sequelize() {
    return this.#modelDefinition.sequelize;
  }

  get #queryInterface() {
    return this.#sequelize.queryInterface;
  }

  async destroy(instanceOrInstances: readonly M[] | M, options: DestroyManyOptions = EMPTY_OBJECT): Promise<number> {
    const { hardDelete, noHooks, ...passDown } = options;

    assertHasPrimaryKey(this.#modelDefinition);
    setTransactionFromCls(passDown, this.#sequelize);

    const instances: M[] = Array.isArray(instanceOrInstances) ? [...instanceOrInstances] : [instanceOrInstances];
    if (instances.length === 0) {
      return 0;
    }

    if (mayRunHook('beforeDestroyMany', noHooks)) {
      await this.#modelDefinition.hooks.runAsync('beforeDestroyMany', instances, options);
    }

    const isSoftDelete = !hardDelete && this.#modelDefinition.isParanoid();
    if (isSoftDelete) {
      // TODO: implement once updateMany is implemented - https://github.com/sequelize/sequelize/issues/4501
      throw new Error('ModelRepository#destroy does not support paranoid deletion yet.');
    }

    Object.freeze(options);
    Object.freeze(instances);

    const primaryKeys = this.#modelDefinition.primaryKeysAttributeNames;
    let where;
    if (instances.length === 1) {
      where = getModelPkWhere(instances[0], true)!;
    } else if (primaryKeys.size === 1 && !this.#modelDefinition.versionAttributeName) {
      const primaryKey: string = primaryKeys.values().next().value;

      const values = instances.map(instance => getPrimaryKeyValueOrThrow(instance, primaryKey));

      where = { [primaryKey]: values };
    } else {
      where = {
        // Ideally, we'd use tuple comparison here, but that's not supported by Sequelize yet.
        // It would look like this:
        // WHERE (id1, id2) IN ((1, 2), (3, 4))
        [Op.or]: instances.map(instance => getModelPkWhere(instance, true)!),
      };
    }

    const result = await this.#queryInterface.bulkDelete(this.#modelDefinition, {
      ...passDown,
      limit: null,
      where,
    });

    if (mayRunHook('afterDestroyMany', noHooks)) {
      await this.#modelDefinition.hooks.runAsync('afterDestroyMany', instances, options, result);
    }

    return result;
  }

  // async save(instances: M[] | M): Promise<void> {}
  // async updateOne(instance: M, values: object, options: unknown): Promise<M> {}
  // async updateMany(data: Array<{ instance: M, values: object }>, options: unknown): Promise<M> {}
  // async updateMany(data: Array<{ where: object, values: object }>, options: unknown): Promise<M> {}
  // async restore(instances: M[] | M, options: unknown): Promise<number> {}
  // async bulkUpdate(options: unknown): Promise<M> {}
  // async bulkDestroy(options: unknown): Promise<M> {}
  // async bulkRestore(options: unknown): Promise<M> {}
}

const modelRepositories = new WeakMap<ModelDefinition, ModelRepository>();

export function getModelRepository(model: ModelDefinition): ModelRepository {
  let internals = modelRepositories.get(model);
  if (internals) {
    return internals;
  }

  internals = new ModelRepository(model);

  return internals;
}
