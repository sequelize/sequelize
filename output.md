

<a name="Sequelize" />

### Sequelize

The main class 

### Members:

* <a href="#Sequelize">Sequelize</a>
* <a href="#Sequelize">Sequelize</a>
* <a href="#Utils">Utils</a>
* <a href="#QueryTypes">QueryTypes</a>
* <a href="#connectorManager">connectorManager</a>
* <a href="#Transaction">Transaction</a>
* <a href="#getDialect">getDialect</a>
* <a href="#getQueryInterface">getQueryInterface</a>
* <a href="#getMigrator">getMigrator</a>
* <a href="#define">define</a>
* <a href="#model">model</a>
* <a href="#isDefined">isDefined</a>
* <a href="#import">import</a>
* <a href="#query">query</a>
* <a href="#query">query</a>
* <a href="#createSchema">createSchema</a>
* <a href="#showAllSchemas">showAllSchemas</a>
* <a href="#dropSchema">dropSchema</a>
* <a href="#dropAllSchemas">dropAllSchemas</a>
* <a href="#sync">sync</a>
* <a href="#authenticate">authenticate</a>
* <a href="#fn">fn</a>
* <a href="#col">col</a>
* <a href="#cast">cast</a>
* <a href="#literal">literal</a>
* <a href="#asIs">asIs</a>
* <a href="#and">and</a>
* <a href="#or">or</a>
* <a href="#transaction">transaction</a>

------

<a name="Sequelize" />

## new Sequelize(database, [username=null], [password=null], [options={}])

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

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>database</td>
<td>String</td>
<td>The name of the database</td>
</tr>

<tr>
<td>[username=null]</td>
<td>String</td>
<td>The username which is used to authenticate against the database.</td>
</tr>

<tr>
<td>[password=null]</td>
<td>String</td>
<td>The password which is used to authenticate against the database.</td>
</tr>

<tr>
<td>[options={}]</td>
<td>Object</td>
<td>An object with options.</td>
</tr>

<tr>
<td>[options.dialect='mysql']</td>
<td>String</td>
<td>The dialect of the relational database.</td>
</tr>

<tr>
<td>[options.dialectModulePath=null]</td>
<td>String</td>
<td>If specified, load the dialect library from this path.</td>
</tr>

<tr>
<td>[options.host='localhost']</td>
<td>String</td>
<td>The host of the relational database.</td>
</tr>

<tr>
<td>[options.port=]</td>
<td>Integer</td>
<td>The port of the relational database.</td>
</tr>

<tr>
<td>[options.protocol='tcp']</td>
<td>String</td>
<td>The protocol of the relational database.</td>
</tr>

<tr>
<td>[options.define={}]</td>
<td>Object</td>
<td>Options, which shall be default for every model definition. See sequelize#define for options</td>
</tr>

<tr>
<td>[options.query={}]</td>
<td>Object</td>
<td>I have absolutely no idea.</td>
</tr>

<tr>
<td>[options.sync={}]</td>
<td>Object</td>
<td>Options, which shall be default for every `sync` call.</td>
</tr>

<tr>
<td>[options.logging=console.log]</td>
<td>Function</td>
<td>A function that gets executed everytime Sequelize would log something.</td>
</tr>

<tr>
<td>[options.omitNull=false]</td>
<td>Boolean</td>
<td>A flag that defines if null values should be passed to SQL queries or not.</td>
</tr>

<tr>
<td>[options.queue=true]</td>
<td>Boolean</td>
<td>I have absolutely no idea.</td>
</tr>

<tr>
<td>[options.native=false]</td>
<td>Boolean</td>
<td>A flag that defines if native library shall be used or not.</td>
</tr>

<tr>
<td>[options.replication=false]</td>
<td>Boolean</td>
<td>I have absolutely no idea.</td>
</tr>

<tr>
<td>[options.pool={}]</td>
<td>Object</td>
<td>Something.</td>
</tr>

<tr>
<td>[options.quoteIdentifiers=true]</td>
<td>Boolean</td>
<td>Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.</td>
</tr>

</table>

------

<a name="Sequelize" />

## new Sequelize(uri, [options={}])

Instantiate sequlize with an URI

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>uri</td>
<td>String</td>
<td>A full database URI </td>
</tr>

<tr>
<td>[options={}]</td>
<td>object</td>
<td>See above for possible options</td>
</tr>

</table>

------

<a name="Utils" />

### Utils

A reference to Utils

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Utils">Utils</a>

------

<a name="QueryTypes" />

### QueryTypes

An object of different query types. This is used when doing raw queries (sequlize.query). If no type is provided to .query, sequelize will try to guess the correct type based on your SQL. This might not always work if you query is formatted in a special way

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-QueryTypes">QueryTypes</a>

