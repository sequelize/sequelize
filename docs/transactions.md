# Transactions

Sequelize supports two ways of using transactions:

* One which will automatically commit or rollback the transaction based on the result of a promise chain and, (if enabled) pass the transaction to all calls within the callback
* And one which leaves committing, rolling back and passing the transaction to the user.

The key difference is that the managed transaction uses a callback that expects a promise to be returned to it while the unmanaged transaction returns a promise.

## Managed transaction (auto-callback)

Managed transactions handle committing or rolling back the transaction automagically. You start a managed transaction by passing a callback to `sequelize.transaction`.

Notice how the callback passed to `transaction` returns a promise chain, and does not explicitly call `t.commit()` nor `t.rollback()`. If all promises in the returned chain are resolved successfully the transaction is committed. If one or several of the promises are rejected, the transaction is rolled back.

```js
return sequelize.transaction(function (t) {

  // chain all your queries here. make sure you return them.
  return User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, {transaction: t}).then(function (user) {
    return user.setShooter({
      firstName: 'John',
      lastName: 'Boothe'
    }, {transaction: t});
  });

}).then(function (result) {
  // Transaction has been committed
  // result is whatever the result of the promise chain returned to the transaction callback
}).catch(function (err) {
  // Transaction has been rolled back
  // err is whatever rejected the promise chain returned to the transaction callback
});
```

### Throw errors to rollback

When using the managed transaction you should _never_ commit or rollback the transaction manually. If all queries are successful, but you still want to rollback the transaction (for example because of a validation failure) you should throw an error to break and reject the chain:

```js
return sequelize.transaction(function (t) {
  return User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, {transaction: t}).then(function (user) {
    // Woops, the query was successful but we still want to roll back!
    throw new Error();
  });
});
```

### Automatically pass transactions to all queries

In the examples above, the transaction is still manually passed, by passing `{ transaction: t }` as the second argument. To automatically pass the transaction to all queries you must install the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage) (CLS) module and instantiate a namespace in your own code:

```js
const cls = require('continuation-local-storage'),
    namespace = cls.createNamespace('my-very-own-namespace');
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
sequelize.transaction(function (t1) {
  namespace.get('transaction') === t1; // true
});

sequelize.transaction(function (t2) {
  namespace.get('transaction') === t2; // true
});
```

In most case you won't need to access `namespace.get('transaction')` directly, since all queries will automatically look for a transaction on the namespace:

```js
sequelize.transaction(function (t1) {
  // With CLS enabled, the user will be created inside the transaction
  return User.create({ name: 'Alice' });
});
```

After you've used `Sequelize.useCLS()` all promises returned from sequelize will be patched to maintain CLS context. CLS is a complicated subject - more details in the docs for [cls-bluebird](https://www.npmjs.com/package/cls-bluebird), the patch used to make bluebird promises work with CLS.

