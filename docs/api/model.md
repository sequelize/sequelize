<a name="model"></a>
# Class Model
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L24)
A Model represents a table in the database. Sometimes you might also see it refererred to as model, or simply as factory.
This class should _not_ be instantiated directly, it is created using `sequelize.define`, and already created models can be loaded using `sequelize.import`

### Mixes:
* Hooks
* Associations

***

<a name="removeattribute"></a>
## `removeAttribute([attribute])`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L404)
Remove attribute from model definition

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [attribute] | String |  |


***

<a name="sync"></a>
## `sync()` -> `Promise.<this>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L414)
Sync this Model to the DB, that is create the table. Upon success, the callback will be called with the model instance (this)

**See:**

* [Sequelize#sync](api/sequelize#sync)


***

<a name="drop"></a>
## `drop([options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L451)
Drop the table represented by this Model

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.cascade=false] | Boolean | Also drop all objects depending on this table, such as views. Only works in postgres |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

<a name="schema"></a>
## `schema(schema, [options])` -> `hi`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L469)
Apply a schema to this model. For postgres, this will actually place the schema in front of the table name - `"schema"."tableName"`,
while the schema will be prepended to the table name for mysql and sqlite - `'schema.tablename'`.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | String | The name of the schema |
| [options] | Object |  |
| [options.schemaDelimiter='.'] | String | The character(s) that separates the schema name from the table name |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

<a name="gettablename"></a>
## `getTableName([options])` -> `String|Object`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L493)
Get the tablename of the model, taking schema into account. The method will return The name as a string if the model has no schema,
or an object with `tableName`, `schema` and `delimiter` properties.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | The hash of options from any query. You can use one model to access tables with matching schemas by overriding `getTableName` and using custom key/values to alter the name of the table. (eg. subscribers_1, subscribers_2) |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

<a name="unscoped"></a>
## `unscoped()` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L500)


***

<a name="scope"></a>
## `scope(options*)` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L550)
Apply a scope created in `define` to the model. First let's look at how to create scopes:
```js
var Model = sequelize.define('model', attributes, {
  defaultScope: {
    where: {
      username: 'dan'
    },
    limit: 12
  },
  scopes: {
    isALie: {
      where: {
        stuff: 'cake'
      }
    },
    complexFunction: function(email, accessLevel) {
      return {
        where: {
          email: {
            $like: email
          },
          accesss_level {
            $gte: accessLevel
          }
        }
      }
    }
  }
})
```
Now, since you defined a default scope, every time you do Model.find, the default scope is appended to your query. Here's a couple of examples:
```js
Model.findAll() // WHERE username = 'dan'
Model.findAll({ where: { age: { gt: 12 } } }) // WHERE age > 12 AND username = 'dan'
```

To invoke scope functions you can do:
```js
Model.scope({ method: ['complexFunction' 'dan@sequelize.com', 42]}).findAll()
// WHERE email like 'dan@sequelize.com%' AND access_level >= 42
```


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options* | Array &#124; Object &#124; String | The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes and scope functions with no arguments, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default. |

__Returns:__ A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.

***

<a name="findall"></a>
## `findAll([options])` -> `Promise.<Array.<Instance>>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L701)
Search for multiple instances.

__Simple search using AND and =__
```js
Model.findAll({
  where: {
    attr1: 42,
    attr2: 'cake'
  }
})
```
```sql
WHERE attr1 = 42 AND attr2 = 'cake'
```

__Using greater than, less than etc.__
```js

Model.findAll({
  where: {
    attr1: {
      gt: 50
    },
    attr2: {
      lte: 45
    },
    attr3: {
      in: [1,2,3]
    },
    attr4: {
      ne: 5
    }
  }
})
```
```sql
WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
```
Possible options are: `gt, gte, lt, lte, ne, between/.., nbetween/notbetween/!.., in, not, like, nlike/notlike`

