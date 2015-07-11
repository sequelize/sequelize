<a name="hasone"></a>
# Mixin HasOne
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-one.js#L16)
One-to-one association

In the API reference below, replace `Assocation(s)` with the actual name of your association, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.


***

<a name="getassociation"></a>
## `getAssociation([options])` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-one.js#L79)
Get the associated instance


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |


***

<a name="setassociation"></a>
## `setAssociation([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-one.js#L88)
Set the associated model


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Instance &#124; String &#124; Number | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to getAssocation and `target.save` |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-one.js#L97)
Create a new instance of the associated model and associate it with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to `target.create` and setAssociation. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_