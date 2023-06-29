'use strict';

const Toposort = require('toposort-class');
const _ = require('lodash');

export class ModelManager {
  constructor(sequelize) {
    this.models = [];
    this.sequelize = sequelize;
  }

  addModel(model) {
    this.models.push(model);
    this.sequelize.models[model.name] = model;

    return model;
  }

  removeModel(modelToRemove) {
    this.models = this.models.filter(model => model.name !== modelToRemove.name);

    delete this.sequelize.models[modelToRemove.name];
  }

  getModel(against, options) {
    options = _.defaults(options || {}, {
      attribute: 'name',
    });

    return this.models.find(model => model[options.attribute] === against);
  }

  hasModel(targetModel) {
    return this.models.includes(targetModel);
  }

  get all() {
    return this.models;
  }

  /**
   * Returns an array that lists every model, sorted in order
   * of foreign key references: The first model is a model that is depended upon,
   * the last model is a model that is not depended upon.
   *
   * If there is a cyclic dependency, this returns null.
   */
  getModelsTopoSortedByForeignKey() {
    const models = new Map();
    const sorter = new Toposort();

    const queryGenerator = this.sequelize.queryInterface.queryGenerator;

    for (const model of this.models) {
      let deps = [];
      const tableName = queryGenerator.quoteTable(model);

      models.set(tableName, model);

      const { attributes } = model.modelDefinition;
      for (const attrName of attributes.keys()) {
        const attribute = attributes.get(attrName);

        if (!attribute.references) {
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
    } catch (error) {
      if (!error.message.startsWith('Cyclic dependency found.')) {
        throw error;
      }

      return null;
    }

    return sorted
      .map(modelName => {
        return models.get(modelName);
      })
      .filter(Boolean);
  }

  /**
   * Iterate over Models in an order suitable for e.g. creating tables.
   * Will take foreign key constraints into account so that dependencies are visited before dependents.
   *
   * @param {Function} iterator method to execute on each model
   * @param {object} options
   * @private
   *
   * @deprecated
   */
  forEachModel(iterator, options) {
    const sortedModels = this.getModelsTopoSortedByForeignKey();
    if (sortedModels == null) {
      throw new Error('Cyclic dependency found.');
    }

    options = _.defaults(options || {}, {
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
