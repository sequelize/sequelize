import { BelongsToAssociation } from '../associations/index.js';
import type { ModelStatic } from '../model.js';

/**
 * Returns all BelongsTo associations in the entire Sequelize instance that target the given model.
 *
 * @param target
 */
export function getBelongsToAssociationsWithTarget(target: ModelStatic): BelongsToAssociation[] {
  const sequelize = target.sequelize;

  const associations: BelongsToAssociation[] = [];
  for (const model of sequelize.models) {
    for (const association of Object.values(model.associations)) {
      if (association instanceof BelongsToAssociation && association.target === target) {
        associations.push(association);
      }
    }
  }

  return associations;
}
