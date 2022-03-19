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
}

export default ModelManager;
