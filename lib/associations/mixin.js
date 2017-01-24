'use strict';

var Utils = require('./../utils')
  , _ = require('lodash')
  , HasOne = require('./has-one')
  , HasMany = require('./has-many')
  , BelongsToMany = require('./belongs-to-many')
  , BelongsTo = require('./belongs-to');

/**
 * Creating associations in sequelize is done by calling one of the belongsTo / hasOne / hasMany / belongsToMany functions on a model (the source), and providing another model as the first argument to the function (the target).
 *
 * * hasOne - adds a foreign key to the target and singular association mixins to the source.
 * * belongsTo - add a foreign key and singular association mixins to the source.
 * * hasMany - adds a foreign key to target and plural association mixins to the source.
 * * belongsToMany - creates an N:M association with a join table and adds plural association mixins to the source. The junction table is created with sourceId and targetId.
 *
 * Creating an association will add a foreign key constraint to the attributes. All associations use `CASCADE` on update and `SET NULL` on delete, except for n:m, which also uses `CASCADE` on delete.
 *
 * When creating associations, you can provide an alias, via the `as` option. This is useful if the same model is associated twice, or you want your association to be called something other than the name of the target model.
 *
 * As an example, consider the case where users have many pictures, one of which is their profile picture. All pictures have a `userId`, but in addition the user model also has a `profilePictureId`, to be able to easily load the user's profile picture.
 *
 * ```js
 * User.hasMany(Picture)
 * User.belongsTo(Picture, { as: 'ProfilePicture', constraints: false })
 *
 * user.getPictures() // gets you all pictures
 * user.getProfilePicture() // gets you only the profile picture
 *
 * User.findAll({
 *   where: ...,
 *   include: [
 *     { model: Picture }, // load all pictures
 *     { model: Picture, as: 'ProfilePicture' }, // load the profile picture. Notice that the spelling must be the exact same as the one in the association
 *   ]
 * })
 * ```
 * To get full control over the foreign key column added by sequelize, you can use the `foreignKey` option. It can either be a string, that specifies the name, or and object type definition,
 * equivalent to those passed to `sequelize.define`.
 *
 * ```js
 * User.hasMany(Picture, { foreignKey: 'uid' })
 * ```
 *
 * The foreign key column in Picture will now be called `uid` instead of the default `userId`.
 *
 * ```js
 * User.hasMany(Picture, {
 *   foreignKey: {
 *     name: 'uid',
 *     allowNull: false
 *   }
 * })
 * ```
 *
 * This specifies that the `uid` column cannot be null. In most cases this will already be covered by the foreign key constraints, which sequelize creates automatically, but can be useful in case where the foreign keys are disabled, e.g. due to circular references (see `constraints: false` below).
 *
 * When fetching associated models, you can limit your query to only load some models. These queries are written in the same way as queries to `find`/`findAll`. To only get pictures in JPG, you can do:
 *
 * ```js
 * user.getPictures({
 *   where: {
 *     format: 'jpg'
 *   }
 * })
 * ```
 *
 * There are several ways to update and add new associations. Continuing with our example of users and pictures:
 * ```js
 * user.addPicture(p) // Add a single picture
 * user.setPictures([p1, p2]) // Associate user with ONLY these two picture, all other associations will be deleted
 * user.addPictures([p1, p2]) // Associate user with these two pictures, but don't touch any current associations
 * ```
 *
 * You don't have to pass in a complete object to the association functions, if your associated model has a single primary key:
 *
 * ```js
 * user.addPicture(req.query.pid) // Here pid is just an integer, representing the primary key of the picture
 * ```
 *
 * In the example above we have specified that a user belongs to his profile picture. Conceptually, this might not make sense, but since we want to add the foreign key to the user model this is the way to do it.
 *
 * Note how we also specified `constraints: false` for profile picture. This is because we add a foreign key from user to picture (profilePictureId), and from picture to user (userId). If we were to add foreign keys to both, it would create a cyclic dependency, and sequelize would not know which table to create first, since user depends on picture, and picture depends on user. These kinds of problems are detected by sequelize before the models are synced to the database, and you will get an error along the lines of `Error: Cyclic dependency found. 'users' is dependent of itself`. If you encounter this, you should either disable some constraints, or rethink your associations completely.
 *
 * @mixin Associations
 * @name Associations
 */
