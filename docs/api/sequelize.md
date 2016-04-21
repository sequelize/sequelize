<a name="sequelize"></a>
# Class Sequelize
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L31)

This is the main class, the entry point to sequelize. To use it, you just need to import sequelize:

```js
var Sequelize = require('sequelize');
```

In addition to sequelize, the connection library for the dialect you want to use should also be installed in your project. You don't need to import it however, as sequelize will take care of that.

***

<a name="sequelize"></a>
## `new Sequelize(database, [username=null], [password=null], [options={}])`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L91)

Instantiate sequelize with name of database, username and password

#### Example usage

```javascript
// without password and options
var sequelize = new Sequelize('database', 'username')

// without options
var sequelize = new Sequelize('database', 'username', 'password')

// without password / with blank password
var sequelize = new Sequelize('database', 'username', null, {})

// with password and options
var sequelize = new Sequelize('my_database', 'john', 'doe', {})

// with uri (see below)
var sequelize = new Sequelize('mysql://localhost:3306/database', {})
```

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| database | String | The name of the database |
| [username=null] | String | The username which is used to authenticate against the database. |
| [password=null] | String | The password which is used to authenticate against the database. |
| [options={}] | Object | An object with options. |
| [options.dialect='mysql'] | String | The dialect of the database you are connecting to. One of mysql, postgres, sqlite, mariadb and mssql. |
| [options.dialectModulePath=null] | String | If specified, load the dialect library from this path. For example, if you want to use pg.js instead of pg when connecting to a pg database, you should specify 'pg.js' here |
| [options.dialectOptions] | Object | An object of additional options, which are passed directly to the connection library |
| [options.storage] | String | Only used by sqlite. Defaults to ':memory:' |
| [options.host='localhost'] | String | The host of the relational database. |
| [options.port=] | Integer | The port of the relational database. |
| [options.protocol='tcp'] | String | The protocol of the relational database. |
| [options.define={}] | Object | Default options for model definitions. See sequelize.define for options |
| [options.query={}] | Object | Default options for sequelize.query |
| [options.set={}] | Object | Default options for sequelize.set |
| [options.sync={}] | Object | Default options for sequelize.sync |
| [options.timezone='+00:00'] | String | The timezone used when converting a date from the database into a JavaScript date. The timezone is also used to SET TIMEZONE when connecting to the server, to ensure that the result of NOW, CURRENT_TIMESTAMP and other time related functions have in the right timezone. For best cross platform performance use the format +/-HH:MM. Will also accept string versions of timezones used by moment.js (e.g. 'America/Los_Angeles'); this is useful to capture daylight savings time changes. |
| [options.logging=console.log] | Function | A function that gets executed every time Sequelize would log something. |
| [options.omitNull=false] | Boolean | A flag that defines if null values should be passed to SQL queries or not. |
| [options.native=false] | Boolean | A flag that defines if native library shall be used or not. Currently only has an effect for postgres |
| [options.replication=false] | Boolean | Use read / write replication. To enable replication, pass an object, with two properties, read and write. Write should be an object (a single server for handling writes), and read an array of object (several servers to handle reads). Each read/write server can have the following properties: `host`, `port`, `username`, `password`, `database` |
| [options.pool={}] | Object | Should sequelize use a connection pool. Default is true |
| [options.pool.maxConnections] | Integer |  |
| [options.pool.minConnections] | Integer |  |
| [options.pool.maxIdleTime] | Integer | The maximum time, in milliseconds, that a connection can be idle before being released |
| [options.pool.validateConnection] | Function | A function that validates a connection. Called with client. The default function checks that client is an object, and that its state is not disconnected |
| [options.quoteIdentifiers=true] | Boolean | Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them. |
| [options.transactionType='DEFERRED'] | String | Set the default transaction type. See `Sequelize.Transaction.TYPES` for possible options. Sqlite only. |
| [options.isolationLevel='REPEATABLE_READ'] | String | Set the default transaction isolation level. See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options. |
| [options.retry] | Object | Set of flags that control when a query is automatically retried. |
| [options.retry.match] | Array | Only retry a query if the error matches one of these strings. |
| [options.retry.max] | Integer | How many times a failing query is automatically retried. Set to 0 to disable retrying on SQL_BUSY error. |
| [options.typeValidation=false] | Boolean | Run built in type validators on insert and update, e.g. validate that arguments passed to integer fields are integer-like. |
| [options.benchmark=false] | Boolean | Print query execution time in milliseconds when logging SQL. |


