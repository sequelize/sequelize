<a name="mixin"></a>
# Mixin Mixin
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/associations/mixin.js#L95)
Creating assocations in sequelize is done by calling one of the belongsTo / hasOne / hasMany functions
on a model (the source), and prodiving another model as the first argument to the function (the target).

* hasOne - adds a foreign key to target
* belongsTo - add a foreign key to source
* hasMany - adds a foreign key to target, unless you also specifiy that target hasMany source, in which case a junction table is created with sourceId and targetId

Creating an association will add a foreign key constraint to the attributes. All associations use `CASCADE` on update and `SET NULL` on delete, except for n:m, which also uses `CASCADE` on delete.

When creating associations, you can provide an alias, via the `as` option. This is usefull if the same model
is associated twice, or you want your association to be called something other than the name of the target model.
As an example, consider the case where users have many pictures, one of which is their profile picture. All pictures
have a `userId`, but in addition the user model also has a `profilePictureId`, to be able to easily load the user's profile
picture.

```js
User.hasMany(Picture)
User.belongsTo(Picture, { as: 'ProfilePicture', constraints: false })

user.getPictures() // gets you all pictures
user.getProfilePicture() // gets you only the profile picture

User.findAll({
  where: ...,
  include: [
    { model: Picture }, // load all pictures
    { model: Picture, as: 'ProfilePicture' }, // load the profile picture. Notice that the spelling must be the exact same as the one in the association
  ]
})
```
To get full control over the foreign key column added by sequelize, you can use the `foreignKey` option. It can either be a string, that specifies the name, or and object type definition,
equivalent to those passed to `sequelize.define`.

```js
User.hasMany(Picture, { foreignKey: 'uid' })
```

The foreign key column in Picture will now be called `uid` instead of the default `userId`.

```js
User.hasMany(Picture, {
  foreignKey: {
    name: 'uid'
    allowNull: false
  }
})
```

This specifies that the `uid` column can not be null. In most cases this will already be covered by the foreign key costraints, which sequelize creates automatically,
but can be usefull in case where the foreign keys are disabled, e.g. due to circular references (see `constraints: false` below).

When fetching associated models, you can limit your query to only load some models. These queries are written in the same way as queries to `find`/`findAll`. To only get pictures in JPG, you can do:

```js
user.getPictures({
  where: {
    format: 'jpg'
  }
})
```

There are several ways to update and add new assoications. Continuing with our example of users and pictures:
```js
user.addPicture(p) // Add a single picture
user.setPictures([p1, p2]) // Associate user with ONLY these two picture, all other associations will be deleted
user.addPictures([p1, p2]) // Associate user with these two pictures, but don't touch any current associations
```

You don't have to pass in a complete object to the association functions, if your associated model has a single primary key:

```js
user.addPicture(req.query.pid) // Here pid is just an integer, representing the primary key of the picture
```

In the example above we have specified that a user belongs to his profile picture. Conceptually, this might not make sense,
but since we want to add the foreign key to the user model this is the way to do it.
Note how we also specified `constraints: false` for profile picture. This is because we add a foreign key from
user to picture (profilePictureId), and from picture to user (userId). If we were to add foreign keys to both, it would
create a cyclic dependency, and sequelize would not know which table to create first, since user depends on picture, and picture
depends on user. These kinds of problems are detected by sequelize before the models are synced to the database, and you will
get an error along the lines of `Error: Cyclic dependency found. 'users' is dependent of itself`. If you encounter this,
you should either disable some constraints, or rethink your associations completely.


***

<a name="hasone"></a>
## `hasOne(target, [options])`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/associations/mixin.js#L145)
Creates an association between this (the source) and the provided target. The foreign key is added on the target.

Example: `User.hasOne(Profile)`. This will add userId to the profile table.

The following methods are injected on the source:

* get[AS] - for example getProfile(finder). The finder object is passed to `target.find`.
* set[AS] - for example setProfile(instance, options). Options are passed to `target.save`
* create[AS] - for example createProfile(value, options). Builds and saves a new instance of the associated model. Values and options are passed on to `target.create`

All methods return a promise


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | Model |  |
| [options] | object |  |
| [options.hooks=false] | boolean | Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks |
| [options.as] | string | The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the singularized name of target |
| [options.foreignKey] | string &#124; object | The name of the foreign key in the target table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the colum. Defaults to the name of source + primary key of source |
| [options.onDelete='SET&nbsp;NULL'] | string |  |
| [options.onUpdate='CASCADE'] | string |  |
| [options.constraints=true] | boolean | Should on update and on delete constraints be enabled on the foreign key. |