------

<a name="connectorManager" />

### connectorManager

Direct access to the sequelize connectorManager

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-ConnectorManager">ConnectorManager</a>

------

<a name="Transaction" />

### Transaction

A reference to transaction. Use this to access isolationLevels when creating a transaction

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Transaction">Transaction</a>

------

<a name="getDialect" />

### getDialect()

Returns the specified dialect.

#### Return:

* **String** The specified dialect.

------

<a name="getQueryInterface" />

### getQueryInterface()

Returns an instance of QueryInterface.

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-QueryInterface">QueryInterface</a>

#### Return:

* **QueryInterface** An instance (singleton) of QueryInterface.

------

<a name="getMigrator" />

### getMigrator([options={}], [force=false])

Returns an instance (singleton) of Migrator.

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options={}]</td>
<td>Object</td>
<td>Some options</td>
</tr>

<tr>
<td>[force=false]</td>
<td>Boolean</td>
<td>A flag that defines if the migrator should get instantiated or not.</td>
</tr>

</table>

#### Return:

* **Migrator** An instance of Migrator.

------

<a name="define" />

### define(daoName, attributes, [options])

Define a new model, representing a table in the DB.

The table columns are define by the hash that is given as the second argument. Each attribute of the hash represents a column. A short table definition might look like this:

```js
sequelize.define(..., {
    columnA: {
        type: Sequelize.BOOLEAN,
        // Other attributes here
    },
    columnB: Sequelize.STRING,
    columnC: 'MY VERY OWN COLUMN TYPE'
})
``` 

For a list of possible data types, see http://sequelizejs.com/docs/latest/models#data-types

For more about getters and setters, see http://sequelizejs.com/docs/latest/models#getters---setters

For more about instance and class methods see http://sequelizejs.com/docs/latest/models#expansion-of-models

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DataTypes">DataTypes</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>daoName</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>attributes</td>
<td>Object</td>
<td>An object, where each attribute is a column of the table. Each column can be either a DataType, a string or a type-description object, with the properties described below:</td>
</tr>

<tr>
<td>attributes.column</td>
<td>String|DataType|Object</td>
<td>The description of a database column</td>
</tr>

<tr>
<td>attributes.column.type</td>
<td>String|DataType</td>
<td>A string or a data type</td>
</tr>

<tr>
<td>[attributes.column.allowNull=true]</td>
<td>Boolean</td>
<td>If false, the column will have a NOT NULL constraint</td>
</tr>

<tr>
<td>[attributes.column.defaultValue=null]</td>
<td>Boolean</td>
<td>A literal default value, or a function, see sequelize#fn</td>
</tr>

<tr>
<td>[attributes.column.unique=false]</td>
<td>String|Boolean</td>
<td>If true, the column will get a unique constraint. If a string is provided, the column will be part of a composite unique index. If multiple columns have the same string, they will be part of the same unique index</td>
</tr>

<tr>
<td>[attributes.column.primaryKey=false]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[attributes.column.autoIncrement=false]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[attributes.column.comment=null]</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[attributes.column.references]</td>
<td>String|DAOFactory</td>
<td>If this column references another table, provide it here as a DAOFactory, or a string</td>
</tr>

<tr>
<td>[attributes.column.referencesKey='id']</td>
<td>String</td>
<td>The column of the foreign table that this column references</td>
</tr>

<tr>
<td>[attributes.column.onUpdate]</td>
<td>String</td>
<td>What should happen when the referenced key is updated. One of CASCADE, RESTRICT or NO ACTION</td>
</tr>

<tr>
<td>[attributes.column.onDelete]</td>
<td>String</td>
<td>What should happen when the referenced key is deleted. One of CASCADE, RESTRICT or NO ACTION</td>
</tr>

<tr>
<td>[attributes.column.get]</td>
<td>Function</td>
<td>Provide a custom getter for this column. Use this.getDataValue(String) and this.setDataValue(String, Value) to manipulate the underlying values.</td>
</tr>

<tr>
<td>[attributes.column.set]</td>
<td>Function</td>
<td>Provide a custom setter for this column. Use this.getDataValue(String) and this.setDataValue(String, Value) to manipulate the underlying values.</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td>These options are merged with the options provided to the Sequelize constructor</td>
</tr>

<tr>
<td>[options.omitNull]</td>
<td>Boolean</td>
<td>Don't persits null values. This means that all columns with null values will not be saved</td>
</tr>

<tr>
<td>[options.timestamps=true]</td>
<td>Boolean</td>
<td>Handle createdAt and updatedAt timestamps</td>
</tr>

