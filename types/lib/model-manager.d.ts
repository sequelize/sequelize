import { Model, ModelStatic } from './model';
import { Sequelize } from './sequelize';

export class ModelManager {
  public sequelize: Sequelize;
  public models: typeof Model[];
  public all: typeof Model[];

  constructor(sequelize: Sequelize);
  public addModel<T extends ModelStatic<any>>(model: T): T;
  public removeModel(model: ModelStatic<any>): void;
  public getModel(against: unknown, options?: { attribute?: string }): typeof Model;
}

export default ModelManager;
