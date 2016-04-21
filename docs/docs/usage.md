## Basic usage

To get the ball rollin' you first have to create an instance of Sequelize. Use it the following way:

```js
var sequelize = new Sequelize('database', 'username'[, 'password'])
```
This will save the passed database credentials and provide all further methods. Furthermore you can specify a non-default host/port:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  host: "my.server.tld",
  port: 12345
})
```

If you just don't have a password:

```js
var sequelize = new Sequelize('database', 'username')
// or
var sequelize = new Sequelize('database', 'username', null)
```

You can also use a connection string:

```js
var sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname', {
  // Look to the next section for possible options
})
```

## Options

Besides the host and the port, Sequelize comes with a whole bunch of options. Here they are:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  // custom host; default: localhost
  host: 'my.server.tld',
 
  // custom port; default: 3306
  port: 12345,
 
  // custom protocol
  // - default: 'tcp'
  // - added in: v1.5.0
  // - postgres only, useful for heroku
  protocol: null,
 
  // disable logging; default: console.log
  logging: false,
 
  // the sql dialect of the database
  // - default is 'mysql'
  // - currently supported: 'mysql', 'sqlite', 'postgres', 'mariadb', 'mssql'
  dialect: 'mysql',
 
  // you can also pass any dialect options to the underlying dialect library
  // - default is empty
  // - currently supported: 'mysql', 'mariadb', 'postgres', 'mssql'
  dialectOptions: {
    socketPath: '/Applications/MAMP/tmp/mysql/mysql.sock',
    supportBigNumbers: true,
    bigNumberStrings: true
  },
 
  // the storage engine for sqlite
  // - default ':memory:'
  storage: 'path/to/database.sqlite',
 
  // disable inserting undefined values as NULL
  // - default: false
  omitNull: true,
 
  // a flag for using a native library or not.
  // in the case of 'pg' -- set this to true will allow SSL support
  // - default: false
  native: true,
 
  // Specify options, which are used when sequelize.define is called.
  // The following example:
  //   define: {timestamps: false}
  // is basically the same as:
  //   sequelize.define(name, attributes, { timestamps: false })
  // so defining the timestamps for each model will be not necessary
  // Below you can see the possible keys for settings. All of them are explained on this page
  define: {
    underscored: false
    freezeTableName: false,
    syncOnAssociation: true,
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    },
    classMethods: {method1: function() {}},
    instanceMethods: {method2: function() {}},
    timestamps: true
  },
 
  // similar for sync: you can define this to always force sync for models
  sync: { force: true },
 
  // sync after each association (see below). If set to false, you need to sync manually after setting all associations. Default: true
  syncOnAssociation: true,
 
  // use pooling in order to reduce db connection overload and to increase speed
  // currently only for mysql and postgresql (since v1.5.0)
  pool: { maxConnections: 5, maxIdleTime: 30},
 
  // language is used to determine how to translate words into singular or plural form based on the [lingo project](https://github.com/visionmedia/lingo)
  // options are: en [default], es
  language: 'en',

  // isolation level of each transaction. Defaults to REPEATABLE_READ
  // options are:
  // READ_UNCOMMITTED
  // READ_COMMITTED
  // REPEATABLE_READ
  // SERIALIZABLE
  isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
})
```

**Hint:** You can also define a custom function for the logging part. Just pass a function. The first parameter will be the string that is logged.

## Read replication

Sequelize supports read replication, i.e. having multiple servers that you can connect to when you want to do a SELECT query. When you do read replication, you specify one or more servers to act as read replicas, and one server to act as the write master, which handles all writes and updates and propagates them to the replicas (note that the actual replication process is **not** handled by Sequelize, but should be set up in MySql).

```js
var sequelize = new Sequelize('database', null, null, {
  dialect: 'mysql',
  port: 3306
  replication: {
    read: [
      { host: '8.8.8.8', username: 'anotherusernamethanroot', password: 'lolcats!' },
      { host: 'localhost', username: 'root', password: null }
    ],
    write: { host: 'localhost', username: 'root', password: null }
  },
  pool: { // If you want to override the options used for the read pool you can do so here
    maxConnections: 20,
    maxIdleTime: 30000
  },
})
```

If you have any general settings that apply to all replicas you do not need to provide them for each instance. In the code above, database name and port is propagated to all replicas. The same will happen for user and password, if you leave them out for any of the replicas. Each replica has the following options:`host`,`port`,`username`,`password`,`database`.