**Note:** _[CLS only supports async/await, at the moment, when using cls-hooked package](https://github.com/othiym23/node-continuation-local-storage/issues/98#issuecomment-323503807). Although, [cls-hooked](https://github.com/Jeff-Lewis/cls-hooked/blob/master/README.md) relies on *experimental API* [async_hooks](https://github.com/nodejs/node/blob/master/doc/api/async_hooks.md)_


## Concurrent/Partial transactions

You can have concurrent transactions within a sequence of queries or have some of them excluded from any transactions. Use the `{transaction: }` option to control which transaction a query belong to:

**Warning:** _SQLite does not support more than one transaction at the same time._

### Without CLS enabled
```js
sequelize.transaction(function (t1) {
  return sequelize.transaction(function (t2) {
    // With CLS enable, queries here will by default use t2
    // Pass in the `transaction` option to define/alter the transaction they belong to.
    return Promise.all([
        User.create({ name: 'Bob' }, { transaction: null }),
        User.create({ name: 'Mallory' }, { transaction: t1 }),
        User.create({ name: 'John' }) // this would default to t2
    ]);
  });
});
```

## Isolation levels
The possible isolations levels to use when starting a transaction:

```js
Sequelize.Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED // "READ UNCOMMITTED"
Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED // "READ COMMITTED"
Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ  // "REPEATABLE READ"
Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE // "SERIALIZABLE"
```

By default, sequelize uses the isolation level of the database. If you want to use a different isolation level, pass in the desired level as the first argument:

```js
return sequelize.transaction({
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
  }, function (t) {

  // your transactions

  });
```

**Note:** _The SET ISOLATION LEVEL queries are not logged in case of MSSQL as the specified isolationLevel is passed directly to tedious_

## Unmanaged transaction (then-callback)
Unmanaged transactions force you to manually rollback or commit the transaction. If you don't do that, the transaction will hang until it times out. To start an unmanaged transaction, call `sequelize.transaction()` without a callback (you can still pass an options object) and call `then` on the returned promise. Notice that `commit()` and `rollback()` returns a promise.

```js
return sequelize.transaction().then(function (t) {
  return User.create({
    firstName: 'Bart',
    lastName: 'Simpson'
  }, {transaction: t}).then(function (user) {
    return user.addSibling({
      firstName: 'Lisa',
      lastName: 'Simpson'
    }, {transaction: t});
  }).then(function () {
    return t.commit();
  }).catch(function (err) {
    return t.rollback();
  });
});
```

## Options
The `transaction` method can be called with an options object as the first argument, that
allows the configuration of the transaction.

```js
return sequelize.transaction({ /* options */ });
```

The following options (with their default values) are available:

```js
{
  autocommit: true,
  isolationLevel: 'REPEATABLE_READ',
  deferrable: 'NOT DEFERRABLE' // implicit default of postgres
}
```

The `isolationLevel` can either be set globally when initializing the Sequelize instance or
locally for every transaction:

```js
// globally
new Sequelize('db', 'user', 'pw', {
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
});

// locally
sequelize.transaction({
  isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
});
```

The `deferrable` option triggers an additional query after the transaction start
that optionally set the constraint checks to be deferred or immediate. Please note
that this is only supported in PostgreSQL.

```js
sequelize.transaction({
  // to defer all constraints:
  deferrable: Sequelize.Deferrable.SET_DEFERRED,

  // to defer a specific constraint:
  deferrable: Sequelize.Deferrable.SET_DEFERRED(['some_constraint']),

  // to not defer constraints:
  deferrable: Sequelize.Deferrable.SET_IMMEDIATE
})
```

## Usage with other sequelize methods

The `transaction` option goes with most other options, which are usually the first argument of a method.
For methods that take values, like `.create`, `.update()`, `.updateAttributes()` etc. `transaction` should be passed to the option in the second argument.
If unsure, refer to the API documentation for the method you are using to be sure of the signature.

## After commit hook

A `transaction` object allows tracking if and when it is committed.

An `afterCommit` hook can be added to both managed and unmanaged transaction objects:
```js
sequelize.transaction(t => {
  t.afterCommit((transaction) => {
    // Your logic
  });
});

sequelize.transaction().then(t => {
  t.afterCommit((transaction) => {
    // Your logic
  });

  return t.commit();
})
```

The function passed to `afterCommit` can optionally return a promise that will resolve before the promise chain
that created the transaction resolves

`afterCommit` hooks are _not_ raised if a transaction is rolled back

`afterCommit` hooks do _not_ modify the return value of the transaction, unlike standard hooks

You can use the `afterCommit` hook in conjunction with model hooks to know when a instance is saved and available outside
of a transaction

```js
model.afterSave((instance, options) => {
  if (options.transaction) {
    // Save done within a transaction, wait until transaction is committed to
    // notify listeners the instance has been saved
    options.transaction.afterCommit(() => /* Notify */)
    return;
  }
  // Save done outside a transaction, safe for callers to fetch the updated model
  // Notify
