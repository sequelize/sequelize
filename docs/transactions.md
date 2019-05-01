# Transactions

Sequelize supports two ways of using transactions:

* One which will automatically commit or rollback the transaction based on the result of a promise chain and, (if enabled) pass the transaction to all calls within the callback
* And one which leaves committing, rolling back and passing the transaction to the user.

The key difference is that the managed transaction uses a callback that expects a promise to be returned to it while the unmanaged transaction returns a promise.

## Managed transaction (auto-callback)

Managed transactions handle committing or rolling back the transaction automagically. You start a managed transaction by passing a callback to `sequelize.transaction`.

Notice how the callback passed to `transaction` returns a promise chain, and does not explicitly call `t.commit()` nor `t.rollback()`. If all promises in the returned chain are resolved successfully the transaction is committed. If one or several of the promises are rejected, the transaction is rolled back.

```js
return sequelize.transaction(t => {

  // chain all your queries here. make sure you return them.
  return User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, {transaction: t}).then(user => {
    return user.setShooter({
      firstName: 'John',
      lastName: 'Boothe'
    }, {transaction: t});
  });

}).then(result => {
  // Transaction has been committed
  // result is whatever the result of the promise chain returned to the transaction callback
}).catch(err => {
  // Transaction has been rolled back
  // err is whatever rejected the promise chain returned to the transaction callback
});
```

### Throw errors to rollback

When using the managed transaction you should _never_ commit or rollback the transaction manually. If all queries are successful, but you still want to rollback the transaction (for example because of a validation failure) you should throw an error to break and reject the chain:

```js
return sequelize.transaction(t => {
  return User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, {transaction: t}).then(user => {
    // Woops, the query was successful but we still want to roll back!
    throw new Error();
  });
});
```

### Example

```js
sequelize.transaction((t1) => {
  return sequelize.transaction((t2) => {
    // Pass in the `transaction` option to define/alter the transaction they belong to.
    return Promise.all([
        User.create({ name: 'Bob' }, { transaction: null }),
        User.create({ name: 'Mallory' }, { transaction: t1 }),
        User.create({ name: 'John' }) // No transaction
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
  }, (t) => {

  // your transactions

  });
```

**Note:** _The SET ISOLATION LEVEL queries are not logged in case of MSSQL as the specified isolationLevel is passed directly to tedious_

## Unmanaged transaction (then-callback)

Unmanaged transactions force you to manually rollback or commit the transaction. If you don't do that, the transaction will hang until it times out. To start an unmanaged transaction, call `sequelize.transaction()` without a callback (you can still pass an options object) and call `then` on the returned promise. Notice that `commit()` and `rollback()` returns a promise.

```js
return sequelize.transaction().then(t => {
  return User.create({
    firstName: 'Bart',
    lastName: 'Simpson'
  }, {transaction: t}).then(user => {
    return user.addSibling({
      firstName: 'Lisa',
      lastName: 'Simpson'
    }, {transaction: t});
  }).then(() => {
    return t.commit();
  }).catch((err) => {
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
For methods that take values, like `.create`, `.update()`, etc. `transaction` should be passed to the option in the second argument.
If unsure, refer to the API documentation for the method you are using to be sure of the signature.

## After commit hook

A `transaction` object allows tracking if and when it is committed.

An `afterCommit` hook can be added to both managed and unmanaged transaction objects:

```js
sequelize.transaction(t => {
  t.addHook('afterCommit', (transaction) => {
    // Your logic
  });
});

sequelize.transaction().then(t => {
  t.addHook('afterCommit', (transaction) => {
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
model.addHook('afterSave', (instance, options) => {
  if (options.transaction) {
    // Save done within a transaction, wait until transaction is committed to
    // notify listeners the instance has been saved
    options.transaction.addHook('afterCommit', () => /* Notify */)
    return;
  }
  // Save done outside a transaction, safe for callers to fetch the updated model
  // Notify
})
```

## Locks

Queries within a `transaction` can be performed with locks

```js
return User.findAll({
  limit: 1,
  lock: true,
  transaction: t1
})
```

Queries within a transaction can skip locked rows

```js
return User.findAll({
  limit: 1,
  lock: true,
  skipLocked: true,
  transaction: t2
})
```
