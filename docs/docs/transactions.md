Sequelize supports two ways of using transactions:

* One which will automatically commit or rollback the transaction based on the result of a promise chain and, (if enabled) pass the transaction to all calls within the callback
* And one which leaves committing, rolling back and passing the transaction to the user.

The key difference is that the managed transaction uses a callback that expects a promise to be returned to it while the unmanaged transaction returns a promise.

# Managed transaction (auto-callback)
```js
return sequelize.transaction(function (t) {
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

In the example above, the transaction is still manually passed, by passing `{ transaction: t }` as the second argument. To automatically pass the transaction to all queries you must install the [continuation local storage](https://github.com/othiym23/node-continuation-local-storage) (CLS) module and instantiate a namespace in your own code:

```js
var cls = require('continuation-local-storage'),
    namespace = cls.createNamespace('my-very-own-namespace');
```

To enable CLS you must tell sequelize which namespace to use by setting it as a property on the sequelize constructor:

```js
var Sequelize = require('sequelize');
Sequelize.cls = namespace;

new Sequelize(....);
```

Notice, that the `cls` property must be set on the *constructor*, not on an instance of sequelize. This means that all instances will share the same namespace, and that CLS is all-or-nothing - you cannot enable it only for some instances. 

CLS works like a thread-local storage for callbacks. What this means in practice is, that different callback chains can access local variables by using the CLS namespace. When CLS is enabled sequelize will set the `transaction` property on the namespace when a new transaction is created. Since variables set within a callback chain are private to that chain several concurrent transactions can exist at the same time:

```js
sequelize.transaction(function (t1) {
  namespace.get('transaction') === t1;
});

sequelize.transaction(function (t2) {
  namespace.get('transaction') === t2;
});
```

In most case you won't need to access `namespace.get('transaction')` directly, since all queries will automatically look for a transaction on the namespace:

```js
sequelize.transaction(function (t1) {
  // With CLS enabled, the user will be created inside the transaction
  User.create({ name: 'Alice' });
});
```

If you want to execute queries inside the callback without using the transaction you can pass `{ transaction: null }`, or another transaction if you have several concurrent ones:

```js
sequelize.transaction(function (t1) {
  sequelize.transaction(function (t2) {
    // By default queries here will use t2
    User.create({ name: 'Bob' }, { transaction: null });
    User.create({ name: 'Mallory' }, { transaction: t1 });
  });    
});
```

# Unmanaged transaction (then-callback)
```js    
return sequelize.transaction().then(function (t) {
  return User.create({
    firstName: 'Homer',
    lastName: 'Simpson'
  }, {transaction: t}).then(function (user) {
    return user.addSibling({
      firstName: 'Lisa',
      lastName: 'Simpson'
    }, {transction: t});
  }).then(function () {
    t.commit();
  }).catch(function (err) {
    t.rollback();
  });
});
```

# Using transactions with other sequelize methods

The `transaction` option goes with most other options, which are usually the first argument of a method.
For methods that take values, like `.create`, `.update()`, `.updateAttributes()` etc. `transaction` should be passed to the option in the second argument.
If unsure, refer to the API documentation for the method you are using to be sure of the signature.
