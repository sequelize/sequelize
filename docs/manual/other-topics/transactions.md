# Transactions

Sequelize does not use [transactions](https://en.wikipedia.org/wiki/Database_transaction) by default. However, for production-ready usage of Sequelize, you should definitely configure Sequelize to use transactions.

Sequelize supports two ways of using transactions:

1. **Unmanaged transactions:** Committing and rolling back the transaction should be done manually by the user (by calling the appropriate Sequelize methods).

2. **Managed transactions**: Sequelize will automatically rollback the transaction if any error is thrown, or commit the transaction otherwise. Also, if CLS (Continuation Local Storage) is enabled, all queries within the transaction callback will automatically receive the transaction object.

## Unmanaged transactions

Let's start with an example:

```js
// First, we start a transaction and save it into a variable
const t = await sequelize.transaction();

try {

  // Then, we do some calls passing this transaction as an option:

  const user = await User.create({
    firstName: 'Bart',
    lastName: 'Simpson'
  }, { transaction: t });

  await user.addSibling({
    firstName: 'Lisa',
    lastName: 'Simpson'
  }, { transaction: t });

  // If the execution reaches this line, no errors were thrown.
  // We commit the transaction.
  await t.commit();

} catch (error) {

  // If the execution reaches this line, an error was thrown.
  // We rollback the transaction.
  await t.rollback();

}
```

As shown above, the *unmanaged transaction* approach requires that you commit and rollback the transaction manually, when necessary.

## Managed transactions

Managed transactions handle committing or rolling back the transaction automatically. You start a managed transaction by passing a callback to `sequelize.transaction`. This callback can be `async` (and usually is).

The following will happen in this case:

* Sequelize will automatically start a transaction and obtain a transaction object `t`
* Then, Sequelize will execute the callback you provided, passing `t` into it
* If your callback throws, Sequelize will automatically rollback the transaction
* If your callback succeeds, Sequelize will automatically commit the transaction
* Only then the `sequelize.transaction` call will settle:
  * Either resolving with the resolution of your callback
  * Or, if your callback throws, rejecting with the thrown error

Example code:

```js
try {

  const result = await sequelize.transaction(async (t) => {

    const user = await User.create({
      firstName: 'Abraham',
      lastName: 'Lincoln'
    }, { transaction: t });

    await user.setShooter({
      firstName: 'John',
      lastName: 'Boothe'
    }, { transaction: t });

    return user;

  });

  // If the execution reaches this line, the transaction has been committed successfully
  // `result` is whatever was returned from the transaction callback (the `user`, in this case)

} catch (error) {

  // If the execution reaches this line, an error occurred.
  // The transaction has already been rolled back automatically by Sequelize!

}
```

Note that `t.commit()` and `t.rollback()` were not called directly (which is correct).

### Throw errors to rollback

When using the managed transaction you should *never* commit or rollback the transaction manually. If all queries are successful (in the sense of not throwing any error), but you still want to rollback the transaction, you should throw an error yourself:

```js
await sequelize.transaction(async t => {
  const user = await User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, { transaction: t });

  // Woops, the query was successful but we still want to roll back!
  // We throw an error manually, so that Sequelize handles everything automatically.
  throw new Error();
});
```

### Automatically pass transactions to all queries

In the examples above, the transaction is still manually passed, by passing `{ transaction: t }` as the second argument. To automatically pass the transaction to all queries you must install the [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked) (CLS) module and instantiate a namespace in your own code:

```js
const cls = require('cls-hooked');
const namespace = cls.createNamespace('my-very-own-namespace');
```

To enable CLS you must tell sequelize which namespace to use by using a static method of the sequelize constructor:

```js
const Sequelize = require('sequelize');
Sequelize.useCLS(namespace);

new Sequelize(....);
```

Notice, that the `useCLS()` method is on the *constructor*, not on an instance of sequelize. This means that all instances will share the same namespace, and that CLS is all-or-nothing - you cannot enable it only for some instances.

CLS works like a thread-local storage for callbacks. What this means in practice is that different callback chains can access local variables by using the CLS namespace. When CLS is enabled sequelize will set the `transaction` property on the namespace when a new transaction is created. Since variables set within a callback chain are private to that chain several concurrent transactions can exist at the same time:

```js
sequelize.transaction((t1) => {
  namespace.get('transaction') === t1; // true
});

sequelize.transaction((t2) => {
  namespace.get('transaction') === t2; // true
});
```

In most case you won't need to access `namespace.get('transaction')` directly, since all queries will automatically look for a transaction on the namespace:

```js
sequelize.transaction((t1) => {
  // With CLS enabled, the user will be created inside the transaction
  return User.create({ name: 'Alice' });
});
```

## Concurrent/Partial transactions

You can have concurrent transactions within a sequence of queries or have some of them excluded from any transactions. Use the `transaction` option to control which transaction a query belongs to:

**Note:** *SQLite does not support more than one transaction at the same time.*

### With CLS enabled

```js
sequelize.transaction((t1) => {
  return sequelize.transaction((t2) => {
    // With CLS enabled, queries here will by default use t2.
    // Pass in the `transaction` option to define/alter the transaction they belong to.
    return Promise.all([
        User.create({ name: 'Bob' }, { transaction: null }),
        User.create({ name: 'Mallory' }, { transaction: t1 }),
        User.create({ name: 'John' }) // this would default to t2
    ]);
  });
});
```

## Passing options

The `sequelize.transaction` method accepts options.

For unmanaged transactions, just use `sequelize.transaction(options)`.

For managed transactions, use `sequelize.transaction(options, callback)`.

## Isolation levels

The possible isolations levels to use when starting a transaction:

```js
const { Transaction } = require('sequelize');

// The following are valid isolation levels:
Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED // "READ UNCOMMITTED"
Transaction.ISOLATION_LEVELS.READ_COMMITTED // "READ COMMITTED"
Transaction.ISOLATION_LEVELS.REPEATABLE_READ  // "REPEATABLE READ"
Transaction.ISOLATION_LEVELS.SERIALIZABLE // "SERIALIZABLE"
```

By default, sequelize uses the isolation level of the database. If you want to use a different isolation level, pass in the desired level as the first argument:

```js
const { Transaction } = require('sequelize');

await sequelize.transaction({
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
}, async (t) => {
  // Your code
});
```

You can also overwrite the `isolationLevel` setting globally with an option in the Sequelize constructor:

```js
const { Sequelize, Transaction } = require('sequelize');

const sequelize = new Sequelize('sqlite::memory:', {
  isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
});
```

**Note for MSSQL:** _The `SET ISOLATION LEVEL` queries are not logged since the specified `isolationLevel` is passed directly to `tedious`._

## Usage with other sequelize methods

The `transaction` option goes with most other options, which are usually the first argument of a method.

For methods that take values, like `.create`, `.update()`, etc. `transaction` should be passed to the option in the second argument.

If unsure, refer to the API documentation for the method you are using to be sure of the signature.

Examples:

```js
await User.create({ name: 'Foo Bar' }, { transaction: t });

await User.findAll({
  where: {
    name: 'Foo Bar'
  },
  transaction: t
});
```

## The `afterCommit` hook

A `transaction` object allows tracking if and when it is committed.

An `afterCommit` hook can be added to both managed and unmanaged transaction objects:

```js
// Managed transaction:
await sequelize.transaction(async (t) => {
  t.afterCommit(() => {
    // Your logic
  });
});

// Unmanaged transaction:
const t = await sequelize.transaction();
t.afterCommit(() => {
  // Your logic
});
await t.commit();
```

The callback passed to `afterCommit` can be `async`. In this case:

* For a managed transaction: the `sequelize.transaction` call will wait for it before settling;
* For an unmanaged transaction: the `t.commit` call will wait for it before settling.

Notes:

* The `afterCommit` hook is not raised if the transaction is rolled back;
* The `afterCommit` hook does not modify the return value of the transaction (unlike most hooks)

You can use the `afterCommit` hook in conjunction with model hooks to know when a instance is saved and available outside of a transaction

```js
User.afterSave((instance, options) => {
  if (options.transaction) {
    // Save done within a transaction, wait until transaction is committed to
    // notify listeners the instance has been saved
    options.transaction.afterCommit(() => /* Notify */)
    return;
  }
  // Save done outside a transaction, safe for callers to fetch the updated model
  // Notify
});
```

## Locks

Queries within a `transaction` can be performed with locks:

```js
return User.findAll({
  limit: 1,
  lock: true,
  transaction: t1
});
```

Queries within a transaction can skip locked rows:

```js
return User.findAll({
  limit: 1,
  lock: true,
  skipLocked: true,
  transaction: t2
});
```
