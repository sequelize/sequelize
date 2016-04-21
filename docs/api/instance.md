<a name="instance"></a>
# Class Instance
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L85)

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

* [Sequelize#define](sequelize#define)


***

<a name="isnewrecord"></a>
## `isNewRecord` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L98)

Returns true if this instance has not yet been persisted to the database

***

<a name="model"></a>
## `Model()` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L107)

Returns the Model the instance was created from.

**See:**

* [Model](model)


***

<a name="sequelize"></a>
## `sequelize()` -> `Sequelize`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L116)

A reference to the sequelize instance

**See:**

* [Sequelize](sequelize)


***

<a name="where"></a>
## `where()` -> `Object`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L126)

Get an object representing the query for this instance, use with `options.where`

***

<a name="getdatavalue"></a>
## `getDataValue(key)` -> `any`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L150)

Get the value of the underlying data value

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String |  |


***

<a name="setdatavalue"></a>
## `setDataValue(key, value)`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L160)

Update the underlying data value

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String |  |
| value | any |  |


***

<a name="get"></a>
## `get([key], [options])` -> `Object|any`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L179)

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
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L249)

Set is used to update values on the instance (the sequelize representation of the instance that is, remember that nothing will be persisted before you actually call `save`).
In its most basic form `set` will update a value stored in the underlying `dataValues` object. However, if a custom setter function is defined for the key, that function
will be called instead. To bypass the setter, you can pass `raw: true` in the options object.

If set is called with an object, it will loop over the object, and call set recursively for each key, value pair. If you set raw to true, the underlying dataValues will either be
set directly to the object passed, or used to extend dataValues, if dataValues already contain values.

When set is called, the previous value of the field is stored and sets a changed flag(see `changed`).

Set can also be used to build instances for associations, if you have values for those.
When using set with associations you need to make sure the property key matches the alias of the association
while also making sure that the proper include options have been set (from .build() or .find())

If called with a dot.separated key on a JSON/JSONB attribute it will set the value nested and flag the entire object as changed.

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| key | String &#124; Object |  |
| value | any |  |
| [options] | Object |  |
| [options.raw=false] | Boolean | If set to true, field and virtual setters will be ignored |
| [options.reset=false] | Boolean | Clear all previously set data values |

__Aliases:__ setAttributes

***

<a name="changed"></a>
## `changed([key])` -> `Boolean|Array`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L401)

If changed is called with a string it will return a boolean indicating whether the value of that key in `dataValues` is different from the value in `_previousDataValues`.

If changed is called without an argument, it will return an array of keys that have changed.

If changed is called without an argument and no keys have changed, it will return `false`.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [key] | String |  |


***

<a name="previous"></a>
## `previous([key])` -> `any|Array.<any>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L425)

Returns the previous value for key from `_previousDataValues`.

If called without a key, returns the previous values for all values which have changed

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [key] | String |  |


***

<a name="save"></a>
## `save([options])` -> `Promise.<this|Errors.ValidationError>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L493)

Validate this instance, and if the validation passes, persist it to the database. It will only save changed fields, and do nothing if no fields have changed.

On success, the callback will be called with this instance. On validation error, the callback will be called with an instance of `Sequelize.ValidationError`.
This error will have a property for each of the fields for which validation failed, with the error message for that field.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.fields] | Array.&lt;string&gt; | An optional array of strings, representing database columns. If fields is provided, only those columns will be validated and saved. |
| [options.silent=false] | Boolean | If true, the updatedAt timestamp will not be updated. |
| [options.validate=true] | Boolean | If false, validations won't be run. |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |


***

<a name="reload"></a>
## `reload([options])` -> `Promise.<this>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L740)

Refresh the current instance in-place, i.e. update the object with current data from the DB and return the same object.
This is different from doing a `find(Instance.id)`, because that would create and return a new instance. With this method,
all references to the Instance are updated with the new data and no new objects are created.

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | Options that are passed on to `Model.find` |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

<a name="validate"></a>
## `validate([options])` -> `Promise.<Errors.ValidationError|undefined>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L776)

Validate the attribute of this instance according to validation rules set in the model definition.

Emits null if and only if validation successful; otherwise an Error instance containing { field name : [error msgs] } entries.

**See:**

* [InstanceValidator](instancevalidator)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | Options that are passed to the validator |
| [options.skip] | Array | An array of strings. All properties that are in this array will not be validated |


***

<a name="update"></a>
## `update(updates, options)` -> `Promise.<this>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L796)

This is the same as calling `set` and then calling `save` but it only saves the
exact values passed to it, making it more atomic and safer.

**See:**

* [Instance#set](instance#set)
* [Instance#save](instance#save)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| updates | Object | See `set` |
| options | Object | See `save` |

__Aliases:__ updateAttributes

***

<a name="destroy"></a>
## `destroy([options={}])` -> `Promise.<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L835)

Destroy the row corresponding to this instance. Depending on your setting for paranoid, the row will either be completely deleted, or have its deletedAt timestamp set to the current time.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.force=false] | Boolean | If set to true, paranoid models will actually be deleted |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |


***

<a name="restore"></a>
## `restore([options={}])` -> `Promise.<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L882)

Restore the row corresponding to this instance. Only available for paranoid models.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |


***

<a name="increment"></a>
## `increment(fields, [options])` -> `Promise.<this>`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L934)

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

* [Instance#reload](instance#reload)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fields | String &#124; Array &#124; Object | If a string is provided, that column is incremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is incremented by the value given. |
| [options] | Object |  |
| [options.by=1] | Integer | The number to increment by |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |


***

<a name="decrement"></a>
## `decrement(fields, [options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L997)

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

* [Instance#reload](instance#reload)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fields | String &#124; Array &#124; Object | If a string is provided, that column is decremented by the value of `by` given in options. If an array is provided, the same is true for each column. If and object is provided, each column is decremented by the value given |
| [options] | Object |  |
| [options.by=1] | Integer | The number to decrement by |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |


***

<a name="equals"></a>
## `equals(other)` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L1019)

Check whether all values of this and `other` Instance are the same

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| other | Instance |  |


***

<a name="equalsoneof"></a>
## `equalsOneOf(others)` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L1043)

Check if this is equal to one of `others` by calling equals

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| others | Array |  |


***

<a name="tojson"></a>
## `toJSON()` -> `object`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/instance.js#L1061)

Convert the instance to a JSON representation. Proxies to calling `get` with no keys. This means get all values gotten from the DB, and apply all custom getters.

**See:**

* [Instance#get](instance#get)


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_