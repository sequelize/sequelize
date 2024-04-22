import { map, SetView } from '@sequelize/utils';
import { inspect } from 'node:util';
// @ts-expect-error -- toposort-class definition will be added to sequelize/toposort later
import Toposort from 'toposort-class';
import type { AbstractDialect } from './abstract-dialect/dialect.js';
import type { Model, ModelStatic } from './model';
import type { SequelizeTypeScript } from './sequelize-typescript.js';

export class ModelSetView<Dialect extends AbstractDialect> extends SetView<ModelStatic> {
  readonly #sequelize: SequelizeTypeScript<Dialect>;

  constructor(sequelize: SequelizeTypeScript<Dialect>, set: Set<ModelStatic>) {
    super(set);

    this.#sequelize = sequelize;
  }

  get<M extends Model = Model>(modelName: string): ModelStatic<M> | undefined {
    return this.find(model => model.modelDefinition.modelName === modelName) as
      | ModelStatic<M>
      | undefined;
  }

  getOrThrow<M extends Model = Model>(modelName: string): ModelStatic<M> {
    const model = this.get<M>(modelName);

    if (!model) {
      throw new Error(`Model ${inspect(modelName)} was not added to this Sequelize instance.`);
    }

    return model;
  }

  /**
   * Returns the list of registered model names.
   */
  getNames(): Iterable<string> {
    return map(this, model => model.modelDefinition.modelName);
  }

  hasByName(modelName: string): boolean {
    return this.get(modelName) !== undefined;
  }

  /**
   * Returns an array that lists every model, sorted in order
   * of foreign key references: The first model is a model that is depended upon,
   * the last model is a model that is not depended upon.
   *
   * If there is a cyclic dependency, this returns null.
   */
  getModelsTopoSortedByForeignKey(): ModelStatic[] | null {
    const models = new Map();
    const sorter = new Toposort();

    const queryGenerator = this.#sequelize.queryGenerator;

    for (const model of this) {
      let deps = [];
      const tableName = queryGenerator.quoteTable(model);

      models.set(tableName, model);

      const { attributes } = model.modelDefinition;
      for (const attrName of attributes.keys()) {
        const attribute = attributes.get(attrName);

        if (!attribute?.references) {
          continue;
        }

        const dep = queryGenerator.quoteTable(attribute.references.table);
        deps.push(dep);
      }

      deps = deps.filter(dep => tableName !== dep);

      sorter.add(tableName, deps);
    }

    let sorted;
    try {
      sorted = sorter.sort();
    } catch (error: unknown) {
      if (error instanceof Error && !error.message.startsWith('Cyclic dependency found.')) {
        throw error;
      }

      return null;
    }

    return sorted
      .map((modelName: string) => {
        return models.get(modelName);
      })
      .filter(Boolean);
  }

  /**
   * Iterate over Models in an order suitable for e.g. creating tables.
   * Will take foreign key constraints into account so that dependencies are visited before dependents.
   *
   * @param iterator method to execute on each model
   * @param options
   * @param options.reverse
   * @private
   *
   * @deprecated
   */
  forEachModel(iterator: (model: ModelStatic) => void, options?: { reverse?: boolean }) {
    const sortedModels = this.getModelsTopoSortedByForeignKey();
    if (sortedModels == null) {
      throw new Error('Cyclic dependency found.');
    }

    // TODO: options should be false by default
    const reverse = options?.reverse ?? true;

    if (reverse) {
      sortedModels.reverse();
    }

    for (const model of sortedModels) {
      iterator(model);
    }
  }
}
