import { Model, ModelStatic } from './model';
import { Sequelize } from './sequelize';

export class ModelManager {
  public sequelize: Sequelize;
  public models: Array<ModelStatic>;
  public all: Array<ModelStatic>;

  constructor(sequelize: Sequelize);
  public addModel<T extends ModelStatic>(model: T): T;
  public removeModel(model: ModelStatic): void;
  public getModel(against: unknown, options?: { attribute?: string }): typeof Model;

  /**
   * Returns an array that lists every model, sorted in order
   * of foreign key references: The first model is a model that is depended upon,
   * the last model is a model that is not depended upon.
   *
   * If there is a cyclic dependency, this returns null.
   */
  public getModelsTopoSortedByForeignKey(): ModelStatic[] | null;
}
