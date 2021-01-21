# Connecting to a Database

These instructions will give you a framework-agnostic implementation of Sequelize. This setup does not use any of the Sequelize-CLI generators, but you will still need to use Sequelize-CLI to run any migrations.

Be sure you've installed Node.js before you begin.

## Installing Sequelize

Sequelize is available via [npm](https://www.npmjs.com/package/sequelize) (or [yarn](https://yarnpkg.com/package/sequelize)). To install simply run:

```
npm install sequelize
```

### Pick your database driver

Depending on which flavor of SQL database you are using, you will need to install the corresponding driver library. Pick from the following list:

```
$ npm install pg pg-hstore
$ npm install mysql2
$ npm install mariadb
$ npm install sqlite3
$ npm install tedious
```

## Building a Connection

To connect to the database, you must create a Sequelize instance. The simplest way to connect is to pass a connection URI to the `Sequelize` constructor:

```js
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname')
```

**Note on Naming:** By convention, `Sequelize` refers to the library while `sequelize` refers to an instance of Sequelize, which represents a connection to one database.

### Passing Parameters

You may also pass the connection parameters separately to the Sequelize constructor. The Sequelize constructor accepts a lot of options. They are documented in the [API Reference](../class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor).

```js
// SQLITE
const Sequelize = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'path/to/database.sqlite'
});
```

```js
// OTHER DIALECTS
const Sequelize = require('sequelize');
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql'|'sqlite'|'postgres'|'mssql',

  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },

  // SQLite only
  storage: 'path/to/database.sqlite',

  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
  operatorsAliases: false
});
```

### Using the SQLite shortcut

If you want an immediate, lightweight connection to a development database try using this SQLite setup:

```js
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = new Sequelize("sqlite::memory:");

// sequelize connection to db is ready
```

To experiment with the other dialects, which are harder to setup locally, you can use the [Sequelize SSCCE](https://github.com/papb/sequelize-sscce) GitHub repository, which allows you to run code on all supported dialects directly from GitHub, for free, without any setup!

### Testing the connection

You can use the `.authenticate()` function to test if the connection:

```js
try {
  await sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  console.error('Unable to connect to the database:', error);
}
```

### Closing the connection

Sequelize will keep the connection open by default, and use the same connection for all queries. If you need to close the connection, call `sequelize.close()` (which is asynchronous and returns a Promise).

## Logging to the console

By default, Sequelize will log to console every SQL query it performs.

The `options.logging` option can be used to customize logging. The default function calls `console.log` on the first log parameter of the logging function. For example, for query logging the first parameter is the raw query and the second (hidden by default) is the Sequelize object.

Common useful values for `options.logging`:

```js
const sequelize = new Sequelize('sqlite::memory:', {
  // Choose one of the logging options
  logging: console.log,                  // Default, displays the first parameter of the log function call
  logging: (...msg) => console.log(msg), // Displays all log function call parameters
  logging: false,                        // Disables logging
  logging: msg => logger.debug(msg),     // Use custom logger (e.g. Winston or Bunyan), displays the first parameter
  logging: logger.debug.bind(logger)     // Alternative way to use custom logger, displays all messages
});
```
