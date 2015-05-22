<a name="deferrable"></a>
## `Deferrable()` -> `object`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L39)
A collection of properties related to deferrable constraints. It can be used to
make foreign key constraints deferrable and to set the constaints within a
transaction. This is only supported in PostgreSQL.

The foreign keys can be configured like this. It will create a foreign key
that will check the constraints immediately when the data was inserted.

```js
sequelize.define('Model', {
  foreign_id: {
    type: Sequelize.INTEGER,
    references: {
      model: OtherModel,
      key: 'id',
      deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
    }
  }
});
```

The constraints can be configured in a transaction like this. It will
trigger a query once the transaction has been started and set the constraints
to be checked at the very end of the transaction.

```js
sequelize.transaction({
  deferrable: Sequelize.Deferrable.SET_DEFERRED
});
```


***

<a name="initially_deferred"></a>
## `INITIALLY_DEFERRED()`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L59)
A property that will defer constraints checks to the end of transactions.


***

<a name="initially_immediate"></a>
## `INITIALLY_IMMEDIATE()`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L76)
A property that will trigger the constraint checks immediately


***

<a name="not"></a>
## `NOT()`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L95)
A property that will set the constraints to not deferred. This is
the default in PostgreSQL and it make it impossible to dynamically
defer the constraints within a transaction.


***

<a name="set_deferred"></a>
## `SET_DEFERRED(constraints)`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L114)
A property that will trigger an additional query at the beginning of a
transaction which sets the constraints to deferred.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| constraints | Array | An array of constraint names. Will defer all constraints by default. |


***

<a name="set_immediate"></a>
## `SET_IMMEDIATE(constraints)`
[View code](https://github.com/sequelize/sequelize/blob/2dc7a0f610480e045a412d215d7247912158407d/lib/deferrable.js#L135)
A property that will trigger an additional query at the beginning of a
transaction which sets the constraints to immediately.


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| constraints | Array | An array of constraint names. Will defer all constraints by default. |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_