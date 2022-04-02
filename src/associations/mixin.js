'use strict';

import assert from 'assert';
import { isModelStatic, isSameModel } from '../model';
import { movedSequelizeParam } from '../utils/deprecations';
import { AssociationConstructorSecret, getModel, removeUndefined } from './helpers';
import NodeUtil from 'util';

const _ = require('lodash');
const { HasOne } = require('./has-one');
const { HasMany } = require('./has-many');
const { BelongsToMany } = require('./belongs-to-many');
const { BelongsTo } = require('./belongs-to');

export const Mixin = {
  hasMany(target, options = {}) {
    if (!isModelStatic(target)) {
      throw new Error(`${this.name}.hasMany called with something that's not a subclass of Sequelize.Model`);
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    Object.assign(options, _.omit(source.options, ['hooks', 'sequelize']));

    const sequelize = source.sequelize;
    Object.defineProperty(options, 'sequelize', {
      configurable: true,
      get() {
        movedSequelizeParam();

        return sequelize;
      },
    });

    if (options.useHooks) {
      this.runHooks('beforeAssociate', { source, target, type: HasMany, sequelize }, options);
    }

    // the id is in the foreign table or in a connecting table
    const association = new HasMany(AssociationConstructorSecret, source, target, options);

    if (options.useHooks) {
      this.runHooks('afterAssociate', { source, target, type: HasMany, association, sequelize }, options);
    }

    return association;
  },

  belongsToMany(target, options = {}) {
    if (!isModelStatic(target)) {
      throw new Error(`${this.name}.belongsToMany called with something that's not a subclass of Sequelize.Model`);
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;
    options.timestamps = options.timestamps === undefined ? this.sequelize.options.timestamps : options.timestamps;

    const sequelize = source.sequelize;

    Object.defineProperty(options, 'sequelize', {
      configurable: true,
      get() {
        movedSequelizeParam();

        return sequelize;
      },
    });

    // TODO: be more strict about what is copied over
    Object.assign(options, _.omit(source.options, ['hooks', 'timestamps', 'scopes', 'defaultScope', 'name', 'tableName', 'sequelize']));

    if (options.useHooks) {
      this.runHooks('beforeAssociate', { source, target, type: BelongsToMany, sequelize }, options);
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

      const throughModel = getModel(source.sequelize, options.through);
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

    if (existingAssociation) {
      assert.deepStrictEqual(
        _.omit(options, 'inverse'),
        _.omit(existingAssociation._originalOptions, 'inverse'),
        `As belongsToMany association are automatically created on both sides of the association, the belongsToMany association from ${source.name} to ${target.name}, through ${existingAssociation.throughModel.name} has already been defined by ${target.name}.belongsToMany(${source.name}, { through: ${existingAssociation.throughModel.name} }),

In the past Sequelize would attempt to patch the association and models, but this behavior is prone to subtle bugs and has been removed.
We recommend that you call .belongsToMany on one side of the association only, you can customize the other side using the "inverse" option.
`, // TODO: link to website documentation about this
      );
    }

    // the id is in the foreign table or in a connecting table
    const association = existingAssociation || new BelongsToMany(AssociationConstructorSecret, source, target, options);

    Object.defineProperty(options, 'sequelize', {
      configurable: true,
      get() {
        movedSequelizeParam();

        return sequelize;
      },
    });

    if (options.useHooks) {
      this.runHooks('afterAssociate', { source, target, type: BelongsToMany, association, sequelize }, options);
    }

    return association;
  },

  getAssociations(target) {
    return Object.values(this.associations).filter(association => association.target.name === target.name);
  },

  getAssociationForAlias(target, alias) {
    // Two associations cannot have the same alias, so we can use find instead of filter
    return this.getAssociations(target).find(association => association.verifyAssociationAlias(alias)) || null;
  },
};

// The logic for hasOne and belongsTo is exactly the same
function singleLinked(Type) {
  return function declareAssociation(target, options = {}) {

    const source = this;
    if (!isModelStatic(target)) {
      throw new Error(`${source.name}.${_.lowerFirst(Type.name)} called with something that's not a subclass of Sequelize.Model`);
    }

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;
    const sequelize = source.sequelize;

    Object.defineProperty(options, 'sequelize', {
      configurable: true,
      get() {
        movedSequelizeParam();

        return sequelize;
      },
    });

    // TODO: be more strict about what is copied over
    Object.assign(options, _.omit(source.options, ['hooks', 'timestamps', 'scopes', 'defaultScope', 'name', 'tableName', 'sequelize']));

    if (options.useHooks) {
      source.runHooks('beforeAssociate', { source, target, type: Type, sequelize }, options);
    }

    // the id is in the foreign table
    const association = new Type(AssociationConstructorSecret, source, target, options);

    if (options.useHooks) {
      source.runHooks('afterAssociate', { source, target, type: Type, association, sequelize }, options);
    }

    return association;
  };
}

Mixin.hasOne = singleLinked(HasOne);
Mixin.belongsTo = singleLinked(BelongsTo);
