<a name="hasmany"></a>
# Mixin HasMany
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L17)

One-to-many association

In the API reference below, replace `Assocation(s)` with the actual name of your association, e.g. for `User.hasMany(Project)` the getter will be `user.getProjects()`.

***

<a name="getassociations"></a>
## `getAssociations([options])` -> `Promise.<Array.<Instance>>`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L104)

Get everything currently associated with this, using an optional where clause.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.where] | Object | An optional where clause to limit the associated models |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |
| [options.schema] | String | Apply a schema on the related model |


***

<a name="setassociations"></a>
## `setAssociations([newAssociations], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L114)

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
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L124)

Associate several instances with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociations] | Array.&lt;Instance &#124; String &#124; Number&gt; | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `target.update`. |
| [options.validate] | Object | Run validation for the join model |


***

<a name="addassociation"></a>
## `addAssociation([newAssociation], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L134)

Associate several instances with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [newAssociation] | Instance &#124; String &#124; Number | An array of instances or primary key of instances to associate with this. Pass `null` or `undefined` to remove all associations. |
| [options] | Object | Options passed to `target.update`. |
| [options.validate] | Object | Run validation for the join model |


***

<a name="createassociation"></a>
## `createAssociation([values], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L143)

Create a new instance of the associated model and associate it with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [values] | Object |  |
| [options] | Object | Options passed to `target.create`. |


***

<a name="removeassociation"></a>
## `removeAssociation([oldAssociated], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L152)

Un-associate the instance.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociated] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to `target.update` |


***

<a name="removeassociations"></a>
## `removeAssociations([oldAssociatedArray], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L161)

Un-associate several instances.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [oldAssociatedArray] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an array of instances or their primary keys |
| [options] | Object | Options passed to `through.destroy` |


***

<a name="hasassociation"></a>
## `hasAssociation([instance], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L170)

Check if an instance is associated with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instance] | Instace &#124; String &#124; Number | Can be an Instance or its primary key |
| [options] | Object | Options passed to getAssociations |


***

<a name="hasassociations"></a>
## `hasAssociations([instances], [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L179)

Check if all instances are associated with this.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [instances] | Array.&lt;Instace &#124; String &#124; Number&gt; | Can be an array of instances or their primary keys |
| [options] | Object | Options passed to getAssociations |


***

<a name="countassociations"></a>
## `countAssociations([options])` -> `Promise.<Int>`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/associations/has-many.js#L189)

Count everything currently associated with this, using an optional where clause.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.where] | Object | An optional where clause to limit the associated models |
| [options.scope] | String &#124; Boolean | Apply a scope on the related model, or remove its default scope by passing false |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_