var Utils     = require("./../utils")
  , HasOne    = require('./has-one')
  , HasMany   = require("./has-many")
  , BelongsTo = require("./belongs-to")

/** 
 * Creating assocations in sequelize is done by calling one of the belongsTo / hasOne / hasMany functions
 * on a model (the source), and prodiving another model as the first argument to the function (the target).
 * 
 * * hasOne - adds a foreign key to target
 * * belongsTo - add a foreign key to source
 * * hasMany - adds a foreign key to target, unless you also specifiy that target hasMany source, in which case a junction table is created with sourceId and targetId
 *
 * Creating an association will add a foreign key constraint to the attributes. All associations use `CASCADE` on update and `SET NULL` on delete, except for n:m, which also uses `CASCADE` on delete.
 *
 * When creating associations, you can provide an alias, via the `as` option. This is usefull if the same model
 * is associated twice, or you want your association to be called something other than the name of the target model.
 * As an example, consider the case where users have many pictures, one of which is their profile picture. All pictures
 * have a `userId`, but in addition the user model also has a `profilePictureId`, to be able to easily load the user's profile
 * picture.
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
 *
 * When getting associated models, you can limit your query to only load some models. These queries are written in the same way as queries to `find`/`findAll`. To only get pictures in JPG, you can do:
 *
 * ```js 
 * user.getPictures({
 *   where: {
 *     format: 'jpg'
 *   }
 * })
 * ```
 *
 * In the above we specify that a user belongs to his profile picture. Conceptually, this might not make sense,
 * but since we want to add the foreign key to the user model this is the way to do it.
 * Note how we also specified `constraints: false` for profile picture. This is because we add a foreign key from
 * user to picture (profilePictureId), and from picture to user (userId). If we were to add foreign keys to both, it would 
 * create a cyclic dependency, and sequelize would not know which table to create first, since user depends on picture, and picture
 * depends on user. These kinds of problems are detected by sequelize before the models are synced to the database, and you will
 * get an error along the lines of `Error: Cyclic dependency found. 'users' is dependent of itself`. If you encounter this,
 * you should either disable some constraints, or rethink your associations completely.
 *
 * @mixin Associations
 */
var Mixin = module.exports = function(){}

