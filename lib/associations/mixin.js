'use strict';

const _ = require('lodash');
const HasOne = require('./has-one');
const HasMany = require('./has-many');
const BelongsToMany = require('./belongs-to-many');
const BelongsTo = require('./belongs-to');

function isModel(model, sequelize) {
  return model
    && model.prototype
    && model.prototype instanceof sequelize.Sequelize.Model;
}

const Mixin = {
  hasMany(target, options = {}) {
    if (!isModel(target, this.sequelize)) {
      throw new Error(`${this.name}.hasMany called with something that's not a subclass of Sequelize.Model`);
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    options = Object.assign(options, _.omit(source.options, ['hooks']));

    if (options.useHooks) {
      this.hooks.run('beforeAssociate', { source, target, type: HasMany }, options);
    }

    // the id is in the foreign table or in a connecting table
    const association = new HasMany(source, target, options);
    source.associations[association.associationAccessor] = association;

    association._injectAttributes();
    association.mixin(source.prototype);

    if (options.useHooks) {
      this.hooks.run('afterAssociate', { source, target, type: HasMany, association }, options);
    }

    return association;
  },

  belongsToMany(target, options = {}) {
    if (!isModel(target, this.sequelize)) {
      throw new Error(`${this.name}.belongsToMany called with something that's not a subclass of Sequelize.Model`);
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;
    options.timestamps = options.timestamps === undefined ? this.sequelize.options.timestamps : options.timestamps;
    options = Object.assign(options, _.omit(source.options, ['hooks', 'timestamps', 'scopes', 'defaultScope']));

    if (options.useHooks) {
      this.hooks.run('beforeAssociate', { source, target, type: BelongsToMany }, options);
    }
    // the id is in the foreign table or in a connecting table
    const association = new BelongsToMany(source, target, options);
    source.associations[association.associationAccessor] = association;

    association._injectAttributes();
    association.mixin(source.prototype);

    if (options.useHooks) {
      this.hooks.run('afterAssociate', { source, target, type: BelongsToMany, association }, options);
    }

    return association;
  },

  getAssociations(target) {
    return Object.values(this.associations).filter(association => association.target.name === target.name);
  },

  getAssociationForAlias(target, alias) {
    // Two associations cannot have the same alias, so we can use find instead of filter
    return this.getAssociations(target).find(association => association.verifyAssociationAlias(alias)) || null;
  }
};

// The logic for hasOne and belongsTo is exactly the same
function singleLinked(Type) {
  return function(target, options = {}) {
    // eslint-disable-next-line no-invalid-this
    const source = this;
    if (!isModel(target, source.sequelize)) {
      throw new Error(`${source.name}.${_.lowerFirst(Type.name)} called with something that's not a subclass of Sequelize.Model`);
    }


    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    if (options.useHooks) {
      source.hooks.run('beforeAssociate', { source, target, type: Type }, options);
    }
    // the id is in the foreign table
    const association = new Type(source, target, Object.assign(options, source.options));
    source.associations[association.associationAccessor] = association;

    association._injectAttributes();
    association.mixin(source.prototype);

    if (options.useHooks) {
      source.hooks.run('afterAssociate', { source, target, type: Type, association }, options);
    }

    return association;
  };
}

Mixin.hasOne = singleLinked(HasOne);
Mixin.belongsTo = singleLinked(BelongsTo);

module.exports = Mixin;
module.exports.Mixin = Mixin;
module.exports.default = Mixin;
