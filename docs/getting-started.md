# Getting started

In this tutorial you will learn to make a simple setup of Sequelize to learn the basics.

## Installing

Sequelize is available via [npm](https://www.npmjs.com/package/sequelize) (or [yarn](https://yarnpkg.com/package/sequelize)).

```sh
npm install --save sequelize
```

You'll also have to manually install the driver for your database of choice:

```sh
# One of the following:
$ npm install --save pg pg-hstore # Postgres
$ npm install --save mysql2
$ npm install --save mariadb
$ npm install --save sqlite3
$ npm install --save tedious # Microsoft SQL Server
```

## Setting up a connection

To connect to the database, you must create a Sequelize instance. This can be done by either passing the connection parameters separately to the Sequelize constructor or by passing a single connection URI:

```js
const Sequelize = require('sequelize');

// Option 1: Passing parameters separately
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: /* one of 'mysql' | 'mariadb' | 'postgres' | 'mssql' */
});

// Option 2: Passing a connection URI
const sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname');
```

The Sequelize constructor takes a whole slew of options that are documented in the [API Reference for the Sequelize constructor](/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor).

### Note: setting up SQLite

If you're using SQLite, you should use the following instead:

```js
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'path/to/database.sqlite'
});
```

### Note: connection pool (production)

If you're connecting to the database from a single process, you should create only one Sequelize instance. Sequelize will set up a connection pool on initialization. This connection pool can be configured through the constructor's `options` parameter (using `options.pool`), as is shown in the following example:

```js
const sequelize = new Sequelize(/* ... */, {
  // ...
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});
```

Learn more in the [API Reference for the Sequelize constructor](/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor). If you're connecting to the database from multiple processes, you'll have to create one instance per process, but each instance should have a maximum connection pool size of such that the total maximum size is respected. For example, if you want a max connection pool size of 90 and you have three processes, the Sequelize instance of each process should have a max connection pool size of 30.

### Testing the connection

You can use the `.authenticate()` function to test if the connection is OK:

```js
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
```

### Closing the connection

Sequelize will keep the connection open by default, and use the same connection for all queries. If you need to close the connection, call `sequelize.close()` (which is asynchronous and returns a Promise).

## Modeling a table

A model is a class that extends `Sequelize.Model`. Models can be defined in two equivalent ways. The first, with `Sequelize.Model.init(attributes, options)`:

```js
const Model = Sequelize.Model;
class User extends Model {}
User.init({
  // attributes
  firstName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  lastName: {
    type: Sequelize.STRING
    // allowNull defaults to true
  }
}, {
  sequelize,
  modelName: 'user'
  // options
});
```

Alternatively, using `sequelize.define`:

```js
const User = sequelize.define('user', {
  // attributes
  firstName: {
    type: Sequelize.STRING,
    allowNull: false
  },
  lastName: {
    type: Sequelize.STRING
    // allowNull defaults to true
  }
}, {
  // options
});
```

Internally, `sequelize.define` calls `Model.init`.

The above code tells Sequelize to expect a table named `users` in the database with the fields `firstName` and `lastName`. The table name is automatically pluralized by default (a library called [inflection](https://www.npmjs.com/package/inflection) is used under the hood to do this). This behavior can be stopped for a specific model by using the `freezeTableName: true` option, or for all models by using the `define` option from the [Sequelize constructor](http://docs.sequelizejs.com/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor).

Sequelize also defines by default the fields `id` (primary key), `createdAt` and `updatedAt` to every model. This behavior can also be changed, of course (check the API Reference to learn more about the available options).

### Changing the default model options

The Sequelize constructor takes a `define` option which will change the default options for all defined models.

```js
const sequelize = new Sequelize(connectionURI, {
  define: {
    // The `timestamps` field specify whether or not the `createdAt` and `updatedAt` fields will be created.
    // This was true by default, but now is false by default
    timestamps: false
  }
});

// Here `timestamps` will be false, so the `createdAt` and `updatedAt` fields will not be created.
class Foo extends Model {}
Foo.init({ /* ... */ }, { sequelize });

// Here `timestamps` is directly set to true, so the `createdAt` and `updatedAt` fields will be created.
class Bar extends Model {}
Bar.init({ /* ... */ }, { sequelize, timestamps: true });
```

You can read more about creating models in the [Model.init API Reference](/class/lib/model.js~Model.html#static-method-init), or in the [sequelize.define API reference](/class/lib/sequelize.js~Sequelize.html#instance-method-define).

## Synchronizing the model with the database

If you want Sequelize to automatically create the table (or modify it as needed) according to your model definition, you can use the `sync` method, as follows:

```js
// Note: using `force: true` will drop the table if it already exists
User.sync({ force: true }).then(() => {
  // Now the `users` table in the database corresponds to the model definition
  return User.create({
    firstName: 'John',
    lastName: 'Hancock'
  });
});
```

### Synchronizing all models at once

Instead of calling `sync()` for every model, you can call `sequelize.sync()` which will automatically sync all models.

### Note for production

In production, you might want to consider using Migrations instead of calling `sync()` in your code. Learn more in the [Migrations](http://docs.sequelizejs.com/manual/migrations.html) guide.

## Querying

A few simple queries are shown below:

```js
// Find all users
User.findAll().then(users => {
  console.log("All users:", JSON.stringify(users, null, 4));
});

// Create a new user
User.create({ firstName: "Jane", lastName: "Doe" }).then(jane => {
  console.log("Jane's auto-generated ID:", jane.id);
});

// Delete everyone named "Jane"
User.destroy({
  where: {
    firstName: "Jane"
  }
}).then(() => {
  console.log("Done");
});

// Change everyone without a last name to "Doe"
User.update({ lastName: "Doe" }, {
  where: {
    lastName: null
  }
}).then(() => {
  console.log("Done");
});
```

Sequelize has a lot of options for querying. You will learn more about those in the next tutorials. It is also possible to make raw SQL queries, if you really need them.

## Promises and async/await

As shown above by the extensive usage of `.then` calls, Sequelize uses Promises extensively. This means that, if your Node version supports it, you can use ES2017 `async/await` syntax for all asynchronous calls made with Sequelize.

Also, all Sequelize promises are in fact [Bluebird](http://bluebirdjs.com) promises, so you have the rich Bluebird API to use as well (for example, using `finally`, `tap`, `tapCatch`, `map`, `mapSeries`, etc). You can access the Bluebird constructor used internally by Sequelize with `Sequelize.Promise`, if you want to set any Bluebird specific options.