/**
 * Creates an association between this (the source) and the provided target. The foreign key is added on the target. 
 * 
 * Example: `User.hasOne(Profile)`. This will add userId to the profile table.
 *
 * The following methods are injected on the source:
 * 
 * * get[AS] - for example getProfile()
 * * set[AS] - for example setProfile(instance, options). Options are passed to `target.save`
 * * create[AS] - for example createProfile(value, options). Builds and saves a new instance of the associated model. Values and options are passed on to `target.create`
 *
 * All methods return an event emitter.
 * 
 * @param {DAOFactory} target
 * @param {object}     [options]
 * @param {boolean}           [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {string}     [options.as] The alias of this model. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the singularized version of target.name
 * @param {string}     [options.foreignKey] The name of the foreign key in the target table. Defaults to the name of source + primary key of source
 * @param {string}     [options.onDelete='SET&nbsp;NULL']
 * @param {string}     [options.onUpdate='CASCADE']
 * @param {boolean}    [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.hasOne = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  // the id is in the foreign table
  var association = new HasOne(this, associatedDAOFactory, Utils._.extend(options, this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype);
  association.injectSetter(this.DAO.prototype);
  association.injectCreator(this.DAO.prototype);

  return association
}

/**
 * Creates an association between this (the source) and the provided target. The foreign key is added on the source. 
 * 
 * Example: `Profile.belongsTo(User)`. This will add userId to the profile table.
 * 
 * The following methods are injected on the source:
 * 
 * * get[AS] - for example getUser()
 * * set[AS] - for example setUser(instance, options). Options are passed to this.save
 * * create[AS] - for example createUser(value, options). Builds and saves a new instance of the associated model. Values and options are passed on to target.create
 *
 * All methods return an event emitter.
 * 
 * @param {DAOFactory} target
 * @param {object}     [options]
 * @param {boolean}           [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {string}     [options.as] The alias of this model. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the singularized version of target.name
 * @param {string}     [options.foreignKey] The name of the foreign key in the source table. Defaults to the name of target + primary key of target
 * @param {string}     [options.onDelete='SET&nbsp;NULL']
 * @param {string}     [options.onUpdate='CASCADE']
 * @param {boolean}    [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.belongsTo = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  // the id is in this table
  var association = new BelongsTo(this, associatedDAOFactory, Utils._.extend(options, this.options))
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype)
  association.injectSetter(this.DAO.prototype)
  association.injectCreator(this.DAO.prototype)

  return association
}

/**
 * Create an association that is either 1:m or n:m. 
 *
 * ```js
 * // Create a 1:m association between user and project
 * User.hasMany(Project)
 * ```
 * ```js
 * // Create a n:m association between user and project
 * User.hasMany(Project)
 * Project.hasMany(User)
 * ```
 * By default, the name of the join table will be source+target, so in this case projectsusers. This can be overridden by providing either a string or a DAOFactory as `through` in the options.

 * The following methods are injected on the source:
 * 
 * * get[AS] - for example getPictures(). 
 * * set[AS] - for example setPictures(instances, defaultAttributes|options). Update the associations. All currently associated models that are not in instances will be removed.
 * * add[AS] - for example addPicture(instance, defaultAttributes|options). Add another association.
 * * create[AS] - for example createPicture(values, options). Build and save a new association. 
 * * remove[AS] - for example removePicture(instance). Remove a single association
 * * has[AS] - for example hasPicture(instance). Is source associated to this target?
 * * has[AS] [plural] - for example hasPictures(instances). Is source associated to all these targets? 
 *
 * All methods return an event emitter.
 *
 * If you use a through model with custom attributes, these attributes can be set when adding / setting new associations in two ways. Consider users and projects from before
 * with a join table that stores whether the project has been started yet:
 * ```js
 * var UserProjects = sequelize.define('userprojects', {
 *   started: Sequelize.BOOLEAN
 * })
 * User.hasMany(Project, { through: UserProjects })
 * Project.hasMany(User, { through: UserProjects })
 * ```
 * ```js
 * jan.addProject(homework, { started: false }) // The homework project is not started yet
 * jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner has been started
 * ```
 *
 * If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:
 *
 * ```js
 * p1.userprojects {
 *   started: true
 * }
 * user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
 * ```
 *
 * Similarily, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
 * ```js
 * user.getProjects().success(function (projects) {
 *   var p1 = projects[0]
 *   p1.userprojects.started // Is this project started yet?
 * })
 * ```
 * 
 * @param {DAOFactory}        target
 * @param {object}            [options]
 * @param {boolean}           [options.hooks=false] Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks
 * @param {DAOFactory|string} [options.through] The name of the table that is used to join source and target in n:m associations. Can also be a sequelize model if you want to define the junction table yourself and add extra attributes to it. 
 * @param {string}            [options.as] The alias of this model. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the singularized version of target.name
 * @param {string}            [options.foreignKey] The name of the foreign key in the source table. Defaults to the name of target + primary key of target
 * @param {string}            [options.onDelete='SET&nbsp;NULL|CASCADE'] Cascade if this is a n:m, and set null if it is a 1:m
 * @param {string}            [options.onUpdate='CASCADE']
 * @param {boolean}           [options.constraints=true] Should on update and on delete constraints be enabled on the foreign key.
 */
Mixin.hasMany = function(associatedDAOFactory, options) {
  // Since this is a mixin, we'll need a unique variable name for hooks (since DAOFactory will override our hooks option)
  options = options || {}
  options.hooks = options.hooks === undefined ? false : Boolean(options.hooks)
  options.useHooks = options.hooks

  options = Utils._.extend(options, Utils._.omit(this.options, ['hooks']))

  // the id is in the foreign table or in a connecting table
  var association = new HasMany(this, associatedDAOFactory, options)
  this.associations[association.associationAccessor] = association.injectAttributes()

  association.injectGetter(this.DAO.prototype)
  association.injectSetter(this.DAO.prototype)
  association.injectCreator(this.DAO.prototype)

  return association
}

Mixin.getAssociation = function(target, alias) {
  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (association.target === target && (alias === undefined ? !association.isAliased : association.as === alias)) {
        return association
      }
    }
  }

  return null
}

Mixin.getAssociationByAlias = function(alias) {
  for (var associationName in this.associations) {
    if (this.associations.hasOwnProperty(associationName)) {
      var association = this.associations[associationName]

      if (association.as === alias) {
        return association
      }
    }
  }

  return null
}

/* example for instance methods:
  Mixin.prototype.test = function() {
    console.log('asd')
  }
*/
