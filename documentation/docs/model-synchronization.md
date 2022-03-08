---
sidebar_position: 5
---

# Synchronizing your Models

When you define a model, you're telling Sequelize a few things about its table in the database. However, what if the table actually doesn't even exist in the database? What if it exists, but it has different columns, less columns, or any other difference?

This is where model synchronization comes in. A model can be synchronized with the database by calling [`model.sync(options)`](pathname:///api/classes/Model.html#sync),
an asynchronous function (that returns a Promise). With this call, Sequelize will automatically perform an SQL query to the database.
Note that this changes only the table in the database, not the model in the JavaScript side.

* `User.sync()` - This creates the table if it doesn't exist (and does nothing if it already exists)
* `User.sync({ force: true })` - This creates the table, dropping it first if it already existed
* `User.sync({ alter: true })` - This checks what is the current state of the table in the database (which columns it has, what are their data types, etc), and then performs the necessary changes in the table to make it match the model.

:::caution

While `sync()` is a very useful tool during development, it is not designed to be used in production and using its `alter` or `force` options may lead to data loss.
See [Synchronizing in production](#synchronization-in-production).

:::

Example:

```js
await User.sync({ force: true });
console.log('The table for the User model was just (re)created!');
```

## Synchronizing all models at once

You can use [`sequelize.sync()`](pathname:///api/classes/Sequelize.html#sync) to automatically synchronize all models. Example:

```js
await sequelize.sync({ force: true });
console.log('All models were synchronized successfully.');
```

## Dropping tables

To drop the table related to a model:

```js
await User.drop();
console.log('User table dropped!');
```

To drop all tables:

```js
await sequelize.drop();
console.log('All tables dropped!');
```

## Database safety check

As shown above, the `sync` and `drop` operations are destructive. Sequelize accepts a `match` option as an additional safety check, which receives a RegExp:

```js
// This will run .sync() only if database name ends with '_test'
sequelize.sync({ force: true, match: /_test$/ });
```

## Synchronization in production

As shown above, `sync({ force: true })` and `sync({ alter: true })` can be destructive operations.
Therefore, they are not recommended for production-level software.
Instead, synchronization should be done with the advanced concept of [Migrations](migrations.html),
with the help of the [Sequelize CLI](https://github.com/sequelize/cli).