<tr>
<td>[options.paranoid=false]</td>
<td>Boolean</td>
<td>Calling destroy will not delete the model, but instead set a deletedAt timestamp if this is true. Needs timestamps=true to work</td>
</tr>

<tr>
<td>[options.underscored=false]</td>
<td>Boolean</td>
<td>Converts all camelCased columns to underscored if true</td>
</tr>

<tr>
<td>[options.freezeTableName=false]</td>
<td>Boolean</td>
<td>If freezeTableName is true, sequelize will not try to alter the DAO name to get the table name. Otherwise, the tablename will be pluralized</td>
</tr>

<tr>
<td>[options.createdAt]</td>
<td>String|Boolean</td>
<td>Override the name of the createdAt column if a string is provided, or disable it if true. Timestamps must be true</td>
</tr>

<tr>
<td>[options.updatedAt]</td>
<td>String|Boolean</td>
<td>Override the name of the updatedAt column if a string is provided, or disable it if true. Timestamps must be true</td>
</tr>

<tr>
<td>[options.deletedAt]</td>
<td>String|Boolean</td>
<td>Override the name of the deletedAt column if a string is provided, or disable it if true. Timestamps must be true</td>
</tr>

<tr>
<td>[options.tableName]</td>
<td>String</td>
<td>Defaults to pluralized DAO name</td>
</tr>

<tr>
<td>[options.getterMethods]</td>
<td>Object</td>
<td>Provide getter functions that work like those defined per column. If you provide a getter method with the same name as a column, it will be used to access the value of that column. If you provide a name that does not match a column, this function will act as a virtual getter, that can fetch multiple other values</td>
</tr>

<tr>
<td>[options.setterMethods]</td>
<td>Object</td>
<td>Provide setter functions that work like those defined per column. If you provide a setter method with the same name as a column, it will be used to update the value of that column. If you provide a name that does not match a column, this function will act as a virtual setter, that can act on and set other values, but will not be persisted</td>
</tr>

<tr>
<td>[options.instanceMethods]</td>
<td>Object</td>
<td>Provide functions that are added to each instance (DAO)</td>
</tr>

<tr>
<td>[options.classMethods]</td>
<td>Object</td>
<td>Provide functions that are added to the model (DAOFactory)</td>
</tr>

<tr>
<td>[options.schema='public']</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[options.engine]</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[options.charset]</td>
<td>Strng</td>
<td></td>
</tr>

<tr>
<td>[options.comment]</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[options.collate]</td>
<td>String</td>
<td></td>
</tr>

</table>

#### Return:

* **DaoFactory** 

------

<a name="model" />

### model(daoName)

Fetch a DAO factory which is already defined

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>daoName</td>
<td>String</td>
<td>The name of a model defined with Sequelize.define</td>
</tr>

</table>

#### Return:

* **DAOFactory** The DAOFactory for daoName

------

<a name="isDefined" />

### isDefined(daoName)

Checks whether a DAO with the given name is defined

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>daoName</td>
<td>String</td>
<td>The name of a model defined with Sequelize.define</td>
</tr>

</table>

#### Return:

* **Boolean** Is a DAO with that name already defined?

------

<a name="import" />

### import(path)

Imports a DAO defined in another file 

Imported DAOs are cached, so multiple calls to import with the same path will not load the file multiple times

See https://github.com/sequelize/sequelize/blob/master/examples/using-multiple-model-files/Task.js for a short example of how to define your models in separate files so that they can be imported by sequelize.import

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>path</td>
<td>String</td>
<td>The path to the file that holds the model you want to import. If the part is relative, it will be resolved relatively to the calling file</td>
</tr>

</table>

#### Return:

* **DAOFactory** 

------

<a name="query" />

### query(sql, [callee], [options={}], [replacements])

Execute a query on the DB, with the posibility to bypass all the sequelize goodness. 

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#build"> for more information about callee.</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>sql</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[callee]</td>
<td>DAOFactory</td>
<td>If callee is provided, the selected data will be used to build an instance of the DAO represented by the factory. Equivalent to calling DAOFactory.build with the values provided by the query.</td>
</tr>

<tr>
<td>[options={}]</td>
<td>Object</td>
<td>Query options.</td>
</tr>

<tr>
<td>[options.raw]</td>
<td>Boolean</td>
<td>If true, sequelize will not try to format the results of the query, or build an instance of a model from the result</td>
</tr>

<tr>
<td>[options.type]</td>
<td>String</td>
<td>What is the type of this query (SELECT, UPDATE etc.). If the query starts with SELECT, the type will be assumed to be SELECT, otherwise no assumptions are made. Only used when raw is false. </td>
</tr>

