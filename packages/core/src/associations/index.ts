import type { Class } from 'type-fest';
import type { Model, ModelStatic } from '../model';
import type { Sequelize } from '../sequelize';
import type { Association } from './base';

export * from './base';
export * from './belongs-to';
export * from './belongs-to-many';
export * from './has-many';
export * from './has-one';

export interface BeforeAssociateEventData {
  source: ModelStatic<Model>;
  target: ModelStatic<Model>;
  sequelize: Sequelize;
  type: Class<Association>;
}

export interface AfterAssociateEventData extends BeforeAssociateEventData {
  association: Association;
}
