import isEqual from 'lodash/isEqual';
import isPlainObject from 'lodash/isPlainObject.js';
import lowerFirst from 'lodash/lowerFirst';
import omit from 'lodash/omit';
import assert from 'node:assert';
import NodeUtils from 'node:util';
import type { Class } from 'type-fest';
import { AssociationError } from '../errors/index.js';
import type { Model, ModelStatic } from '../model';
import type { Sequelize } from '../sequelize';
import * as deprecations from '../utils/deprecations.js';
import { isModelStatic, isSameInitialModel } from '../utils/model-utils.js';
import { removeUndefined } from '../utils/object.js';
import { pluralize, singularize } from '../utils/string.js';
import type { OmitConstructors } from '../utils/types.js';
import type {
  Association,
  AssociationOptions,
  ForeignKeyOptions,
  NormalizedAssociationOptions,
} from './base';
import type { ThroughOptions } from './belongs-to-many.js';

export function checkNamingCollision(source: ModelStatic<any>, associationName: string): void {
  if (Object.hasOwn(source.getAttributes(), associationName)) {
    throw new Error(
      `Naming collision between attribute '${associationName}'` +
        ` and association '${associationName}' on model ${source.name}` +
        '. To remedy this, change the "as" options in your association definition',
    );
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
 */
export function mixinMethods<A extends Association, Aliases extends Record<string, string>>(
  association: A,
  mixinTargetPrototype: Model,
  methods: Array<keyof A | keyof Aliases>,
  aliases?: Aliases,
): void {
  for (const method of methods) {
    // @ts-expect-error -- implicit any, no way around it
    const targetMethodName = association.accessors[method];

    // don't override custom methods
    if (Object.hasOwn(mixinTargetPrototype, targetMethodName)) {
      continue;
    }

    // @ts-expect-error -- implicit any, no way around it
    const realMethod = aliases?.[method] || method;

    Object.defineProperty(mixinTargetPrototype, targetMethodName, {
      enumerable: false,
      value(...params: any[]) {
        // @ts-expect-error -- implicit any, no way around it
        return association[realMethod](this, ...params);
      },
    });
  }
}

/**
 * Used to prevent users from instantiating Associations themselves.
 * Instantiating associations is not safe as it mutates the Model object.
 *
 * @private do not expose outside sequelize
 */
export const AssociationSecret = Symbol('AssociationConstructorPrivateKey');

export function assertAssociationUnique(
  type: Class<Association>,
  source: ModelStatic<any>,
  target: ModelStatic<any>,
  options: NormalizedAssociationOptions<any>,
  parent: Association | undefined,
) {
  const as = options.as;

  const existingAssociation = source.associations[as];
  if (!existingAssociation) {
    return;
  }

  const incompatibilityStatus = getAssociationsIncompatibilityStatus(
    existingAssociation,
    type,
    target,
    options,
  );
  if ((parent || existingAssociation.parentAssociation) && incompatibilityStatus == null) {
    return;
  }

  const existingRoot = existingAssociation.rootAssociation;

  if (!parent && existingRoot === existingAssociation) {
    throw new AssociationError(
      `You have defined two associations with the same name "${as}" on the model "${source.name}". Use another alias using the "as" parameter.`,
    );
  }

  throw new AssociationError(
    `
${parent ? `The association "${parent.as}" needs to define` : `You are trying to define`} the ${type.name} association "${options.as}" from ${source.name} to ${target.name},
but that child association has already been defined as ${existingAssociation.associationType}, to ${target.name} by this call:

${existingRoot.source.name}.${lowerFirst(existingRoot.associationType)}(${existingRoot.target.name}, ${NodeUtils.inspect(existingRoot.options)})

That association would be re-used if compatible, but it is incompatible because ${
      incompatibilityStatus === IncompatibilityStatus.DIFFERENT_TYPES
        ? `their types are different (${type.name} vs ${existingAssociation.associationType})`
        : incompatibilityStatus === IncompatibilityStatus.DIFFERENT_TARGETS
          ? `they target different models (${target.name} vs ${existingAssociation.target.name})`
          : `their options are not reconcilable:

Options of the association to create:
${NodeUtils.inspect(omit(options, 'inverse'), { sorted: true })}

Options of the existing association:
${NodeUtils.inspect(omit(existingAssociation.options as any, 'inverse'), { sorted: true })}
`
    }`.trim(),
  );
}

/**
 * @private
 */
enum IncompatibilityStatus {
  DIFFERENT_TYPES = 0,
  DIFFERENT_TARGETS = 1,
  DIFFERENT_OPTIONS = 2,
}

function getAssociationsIncompatibilityStatus(
  existingAssociation: Association,
  newAssociationType: Class<Association>,
  newTarget: ModelStatic<Model>,
  newOptions: NormalizeBaseAssociationOptions<any>,
): IncompatibilityStatus | null {
  if (existingAssociation.associationType !== newAssociationType.name) {
    return IncompatibilityStatus.DIFFERENT_TYPES;
  }

  if (!isSameInitialModel(existingAssociation.target, newTarget)) {
    return IncompatibilityStatus.DIFFERENT_TARGETS;
  }

  const opts1 = omit(existingAssociation.options as any, 'inverse');
  const opts2 = omit(newOptions, 'inverse');
  if (!isEqual(opts1, opts2)) {
    return IncompatibilityStatus.DIFFERENT_OPTIONS;
  }

  return null;
}

export function assertAssociationModelIsDefined(model: ModelStatic<any>): void {
  if (!model.sequelize) {
    throw new Error(
      `Model ${model.name} must be defined (through Model.init or Sequelize#define) before calling one of its association declaration methods.`,
    );
  }
}

export type AssociationStatic<T extends Association> = {
  new (...arguments_: any[]): T;
} & OmitConstructors<typeof Association>;

export function defineAssociation<
  T extends Association,
  RawOptions extends AssociationOptions<any>,
  CleanOptions extends NormalizedAssociationOptions<any>,
>(
  type: AssociationStatic<T>,
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
  options: RawOptions,
  parent: Association<any> | undefined,
  normalizeOptions: (
    type: AssociationStatic<T>,
    options: RawOptions,
    source: ModelStatic<Model>,
    target: ModelStatic<Model>,
  ) => CleanOptions,
  construct: (opts: CleanOptions) => T,
): T {
  if (!isModelStatic(target)) {
    throw new Error(
      `${source.name}.${lowerFirst(type.name)} was called with ${NodeUtils.inspect(target)} as the target model, but it is not a subclass of Sequelize's Model class`,
    );
  }

  assertAssociationModelIsDefined(source);
  assertAssociationModelIsDefined(target);

  const normalizedOptions = normalizeOptions(type, options, source, target);

  checkNamingCollision(source, normalizedOptions.as);
  assertAssociationUnique(type, source, target, normalizedOptions, parent);

  const sequelize = source.sequelize;
  Object.defineProperty(normalizedOptions, 'sequelize', {
    configurable: true,
    get() {
      deprecations.movedSequelizeParam();

      return sequelize;
    },
  });

  if (normalizedOptions.hooks) {
    source.hooks.runSync('beforeAssociate', { source, target, type, sequelize }, normalizedOptions);
  }

  let association;
  try {
    association = (source.associations[normalizedOptions.as] as T) ?? construct(normalizedOptions);
  } catch (error) {
    throw new AssociationError(
      parent
        ? `Association "${parent.as}" needs to create the ${type.name} association "${normalizedOptions.as}" from ${source.name} to ${target.name}, but it failed`
        : `Defining ${type.name} association "${normalizedOptions.as}" from ${source.name} to ${target.name} failed`,
      { cause: error as Error },
    );
  }

  if (normalizedOptions.hooks) {
    source.hooks.runSync(
      'afterAssociate',
      { source, target, type, association, sequelize },
      normalizedOptions,
    );
  }

  checkNamingCollision(source, normalizedOptions.as);

  return association;
}

export type NormalizeBaseAssociationOptions<T> = Omit<T, 'as' | 'hooks' | 'foreignKey'> & {
  as: string;
  name: { singular: string; plural: string };
  hooks: boolean;
  foreignKey: ForeignKeyOptions<any>;
};

export function normalizeInverseAssociation<T extends { as?: unknown }>(
  inverse: T | string | undefined,
): T | undefined {
  if (typeof inverse === 'string') {
    return { as: inverse } as T;
  }

  return inverse;
}

export function normalizeBaseAssociationOptions<T extends AssociationOptions<any>>(
  associationType: AssociationStatic<any>,
  options: T,
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
): NormalizeBaseAssociationOptions<T> {
  if ('onDelete' in options || 'onUpdate' in options) {
    throw new Error(
      'Options "onDelete" and "onUpdate" have been moved to "foreignKey.onDelete" and "foreignKey.onUpdate" (also available as "otherKey" in belongsToMany)',
    );
  }

  if ('constraints' in options) {
    throw new Error('Option "constraints" has been renamed to "foreignKeyConstraints"');
  }

  if ('foreignKeyConstraint' in options) {
    throw new Error(
      'Option "foreignKeyConstraint" has been renamed to "foreignKeyConstraints" (with a "s" at the end)',
    );
  }

  const isMultiAssociation = associationType.isMultiAssociation;

  let name: { singular: string; plural: string };
  let as: string;
  if (options?.as) {
    if (isPlainObject(options.as)) {
      assert(typeof options.as === 'object');
      name = options.as;
      as = isMultiAssociation ? options.as.plural : options.as.singular;
    } else {
      assert(typeof options.as === 'string');
      as = options.as;
      name = {
        plural: isMultiAssociation ? options.as : pluralize(options.as),
        singular: isMultiAssociation ? singularize(options.as) : options.as,
      };
    }
  } else {
    as = lowerFirst(isMultiAssociation ? target.options.name.plural : target.options.name.singular);
    name = {
      plural: lowerFirst(target.options.name.plural),
      singular: lowerFirst(target.options.name.singular),
    };
  }

  return removeUndefined({
    ...options,
    foreignKey: normalizeForeignKeyOptions(options.foreignKey),
    hooks: options.hooks ?? false,
    as,
    name,
  });
}

export function normalizeForeignKeyOptions<T extends string>(
  foreignKey: AssociationOptions<T>['foreignKey'],
): ForeignKeyOptions<any> {
  return typeof foreignKey === 'string'
    ? { name: foreignKey }
    : removeUndefined({
        ...foreignKey,
        name: foreignKey?.name ?? foreignKey?.fieldName,
        fieldName: undefined,
      });
}

export type MaybeForwardedModelStatic<M extends Model = Model> =
  | ModelStatic<M>
  | ((sequelize: Sequelize) => ModelStatic<M>);

export function getForwardedModel(
  model: MaybeForwardedModelStatic,
  sequelize: Sequelize,
): ModelStatic {
  return typeof model === 'function' && !isModelStatic(model) ? model(sequelize) : model;
}

export function isThroughOptions<M extends Model>(val: any): val is ThroughOptions<M> {
  return isPlainObject(val) && 'model' in val;
}
