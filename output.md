

<!-- Start ./lib/sequelize.js -->

### Sequelize

The main class 

------

## new Sequelize()

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
<td>Options, which shall be default for every model definition.</td>
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

## new Sequelize()

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

------

### getDialect()

Returns the specified dialect.

#### Return:

* **String** The specified dialect.

------

### getQueryInterface()

Returns an instance of QueryInterface.

See: {QueryInterface}

#### Return:

* **QueryInterface** An instance (singleton) of QueryInterface.

------

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

### model(daoName)

Fetch a DAO factory

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

------

### query(sql, [callee], [options={}], [replacements])

Execute a query on the DB, with the posibility to bypass all the sequelize goodness. 

See {@link MyClass} and [MyClass's foo property]{@link MyClass#foo}.
Also, check out {@link http://www.google.com|Google} and
{@link https://github.com GitHub}.

See: {DAOFactory#build} for more information about callee.

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
<td>Query options. See above for a full set of options</td>
</tr>

<tr>
<td>[replacements]</td>
<td>Object|Array</td>
<td>Either an object of named parameter replacements in the format `:param` or an array of unnamed replacements to replace `?`</td>
</tr>

</table>

------

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

------

### authenticate(cake, a)

Test the connetion by trying to authenticate

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>cake</td>
<td>boolean</td>
<td>want cake?</td>
</tr>

<tr>
<td>a</td>
<td>string</td>
<td>something else</td>
</tr>

</table>

------

### authenticate (k)

Test the connetion by trying to authenticate

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>k</td>
<td>string</td>
<td>something else</td>
</tr>

</table>

------

<!-- End ./lib/sequelize.js -->

