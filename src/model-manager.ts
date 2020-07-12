import Toposort from 'toposort-class';
import * as _ from 'lodash';
import Model from './model';
import { TableName } from './common';

export class ModelManager {
  private models: typeof Model[] = [];
  constructor(private sequelize: any) {}

  public addModel<T extends typeof Model>(model: T): T {
    this.models.push(model);
    this.sequelize.models[model.name] = model;
    return model;
  }

  public removeModel(modelToRemove: typeof Model): void {
    this.models = this.models.filter(model => model.name !== modelToRemove.name);
    delete this.sequelize.models[modelToRemove.name];
  }

  public getModel(against: unknown, options: { attribute?: keyof typeof Model } = {}): typeof Model | undefined {
    const attribute = options.attribute || 'name';
    return this.models.find(model => model[attribute] === against);
  }

  public get all(): typeof Model[] {
    return this.models;
  }

  /**
   * Iterate over Models in an order suitable for e.g. creating tables.
   * Will take foreign key constraints into account so that dependencies are visited before dependents.
   *
   * @param {Function} iterator method to execute on each model
   * @param {object} [options] iterator options
   * @private
   */
  public forEachModel(iterator: (m: typeof Model) => void, options: { reverse: boolean } = { reverse: true }): void {
    const models: Record<string, typeof Model> = {};
    const sorter = new Toposort();

    for (const model of this.models) {
      let deps = [];
      let tableName = model.getTableName() as string | TableName;

      if (_.isObject(tableName)) {
        tableName = `${tableName.schema}.${tableName.tableName}`;
      }

      models[tableName] = model;

      for (const attrName in model.rawAttributes) {
        if (Object.prototype.hasOwnProperty.call(model.rawAttributes, attrName)) {
          const attribute = model.rawAttributes[attrName];

          if (attribute.references) {
            const dep = attribute.references.model as typeof Model;

            if (_.isObject(dep)) {
              deps.push(`${dep.schema}.${dep.tableName}`);
            } else {
              deps.push(dep);
            }
          }
        }
      }

      deps = deps.filter(dep => tableName !== dep);

      sorter.add(tableName, deps);
    }

    let sorted = sorter.sort();
    if (options.reverse) {
      sorted = sorted.reverse();
    }
    for (const name of sorted) {
      iterator(models[name]);
    }
  }
}

module.exports = ModelManager;
module.exports.default = ModelManager;
