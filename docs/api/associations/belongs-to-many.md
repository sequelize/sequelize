<a name="belongstomany"></a>
# Mixin BelongsToMany
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L39)
Many-to-many association with a join table.

When the join table has additional attributes, these can be passed in the options object:

```js
UserProject = sequelize.define('user_project', {
  role: Sequelize.STRING
});
User.belongsToMany(Project, { through: UserProject });

user.addProject(project, { role: 'manager', transaction: t });
```

All methods allow you to pass either a persisted instance, its primary key, or a mixture:

```js
Project.create({ id: 11 }).then(function (project) {
  user.addProjects([project, 12]);
});
```

In the API reference below, replace `Assocation(s)` with the actual name of your association, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.


***

<a name="getassociations"></a>
## `getAssociations([options])` -> `Promise.<Array.<Instance>>`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L206)
Get everything currently associated with this, using an optional where clause


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.where] | Object | An optional where clause to limit the associated models |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |


***

<a name="setassociations"></a>
## `setAssociations([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L216)
Set the associated models by passing an array of instances or their primary keys. Everything that it not in the passed array will be un-associated


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Array.&lt;Instance &#124; String &#124; Number&gt; | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `through.findAll`, `bulkCreate`, `update` and `destroy`. Can also hold additional attributes for the join table |
| [options.validate] | Object | Run validation for the join model |


***

<a name="addassociations"></a>
## `addAssociations([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L226)
Associate several instances with this


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Array.&lt;Instance &#124; String &#124; Number&gt; | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `through.findAll`, `bulkCreate`, and `update` `destroy`. Can also hold additional attributes for the join table |
| [options.validate] | Object | Run validation for the join model |


***

<a name="addassociation"></a>
## `addAssociation([newAssociation], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L236)
Associate several instances with this


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociation] | Instance &#124; String &#124; Number | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `through.findAll`, `bulkCreate` and `update`. Can also hold additional attributes for the join table |
| [options.validate] | Object | Run validation for the join model |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L245)
Create a new instance of the associated model and associate it with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to create and add. Can also hold additional attributes for the join table |


***

<a name="removeassociation"></a>
## `removeAssociation([oldAssociated], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L254)
Un-associate the instance


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociated] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to `through.destroy` |


***

<a name="removeassociations"></a>
## `removeAssociations([oldAssociated], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L263)
Un-associate several instances


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociated] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an Instance or its primary key |
| [options] | Object | Options passed to `through.destroy` |


***

<a name="hasassociation"></a>
## `hasAssociation([instance], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L272)
Check if an instance is associated with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instance] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to getAssociations |


***

<a name="hasassociations"></a>
## `hasAssociations([instances], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L281)
Check if all instances are associated with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instances] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an Instance or its primary key |
| [options] | Object | Options passed to getAssociations |


***

<a name="countassociations"></a>
## `countAssociations([options])` -> `Promise.<Int>`
[View code](https://github.com/sequelize/sequelize/blob/95f8fc2783814cd61ec1a8d623b23cd6a7cd5e17/lib/associations/belongs-to-many.js#L291)
Count everything currently associated with this, using an optional where clause


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.where] | Object | An optional where clause to limit the associated models |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_