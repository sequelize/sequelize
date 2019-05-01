# Upgrade to v6

Sequelize v6 is the next major release after v4

## Breaking Changes

### Support for Node 8 and up

Sequelize v6 will only support Node 8 and up

### Removed support for `operatorAliases`

Operator aliases were soft deprecated via the `opt-in` option `operatorAlises` in v5 they have been entirely removed.

Please refer to previous changelogs for the migration guide.

### Renamed operator symbols

If you have relied on accessing sequelize operators via `Symbol.for('gt')` etc. you must now prefix them with `sequelize.operator` eg.
`Symbol.for('sequelize.operator.gt')`

### Removed `Model.build`

`Model.build` has been acting as proxy for `bulkBuild` and `new Model` for a while.

Use `Model.bulkBuild` or `new Model` instead.

### Removal of CLS

CLS allowed implicit passing of the `transaction` property to query options inside of a transaction.
This feature was removed for 3 reasons.

- It required hooking the promise implementation which is not sustainable for the future of sequelize.
- It's generally unsafe due to it's implicit nature.
- It wasn't always reliable when mixed promise implementations were used.

Check all your usage of the `.transaction` method and make sure to explicitly pass the `transaction` object for each subsequent query.

#### Example

```js
db.transaction(async transaction => {
  const mdl = await myModel.findByPk(1);
  await mdl.update({
    a: 1;
  });
});
```

should now be:

```js
db.transaction(async transaction => {
  const mdl = await myModel.findByPk(1, { transaction });
  await mdl.update({
    a: 1;
  }, { transaction });
});
```

### Removed method aliases for hooks

In order to streamlike API all method style add hook functions have been removed.

Before: `MyModel.beforeCreate(...)`
After: `MyModel.addHook('beforeCreate', ...)`

This also affects the `Transaction.afterCommit` method.

Before: `transaction.afterCommit(...)`
After: `transaction.addHook(...)`
