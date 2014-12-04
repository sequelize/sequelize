## Transactions

Sequelize supports two ways of using transactions, one will automatically commit or rollback the transaction based on a promise chain and the other leaves it up to the user.

The key difference is that the managed transaction uses a callback that expects a promise to be returned to it while the unmanaged transaction returns a promise.

### Auto commit/rollback
```js
return sequelize.transaction(t) {
  return User.create({
    firstName: 'Abraham',
    lastName: 'Lincoln'
  }, {transaction: t}).then(function (user) {
    return user.setShooter({
      firstName: 'John',
      lastName: 'Boothe'
    }, {transction: t});
  });
}).then(function (result) {
  // Transaction has been committed
  // result is whatever the result of the promise chain returned to the transaction callback is
}).catch(function (err) {
  // Transaction has been rolled back
  // err is whatever rejected the promise chain returned to the transaction callback is
});
```

### Handled by user
```js    
return sequelize.transaction().function (t) {
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

### Using transactions with other sequelize methods

The `transaction` option goes with most other options, which are usually the first argument of a method.
For methods that take values, like `.create`, `.update()`, `.updateAttributes()` and more `transaction` should be passed to the option in the second argument.
If unsure, refer to the api documentation for the method you are using to be sure of the signature.