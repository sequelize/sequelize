# Basic usage

To get the ball rollin' you first have to create an instance of Sequelize. Use it the following way:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql'
});
```
This will save the passed database credentials and provide all further methods.

Furthermore you can specify a non-default host/port:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql',
  host: "my.server.tld",
  port: 9821,
})
```

If you just don't have a password:

```js
const sequelize = new Sequelize({
  database: 'db_name',
  username: 'username',
  password: null,
  dialect: 'mysql'
});
```

You can also use a connection string:

```js
const sequelize = new Sequelize('mysql://user:pass@example.com:9821/db_name', {
  // Look to the next section for possible options
})
```

## Options

Besides the host and the port, Sequelize comes with a whole bunch of options. Here they are:

- See [Sequelize API][2]
- See [Model Definition][1]
- See [Transactions][3]

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // the sql dialect of the database
  // currently supported: 'mysql', 'sqlite', 'postgres', 'mssql'
  dialect: 'mysql',

  // custom host; default: localhost
  host: 'my.server.tld',
 
  // custom port; default: dialect default
  port: 12345,
 
  // custom protocol; default: 'tcp'
  // postgres only, useful for Heroku
  protocol: null,
 
  // disable logging; default: console.log
  logging: false,

  // you can also pass any dialect options to the underlying dialect library
  // - default is empty
  // - currently supported: 'mysql', 'postgres', 'mssql'
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
  //   define: { timestamps: false }
  // is basically the same as:
  //   sequelize.define(name, attributes, { timestamps: false })
  // so defining the timestamps for each model will be not necessary
  define: {
    underscored: false
    freezeTableName: false,
    charset: 'utf8',
    dialectOptions: {
      collate: 'utf8_general_ci'
    },
    timestamps: true
  },
 
  // similar for sync: you can define this to always force sync for models
  sync: { force: true },
 
  // pool configuration used to pool database connections
  pool: {
    max: 5,
    idle: 30000,
    acquire: 60000,
  },

  // isolation level of each transaction
  // defaults to dialect default
  isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
})
```

**Hint:** You can also define a custom function for the logging part. Just pass a function. The first parameter will be the string that is logged.

## Read replication

Sequelize supports read replication, i.e. having multiple servers that you can connect to when you want to do a SELECT query. When you do read replication, you specify one or more servers to act as read replicas, and one server to act as the write master, which handles all writes and updates and propagates them to the replicas (note that the actual replication process is **not** handled by Sequelize, but should be set up by database backend).

```js
const sequelize = new Sequelize('database', null, null, {
  dialect: 'mysql',
  port: 3306
  replication: {
    read: [
      { host: '8.8.8.8', username: 'read-username', password: 'some-password' },
      { host: '9.9.9.9', username: 'another-username', password: null }
    ],
    write: { host: '1.1.1.1', username: 'write-username', password: 'any-password' }
  },
  pool: { // If you want to override the options used for the read/write pool you can do so here
    max: 20,
    idle: 30000
  },
})
```

If you have any general settings that apply to all replicas you do not need to provide them for each instance. In the code above, database name and port is propagated to all replicas. The same will happen for user and password, if you leave them out for any of the replicas. Each replica has the following options:`host`,`port`,`username`,`password`,`database`.

Sequelize uses a pool to manage connections to your replicas. Internally Sequelize will maintain two pools created using `pool` configuration.

If you want to modify these, you can pass pool as an options when instantiating Sequelize, as shown above.

Each `write` or `useMaster: true` query will use write pool. For `SELECT` read pool will be used. Read replica are switched using a basic round robin scheduling.

## Dialects

With the release of Sequelize `1.6.0`, the library got independent from specific dialects. This means, that you'll have to add the respective connector library to your project yourself.

### MySQL

In order to get Sequelize working nicely together with MySQL, you'll need to install`mysql2@^1.0.0-rc.10`or higher. Once that's done you can use it like this:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql'
})
```

**Note:** You can pass options directly to dialect library by setting the
`dialectOptions` parameter. See [Options][0]
for examples (currently only mysql is supported).

### SQLite

For SQLite compatibility you'll need`sqlite3@~3.0.0`. Configure Sequelize like this:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // sqlite! now!
  dialect: 'sqlite',
 
  // the storage engine for sqlite
  // - default ':memory:'
  storage: 'path/to/database.sqlite'
})
```

Or you can use a connection string as well with a path:

```js
const sequelize = new Sequelize('sqlite:/home/abs/path/dbname.db')
const sequelize = new Sequelize('sqlite:relativePath/dbname.db')
```

### PostgreSQL

The library for PostgreSQL is`pg@^5.0.0 || ^6.0.0` You'll just need to define the dialect:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // gimme postgres, please!
  dialect: 'postgres'
})
```

### MSSQL

The library for MSSQL is`tedious@^1.7.0` You'll just need to define the dialect:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mssql'
})
```

## Executing raw SQL queries

As there are often use cases in which it is just easier to execute raw / already prepared SQL queries, you can utilize the function `sequelize.query`.

- See [Sequelize.query API][5]
- See [Query Types][4]

Here is how it works:

```js
// Arguments for raw queries
sequelize.query('your query', [, options])

// Quick example
sequelize.query("SELECT * FROM myTable").then(myTableRows => {
  console.log(myTableRows)
})

// If you want to return sequelize instances use the model options.
// This allows you to easily map a query to a predefined model for sequelize e.g:
sequelize
  .query('SELECT * FROM projects', { model: Projects })
  .then(projects => {
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
    raw: false,

    // The type of query you are executing. The query type affects how results are formatted before they are passed back.
    type: Sequelize.QueryTypes.SELECT
  })

// Note the second argument being null!
// Even if we declared a callee here, the raw: true would
// supersede and return a raw object.
sequelize
  .query('SELECT * FROM projects', { raw: true })
  .then(projects => {
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
  .then(projects => {
    console.log(projects)
  })

sequelize
  .query(
    'SELECT * FROM projects WHERE status = :status ',
    { raw: true, replacements: { status: 'active' } }
  )
  .then(projects => {
    console.log(projects)
  })
```

**One note:** If the attribute names of the table contain dots, the resulting objects will be nested:

```js
sequelize.query('select 1 as `foo.bar.baz`').then(rows => {
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
[1]: /manual/tutorial/models-definition.html#configuration
[2]: /class/lib/sequelize.js~Sequelize.html
[3]: /manual/tutorial/transactions.html
[4]: /variable/index.html#static-variable-QueryTypes
[5]: /class/lib/sequelize.js~Sequelize.html#instance-method-query