Sequelize uses a pool to manage connections to your replicas. The default options are:

```js
{
  maxConnections: 10,
  minConnections: 0,
  maxIdleTime:    1000
}
```

If you want to modify these, you can pass pool as an options when instantiating Sequelize, as shown above.

**Note:** Read replication only works for MySQL at the moment!

## Dialects

With the release of Sequelize`1.6.0`, the library got independent from specific dialects. This means, that you'll have to add the respective connector library to your project yourself. Version 1.7.0 stable has been released in bundles with the connector libraries (sequelize-mysql, sequelize-postgres etc.) but these bundles are not maintained, and will not be released for 2.0.0 upwards.

### MySQL

In order to get Sequelize working nicely together with MySQL, you'll need to install`mysql@~2.5.0`or higher. Once that's done you can use it like this:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  // mysql is the default dialect, but you know...
  // for demo purposes we are defining it nevertheless :)
  // so: we want mysql!
  dialect: 'mysql'
})
```

**Note:** You can pass options directly to dialect library by setting the
`dialectOptions` parameter. See [Options][0]
for examples (currently only mysql and mariadb are supported).

### MariaDB

For MariaDB compatibility you have to install the package `mariasql@~0.1.20`.
The configuration needs to look like this:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mariadb'
})
```

### SQLite

For SQLite compatibility you'll need`sqlite3@~3.0.0`. Configure Sequelize like this:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  // sqlite! now!
  dialect: 'sqlite',
 
  // the storage engine for sqlite
  // - default ':memory:'
  storage: 'path/to/database.sqlite'
})
```

### PostgreSQL

The library for PostgreSQL is`pg@~3.6.0` You'll just need to define the dialect:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  // gimme postgres, please!
  dialect: 'postgres'
})
```

### MSSQL

The library for MSSQL is`tedious@^1.7.0` You'll just need to define the dialect:

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mssql'
})
```

## Executing raw SQL queries

As there are often use cases in which it is just easier to execute raw / already prepared SQL queries, you can utilize the function `sequelize.query`.

Here is how it works:

```js
// Arguments for raw queries
sequelize.query('your query', [, options])

// Quick example
sequelize.query("SELECT * FROM myTable").then(function(myTableRows) {
  console.log(myTableRows)
})

// If you want to return sequelize instances use the model options.
// This allows you to easily map a query to a predefined model for sequelize e.g:
sequelize
  .query('SELECT * FROM projects', { model: Projects })
  .then(function(projects){
    // Each record will now be mapped to the project's model.
    console.log(projects)
  })


// Options is an object with the following keys:
sequelize
  .query('SELECT 1', {
    // A function (or false) for logging your queries
    // Will get called for every SQL query that gets send
    // to the server.
    logging: console.log,

    // If plain is true, then sequelize will only return the first
    // record of the result set. In case of false it will all records.
    plain: false,

    // Set this to true if you don't have a model definition for your query.
    raw: false
  })

// Note the second argument being null!
// Even if we declared a callee here, the raw: true would
// supersede and return a raw object.
sequelize
  .query('SELECT * FROM projects', { raw: true })
  .then(function(projects) {
    console.log(projects)
  })
```

Replacements in a query can be done in two different ways, either using
named parameters (starting with `:`), or unnamed, represented by a ?

The syntax used depends on the replacements option passed to the function:

* If an array is passed, `?` will be replaced in the order that they appear in the array
* If an object is passed, `:key` will be replaced with the keys from that object.
If the object contains keys not found in the query or vice versa, an exception
will be thrown.

```js
sequelize
  .query(
    'SELECT * FROM projects WHERE status = ?',
    { raw: true, replacements: ['active']
  )
  .then(function(projects) {
    console.log(projects)
  })

sequelize
  .query(
    'SELECT * FROM projects WHERE status = :status ',
    { raw: true, replacements: { status: 'active' } }
  )
  .then(function(projects) {
    console.log(projects)
  })
```

**One note:** If the attribute names of the table contain dots, the resulting objects will be nested:

```js
sequelize.query('select 1 as `foo.bar.baz`').then(function(rows) {
  console.log(JSON.stringify(rows))

  /*
    [{
      "foo": {
        "bar": {
          "baz": 1
        }
      }
    }]
  */
})
```



[0]: /docs/latest/usage#options