var Mixin = module.exports = function() {};

// The logic for hasOne and belongsTo is exactly the same
var singleLinked = function (Type) {
  return function(target, options) { // testhint options:none
    if (!(target instanceof this.sequelize.Model)) {
      throw new Error(this.name + '.' + Utils.lowercaseFirst(Type.toString()) + ' called with something that\'s not an instance of Sequelize.Model');
    }

    var source = this;

    // Since this is a mixin, we'll need a unique variable name for hooks (since Model will override our hooks option)
    options = options || {};
    options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
    options.useHooks = options.hooks;

    // the id is in the foreign table
    var association = new Type(source, target, _.extend(options, source.options));
    source.associations[association.associationAccessor] = association.injectAttributes();

    if (association.mixin) {
      association.mixin(source.Instance.prototype);
    } else {
      association.injectGetter(source.Instance.prototype);
      association.injectSetter(source.Instance.prototype);
      association.injectCreator(source.Instance.prototype);
    }

    return association;
  };
};
/**
 * Creates an association between this (the source) and the provided target. The foreign key is added on the target.
 *
 * Example: `User.hasOne(Profile)`. This will add userId to the profile table.
 *
 * @method hasOne
 * @param {Model}           target
 * @param {object}          [options]
 * @param {boolean}         [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {string}          [options.as] The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the singularized name of target
 * @param {string|object}   [options.foreignKey] The name of the foreign key in the target table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
 * @param {string}          [options.onDelete='SET&nbsp;NULL|CASCADE'] SET NULL if foreignKey allows nulls, CASCADE if otherwise
 * @param {string}          [options.onUpdate='CASCADE']
 * @param {boolean}         [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.hasOne = singleLinked(HasOne);

/**
 * Creates an association between this (the source) and the provided target. The foreign key is added on the source.
 *
 * Example: `Profile.belongsTo(User)`. This will add userId to the profile table.
 *
 * @method belongsTo
 * @param {Model}           target
 * @param {object}          [options]
 * @param {boolean}         [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {string}          [options.as] The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the singularized name of target
 * @param {string|object}   [options.foreignKey] The name of the foreign key in the source table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of target + primary key of target
 * @param {string}          [options.targetKey] The name of the field to use as the key for the association in the target table. Defaults to the primary key of the target table
 * @param {string}          [options.onDelete='SET&nbsp;NULL|NO&nbsp;ACTION'] SET NULL if foreignKey allows nulls, NO ACTION if otherwise
 * @param {string}          [options.onUpdate='CASCADE']
 * @param {boolean}         [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.belongsTo = singleLinked(BelongsTo);

/**
 * Creates a 1:m association between this (the source) and the provided target. The foreign key is added on the target.
 *
 * Example: `User.hasMany(Profile)`. This will add userId to the profile table.
 *
 * @param {Model}               target
 * @param {object}              [options]
 * @param {boolean}             [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {string|object}       [options.as] The alias of this model. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the pluralized name of target
 * @param {string|object}       [options.foreignKey] The name of the foreign key in the target table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
 * @param {string}              [options.sourceKey] The name of the field to use as the key for the association in the source table. Defaults to the primary key of the source table
 * @param {object}              [options.scope] A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M)
 * @param {string}              [options.onDelete='SET&nbsp;NULL|CASCADE'] SET NULL if foreignKey allows nulls, CASCADE if otherwise
 * @param {string}              [options.onUpdate='CASCADE']
 * @param {boolean}             [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.hasMany = function(target, options) { // testhint options:none
  if (!(target instanceof this.sequelize.Model)) {
    throw new Error(this.name + '.hasMany called with something that\'s not an instance of Sequelize.Model');
  }

  var source = this;

  // Since this is a mixin, we'll need a unique variable name for hooks (since Model will override our hooks option)
  options = options || {};
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
  options.useHooks = options.hooks;

  options = _.extend(options, _.omit(source.options, ['hooks']));

  // the id is in the foreign table or in a connecting table
  var association = new HasMany(source, target, options);
  source.associations[association.associationAccessor] = association;

  association.injectAttributes();
  association.mixin(source.Instance.prototype);

  return association;
};

/**
 * Create an N:M association with a join table.
 *
 * ```js
 * User.belongsToMany(Project, { through: 'UserProjects' })
 * Project.belongsToMany(User, { through: 'UserProjects' })
 * ```
 * Defining `through` is required. Sequelize would previously attempt to auto generate names but that would not always lead to the most logical setups.
 *
 * If you define a through model with custom attributes, these attributes can be set when adding / setting new associations in two ways. Consider users and projects from before with a join table that stores whether the project has been started yet:
 * ```js
 * var UserProjects = sequelize.define('UserProjects', {
 *   started: Sequelize.BOOLEAN
 * })
 * User.belongsToMany(Project, { through: UserProjects })
 * Project.belongsToMany(User, { through: UserProjects })
 * ```
 * ```js
 * jan.addProject(homework, { started: false }) // The homework project is not started yet
 * jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner has been started
 * ```
 *
 * If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:
 *
 * ```js
 * p1.UserProjects = {
 *   started: true
 * }
 * user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
 * ```
 *
 * Similarly, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
 * ```js
 * user.getProjects().then(function (projects) {
 *   var p1 = projects[0]
 *   p1.UserProjects.started // Is this project started yet?
 * })
 * ```
 *
 * @param {Model}               target
 * @param {object}              [options]
 * @param {boolean}             [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {Model|string|object} [options.through] The name of the table that is used to join source and target in n:m associations. Can also be a sequelize model if you want to define the junction table yourself and add extra attributes to it.
 * @param {Model}               [options.through.model] The model used to join both sides of the N:M association.
 * @param {object}              [options.through.scope] A key/value set that will be used for association create and find defaults on the through model. (Remember to add the attributes to the through model)
 * @param {boolean}             [options.through.unique=true] If true a unique key will be generated from the foreign keys used (might want to turn this off and create specific unique keys when using scopes)
 * @param {string|object}       [options.as] The alias of this association. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the association, you should provide the same alias when eager loading and when getting associated models. Defaults to the pluralized name of target
 * @param {string|object}       [options.foreignKey] The name of the foreign key in the join table (representing the source model) or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of source + primary key of source
 * @param {string|object}       [options.otherKey] The name of the foreign key in the join table (representing the target model) or an object representing the type definition for the other column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the column. Defaults to the name of target + primary key of target
 * @param {object}              [options.scope] A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M)
 * @param {boolean}             [options.timestamps=sequelize.options.timestamps] Should the join model have timestamps
 * @param {string}              [options.onDelete='SET&nbsp;NULL|CASCADE'] Cascade if this is a n:m, and set null if it is a 1:m
 * @param {string}              [options.onUpdate='CASCADE']
 * @param {boolean}             [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.belongsToMany = function(targetModel, options) { // testhint options:none
  if (!(targetModel instanceof this.sequelize.Model)) {
    throw new Error(this.name + '.belongsToMany called with something that\'s not an instance of Sequelize.Model');
  }

  var sourceModel = this;

  // Since this is a mixin, we'll need a unique variable name for hooks (since Model will override our hooks option)
  options = options || {};
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks);
  options.useHooks = options.hooks;
  options.timestamps = options.timestamps === undefined ? this.sequelize.options.timestamps : options.timestamps;
  options = _.extend(options, _.omit(sourceModel.options, ['hooks', 'timestamps', 'scopes', 'defaultScope']));

  // the id is in the foreign table or in a connecting table
  var association = new BelongsToMany(sourceModel, targetModel, options);
  sourceModel.associations[association.associationAccessor] = association.injectAttributes();

  association.injectGetter(sourceModel.Instance.prototype);
  association.injectSetter(sourceModel.Instance.prototype);
  association.injectCreator(sourceModel.Instance.prototype);

  return association;
};

Mixin.getAssociation = function(target, alias) {
  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName];

      if (association.target.name === target.name && (alias === undefined ? !association.isAliased : association.as === alias)) {
        return association;
      }
    }
  }

  return null;
};