***

<a name="sequelize"></a>
## `new Sequelize(uri, [options={}])`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L100)

Instantiate sequelize with an URI

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| uri | String | A full database URI |
| [options={}] | object | See above for possible options |


***

<a name="models"></a>
## `models`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L221)

Models are stored here under the name given to `sequelize.define`

***

<a name="version"></a>
## `version`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L245)

Sequelize version number.

***

<a name="sequelize"></a>
## `Sequelize`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L254)

A reference to Sequelize constructor from sequelize. Useful for accessing DataTypes, Errors etc.

**See:**

* [Sequelize](sequelize)


***

<a name="utils"></a>
## `Utils`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L260)

A reference to sequelize utilities. Most users will not need to use these utils directly. However, you might want to use `Sequelize.Utils._`, which is a reference to the lodash library, if you don't already have it imported in your project.

***

<a name="promise"></a>
## `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L266)

A handy reference to the bluebird Promise class

***

<a name="querytypes"></a>
## `QueryTypes`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L272)

Available query types for use with `sequelize.query`

***

<a name="validator"></a>
## `Validator`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L279)

Exposes the validator.js object, so you can extend it with custom validation functions. The validator is exposed both on the instance, and on the constructor.

**See:**




***

<a name="transaction"></a>
## `Transaction`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L299)

A reference to the sequelize transaction class. Use this to access isolationLevels and types when creating a transaction

**See:**

