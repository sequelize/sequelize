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