***

<a name="belongsto"></a>
## `belongsTo(target, [options])`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/associations/mixin.js#L170)
Creates an association between this (the source) and the provided target. The foreign key is added on the source.

Example: `Profile.belongsTo(User)`. This will add userId to the profile table.

The following methods are injected on the source:

* get[AS] - for example getUser(finder). The finder object is passed to `target.find`.
* set[AS] - for example setUser(instance, options). Options are passed to this.save
* create[AS] - for example createUser(value, options). Builds and saves a new instance of the associated model. Values and options are passed on to target.create

All methods return a promise


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | Model |  |
| [options] | object |  |
| [options.hooks=false] | boolean | Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks |
| [options.as] | string | The alias of this model, in singular form. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the singularized name of target |
| [options.foreignKey] | string &#124; object | The name of the foreign key in the source table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the colum. Defaults to the name of target + primary key of target |
| [options.onDelete='SET&nbsp;NULL'] | string |  |
| [options.onUpdate='CASCADE'] | string |  |
| [options.constraints=true] | boolean | Should on update and on delete constraints be enabled on the foreign key. |


***

<a name="hasmany"></a>
## `hasMany(target, [options])`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/associations/mixin.js#L245)
Create an association that is either 1:m or n:m.

```js
// Create a 1:m association between user and project
User.hasMany(Project)
```
```js
// Create a n:m association between user and project
User.hasMany(Project)
Project.hasMany(User)
```
By default, the name of the join table will be source+target, so in this case projectsusers. This can be overridden by providing either a string or a Model as `through` in the options.

The following methods are injected on the source:

* get[AS] - for example getPictures(finder). The finder object is passed to `target.find`.
* set[AS] - for example setPictures(instances, defaultAttributes|options). Update the associations. All currently associated models that are not in instances will be removed.
* add[AS] - for example addPicture(instance, defaultAttributes|options). Add another associated object.
* add[AS] [plural] - for example addPictures([instance1, instance2], defaultAttributes|options). Add some more associated objects.
* create[AS] - for example createPicture(values, options). Build and save a new association.
* remove[AS] - for example removePicture(instance). Remove a single association.
* remove[AS] [plural] - for example removePictures(instance). Remove multiple association.
* has[AS] - for example hasPicture(instance). Is source associated to this target?
* has[AS] [plural] - for example hasPictures(instances). Is source associated to all these targets?

All methods return a promise

If you use a through model with custom attributes, these attributes can be set when adding / setting new associations in two ways. Consider users and projects from before
with a join table that stores whether the project has been started yet:
```js
var UserProjects = sequelize.define('userprojects', {
  started: Sequelize.BOOLEAN
})
User.hasMany(Project, { through: UserProjects })
Project.hasMany(User, { through: UserProjects })
```
```js
jan.addProject(homework, { started: false }) // The homework project is not started yet
jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner has been started
```

If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:

```js
p1.userprojects {
  started: true
}
user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
```

Similarily, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
```js
user.getProjects().success(function (projects) {
  var p1 = projects[0]
  p1.userprojects.started // Is this project started yet?
})
```


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | Model |  |
| [options] | object |  |
| [options.hooks=false] | boolean | Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks |
| [options.through] | Model &#124; string &#124; object | The name of the table that is used to join source and target in n:m associations. Can also be a sequelize model if you want to define the junction table yourself and add extra attributes to it. |
| [options.through.model] | Model | The model used to join both sides of the N:M association. |
| [options.through.scope] | object | A key/value set that will be used for association create and find defaults on the through model. (Remember to add the attributes to the through model) |
| [options.through.unique=true] | boolean | If true a unique key will be generated from the foreign keys used (might want to turn this off and create specific unique keys when using scopes) |
| [options.as] | string &#124; object | The alias of this model. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the pluralized name of target |
| [options.foreignKey] | string &#124; object | The name of the foreign key in the target table / join table or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the colum. Defaults to the name of source + primary key of source |
| [options.scope] | object | A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M) |
| [options.onDelete='SET&nbsp;NULL &#124; CASCADE'] | string | Cascade if this is a n:m, and set null if it is a 1:m |
| [options.onUpdate='CASCADE'] | string |  |
| [options.constraints=true] | boolean | Should on update and on delete constraints be enabled on the foreign key. |


***

