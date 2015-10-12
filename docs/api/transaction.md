<a name="transaction"></a>
# Class Transaction
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/transaction.js#L19)

The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.

To run a query under a transaction, you should pass the transaction in the options object.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| sequelize | Sequelize | A configured sequelize Instance |
| options | Object | An object with options |
| options.autocommit=true | Boolean | Sets the autocommit property of the transaction. |
| options.isolationLevel=true | String | Sets the isolation level of the transaction. |
| options.deferrable | String | Sets the constraints to be deferred or immediately checked. |


***

<a name="isolation_levels"></a>
## `ISOLATION_LEVELS`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/transaction.js#L71)

Isolations levels can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
Default to `REPEATABLE_READ` but you can override the default isolation level by passing `options.isolationLevel` in `new Sequelize`.

The possible isolations levels to use when starting a transaction:

```js
{
  READ_UNCOMMITTED: "READ UNCOMMITTED",
  READ_COMMITTED: "READ COMMITTED",
  REPEATABLE_READ: "REPEATABLE READ",
  SERIALIZABLE: "SERIALIZABLE"
}
```

Pass in the desired level as the first argument:

```js
return sequelize.transaction({
  isolationLevel: Sequelize.Transaction.SERIALIZABLE
}, function (t) {

 // your transactions

}).then(function(result) {
  // transaction has been committed. Do something after the commit if required.
}).catch(function(err) {
  // do something with the err.
});
```

***

<a name="lock"></a>
## `LOCK`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/transaction.js#L115)

Possible options for row locking. Used in conjuction with `find` calls:

```js
t1 // is a transaction
t1.LOCK.UPDATE,
t1.LOCK.SHARE,
t1.LOCK.KEY_SHARE, // Postgres 9.3+ only
t1.LOCK.NO_KEY_UPDATE // Postgres 9.3+ only
```

Usage:
```js
t1 // is a transaction
Model.findAll({
  where: ...,
  transaction: t1,
  lock: t1.LOCK...
});
```

Postgres also supports specific locks while eager loading by using OF:
```js
UserModel.findAll({
  where: ...,
  include: [TaskModel, ...],
  transaction: t1,
  lock: {
    level: t1.LOCK...,
    of: UserModel
  }
});
```
UserModel will be locked but TaskModel won't!

***

<a name="commit"></a>
## `commit()` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/transaction.js#L127)

Commit the transaction

***

<a name="rollback"></a>
## `rollback()` -> `Promise`
[View code](https://github.com/sequelize/sequelize/blob/0de404640d4c71e2d1f1259356650dfb586a248b/lib/transaction.js#L154)

Rollback (abort) the transaction

***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_