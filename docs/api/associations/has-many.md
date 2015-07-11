<a name="hasmany"></a>
# Mixin HasMany
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L17)
One-to-many association

In the API reference below, replace `Assocation(s)` with the actual name of your association, e.g. for `User.belongsToMany(Project)` the getter will be `user.getProjects()`.


***

<a name="getassociations"></a>
## `getAssociations([options])` -> `Promise.<Array.<Instance>>`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L84)
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
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L94)
Set the associated models by passing an array of instances or their primary keys. Everything that it not in the passed array will be un-associated


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Array.&lt;Instance &#124; String &#124; Number&gt; | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `target.findAll` and `update`. |
| [options.validate] | Object | Run validation for the join model |


***

<a name="addassociations"></a>
## `addAssociations([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L104)
Associate several instances with this


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Array.&lt;Instance &#124; String &#124; Number&gt; | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `target.update`. |
| [options.validate] | Object | Run validation for the join model |


***

<a name="addassociation"></a>
## `addAssociation([newAssociation], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L114)
Associate several instances with this


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociation] | Instance &#124; String &#124; Number | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `target.update`. |
| [options.validate] | Object | Run validation for the join model |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L123)
Create a new instance of the associated model and associate it with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to `target.create`. |


***

<a name="removeassociation"></a>
## `removeAssociation([oldAssociated], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L132)
Un-associate the instance


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociated] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to `target.update` |


***

<a name="removeassociations"></a>
## `removeAssociations([oldAssociated], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L141)
Un-associate several instances


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociated] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an Instance or its primary key |
| [options] | Object | Options passed to `through.destroy` |


***

<a name="hasassociation"></a>
## `hasAssociation([instance], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L150)
Check if an instance is associated with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instance] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to getAssociations |


***

<a name="hasassociations"></a>
## `hasAssociations([instances], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/e1de2e37b2301ec55af21f17cf0ac3dbf5d60179/lib/associations/has-many.js#L159)
Check if all instances are associated with this.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instances] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an Instance or its primary key |
| [options] | Object | Options passed to getAssociations |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_