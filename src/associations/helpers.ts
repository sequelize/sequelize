import type { Model, ModelAttributeColumnOptions, ModelStatic } from '../model';
import type { Association, AssociationOptions } from './base';

export function checkNamingCollision(association: Association): void {
  if (Object.prototype.hasOwnProperty.call(association.source.getAttributes(), association.as)) {
    throw new Error(
      `Naming collision between attribute '${association.as}'`
      + ` and association '${association.as}' on model ${association.source.name}`
      + '. To remedy this, change either foreignKey or as in your association definition',
    );
  }
}

export function addForeignKeyConstraints(
  newAttribute: ModelAttributeColumnOptions,
  source: ModelStatic<Model>,
  options: AssociationOptions<string>,
  key: string,
): void {
  // FK constraints are opt-in: users must either set `foreignKeyConstraints`
  // on the association, or request an `onDelete` or `onUpdate` behavior

  if (options.foreignKeyConstraint || options.onDelete || options.onUpdate) {
    // Find primary keys: composite keys not supported with this approach
    const primaryKeys = Object.keys(source.primaryKeys)
      .map(primaryKeyAttribute => source.getAttributes()[primaryKeyAttribute].field || primaryKeyAttribute);

    if (primaryKeys.length === 1 || !primaryKeys.includes(key)) {
      newAttribute.references = {
        model: source.getTableName(),
        key: key || primaryKeys[0],
      };

      newAttribute.onDelete = options.onDelete;
      newAttribute.onUpdate = options.onUpdate;
    }
  }
}

/**
 * Mixin (inject) association methods to model prototype
 *
 * @private
 *
 * @param association instance
 * @param mixinTargetPrototype Model prototype
 * @param methods Method names to inject
 * @param aliases Mapping between model and association method names
 *
 */
export function mixinMethods<A extends Association, Aliases extends Record<string, string>>(
  association: A,
  mixinTargetPrototype: Model,
  methods: Array<keyof A | keyof Aliases>,
  aliases?: Aliases,
): void {
  for (const method of methods) {
    // @ts-expect-error
    const targetMethodName = association.accessors[method];

    // don't override custom methods
    if (Object.prototype.hasOwnProperty.call(mixinTargetPrototype, targetMethodName)) {
      continue;
    }

    // @ts-expect-error
    const realMethod = aliases?.[method] || method;

    Object.defineProperty(mixinTargetPrototype, 'targetMethodName', {
      enumerable: false,
      value(...params: any[]) {
        // @ts-expect-error
        return association[realMethod](this, ...params);
      },
    });
  }
}
