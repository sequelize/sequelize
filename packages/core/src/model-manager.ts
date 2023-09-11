'use strict';

import defaults from 'lodash/defaults';
// @ts-expect-error -- toposort-class definition will be added to sequelize/toposort later
import Toposort from 'toposort-class';
import type { ModelStatic } from './model';
import type { Sequelize } from './sequelize';

export class ModelManager {
  #sequelize: Sequelize;
  declare models: ModelStatic[];

  constructor(sequelize: Sequelize) {
    this.models = [];
    this.#sequelize = sequelize;
  }

  addModel<T extends ModelStatic>(model: T): T {
    this.models.push(model);
    this.#sequelize.models[model.name] = model;

    return model;
  }

  removeModel(modelToRemove: ModelStatic): void {
    this.models = this.models.filter(
      model => model.name !== modelToRemove.name,
    );

    delete this.#sequelize.models[modelToRemove.name];
  }

  getModel(modelName: string): ModelStatic | undefined {
    return this.models.find(model => model.name === modelName);
  }

  findModel(
    callback: (model: ModelStatic) => boolean,
  ): ModelStatic | undefined {
    return this.models.find(callback);
  }

  hasModel(targetModel: ModelStatic): boolean {
    return this.models.includes(targetModel);
  }

  get all(): ModelStatic[] {
    return this.models;
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

    for (const model of this.models) {
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
      if (
        error instanceof Error
        && !error.message.startsWith('Cyclic dependency found.')
      ) {
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
  forEachModel(
    iterator: (model: ModelStatic) => void,
    options?: { reverse?: boolean },
  ) {
    const sortedModels = this.getModelsTopoSortedByForeignKey();
    if (sortedModels == null) {
      throw new Error('Cyclic dependency found.');
    }

    options = defaults(options || {}, {
      reverse: true,
    });

    if (options.reverse) {
      sortedModels.reverse();
    }

    for (const model of sortedModels) {
      iterator(model);
    }
  }
}
