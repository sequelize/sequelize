import type { MaybeForwardedModelStatic } from '../../associations/helpers.js';
import { AssociationSecret, getForwardedModel } from '../../associations/helpers.js';
import type {
  AssociationOptions,
  BelongsToManyOptions,
  BelongsToOptions,
  HasManyOptions,
  HasOneOptions,
} from '../../associations/index.js';
import { BelongsTo as BelongsToAssociation, HasMany as HasManyAssociation, HasOne as HasOneAssociation, BelongsToMany as BelongsToManyAssociation } from '../../associations/index.js';
import type { ModelStatic, Model, AttributeNames } from '../../model.js';
import type { Sequelize } from '../../sequelize.js';
import { isString } from '../../utils/check.js';
import { isModelStatic } from '../../utils/model-utils.js';
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
    source: Model<{ [key in SourceKey]: unknown }>,
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

export function initDecoratedAssociations(model: ModelStatic, sequelize: Sequelize): void {
  const associations = registeredAssociations.get(model);

  if (!associations) {
    return;
  }

  for (const association of associations) {
    const { type, source, target: targetGetter, associationName } = association;
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

