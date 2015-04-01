<a name="instance"></a>
# Class Instance
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L42)
This class represents an single instance, a database row. You might see it referred to as both Instance and instance. You should not
instantiate the Instance class directly, instead you access it using the finder and creation methods on the model.

Instance instances operate with the concept of a `dataValues` property, which stores the actual values represented by the instance.
By default, the values from dataValues can also be accessed directly from the Instance, that is:
```js
instance.field
// is the same as
instance.get('field')
// is the same as
instance.getDataValue('field')
```
However, if getters and/or setters are defined for `field` they will be invoked, instead of returning the value from `dataValues`.
Accessing properties directly or using `get` is preferred for regular use, `getDataValue` should only be used for custom getters.


**See:**

* [Sequelize#define](api/sequelize#define)


***

<a name="isnewrecord"></a>
## `isNewRecord` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L54)
Returns true if this instance has not yet been persisted to the database

***

<a name="model"></a>
## `Model()` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L63)
Returns the Model the instance was created from.

**See:**

* [Model](api/model)


***

<a name="sequelize"></a>
## `sequelize()` -> `Sequelize`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L72)
A reference to the sequelize instance

**See:**

* [Sequelize](api/sequelize)


***

<a name="isdeleted"></a>
## `isDeleted()` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L85)
If timestamps and paranoid are enabled, returns whether the deletedAt timestamp of this instance is set. Otherwise, always returns false.

***

<a name="values"></a>
## `values()` -> `Object`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L98)
Get the values of this Instance. Proxies to `this.get`
**Deprecated** .values is deprecated. Please use .get() instead.

**See:**

* [Instance#get](api/instance#get)


***

<a name="isdirty"></a>
## `isDirty()` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L112)
A getter for `this.changed()`. Returns true if any keys have changed.


**See:**

* [Instance#changed](api/instance#changed)


***

<a name="primarykeyvalues"></a>
## `primaryKeyValues()` -> `Object`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L124)
Get the values of the primary keys of this instance.


***

<a name="getdatavalue"></a>
## `getDataValue(key)` -> `any`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L160)
Get the value of the underlying data value


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String |  |


***

<a name="setdatavalue"></a>
## `setDataValue(key, value)`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L170)
Update the underlying data value


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String |  |
| value | any |  |


***

<a name="get"></a>
## `get([key], [options])` -> `Object|any`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L184)
If no key is given, returns all values of the instance, also invoking virtual getters.

If key is given and a field or virtual getter is present for the key it will call that getter - else it will return the value for key.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [key] | String |  |
| [options] | Object |  |
| [options.plain=false] | Boolean | If set to true, included instances will be returned as plain objects |


***

<a name="set"></a>
## `set(key, value, [options])`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L263)
Set is used to update values on the instance (the sequelize representation of the instance that is, remember that nothing will be persisted before you actually call `save`).
In its most basic form `set` will update a value stored in the underlying `dataValues` object. However, if a custom setter function is defined for the key, that function
will be called instead. To bypass the setter, you can pass `raw: true` in the options object.

If set is called with an object, it will loop over the object, and call set recursively for each key, value pair. If you set raw to true, the underlying dataValues will either be
set directly to the object passed, or used to extend dataValues, if dataValues already contain values.

When set is called, the previous value of the field is stored, so that you can later see which fields changed (see `changed`).

Set can also be used to build instances for associations, if you have values for those. TODO - mick should probably write something here about how includes in set works - perhaps also even some tests?


**See:**

* [Model#find](api/model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String &#124; Object |  |
| value | any |  |
| [options] | Object |  |
| [options.raw=false] | Boolean | If set to true, field and virtual setters will be ignored |
| [options.reset=false] | Boolean | Clear all previously set data values |
| [options.include] | Object |  |

__Aliases:__ setAttributes

***

<a name="changed"></a>
## `changed([key])` -> `Boolean|Array`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L397)
If changed is called with a string it will return a boolean indicating whether the value of that key in `dataValues` is different from the value in `_previousDataValues`.

If changed is called without an argument, it will return an array of keys that have changed.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [key] | String |  |


***

<a name="previous"></a>
## `previous(key)` -> `any`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L416)
Returns the previous value for key from `_previousDataValues`.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String |  |


***

<a name="save"></a>
## `save([options])` -> `Promise<this|Errors.ValidationError>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L477)
Validate this instance, and if the validation passes, persist it to the database.

On success, the callback will be called with this instance. On validation error, the callback will be called with an instance of `Sequelize.ValidationError`.
This error will have a property for each of the fields for which validation failed, with the error message for that field.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.fields] | Object | An optional array of strings, representing database columns. If fields is provided, only those columns will be validated and saved. |
| [options.silent=false] | Boolean | If true, the updatedAt timestamp will not be updated. |
| [options.validate=true] | Boolean | If false, validations won't be run. |
| [options.transaction] | Transaction |  |


***

<a name="reload"></a>
## `reload([options])` -> `Promise<this>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L710)
Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
This is different from doing a `find(Instance.id)`, because that would create and return a new instance. With this method,
all references to the Instance are updated with the new data and no new objects are created.


**See:**

* [Model#find](api/model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | Options that are passed on to `Model.find` |


***

<a name="validate"></a>
## `validate([options])` -> `Promise<undefined|Errors.ValidationError>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L737)
Validate the attribute of this instance according to validation rules set in the model definition.

Emits null if and only if validation successful; otherwise an Error instance containing { field name : [error msgs] } entries.


**See:**

* [InstanceValidator](api/instancevalidator)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | Options that are passed to the validator |
| [options.skip] | Array | An array of strings. All properties that are in this array will not be validated |


***

<a name="update"></a>
## `update(updates, options)` -> `Promise<this>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L756)
This is the same as calling `set` and then calling `save`.


**See:**

* [Instance#set](api/instance#set)
* [Instance#save](api/instance#save)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| updates | Object | See `set` |
| options | Object | See `save`  |

__Aliases:__ updateAttributes

***

<a name="destroy"></a>
## `destroy([options={}])` -> `Promise<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L788)
Destroy the row corresponding to this instance. Depending on your setting for paranoid, the row will either be completely deleted, or have its deletedAt timestamp set to the current time.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.force=false] | Boolean | If set to true, paranoid models will actually be deleted |
| [options.transaction] | Transaction |  |


***

<a name="restore"></a>
## `restore([options={}])` -> `Promise<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L831)
Restore the row corresponding to this instance. Only available for paranoid models.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.transaction] | Transaction |  |


***

<a name="increment"></a>
## `increment(fields, [options])` -> `Promise<this>`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L879)
Increment the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The increment is done using a
```sql
SET column = column + X
```
query. To get the correct value after an increment into the Instance you should do a reload.

```js
instance.increment('number') // increment number by 1
instance.increment(['number', 'count'], { by: 2 }) // increment number and count by 2
instance.increment({ answer: 42, tries: 1}, { by: 2 }) // increment answer by 42, and tries by 1.
                                                       // `by` is ignored, since each column has its own value
```


**See:**

* [Instance#reload](api/instance#reload)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fields | String &#124; Array &#124; Object | If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given |
| [options] | Object |  |
| [options.by=1] | Integer | The number to increment by |
| [options.transaction] | Transaction |  |


***

<a name="decrement"></a>
## `decrement(fields, [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L966)
Decrement the value of one or more columns. This is done in the database, which means it does not use the values currently stored on the Instance. The decrement is done using a
```sql
SET column = column - X
```
query. To get the correct value after an decrement into the Instance you should do a reload.

```js
instance.decrement('number') // decrement number by 1
instance.decrement(['number', 'count'], { by: 2 }) // decrement number and count by 2
instance.decrement({ answer: 42, tries: 1}, { by: 2 }) // decrement answer by 42, and tries by 1.
                                                       // `by` is ignored, since each column has its own value
```


**See:**

* [Instance#reload](api/instance#reload)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fields | String &#124; Array &#124; Object | If a string is provided, that column is decremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is decremented by the value given |
| [options] | Object |  |
| [options.by=1] | Integer | The number to decrement by |
| [options.transaction] | Transaction |  |


***

<a name="equals"></a>
## `equals(other)` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L1000)
Check whether all values of this and `other` Instance are the same


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| other | Instance |  |


***

<a name="equalsoneof"></a>
## `equalsOneOf(others)` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L1020)
Check if this is eqaul to one of `others` by calling equals


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| others | Array |  |


***

<a name="tojson"></a>
## `toJSON()` -> `object`
[View code](https://github.com/sequelize/sequelize/blob/768c4400949da3d727bfb733b87c26d36707ab4e/lib/instance.js#L1038)
Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all values gotten from the DB, and apply all custom getters.


**See:**

* [Instance#get](api/instance#get)


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_