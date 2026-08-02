import * as Utils from '../utils.js';
import _ from 'lodash';
import HasOne from './has-one.js';
import HasMany from './has-many.js';
import BelongsToMany from './belongs-to-many.js';
import BelongsTo from './belongs-to.js';

export const Mixin = {
  hasMany(target, options) {
    // testhint options:none
    if (!target || !target.prototype || !(target.prototype instanceof this.sequelize.Model)) {
      throw new Error(this.name + ".hasMany called with something that's not a subclass of Sequelize.Model");
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options = options || {};
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    options = Object.assign(options, _.omit(source.options, ['hooks']));

    // the id is in the foreign table or in a connecting table
    const association = new HasMany(source, target, options);
    source.associations[association.associationAccessor] = association;

    association.injectAttributes();
    association.mixin(source.prototype);

    return association;
  },

  belongsToMany(targetModel, options) {
    // testhint options:none
    if (!targetModel || !targetModel.prototype || !(targetModel.prototype instanceof this.sequelize.Model)) {
      throw new Error(this.name + ".belongsToMany called with something that's not a subclass of Sequelize.Model");
    }

    const sourceModel = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options = options || {};
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;
    options.timestamps = options.timestamps === undefined ? this.sequelize.options.timestamps : options.timestamps;
    options = Object.assign(options, _.omit(sourceModel.options, ['hooks', 'timestamps', 'scopes', 'defaultScope']));

    // the id is in the foreign table or in a connecting table
    const association = new BelongsToMany(sourceModel, targetModel, options);
    sourceModel.associations[association.associationAccessor] = association;

    association.injectAttributes();
    association.mixin(sourceModel.prototype);

    return association;
  },

  getAssociations(target) {
    return Object.values(this.associations).filter((association) => association.target.name === target.name);
  },

  getAssociationForAlias(target, alias) {
    // Two associations cannot have the same alias, so we can use find instead of filter
    return this.getAssociations(target).find((association) => this.verifyAssociationAlias(association, alias)) || null;
  },

  verifyAssociationAlias(association, alias) {
    if (alias) {
      return association.as === alias;
    } else {
      return !association.isAliased;
    }
  }
};

// The logic for hasOne and belongsTo is exactly the same
function singleLinked(Type) {
  return function (target, options) {
    // testhint options:none
    if (!target || !target.prototype || !(target.prototype instanceof this.sequelize.Model)) {
      throw new Error(
        this.name +
          '.' +
          Utils.lowercaseFirst(Type.toString()) +
          " called with something that's not a subclass of Sequelize.Model"
      );
    }

    const source = this;

    // Since this is a mixin, we'll need a unique letiable name for hooks (since Model will override our hooks option)
    options = options || {};
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    // the id is in the foreign table
    const association = new Type(source, target, Object.assign(options, source.options));
    source.associations[association.associationAccessor] = association;

    association.injectAttributes();
    association.mixin(source.prototype);

    return association;
  };
}

Mixin.hasOne = singleLinked(HasOne);

Mixin.belongsTo = singleLinked(BelongsTo);

export default Mixin;
