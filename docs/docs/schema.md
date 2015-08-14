## Syncing

`sequelize.sync()` will, based on your model definitions, create any missing tables.
If `force: true` it will first drop tables before recreating them.

## Migrations / Manual schema changes

Sequelize has a [sister library](https://github.com/sequelize/umzug) for handling execution and logging of migration tasks.
Sequelize provides a list of ways to programmatically create or change a table schema.

### createTable

### addColumn

### changeColumn

### removeColumn

### addIndex

### removeIndex

### addConstraint

### removeConstraint
