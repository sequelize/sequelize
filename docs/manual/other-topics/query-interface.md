# Query Interface

An instance of Sequelize uses something called **Query Interface** to communicate to the database in a dialect-agnostic way. Most of the methods you've learned in this manual are implemented with the help of several methods from the query interface.

The methods from the query interface are therefore lower-level methods; you should use them only if you do not find another way to do it with higher-level APIs from Sequelize. They are, of course, still higher-level than running raw queries directly (i.e., writing SQL by hand).

This guide shows a few examples, but for the full list of what it can do, and for detailed usage of each method, check the [QueryInterface API](../class/lib/dialects/abstract/query-interface.js~QueryInterface.html).

## Obtaining the query interface

From now on, we will call `queryInterface` the singleton instance of the [QueryInterface](../class/lib/dialects/abstract/query-interface.js~QueryInterface.html) class, which is available on your Sequelize instance:

```js
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(/* ... */);
const queryInterface = sequelize.getQueryInterface();
```

## Creating a table

```js
queryInterface.createTable('Person', {
  name: DataTypes.STRING,
  isBetaMember: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
});
```

Generated SQL (using SQLite):

```SQL
CREATE TABLE IF NOT EXISTS `Person` (
  `name` VARCHAR(255),
  `isBetaMember` TINYINT(1) NOT NULL DEFAULT 0
);
```

**Note:** Consider defining a Model instead and calling `YourModel.sync()` instead, which is a higher-level approach.

## Adding a column to a table

```js
queryInterface.addColumn('Person', 'petName', { type: DataTypes.STRING });
```

Generated SQL (using SQLite):

```sql
ALTER TABLE `Person` ADD `petName` VARCHAR(255);
```

## Changing the datatype of a column

```js
queryInterface.changeColumn('Person', 'foo', {
  type: DataTypes.FLOAT,
  defaultValue: 3.14,
  allowNull: false
});
```

Generated SQL (using MySQL):

```sql
ALTER TABLE `Person` CHANGE `foo` `foo` FLOAT NOT NULL DEFAULT 3.14;
```

## Removing a column

```js
queryInterface.removeColumn('Person', 'petName', { /* query options */ });
```

Generated SQL (using PostgreSQL):

```SQL
ALTER TABLE "public"."Person" DROP COLUMN "petName";
```

## Changing and removing columns in SQLite

SQLite does not support directly altering and removing columns. However, Sequelize will try to work around this by recreating the whole table with the help of a backup table, inspired by [these instructions](https://www.sqlite.org/lang_altertable.html#otheralter).

For example:

```js
// Assuming we have a table in SQLite created as follows:
queryInterface.createTable('Person', {
  name: DataTypes.STRING,
  isBetaMember: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  petName: DataTypes.STRING,
  foo: DataTypes.INTEGER
});

// And we change a column:
queryInterface.changeColumn('Person', 'foo', {
  type: DataTypes.FLOAT,
  defaultValue: 3.14,
  allowNull: false
});
```

The following SQL calls are generated for SQLite:

```sql
PRAGMA TABLE_INFO(`Person`);

CREATE TABLE IF NOT EXISTS `Person_backup` (
  `name` VARCHAR(255),
  `isBetaMember` TINYINT(1) NOT NULL DEFAULT 0,
  `foo` FLOAT NOT NULL DEFAULT '3.14',
  `petName` VARCHAR(255)
);

INSERT INTO `Person_backup`
  SELECT
    `name`,
    `isBetaMember`,
    `foo`,
    `petName`
  FROM `Person`;

DROP TABLE `Person`;

CREATE TABLE IF NOT EXISTS `Person` (
  `name` VARCHAR(255),
  `isBetaMember` TINYINT(1) NOT NULL DEFAULT 0,
  `foo` FLOAT NOT NULL DEFAULT '3.14',
  `petName` VARCHAR(255)
);

INSERT INTO `Person`
  SELECT
    `name`,
    `isBetaMember`,
    `foo`,
    `petName`
  FROM `Person_backup`;

DROP TABLE `Person_backup`;
```

## Other

As mentioned in the beginning of this guide, there is a lot more to the Query Interface available in Sequelize! Check the [QueryInterface API](../class/lib/dialects/abstract/query-interface.js~QueryInterface.html) for a full list of what can be done.