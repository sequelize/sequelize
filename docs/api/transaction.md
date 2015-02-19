<a name="transaction"></a>
# Class Transaction
[View code](https://github.com/sequelize/sequelize/blob/56b47a6bdd60a9a1c5e43a35409dffa9ed5a4d93/lib/transaction.js#L12)
The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.

To run a query under a transaction, you should pass the transaction in the options object.

***

<a name="isolation_levels"></a>
## `ISOLATION_LEVELS`
[View code](https://github.com/sequelize/sequelize/blob/56b47a6bdd60a9a1c5e43a35409dffa9ed5a4d93/lib/transaction.js#L45)
The possible isolations levels to use when starting a transaction

```js
{
  READ_UNCOMMITTED: "READ UNCOMMITTED",
  READ_COMMITTED: "READ COMMITTED",
  REPEATABLE_READ: "REPEATABLE READ",
  SERIALIZABLE: "SERIALIZABLE"
}
```


***

<a name="lock"></a>
## `LOCK`
[View code](https://github.com/sequelize/sequelize/blob/56b47a6bdd60a9a1c5e43a35409dffa9ed5a4d93/lib/transaction.js#L67)
Possible options for row locking. Used in conjuction with `find` calls:

```js
t1 // is a transaction
Model.findAll({
  where: ...
}, {
  transaction: t1,
  lock: t1.LOCK.UPDATE,
  lock: t1.LOCK.SHARE
})
```

***

<a name="commit"></a>
## `commit()` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/56b47a6bdd60a9a1c5e43a35409dffa9ed5a4d93/lib/transaction.js#L77)
Commit the transaction


***

<a name="rollback"></a>
## `rollback()` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/56b47a6bdd60a9a1c5e43a35409dffa9ed5a4d93/lib/transaction.js#L98)
Rollback (abort) the transaction


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_