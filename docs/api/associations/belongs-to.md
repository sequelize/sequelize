<a name="belongsto"></a>
# Mixin BelongsTo
[View code](https://github.com/sequelize/sequelize/blob/f678009d7514b81a6f87e12b86360e9a597e3ca8/lib/associations/belongs-to.js#L17)
One-to-one association

In the API reference below, replace `Assocation(s)` with the actual name of your association, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.


***

<a name="getassociation"></a>
## `getAssociation([options])` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/f678009d7514b81a6f87e12b86360e9a597e3ca8/lib/associations/belongs-to.js#L81)
Get the associated instance


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |


***

<a name="setassociation"></a>
## `setAssociation([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/f678009d7514b81a6f87e12b86360e9a597e3ca8/lib/associations/belongs-to.js#L91)
Set the associated model


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Instance &#124; String &#124; Number | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `this.save` |
| [options.save=true] | Boolean | Skip saving this after setting the foreign key if false. |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/f678009d7514b81a6f87e12b86360e9a597e3ca8/lib/associations/belongs-to.js#L100)
Create a new instance of the associated model and associate it with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to `target.create` and setAssociation. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_