<tr>
<td>[options.transaction=null]</td>
<td>Transaction</td>
<td>The transaction that the query should be executed under</td>
</tr>

<tr>
<td>[replacements]</td>
<td>Object|Array</td>
<td>Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?`</td>
</tr>

</table>

#### Return:

* **EventEmitter** 

------

<a name="query" />

### query(sql, [options={raw:true}])

Execute a raw query against the DB.

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>sql</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>[options={raw:true}]</td>
<td>Object</td>
<td>Query options. See above for a full set of options</td>
</tr>

</table>

#### Return:

* **EventEmitter** 

------

<a name="createSchema" />

### createSchema(schema)

Create a new database schema

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>schema</td>
<td>String</td>
<td>Name of the schema</td>
</tr>

</table>

#### Return:

* **EventEmitter** 

------

<a name="showAllSchemas" />

### showAllSchemas()

Show all defined schemas

#### Return:

* **EventEmitter** 

------

<a name="dropSchema" />

### dropSchema(schema)

Drop a single schema

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>schema</td>
<td>String</td>
<td>Name of the schema</td>
</tr>

</table>

#### Return:

* **EventEmitter** 

------

<a name="dropAllSchemas" />

### dropAllSchemas()

Drop all schemas

#### Return:

* **EventEmitter** 

------

<a name="sync" />

### sync([options={}])

Sync all defined DAOs to the DB. 

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options={}]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.force=false]</td>
<td>Boolean</td>
<td>If force is true, each DAO will do DROP TABLE IF EXISTS ..., before it tries to create its own table</td>
</tr>

<tr>
<td>[options.logging=console.log]</td>
<td>Boolean|function</td>
<td>A function that logs sql queries, or false for no logging</td>
</tr>

<tr>
<td>[options.schema='public']</td>
<td>String</td>
<td>The schema that the tables should be created in. This can be overriden for each table in sequelize.define</td>
</tr>

</table>

#### Return:

* **EventEmitter** 

------

<a name="authenticate" />

### authenticate()

Test the connetion by trying to authenticate

#### Return:

* **EventEmitter** 

------

<a name="fn" />

### fn(fn, args)

Creates a object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
If you want to refer to columns in your function, you should use sequelize.col, so that the columns are properly interpreted as columns and not a strings.

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#col">Sequelize#col</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>fn</td>
<td>String</td>
<td>The function you want to call</td>
</tr>

<tr>
<td>args</td>
<td>any</td>
<td>All further arguments will be passed as arguments to the function</td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.fn

------

<a name="col" />

### col(col)

Creates a object representing a column in the DB. This is usefull in sequelize.fn, since raw string arguments to that will be escaped.

See: Sequelize#fn

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>col</td>
<td>String</td>
<td>The name of the column</td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.col

------

<a name="cast" />

### cast(val, type)

Creates a object representing a call to the cast function. 

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>val</td>
<td>any</td>
<td>The value to cast</td>
</tr>

<tr>
<td>type</td>
<td>String</td>
<td>The type to cast it to</td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.cast

------

<a name="literal" />

### literal(val)

Creates a object representing a literal, i.e. something that will not be escaped.

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>val</td>
<td>any</td>
<td></td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.literal

------

<a name="asIs" />

### asIs()

An alias of literal

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#literal">Sequelize#literal</a>

------

<a name="and" />

### and(args)

An AND query 

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#find">DAOFactory#find</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>args</td>
<td>String|Object</td>
<td>Each argument will be joined by AND</td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.and

------

<a name="or" />

### or(args)

An OR query 

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#find">DAOFactory#find</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>args</td>
<td>String|Object</td>
<td>Each argument will be joined by OR</td>
</tr>

</table>

#### Return:

* **An** instance of Sequelize.or

------

<a name="transaction" />

### transaction([options={}], callback)

Start a transaction. 

See: <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Transaction"> </a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options={}]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.autocommit=true]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[options.isolationLevel='REPEATABLE_READ']</td>
<td>String</td>
<td>One of READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE. It is preferred to use sequelize.Transaction.ISOLATION_LEVELS as opposed to providing a string</td>
</tr>

<tr>
<td>callback</td>
<td>Function</td>
<td>Called when the transaction has been set up and is ready for use. If the callback takes two arguments it will be called with err, transaction, otherwise it will be called with transaction.</td>
</tr>

</table>

#### Return:

* **Transaction** 

------

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on [IRC](irc://irc.freenode.net/#sequelizejs), open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org), [dox](https://github.com/visionmedia/dox) and [markdox](https://github.com/cbou/markdox)_

_This documentation was automagically created on Sun Feb 09 2014 20:14:56 GMT+0100 (CET)_