* [Transaction](transaction)
* [Sequelize#transaction](sequelize#transaction)


***

<a name="deferrable"></a>
## `Deferrable`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L307)

A reference to the deferrable collection. Use this to access the different deferrable options.

**See:**

* [Deferrable](deferrable)
* [Sequelize#transaction](sequelize#transaction)


***

<a name="instance"></a>
## `Instance`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L314)

A reference to the sequelize instance class.

**See:**

* [Instance](instance)


***

<a name="association"></a>
## `Association`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L321)

A reference to the sequelize association class.

**See:**

* [Association](association)


***

<a name="error"></a>
## `Error`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L334)

A general error class

**See:**

* [Errors#BaseError](errors#baseerror)


***

<a name="validationerror"></a>
## `ValidationError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L342)

Emitted when a validation fails

**See:**

* [Errors#ValidationError](errors#validationerror)


***

<a name="validationerroritem"></a>
## `ValidationErrorItem`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L350)

Describes a validation error on an instance path

**See:**

* [Errors#ValidationErrorItem](errors#validationerroritem)


***

<a name="databaseerror"></a>
## `DatabaseError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L357)

A base class for all database related errors.

**See:**

* [Errors#DatabaseError](errors#databaseerror)


***

<a name="timeouterror"></a>
## `TimeoutError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L364)

Thrown when a database query times out because of a deadlock

**See:**

* [Errors#TimeoutError](errors#timeouterror)


***

<a name="uniqueconstrainterror"></a>
## `UniqueConstraintError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L371)

Thrown when a unique constraint is violated in the database

**See:**

* [Errors#UniqueConstraintError](errors#uniqueconstrainterror)


***

<a name="exclusionconstrainterror"></a>
## `ExclusionConstraintError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L378)

Thrown when an exclusion constraint is violated in the database

**See:**

* [Errors#ExclusionConstraintError](errors#exclusionconstrainterror)


***

<a name="foreignkeyconstrainterror"></a>
## `ForeignKeyConstraintError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L385)

Thrown when a foreign key constraint is violated in the database

**See:**

* [Errors#ForeignKeyConstraintError](errors#foreignkeyconstrainterror)


***

<a name="connectionerror"></a>
## `ConnectionError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L392)

A base class for all connection related errors.

**See:**

* [Errors#ConnectionError](errors#connectionerror)


***

<a name="connectionrefusederror"></a>
## `ConnectionRefusedError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L399)

Thrown when a connection to a database is refused

**See:**

* [Errors#ConnectionRefusedError](errors#connectionrefusederror)


***

<a name="accessdeniederror"></a>
## `AccessDeniedError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L406)

Thrown when a connection to a database is refused due to insufficient access

**See:**

* [Errors#AccessDeniedError](errors#accessdeniederror)


***

<a name="hostnotfounderror"></a>
## `HostNotFoundError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L413)

Thrown when a connection to a database has a hostname that was not found

**See:**

* [Errors#HostNotFoundError](errors#hostnotfounderror)


***

<a name="hostnotreachableerror"></a>
## `HostNotReachableError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L420)

Thrown when a connection to a database has a hostname that was not reachable

**See:**

* [Errors#HostNotReachableError](errors#hostnotreachableerror)


***

<a name="invalidconnectionerror"></a>
## `InvalidConnectionError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L427)

Thrown when a connection to a database has invalid values for any of the connection parameters

**See:**

* [Errors#InvalidConnectionError](errors#invalidconnectionerror)


***

<a name="connectiontimedouterror"></a>
## `ConnectionTimedOutError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L434)

Thrown when a connection to a database times out

**See:**

* [Errors#ConnectionTimedOutError](errors#connectiontimedouterror)


***

<a name="instanceerror"></a>
## `InstanceError`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L441)

Thrown when a some problem occurred with Instance methods (see message for details)

**See:**

* [Errors#InstanceError](errors#instanceerror)


***

<a name="getdialect"></a>
## `getDialect()` -> `String`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L454)

Returns the specified dialect.
__Returns:__ The specified dialect.

***

<a name="getqueryinterface"></a>
## `getQueryInterface()` -> `QueryInterface`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L466)

Returns an instance of QueryInterface.

**See:**

* [QueryInterface](queryinterface)

__Returns:__ An instance (singleton) of QueryInterface.

***

<a name="define"></a>
## `define(modelName, attributes, [options])` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L569)

Define a new model, representing a table in the DB.

The table columns are define by the hash that is given as the second argument. Each attribute of the hash represents a column. A short table definition might look like this:

```js
sequelize.define('modelName', {
    columnA: {
        type: Sequelize.BOOLEAN,
        validate: {
          is: ["[a-z]",'i'],        // will only allow letters
          max: 23,                  // only allow values <= 23
          isIn: {
            args: [['en', 'zh']],
            msg: "Must be English or Chinese"
          }
        },
        field: 'column_a'
        // Other attributes here
    },
    columnB: Sequelize.STRING,
    columnC: 'MY VERY OWN COLUMN TYPE'
})

sequelize.models.modelName // The model will now be available in models under the name given to define
```


As shown above, column definitions can be either strings, a reference to one of the datatypes that are predefined on the Sequelize constructor, or an object that allows you to specify both the type of the column, and other attributes such as default values, foreign key constraints and custom setters and getters.

For a list of possible data types, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#data-types

For more about getters and setters, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#getters-setters

For more about instance and class methods, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#expansion-of-models

For more about validation, see http://docs.sequelizejs.com/en/latest/docs/models-definition/#validations

**See:**

* [DataTypes](datatypes)
* [Hooks](hooks)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| modelName | String | The name of the model. The model will be stored in `sequelize.models` under this name |
| attributes | Object | An object, where each attribute is a column of the table. Each column can be either a DataType, a string or a type-description object, with the properties described below: |
| attributes.column | String &#124; DataType &#124; Object | The description of a database column |
| attributes.column.type | String &#124; DataType | A string or a data type |
| [attributes.column.allowNull=true] | Boolean | If false, the column will have a NOT NULL constraint, and a not null validation will be run before an instance is saved. |
| [attributes.column.defaultValue=null] | Any | A literal default value, a JavaScript function, or an SQL function (see `sequelize.fn`) |
| [attributes.column.unique=false] | String &#124; Boolean | If true, the column will get a unique constraint. If a string is provided, the column will be part of a composite unique index. If multiple columns have the same string, they will be part of the same unique index |
| [attributes.column.primaryKey=false] | Boolean |  |
| [attributes.column.field=null] | String | If set, sequelize will map the attribute name to a different name in the database |
| [attributes.column.autoIncrement=false] | Boolean |  |
| [attributes.column.comment=null] | String |  |
| [attributes.column.references=null] | String &#124; Model | An object with reference configurations |
| [attributes.column.references.model] | String &#124; Model | If this column references another table, provide it here as a Model, or a string |
| [attributes.column.references.key='id'] | String | The column of the foreign table that this column references |
| [attributes.column.onUpdate] | String | What should happen when the referenced key is updated. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION |
| [attributes.column.onDelete] | String | What should happen when the referenced key is deleted. One of CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION |
| [attributes.column.get] | Function | Provide a custom getter for this column. Use `this.getDataValue(String)` to manipulate the underlying values. |
| [attributes.column.set] | Function | Provide a custom setter for this column. Use `this.setDataValue(String, Value)` to manipulate the underlying values. |
| [attributes.validate] | Object | An object of validations to execute for this column every time the model is saved. Can be either the name of a validation provided by validator.js, a validation function provided by extending validator.js (see the `DAOValidator` property for more details), or a custom validation function. Custom validation functions are called with the value of the field, and can possibly take a second callback argument, to signal that they are asynchronous. If the validator is sync, it should throw in the case of a failed validation, it it is async, the callback should be called with the error text. |
| [options] | Object | These options are merged with the default define options provided to the Sequelize constructor |
| [options.defaultScope={}] | Object | Define the default search scope to use for this model. Scopes have the same form as the options passed to find / findAll |
| [options.scopes] | Object | More scopes, defined in the same way as defaultScope above. See `Model.scope` for more information about how scopes are defined, and what you can do with them |
| [options.omitNull] | Boolean | Don't persist null values. This means that all columns with null values will not be saved |
| [options.timestamps=true] | Boolean | Adds createdAt and updatedAt timestamps to the model. |
| [options.paranoid=false] | Boolean | Calling `destroy` will not delete the model, but instead set a `deletedAt` timestamp if this is true. Needs `timestamps=true` to work |
| [options.underscored=false] | Boolean | Converts all camelCased columns to underscored if true |
| [options.underscoredAll=false] | Boolean | Converts camelCased model names to underscored table names if true |
| [options.freezeTableName=false] | Boolean | If freezeTableName is true, sequelize will not try to alter the DAO name to get the table name. Otherwise, the model name will be pluralized |
| [options.name] | Object | An object with two attributes, `singular` and `plural`, which are used when this model is associated to others. |
| [options.name.singular=inflection.singularize(modelName)] | String |  |
| [options.name.plural=inflection.pluralize(modelName)] | String |  |
| [options.indexes] | Array.&lt;Object&gt; |  |
| [options.indexes[].name] | String | The name of the index. Defaults to model name + _ + fields concatenated |
| [options.indexes[].type] | String | Index type. Only used by mysql. One of `UNIQUE`, `FULLTEXT` and `SPATIAL` |
| [options.indexes[].method] | String | The method to create the index by (`USING` statement in SQL). BTREE and HASH are supported by mysql and postgres, and postgres additionally supports GIST and GIN. |
| [options.indexes[].unique=false] | Boolean | Should the index by unique? Can also be triggered by setting type to `UNIQUE` |
| [options.indexes[].concurrently=false] | Boolean | PostgreSQL will build the index without taking any write locks. Postgres only |
| [options.indexes[].fields] | Array.&lt;String &#124; Object&gt; | An array of the fields to index. Each field can either be a string containing the name of the field, a sequelize object (e.g `sequelize.fn`), or an object with the following attributes: `attribute` (field name), `length` (create a prefix index of length chars), `order` (the direction the column should be sorted in), `collate` (the collation (sort order) for the column) |
| [options.createdAt] | String &#124; Boolean | Override the name of the createdAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting. |
| [options.updatedAt] | String &#124; Boolean | Override the name of the updatedAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting. |
| [options.deletedAt] | String &#124; Boolean | Override the name of the deletedAt column if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting. |
| [options.tableName] | String | Defaults to pluralized model name, unless freezeTableName is true, in which case it uses model name verbatim |
| [options.getterMethods] | Object | Provide getter functions that work like those defined per column. If you provide a getter method with the same name as a column, it will be used to access the value of that column. If you provide a name that does not match a column, this function will act as a virtual getter, that can fetch multiple other values |
| [options.setterMethods] | Object | Provide setter functions that work like those defined per column. If you provide a setter method with the same name as a column, it will be used to update the value of that column. If you provide a name that does not match a column, this function will act as a virtual setter, that can act on and set other values, but will not be persisted |
| [options.instanceMethods] | Object | Provide functions that are added to each instance (DAO). If you override methods provided by sequelize, you can access the original method using `this.constructor.super_.prototype`, e.g. `this.constructor.super_.prototype.toJSON.apply(this, arguments)` |
| [options.classMethods] | Object | Provide functions that are added to the model (Model). If you override methods provided by sequelize, you can access the original method using `this.constructor.prototype`, e.g. `this.constructor.prototype.find.apply(this, arguments)` |
| [options.schema='public'] | String |  |
| [options.engine] | String |  |
| [options.charset] | String |  |
| [options.comment] | String |  |
| [options.collate] | String |  |
| [options.initialAutoIncrement] | String | Set the initial AUTO_INCREMENT value for the table in MySQL. |
| [options.hooks] | Object | An object of hook function that are called before and after certain lifecycle events. The possible hooks are: beforeValidate, afterValidate, beforeBulkCreate, beforeBulkDestroy, beforeBulkUpdate, beforeCreate, beforeDestroy, beforeUpdate, afterCreate, afterDestroy, afterUpdate, afterBulkCreate, afterBulkDestory and afterBulkUpdate. See Hooks for more information about hook functions and their signatures. Each property can either be a function, or an array of functions. |
| [options.validate] | Object | An object of model wide validations. Validations have access to all model values via `this`. If the validator function takes an argument, it is assumed to be async, and is called with a callback that accepts an optional error. |


***

<a name="model"></a>
## `model(modelName)` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L615)

Fetch a Model which is already defined

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| modelName | String | The name of a model defined with Sequelize.define |


***

<a name="isdefined"></a>
## `isDefined(modelName)` -> `Boolean`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L629)

Checks whether a model with the given name is defined

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| modelName | String | The name of a model defined with Sequelize.define |


***

<a name="import"></a>
## `import(path)` -> `Model`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L643)

Imports a model defined in another file

Imported models are cached, so multiple calls to import with the same path will not load the file multiple times

See https://github.com/sequelize/express-example for a short example of how to define your models in separate files so that they can be imported by sequelize.import

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| path | String | The path to the file that holds the model you want to import. If the part is relative, it will be resolved relatively to the calling file |


***

<a name="query"></a>
## `query(sql, [options={}])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L708)

Execute a query on the DB, with the possibility to bypass all the sequelize goodness.

By default, the function will return two arguments: an array of results, and a metadata object, containing number of affected rows etc. Use `.spread` to access the results.

If you are running a type of query where you don't need the metadata, for example a `SELECT` query, you can pass in a query type to make sequelize format the results:

```js
sequelize.query('SELECT...').spread(function (results, metadata) {
  // Raw query - use spread
});

sequelize.query('SELECT...', { type: sequelize.QueryTypes.SELECT }).then(function (results) {
  // SELECT query - use then
})
```

**See:**

* [Model#build](model#build)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| sql | String |  |
| [options={}] | Object | Query options. |
| [options.raw] | Boolean | If true, sequelize will not try to format the results of the query, or build an instance of a model from the result |
| [options.transaction=null] | Transaction | The transaction that the query should be executed under |
| [options.type='RAW'] | String | The type of query you are executing. The query type affects how results are formatted before they are passed back. The type is a string, but `Sequelize.QueryTypes` is provided as convenience shortcuts. |
| [options.nest=false] | Boolean | If true, transforms objects with `.` separated property names into nested objects using [dottie.js](https://github.com/mickhansen/dottie.js). For example { 'user.username': 'john' } becomes { user: { username: 'john' }}. When `nest` is true, the query type is assumed to be `'SELECT'`, unless otherwise specified |
| [options.plain=false] | Boolean | Sets the query type to `SELECT` and return a single row |
| [options.replacements] | Object &#124; Array | Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?` in your SQL. |
| [options.bind] | Object &#124; Array | Either an object of named bind parameter in the format `$param` or an array of unnamed bind parameter to replace `$1, $2, ...` in your SQL. |
| [options.useMaster=false] | Boolean | Force the query to use the write pool, regardless of the query type. |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |
| [options.instance] | Instance | A sequelize instance used to build the return instance |
| [options.model] | Model | A sequelize model used to build the returned model instances (used to be called callee) |
| [options.retry] | Object | Set of flags that control when a query is automatically retried. |
| [options.retry.match] | Array | Only retry a query if the error matches one of these strings. |
| [options.retry.max] | Integer | How many times a failing query is automatically retried. |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |
| [options.supportsSearchPath] | Boolean | If false do not prepend the query with the search_path (Postgres only) |
| [options.mapToModel=false] | Object | Map returned fields to model's fields if `options.model` or `options.instance` is present. Mapping will occur before building the model instance. |
| [options.fieldMap] | Object | Map returned fields to arbitrary names for `SELECT` query type. |


***

<a name="set"></a>
## `set(variables, options)` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L841)

Execute a query which would set an environment or user variable. The variables are set per connection, so this function needs a transaction.
Only works for MySQL.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| variables | Object | Object with multiple variables. |
| options | Object | Query options. |
| options.transaction | Transaction | The transaction that the query should be executed under |


***

<a name="escape"></a>
## `escape(value)` -> `String`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L875)

Escape value.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| value | String |  |


***

<a name="createschema"></a>
## `createSchema(schema, options={})` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L891)

Create a new database schema.

Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
not a database table. In mysql and sqlite, this command will do nothing.

**See:**

* [Model#schema](model#schema)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | String | Name of the schema |
| options={} | Object |  |
| options.logging | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="showallschemas"></a>
## `showAllSchemas(options={})` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L904)

Show all defined schemas

Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
not a database table. In mysql and sqlite, this will show all tables.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options={} | Object |  |
| options.logging | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="dropschema"></a>
## `dropSchema(schema, options={})` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L918)

Drop a single schema

Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
not a database table. In mysql and sqlite, this drop a table matching the schema name

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| schema | String | Name of the schema |
| options={} | Object |  |
| options.logging | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="dropallschemas"></a>
## `dropAllSchemas(options={})` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L931)

Drop all schemas

Note,that this is a schema in the [postgres sense of the word](http://www.postgresql.org/docs/9.1/static/ddl-schemas.html),
not a database table. In mysql and sqlite, this is the equivalent of drop all tables.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options={} | Object |  |
| options.logging | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="sync"></a>
## `sync([options={}])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L947)

Sync all defined models to the DB.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.force=false] | Boolean | If force is true, each DAO will do DROP TABLE IF EXISTS ..., before it tries to create its own table |
| [options.match] | RegEx | Match a regex against the database name before syncing, a safety check for cases where force: true is used in tests but not live code |
| [options.logging=console.log] | Boolean &#124; function | A function that logs sql queries, or false for no logging |
| [options.schema='public'] | String | The schema that the tables should be created in. This can be overriden for each table in sequelize.define |
| [options.searchPath=DEFAULT] | String | An optional parameter to specify the schema search_path (Postgres only) |
| [options.hooks=true] | Boolean | If hooks is true then beforeSync, afterSync, beforBulkSync, afterBulkSync hooks will be called |


***

<a name="truncate"></a>
## `truncate([options])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1003)

Truncate all tables defined through the sequelize models. This is done
by calling Model.truncate() on each model.

**See:**

* [Model#truncate](model#truncate)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options] | object | The options passed to Model.destroy in addition to truncate |
| [options.transaction] | Boolean &#124; function |  |
| [options.logging] | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="drop"></a>
## `drop(options)` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1025)

Drop all tables defined through this sequelize instance. This is done by calling Model.drop on each model

**See:**

* [Model#drop](model#drop)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| options | object | The options passed to each call to Model.drop |
| options.logging | Boolean &#124; function | A function that logs sql queries, or false for no logging |


***

<a name="authenticate"></a>
## `authenticate()` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1047)

Test the connection by trying to authenticate
__Aliases:__ validate

***

<a name="fn"></a>
## `fn(fn, args)` -> `Sequelize.fn`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1080)

Creates a object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
If you want to refer to columns in your function, you should use `sequelize.col`, so that the columns are properly interpreted as columns and not a strings.

Convert a user's username to upper case
```js
instance.updateAttributes({
  username: self.sequelize.fn('upper', self.sequelize.col('username'))
})
```

**See:**

* [Model#find](model#find)
* [Model#findAll](model#findall)
* [Model#define](model#define)
* [Sequelize#col](sequelize#col)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| fn | String | The function you want to call |
| args | any | All further arguments will be passed as arguments to the function |


***

<a name="col"></a>
## `col(col)` -> `Sequelize.col`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1093)

Creates a object representing a column in the DB. This is often useful in conjunction with `sequelize.fn`, since raw string arguments to fn will be escaped.

**See:**

* [Sequelize#fn](sequelize#fn)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| col | String | The name of the column |


***

<a name="cast"></a>
## `cast(val, type)` -> `Sequelize.cast`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1107)

Creates a object representing a call to the cast function.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| val | any | The value to cast |
| type | String | The type to cast it to |


***

<a name="literal"></a>
## `literal(val)` -> `Sequelize.literal`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1120)

Creates a object representing a literal, i.e. something that will not be escaped.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| val | any |  |

__Aliases:__ asIs

***

<a name="and"></a>
## `and(args)` -> `Sequelize.and`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1133)

An AND query

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | String &#124; Object | Each argument will be joined by AND |


***

<a name="or"></a>
## `or(args)` -> `Sequelize.or`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1146)

An OR query

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| args | String &#124; Object | Each argument will be joined by OR |


***

<a name="json"></a>
## `json(conditions, [value])` -> `Sequelize.json`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1159)

Creates an object representing nested where conditions for postgres's json data-type.

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| conditions | String &#124; Object | A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres json syntax. |
| [value] | String &#124; Number &#124; Boolean | An optional value to compare against. Produces a string of the form "&lt;json path&gt; = '&lt;value&gt;'". |


***

<a name="where"></a>
## `where(attr, [comparator='='], logic)` -> `Sequelize.where`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1181)

A way of specifying attr = condition.

The attr can either be an object taken from `Model.rawAttributes` (for example `Model.rawAttributes.id` or `Model.rawAttributes.name`). The
attribute should be defined in your model definition. The attribute can also be an object from one of the sequelize utility functions (`sequelize.fn`, `sequelize.col` etc.)

For string attributes, use the regular `{ where: { attr: something }}` syntax. If you don't want your string to be escaped, use `sequelize.literal`.

**See:**

* [Model#find](model#find)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| attr | Object | The attribute, which can be either an attribute object from `Model.rawAttributes` or a sequelize object, for example an instance of `sequelize.fn`. For simple string attributes, use the POJO syntax |
| [comparator='='] | string |  |
| logic | String &#124; Object | The condition. Can be both a simply type, or a further condition (`$or`, `$and`, `.literal` etc.) |

__Aliases:__ condition

***

<a name="transaction"></a>
## `transaction([options={}])` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/3e5b8772ef75169685fc96024366bca9958fee63/lib/sequelize.js#L1235)

Start a transaction. When using transactions, you should pass the transaction in the options argument in order for the query to happen under that transaction

```js
sequelize.transaction().then(function (t) {
  return User.find(..., { transaction: t}).then(function (user) {
    return user.updateAttributes(..., { transaction: t});
  })
  .then(t.commit.bind(t))
  .catch(t.rollback.bind(t));
})
```

A syntax for automatically committing or rolling back based on the promise chain resolution is also supported:

```js
sequelize.transaction(function (t) { // Note that we use a callback rather than a promise.then()
  return User.find(..., { transaction: t}).then(function (user) {
    return user.updateAttributes(..., { transaction: t});
  });
}).then(function () {
  // Committed
}).catch(function (err) {
  // Rolled back
  console.error(err);
});
```

If you have [CLS](https://github.com/othiym23/node-continuation-local-storage) enabled, the transaction will automatically be passed to any query that runs within the callback.
To enable CLS, add it do your project, create a namespace and set it on the sequelize constructor:

```js
var cls = require('continuation-local-storage'),
    ns = cls.createNamespace('....');
var Sequelize = require('sequelize');
Sequelize.cls = ns;
```
Note, that CLS is enabled for all sequelize instances, and all instances will share the same namespace

**See:**

* [Transaction](transaction)


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| [options={}] | Object |  |
| [options.autocommit=true] | Boolean |  |
| [options.type='DEFERRED'] | String | See `Sequelize.Transaction.TYPES` for possible options. Sqlite only. |
| [options.isolationLevel='REPEATABLE_READ'] | String | See `Sequelize.Transaction.ISOLATION_LEVELS` for possible options |
| [options.logging=false] | Function | A function that gets executed while running the query to log the sql. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_