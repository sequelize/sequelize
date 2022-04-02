import assert from 'assert';
import lowerFirst from 'lodash/lowerFirst';
import omit from 'lodash/omit';
import type { Class } from 'type-fest';
import type { Model, ModelStatic, AttributeNames } from '../model';
import { isModelStatic, isSameModel } from '../model';
import type { Sequelize } from '../sequelize';
import * as deprecations from '../utils/deprecations';
import { cloneDeep } from '../utils/index.js';
import { assertAssociationModelIsDefined } from './association-utils.js';
import type { Association, AssociationOptions } from './base';
import { BelongsTo } from './belongs-to';
import type { BelongsToManyOptions } from './belongs-to-many';
import { BelongsToMany, isThroughOptions } from './belongs-to-many';
import type { HasManyOptions } from './has-many';
import { HasMany } from './has-many';
import { HasOne } from './has-one';
import { AssociationConstructorSecret, getModel, removeUndefined } from './helpers';

export type BeforeAssociateEventData = {
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
  sequelize: Sequelize,
  type: Class<Association>,
};

export type AfterAssociateEventData = BeforeAssociateEventData & {
  association: Association,
};

export const DefineAssociationMethods = {
  hasMany<
    S extends Model,
    T extends Model,
    SourceKey extends AttributeNames<S>,
    TargetKey extends AttributeNames<T>,
  >(source: ModelStatic<S>, target: ModelStatic<T>, options: HasManyOptions<SourceKey, TargetKey> = {}) {
    options = associationPreflight('hasMany', source, target, options);
    const sequelize = source.sequelize!;

    if (options.hooks) {
      source.runHooks('beforeAssociate', { source, target, type: HasMany, sequelize }, options);
    }

    // the id is in the foreign table or in a connecting table
    const association = new HasMany(AssociationConstructorSecret, source, target, options);

    if (options.hooks) {
      source.runHooks('afterAssociate', { source, target, type: HasMany, association, sequelize }, options);
    }

    return association;
  },

  belongsToMany<
    S extends Model,
    T extends Model,
    SourceKey extends AttributeNames<S>,
    TargetKey extends AttributeNames<T>,
    ThroughModel extends Model,
  >(source: ModelStatic<S>, target: ModelStatic<T>, options: BelongsToManyOptions<SourceKey, TargetKey, ThroughModel>) {
    options = associationPreflight('belongsToMany', source, target, options);

    const sequelize = source.sequelize!;

    options.timestamps = options.timestamps === undefined ? sequelize.options.define?.timestamps : options.timestamps;

    if (options.hooks) {
      source.runHooks('beforeAssociate', { source, target, type: BelongsToMany, sequelize }, options);
    }

    // BelongsToMany automatically creates its symmetrical association on the target model
    //  if the user tries to use BelongsToMany on both the source & target model,
    //  we return the already created association (assuming the options are compatible).
    let existingAssociation;
    for (const association of Object.values(source.associations)) {
      if (!(association instanceof BelongsToMany)) {
        continue;
      }

      if (!isSameModel(association.target, target)) {
        continue;
      }

      const throughModel = getModel(sequelize, isThroughOptions(options.through) ? options.through.model : options.through);
      if (!throughModel) {
        continue;
      }

      if (!isSameModel(association.throughModel, throughModel)) {
        continue;
      }

      existingAssociation = association;
      break;
    }

    options = removeUndefined(options);
    Object.defineProperty(options, 'sequelize', {
      configurable: true,
      get() {
        deprecations.movedSequelizeParam();

        return source.sequelize!;
      },
    });

    if (existingAssociation) {
      // TODO: link to website documentation about this
      assert.deepStrictEqual(
        omit(options, 'inverse'),
        omit(existingAssociation._originalOptions, 'inverse'),
        `As belongsToMany association are automatically created on both sides of the association, the belongsToMany association from ${source.name} to ${target.name}, through ${existingAssociation.throughModel.name} has already been defined by ${target.name}.belongsToMany(${source.name}, { through: ${existingAssociation.throughModel.name} }),

In the past Sequelize would attempt to patch the association and models, but this behavior is prone to subtle bugs and has been removed.
We recommend calling .belongsToMany on one side of the association only, you can customize the other side using the "inverse" option.
`,
      );
    }

    // the id is in the foreign table or in a connecting table
    const association = existingAssociation || new BelongsToMany(AssociationConstructorSecret, source, target, options);

    if (options.hooks) {
      source.runHooks('afterAssociate', { source, target, type: BelongsToMany, association, sequelize }, options);
    }

    return association;
  },

  hasOne: singleLinked(HasOne),
  belongsTo: singleLinked(BelongsTo),
};

// The logic for hasOne and belongsTo is exactly the same
function singleLinked<
  A extends Association,
>(Type: Class<A>) {
  return function declareAssociation<
    S extends Model,
    T extends Model,
  >(source: ModelStatic<S>, target: ModelStatic<T>, options: AssociationOptions<any> = {}) {
    options = associationPreflight(lowerFirst(Type.name), source, target, options);
    const sequelize = source.sequelize!;

    if (options.hooks) {
      source.runHooks('beforeAssociate', { source, target, type: Type, sequelize }, options);
    }

    // the id is in the foreign table
    const association = new Type(AssociationConstructorSecret, source, target, options);

    if (options.hooks) {
      source.runHooks('afterAssociate', { source, target, type: Type, association, sequelize }, options);
    }

    return association;
  };
}

function associationPreflight<Opts extends AssociationOptions<any>>(
  type: string,
  source: ModelStatic<Model>,
  target: ModelStatic<Model>,
  options: Opts,
): Opts {
  if (!isModelStatic(target)) {
    throw new Error(`${source.name}.${type} called with something that's not a subclass of Sequelize.Model`);
  }

  assertAssociationModelIsDefined(source);
  assertAssociationModelIsDefined(target);

  options = removeUndefined(cloneDeep(options));
  Object.defineProperty(options, 'sequelize', {
    configurable: true,
    get() {
      deprecations.movedSequelizeParam();

      return source.sequelize!;
    },
  });

  options.hooks = Boolean(options.hooks ?? false);

  return options;
}