<a name="belongstomany"></a>
## `belongsToMany(target, [options])`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/associations/mixin.js#L339)
Create an N:M association with a join table

```js
User.belongsToMany(Project)
Project.belongsToMany(User)
```
By default, the name of the join table will be source+target, so in this case projectsusers. This can be overridden by providing either a string or a Model as `through` in the options.

The following methods are injected on the source:

* get[AS] - for example getPictures(finder). The finder object is passed to `target.find`.
* set[AS] - for example setPictures(instances, defaultAttributes|options). Update the associations. All currently associated models that are not in instances will be removed.
* add[AS] - for example addPicture(instance, defaultAttributes|options). Add another associated object.
* add[AS] [plural] - for example addPictures([instance1, instance2], defaultAttributes|options). Add some more associated objects.
* create[AS] - for example createPicture(values, options). Build and save a new association.
* remove[AS] - for example removePicture(instance). Remove a single association.
* remove[AS] [plural] - for example removePictures(instance). Remove multiple association.
* has[AS] - for example hasPicture(instance). Is source associated to this target?
* has[AS] [plural] - for example hasPictures(instances). Is source associated to all these targets?

All methods return a promise

If you use a through model with custom attributes, these attributes can be set when adding / setting new associations in two ways. Consider users and projects from before
with a join table that stores whether the project has been started yet:
```js
var UserProjects = sequelize.define('userprojects', {
  started: Sequelize.BOOLEAN
})
User.belongsToMany(Project, { through: UserProjects })
Project.belongsToMany(User, { through: UserProjects })
```
```js
jan.addProject(homework, { started: false }) // The homework project is not started yet
jan.setProjects([makedinner, doshopping], { started: true}) // Both shopping and dinner has been started
```

If you want to set several target instances, but with different attributes you have to set the attributes on the instance, using a property with the name of the through model:

```js
p1.userprojects {
  started: true
}
user.setProjects([p1, p2], {started: false}) // The default value is false, but p1 overrides that.
```

Similarily, when fetching through a join table with custom attributes, these attributes will be available as an object with the name of the through model.
```js
user.getProjects().then(function (projects) {
  var p1 = projects[0]
  p1.userprojects.started // Is this project started yet?
})
```


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| target | Model |  |
| [options] | object |  |
| [options.hooks=false] | boolean | Set to true to run before-/afterDestroy hooks when an associated model is deleted because of a cascade. For example if `User.hasOne(Profile, {onDelete: 'cascade', hooks:true})`, the before-/afterDestroy hooks for profile will be called when a user is deleted. Otherwise the profile will be deleted without invoking any hooks |
| [options.through] | Model &#124; string &#124; object | The name of the table that is used to join source and target in n:m associations. Can also be a sequelize model if you want to define the junction table yourself and add extra attributes to it. |
| [options.through.model] | Model | The model used to join both sides of the N:M association. |
| [options.through.scope] | object | A key/value set that will be used for association create and find defaults on the through model. (Remember to add the attributes to the through model) |
| [options.through.unique=true] | boolean | If true a unique key will be generated from the foreign keys used (might want to turn this off and create specific unique keys when using scopes) |
| [options.as] | string &#124; object | The alias of this association. If you provide a string, it should be plural, and will be singularized using node.inflection. If you want to control the singular version yourself, provide an object with `plural` and `singular` keys. See also the `name` option passed to `sequelize.define`. If you create multiple associations between the same tables, you should provide an alias to be able to distinguish between them. If you provide an alias when creating the assocition, you should provide the same alias when eager loading and when getting assocated models. Defaults to the pluralized name of target |
| [options.foreignKey] | string &#124; object | The name of the foreign key in the join table (representing the source model) or an object representing the type definition for the foreign column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the colum. Defaults to the name of source + primary key of source |
| [options.otherKey] | string &#124; object | The name of the foreign key in the join table (representing the target model) or an object representing the type definition for the other column (see `Sequelize.define` for syntax). When using an object, you can add a `name` property to set the name of the colum. Defaults to the name of target + primary key of target |
| [options.scope] | object | A key/value set that will be used for association create and find defaults on the target. (sqlite not supported for N:M) |
| [options.onDelete='SET&nbsp;NULL &#124; CASCADE'] | string | Cascade if this is a n:m, and set null if it is a 1:m |
| [options.onUpdate='CASCADE'] | string |  |
| [options.constraints=true] | boolean | Should on update and on delete constraints be enabled on the foreign key. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_