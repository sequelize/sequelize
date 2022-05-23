import { Model, ModelType } from './model';
import { Sequelize } from './sequelize';

export class ModelManager {
  public sequelize: Sequelize;
  public models: typeof Model[];
  public all: typeof Model[];

  constructor(sequelize: Sequelize);
  public addModel<T extends ModelType>(model: T): T;
  public removeModel(model: ModelType): void;
  public getModel(against: unknown, options?: { attribute?: string }): typeof Model;

  /**
   * Returns an array that lists every model, sorted in order
   * of foreign key references: The first model is a model that is depended upon,
   * the last model is a model that is not depended upon.
   *
   * If there is a cyclic dependency, this returns null.
   */
  public getModelsTopoSortedByForeignKey(): ModelType[] | null;
}

export default ModelManager;
