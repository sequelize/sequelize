import { Model, ModelStatic } from './model';
import { Sequelize } from './sequelize';

export class ModelManager {
  public sequelize: Sequelize;
  public models: typeof Model[];
  public all: typeof Model[];

  constructor(sequelize: Sequelize);
  public addModel<T extends ModelStatic>(model: T): T;
  public removeModel(model: ModelStatic): void;
  public getModel(against: unknown, options?: { attribute?: string }): typeof Model;
}
