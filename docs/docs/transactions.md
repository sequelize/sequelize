## Transactions
```js    
sequelize.transaction(function(t) {
  // we just opened a new connection to the database which is transaction exclusive.
  // also we send some first transaction queries to the database.

  // do some async stuff ...

  // if everything is ok ... commit the transaction
  t.commit().success(function() {})

  // if something failed ... rollback the transaction
  t.rollback().success(function() {})

  // the commit / rollback will emit events which can be observed via:
  t.done(function() {
    /* we will be here once the transaction
    has been committed / reverted */
  })
})

sequelize.transaction(function(t) {
  User.create({ username: 'foo' }, { transaction: t }).success(function() {
    // this user will only be available inside the session
    User.all({ transaction: t }) // will return the user
    User.all() // will not return the user
  })
})
```