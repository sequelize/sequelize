import { inspect } from 'node:util';
import type { MaybeForwardedModelStatic } from '../../associations/helpers.js';
import { AssociationSecret, getForwardedModel } from '../../associations/helpers.js';
import type {
  AssociationOptions,
  BelongsToManyOptions,
  BelongsToOptions,
  HasManyOptions,
  HasOneOptions,
} from '../../associations/index.js';
import {
  BelongsTo as BelongsToAssociation,
  BelongsToMany as BelongsToManyAssociation,
  HasMany as HasManyAssociation,
  HasOne as HasOneAssociation,
} from '../../associations/index.js';
import type { AttributeNames, Model, ModelStatic } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { isString } from '../../utils/check.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { EMPTY_ARRAY } from '../../utils/object.js';
import { throwMustBeInstanceProperty, throwMustBeModel } from './decorator-utils.js';

export type AssociationType = 'BelongsTo' | 'HasOne' | 'HasMany' | 'BelongsToMany';

interface RegisteredAssociation {
  type: AssociationType;
  associationName: string;
  source: ModelStatic;
  target: MaybeForwardedModelStatic;
  options: AssociationOptions;
}

const registeredAssociations = new WeakMap<ModelStatic, RegisteredAssociation[]>();

function decorateAssociation(
  type: AssociationType,
  source: Object,
  target: MaybeForwardedModelStatic,
  associationName: string | symbol,
  options: AssociationOptions,
): void {
  if (typeof source === 'function') {
    throwMustBeInstanceProperty(type, source, associationName);
  }

  const sourceClass = source.constructor;
  if (!isModelStatic(sourceClass)) {
    throwMustBeModel(type, source, associationName);
  }

  if (typeof associationName === 'symbol') {
    throw new TypeError('Symbol associations are not currently supported. We welcome a PR that implements this feature.');
  }

  const associations = registeredAssociations.get(sourceClass) ?? [];
  registeredAssociations.set(sourceClass, associations);

  associations.push({ source: sourceClass, target, options, associationName, type });
}

export function HasOne<Target extends Model>(
  target: MaybeForwardedModelStatic<Target>,
  optionsOrForeignKey: HasOneOptions<string, AttributeNames<Target>> | AttributeNames<Target>,
) {
  return (source: Model, associationName: string | symbol) => {
    const options = isString(optionsOrForeignKey) ? { foreignKey: optionsOrForeignKey } : optionsOrForeignKey;

    decorateAssociation('HasOne', source, target, associationName, options);
  };
}

export function HasMany<Target extends Model>(
  target: MaybeForwardedModelStatic<Target>,
  optionsOrForeignKey: HasManyOptions<string, AttributeNames<Target>> | AttributeNames<Target>,
) {
  return (source: Model, associationName: string | symbol) => {
    const options = isString(optionsOrForeignKey) ? { foreignKey: optionsOrForeignKey } : optionsOrForeignKey;

    decorateAssociation('HasMany', source, target, associationName, options);
  };
}

export function BelongsTo<SourceKey extends string, Target extends Model>(
  target: MaybeForwardedModelStatic<Target>,
  optionsOrForeignKey: BelongsToOptions<SourceKey, AttributeNames<Target>> | SourceKey,
) {
  return (
    // This type is a hack to make sure the source model declares a property named [SourceKey].
    // The error message is going to be horrendous, but at least it's enforced.
    source: Model<{ [key in SourceKey]: any }>,
    associationName: string,
  ) => {
    const options = isString(optionsOrForeignKey) ? { foreignKey: optionsOrForeignKey } : optionsOrForeignKey;

    decorateAssociation('BelongsTo', source, target, associationName, options);
  };
}

export function BelongsToMany(
  target: MaybeForwardedModelStatic,
  options: BelongsToManyOptions,
): PropertyDecorator {
  return (
    source: Object,
    associationName: string | symbol,
  ) => {
    decorateAssociation('BelongsToMany', source, target, associationName, options);
  };
}

export function initDecoratedAssociations(source: ModelStatic, sequelize: Sequelize): void {
  const associations = getDeclaredAssociations(source);

  if (!associations.length) {
    return;
  }

  for (const association of associations) {
    const { type, target: targetGetter, associationName } = association;
    const options: AssociationOptions = { ...association.options, as: associationName };

    const target = getForwardedModel(targetGetter, sequelize);

    switch (type) {
      case 'BelongsTo':
        BelongsToAssociation.associate(AssociationSecret, source, target, options as BelongsToOptions<string, string>);
        break;
      case 'HasOne':
        HasOneAssociation.associate(AssociationSecret, source, target, options as HasOneOptions<string, string>);
        break;
      case 'HasMany':
        HasManyAssociation.associate(AssociationSecret, source, target, options as HasManyOptions<string, string>);
        break;
      case 'BelongsToMany':
        BelongsToManyAssociation.associate(AssociationSecret, source, target, options as BelongsToManyOptions);
        break;
      default:
        throw new Error(`Unknown association type: ${type}`);
    }
  }
}

function getDeclaredAssociations(model: ModelStatic): readonly RegisteredAssociation[] {
  const associations: readonly RegisteredAssociation[] = registeredAssociations.get(model) ?? EMPTY_ARRAY;

  const parentModel = Object.getPrototypeOf(model);
  if (isModelStatic(parentModel)) {
    const parentAssociations = getDeclaredAssociations(parentModel);

    for (const parentAssociation of parentAssociations) {
      if (parentAssociation.type !== 'BelongsTo') {
        throw new Error(
          `Models that use @HasOne, @HasMany, or @BelongsToMany associations cannot be inherited from, as they would add conflicting foreign keys on the target model.
Only @BelongsTo associations can be inherited, as it will add the foreign key on the source model.
Remove the ${parentAssociation.type} association ${inspect(parentAssociation.associationName)} from model ${inspect(parentModel.name)} to fix this error.`,
        );
      }

      if ('inverse' in parentAssociation.options) {
        throw new Error(
          `Models that use @BelongsTo associations with the "inverse" option cannot be inherited from, as they would add conflicting associations on the target model.
Only @BelongsTo associations without the "inverse" option can be inherited, as they do not declare an association on the target model.
Remove the "inverse" option from association ${inspect(parentAssociation.associationName)} on model ${inspect(parentModel.name)} to fix this error.`,
        );
      }
    }

    return [...parentAssociations, ...associations];
  }

  return associations;
}
