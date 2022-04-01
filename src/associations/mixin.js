'use strict';

import assert from 'assert';
import { isModelStatic, isSameModel } from '../model';
import { AssociationConstructorSecret, getModel, removeUndefined } from './helpers';

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

    Object.assign(options, _.omit(source.options, ['hooks']));

    if (options.useHooks) {
      this.runHooks('beforeAssociate', { source, target, type: HasMany }, options);
    }

    // the id is in the foreign table or in a connecting table
    const association = new HasMany(AssociationConstructorSecret, source, target, options);

    if (options.useHooks) {
      this.runHooks('afterAssociate', { source, target, type: HasMany, association }, options);
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

    // TODO: be more strict about what is copied over
    Object.assign(options, _.omit(source.options, ['hooks', 'timestamps', 'scopes', 'defaultScope', 'name']));

    if (options.useHooks) {
      this.runHooks('beforeAssociate', { source, target, type: BelongsToMany }, options);
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

      // TODO: instead of deduplicating by 'through', deduplicate by 'as'
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
      assert.deepStrictEqual(options, existingAssociation._originalOptions, `${source.name}.belongsToMany(${target.name}) was called with different options than ${target.name}.belongsToMany(${source.name}). This is not allowed.
Note that 'belongsToMany' associations are automatically created on the target model as well, so you only need to call this method on one side.`);
    }

    // the id is in the foreign table or in a connecting table
    const association = existingAssociation || new BelongsToMany(AssociationConstructorSecret, source, target, options);

    if (options.useHooks) {
      this.runHooks('afterAssociate', { source, target, type: BelongsToMany, association }, options);
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

    if (options.useHooks) {
      source.runHooks('beforeAssociate', { source, target, type: Type }, options);
    }

    // the id is in the foreign table
    const association = new Type(AssociationConstructorSecret, source, target, Object.assign(options, source.options));

    if (options.useHooks) {
      source.runHooks('afterAssociate', { source, target, type: Type, association }, options);
    }

    return association;
  };
}

Mixin.hasOne = singleLinked(HasOne);
Mixin.belongsTo = singleLinked(BelongsTo);