__Queries using OR__
```js
Model.findAll({
  where: Sequelize.and(
    { name: 'a project' },
    Sequelize.or(
      { id: [1,2,3] },
      { id: { gt: 10 } }
    )
  )
})
```
```sql
WHERE name = 'a project' AND (id` IN (1,2,3) OR id > 10)
```

The success listener is called with an array of instances if the query succeeds.


**See:**

* [Sequelize#query](api/sequelize#query)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | A hash of options to describe the scope of the search |
| [options.where] | Object | A hash of attributes to describe your search. See above for examples. |
| [options.attributes] | Array.&lt;String&gt; | A list of the attributes that you want to select. To rename an attribute, you can pass an array, with two elements - the first is the name of the attribute in the DB (or some kind of expression such as `Sequelize.literal`, `Sequelize.fn` and so on), and the second is the name you want the attribute to have in the returned instance |
| [options.paranoid=true] | Boolean | If true, only non-deleted records will be returned. If false, both deleted and non-deleted records will be returned. Only applies if `options.paranoid` is true for the model. |
| [options.include] | Array.&lt;Object &#124; Model&gt; | A list of associations to eagerly load using a left join. Supported is either `{ include: [ Model1, Model2, ...]}` or `{ include: [{ model: Model1, as: 'Alias' }]}`. If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in the as attribute when eager loading Y). |
| [options.include[].model] | Model | The model you want to eagerly load |
| [options.include[].as] | String | The alias of the relation, in case the model you want to eagerly load is aliassed. For `hasOne` / `belongsTo`, this should be the singular name, and for `hasMany`, it should be the plural |
| [options.include[].association] | Association | The association you want to eagerly load. (This can be used instead of providing a model/as pair) |
| [options.include[].where] | Object | Where clauses to apply to the child models. Note that this converts the eager load to an inner join, unless you explicitly set `required: false` |
| [options.include[].attributes] | Array.&lt;String&gt; | A list of attributes to select from the child model |
| [options.include[].required] | Boolean | If true, converts to an inner join, which means that the parent model will only be loaded if it has any matching children. True if `include.where` is set, false otherwise. |
| [options.include[].through.where] | Object | Filter on the join model for belongsToMany relations |
| [options.include[].through.attributes] | Array | A list of attributes to select from the join model for belongsToMany relations |
| [options.include[].include] | Array.&lt;Object &#124; Model&gt; | Load further nested related models |
| [options.order] | String &#124; Array &#124; Sequelize.fn | Specifies an ordering. If a string is provided, it will be escaped. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not. |
| [options.limit] | Number |  |
| [options.offset] | Number |  |
| [options.transaction] | Transaction |  |
| [options.lock] | String &#124; Object | Lock the selected rows. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE. Postgres also supports transaction.LOCK.KEY_SHARE, transaction.LOCK.NO_KEY_UPDATE and specific model locks with joins. See [transaction.LOCK for an example](api/transaction#lock) |
| [options.raw] | Boolean | Return raw result. See sequelize.query for more information. |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.having] | Object |  |

__Aliases:__ all

***

<a name="findbyid"></a>
## `findById([options], ')` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L779)
Search for a single instance by its primary key. This applies LIMIT 1, so the listener will always be called with a single instance.


**See:**

* [Model#findAll](api/model#findall)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Number &#124; String &#124; Buffer | A hash of options to describe the scope of the search, or a number to search by id. |
| ' | Object | [options] |
| [options.transaction] | Transaction |  |

__Aliases:__ findByPrimary

***

<a name="findone"></a>
## `findOne([options])` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L813)
Search for a single instance. This applies LIMIT 1, so the listener will always be called with a single instance.


**See:**

* [Model#findAll](api/model#findall)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object | A hash of options to describe the scope of the search |
| [options.transaction] | Transaction |  |

__Aliases:__ find

***

<a name="aggregate"></a>
## `aggregate(field, aggregateFunction, [options])` -> `Promise.<options.dataType|object>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L842)
Run an aggregation method on the specified field


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| field | String | The field to aggregate over. Can be a field name or * |
| aggregateFunction | String | The function to use for aggregation, e.g. sum, max etc. |
| [options] | Object | Query options. See sequelize.query for full options |
| [options.where] | Object | A hash of search attributes. |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.dataType] | DataType &#124; String | The type of the result. If `field` is a field in this Model, the default will be the type of that field, otherwise defaults to float. |
| [options.distinct] | boolean | Applies DISTINCT to the field being aggregated over |
| [options.transaction] | Transaction |  |
| [options.plain] | boolean | When `true`, the first returned value of `aggregateFunction` is cast to `dataType` and returned. If additional attributes are specified, along with `group` clauses, set `plain` to `false` to return all values of all returned rows. Defaults to `true`  |

__Returns:__ Returns the aggregate result cast to `options.dataType`, unless `options.plain` is false, in which case the complete data result is returned.

***

<a name="count"></a>
## `count([options])` -> `Promise.<Integer>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L882)
Count the number of records matching the provided where clause.

If you provide an `include` option, the number of matching associations will be counted instead.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | Object |  |
| [options.where] | Object | A hash of search attributes. |
| [options.include] | Object | Include options. See `find` for details |
| [options.distinct] | boolean | Apply COUNT(DISTINCT(col)) |
| [options.attributes] | Object | Used in conjustion with `group` |
| [options.group] | Object | For creating complex counts. Will return multiple rows as needed. |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |


***

<a name="findandcount"></a>
## `findAndCount([findOptions])` -> `Promise.<Object>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L923)
Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very usefull for paging

```js
Model.findAndCountAll({
  where: ...,
  limit: 12,
  offset: 12
}).success(function (result) {
})
```
In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return the total number of rows that matched your query.


**See:**

* [Model#findAll](api/model#findall)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [findOptions] | Object | See findAll  |

__Aliases:__ findAndCountAll

***

<a name="max"></a>
## `max(field, [options])` -> `Promise.<Any>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L979)
Find the maximum value of field


**See:**

* [Model#aggregate](api/model#aggregate)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| field | String |  |
| [options] | Object | See aggregate |


***

<a name="min"></a>
## `min(field, [options])` -> `Promise.<Any>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L992)
Find the minimum value of field


**See:**

* [Model#aggregate](api/model#aggregate)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| field | String |  |
| [options] | Object | See aggregate |


***

<a name="sum"></a>
## `sum(field, [options])` -> `Promise.<Number>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1005)
Find the sum of field


**See:**

* [Model#aggregate](api/model#aggregate)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| field | String |  |
| [options] | Object | See aggregate |


***

<a name="build"></a>
## `build(values, [options])` -> `Instance`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1020)
Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| values | Object |  |
| [options] | Object |  |
| [options.raw=false] | Boolean | If set to true, values will ignore field and virtual setters. |
| [options.isNewRecord=true] | Boolean |  |
| [options.include] | Array | an array of include options - Used to build prefetched/included model instances. See `set`  |


***

<a name="create"></a>
## `create(values, [options])` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1088)
Builds a new model instance and calls save on it.


**See:**

* [Instance#build](api/instance#build)
* [Instance#save](api/instance#save)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| values | Object |  |
| [options] | Object |  |
| [options.raw=false] | Boolean | If set to true, values will ignore field and virtual setters. |
| [options.isNewRecord=true] | Boolean |  |
| [options.fields] | Array | If set, only columns matching those in fields will be saved |
| [options.include] | Array | an array of include options - Used to build prefetched/included model instances |
| [options.onDuplicate] | String |  |
| [options.transaction] | Transaction |  |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |


***

<a name="findorinitialize"></a>
## `findOrInitialize` -> `Promise.<Instance>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1113)
Find a row that matches the query, or build (but don't save) the row if none is found.
The successfull result of the promise will be (instance, initialized) - Make sure to use .spread()


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options | Object |  |
| options.where | Object | A hash of search attributes. |
| [options.defaults] | Object | Default values to use if building a new instance |
| [options.transaction] | Object | Transaction to run query under |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |

__Aliases:__ findOrBuild

***

<a name="findorcreate"></a>
## `findOrCreate(options)` -> `Promise.<Instance, created>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1155)
Find a row that matches the query, or build and save the row if none is found
The successfull result of the promise will be (instance, created) - Make sure to use .spread()

If no transaction is passed in the `options` object, a new transaction will be created internally, to prevent the race condition where a matching row is created by another connection after the find but before the insert call.
However, it is not always possible to handle this case in SQLite, specifically if one transaction inserts and another tries to select before the first one has comitted. In this case, an instance of sequelize.TimeoutError will be thrown instead.
If a transaction is created, a savepoint will be created instead, and any unique constraint violation will be handled internally.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options | Object |  |
| options.where | Object | where A hash of search attributes. |
| [options.defaults] | Object | Default values to use if creating a new instance |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |


***

<a name="upsert"></a>
## `upsert(values, [options])` -> `Promise.<created>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1244)
Insert or update a single row. An update will be executed if a row which matches the supplied values on either the primary key or a unique key is found. Note that the unique index must be defined in your sequelize model and not just in the table. Otherwise you may experience a unique constraint violation, because sequelize fails to identify the row that should be updated.

**Implementation details:**

* MySQL - Implemented as a single query `INSERT values ON DUPLICATE KEY UPDATE values`
* PostgreSQL - Implemented as a temporary function with exception handling: INSERT EXCEPTION WHEN unique_constraint UPDATE
* SQLite - Implemented as two queries `INSERT; UPDATE`. This means that the update is executed regardless of whether the row already existed or not

**Note** that SQLite returns undefined for created, no matter if the row was created or updated. This is because SQLite always runs INSERT OR IGNORE + UPDATE, in a single query, so there is no way to know whether the row was inserted or not.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| values | Object |  |
| [options] | Object |  |
| [options.validate=true] | Boolean | Run validations before the row is inserted |
| [options.fields=Object.keys(this.attributes)] | Array | The fields to insert / update. Defaults to all fields |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |

__Returns:__ Returns a boolean indicating whether the row was created or updated.
__Aliases:__ insertOrUpdate

***

<a name="bulkcreate"></a>
## `bulkCreate(records, [options])` -> `Promise.<Array.<Instance>>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1299)
Create and insert multiple instances in bulk.

The success handler is passed an array of instances, but please notice that these may not completely represent the state of the rows in the DB. This is because MySQL
and SQLite do not make it easy to obtain back automatically generated IDs and other default values in a way that can be mapped to multiple records.
To obtain Instances for the newly created values, you will need to query for them again.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| records | Array | List of objects (key/value pairs) to create instances from |
| [options] | Object |  |
| [options.fields] | Array | Fields to insert (defaults to all fields) |
| [options.validate=false] | Boolean | Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation |
| [options.hooks=true] | Boolean | Run before / after bulk create hooks? |
| [options.individualHooks=false] | Boolean | Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run if options.hooks is true. |
| [options.ignoreDuplicates=false] | Boolean | Ignore duplicate values for primary keys? (not supported by postgres) |
| [options.updateOnDuplicate] | Array | Fields to update if row key already exists (on duplicate key update)? (only supported by mysql & mariadb). By default, all fields are updated. |
| [options.transaction] | Transaction |  |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql.  |


***

<a name="destroy"></a>
## `destroy(options)` -> `Promise.<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1450)
Delete multiple instances, or set their deletedAt timestamp to the current time if `paranoid` is enabled.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options | Object |  |
| [options.where] | Object | Filter the destroy |
| [options.hooks=true] | Boolean | Run before / after bulk destroy hooks? |
| [options.individualHooks=false] | Boolean | If set to true, destroy will SELECT all records matching the where parameter and will execute before / after destroy hooks on each row |
| [options.limit] | Number | How many rows to delete |
| [options.force=false] | Boolean | Delete instead of setting deletedAt to current timestamp (only applicable if `paranoid` is enabled) |
| [options.truncate=false] | Boolean | If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored |
| [options.cascade=false] | Boolean | Only used in conjuction with TRUNCATE. Truncates all tables that have foreign-key references to the named table, or to any tables added to the group due to CASCADE. |
| [options.transaction] | Transaction |  |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

<a name="restore"></a>
## `restore(options)` -> `Promise.<undefined>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1527)
Restore multiple instances if `paranoid` is enabled.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options | Object |  |
| [options.where] | Object | Filter the restore |
| [options.hooks=true] | Boolean | Run before / after bulk restore hooks? |
| [options.individualHooks=false] | Boolean | If set to true, restore will find all records within the where parameter and will execute before / after bulkRestore hooks on each row |
| [options.limit] | Number | How many rows to undelete |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |


***

<a name="update"></a>
## `update(values, options)` -> `Promise.<Array.<affectedCount, affectedRows>>`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1600)
Update multiple instances that match the where options. The promise returns an array with one or two elements. The first element is always the number
of affected rows, while the second element is the actual affected rows (only supported in postgres with `options.returning` true.)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| values | Object |  |
| options | Object |  |
| options.where | Object | Options to describe the scope of the search. |
| [options.fields] | Array | Fields to update (defaults to all fields) |
| [options.validate=true] | Boolean | Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation |
| [options.hooks=true] | Boolean | Run before / after bulk update hooks? |
| [options.sideEffects=true] | Boolean | Whether or not to update the side effects of any virtual setters. |
| [options.individualHooks=false] | Boolean | Run before / after update hooks?. If true, this will execute a SELECT followed by individual UPDATEs. A select is needed, because the row data needs to be passed to the hooks |
| [options.returning=false] | Boolean | Return the affected rows (only for postgres) |
| [options.limit] | Number | How many rows to update (only for mysql and mariadb) |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.transaction] | Transaction |  |


***

<a name="describe"></a>
## `describe()` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/model.js#L1788)
Run a describe query on the table. The result will be return to the listener as a hash of attributes and their types.


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_