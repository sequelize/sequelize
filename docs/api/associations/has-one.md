<a name="hasone"></a>
# Mixin HasOne
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/associations/has-one.js#L17)

One-to-one association

In the API reference below, replace `Association` with the actual name of your association, e.g. for `User.hasOne(Project)` the getter will be `user.getProject()`.
This is almost the same as `belongsTo` with one exception. The foreign key will be defined on the target model.

***

<a name="getassociation"></a>
## `getAssociation([options])` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/associations/has-one.js#L78)

Get the associated instance.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |
| [options.schema] | String | Apply a schema on the related model |


***

<a name="setassociation"></a>
## `setAssociation([newAssociation], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/associations/has-one.js#L87)

Set the associated model.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociation] | Instance &#124; String &#124; Number | An instance or the primary key of an instance to associate with this. Pass `null` or `undefined` to remove the association. |
| [options] | Object | Options passed to getAssociation and `target.save` |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/associations/has-one.js#L96)

Create a new instance of the associated model and associate it with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to `target.create` and setAssociation. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_