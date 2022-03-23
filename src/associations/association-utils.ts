import type { ModelStatic } from '../model';

export function assertAssociationModelIsDefined(model: ModelStatic<any>): void {
  if (!model.sequelize) {
    throw new Error(`Model ${model.name} must be defined (through Model.init or Sequelize#define) before calling one of its association declaration methods.`);
  }
}
