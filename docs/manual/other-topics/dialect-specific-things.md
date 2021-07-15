# Dialect-Specific Things

## Underlying Connector Libraries

### MySQL

The underlying connector library used by Sequelize for MySQL is the [mysql2](https://www.npmjs.com/package/mysql2) npm package (version 1.5.2 or higher).

You can provide custom options to it using the `dialectOptions` in the Sequelize constructor:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql',
  dialectOptions: {
    // Your mysql2 options here
  }
})
```

### MariaDB

The underlying connector library used by Sequelize for MariaDB is the [mariadb](https://www.npmjs.com/package/mariadb) npm package.

You can provide custom options to it using the `dialectOptions` in the Sequelize constructor:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mariadb',
  dialectOptions: {
    // Your mariadb options here
    // connectTimeout: 1000
  }
});
```

### SQLite

The underlying connector library used by Sequelize for SQLite is the [sqlite3](https://www.npmjs.com/package/sqlite3) npm package (version 4.0.0 or above).

You specify the storage file in the Sequelize constructor with the `storage` option (use `:memory:` for an in-memory SQLite instance).

You can provide custom options to it using the `dialectOptions` in the Sequelize constructor:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: 'path/to/database.sqlite' // or ':memory:'
  dialectOptions: {
    // Your sqlite3 options here
  }
});
```

### PostgreSQL

The underlying connector library used by Sequelize for PostgreSQL is the [pg](https://www.npmjs.com/package/pg) npm package (version 7.0.0 or above). The module [pg-hstore](https://www.npmjs.com/package/pg-hstore) is also necessary.

You can provide custom options to it using the `dialectOptions` in the Sequelize constructor:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'postgres',
  dialectOptions: {
    // Your pg options here
  }
});
```

To connect over a unix domain socket, specify the path to the socket directory in the `host` option. The socket path must start with `/`.

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'postgres',
  host: '/path/to/socket_directory'
});
```

### MSSQL

The underlying connector library used by Sequelize for MSSQL is the [tedious](https://www.npmjs.com/package/tedious) npm package (version 6.0.0 or above).

You can provide custom options to it using `dialectOptions.options` in the Sequelize constructor:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mssql',
  dialectOptions: {
    // Observe the need for this nested `options` field for MSSQL
    options: {
      // Your tedious options here
      useUTC: false,
      dateFirst: 1
    }
  }
});
```

#### MSSQL Domain Account

In order to connect with a domain account, use the following format.

```js
const sequelize = new Sequelize('database', null, null, {
  dialect: 'mssql',
  dialectOptions: {
    authentication: {
      type: 'ntlm',
      options: {
        domain: 'yourDomain',
        userName: 'username',
        password: 'password'
      }
    },
    options: {
      instanceName: 'SQLEXPRESS'
    }
  }
})
```

## Data type: TIMESTAMP WITHOUT TIME ZONE - PostgreSQL only

If you are working with the PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` and you need to parse it to a different timezone, please use the pg library's own parser:

```js
require('pg').types.setTypeParser(1114, stringValue => {
  return new Date(stringValue + '+0000');
  // e.g., UTC offset. Use any offset that you would like.
});
```

## Data type: ARRAY(ENUM) - PostgreSQL only

Array(Enum) type requireS special treatment. Whenever Sequelize will talk to the database, it has to typecast array values with ENUM name.

So this enum name must follow this pattern `enum_<table_name>_<col_name>`. If you are using `sync` then correct name will automatically be generated.

## Table Hints - MSSQL only

The `tableHint` option can be used to define a table hint. The hint must be a value from `TableHints` and should only be used when absolutely necessary. Only a single table hint is currently supported per query.

Table hints override the default behavior of MSSQL query optimizer by specifing certain options. They only affect the table or view referenced in that clause.

```js
const { TableHints } = require('sequelize');
Project.findAll({
  // adding the table hint NOLOCK
  tableHint: TableHints.NOLOCK
  // this will generate the SQL 'WITH (NOLOCK)'
})
```

## Index Hints - MySQL/MariaDB only

The `indexHints` option can be used to define index hints. The hint type must be a value from `IndexHints` and the values should reference existing indexes.

Index hints [override the default behavior of the MySQL query optimizer](https://dev.mysql.com/doc/refman/5.7/en/index-hints.html).

```js
const { IndexHints } = require("sequelize");
Project.findAll({
  indexHints: [
    { type: IndexHints.USE, values: ['index_project_on_name'] }
  ],
  where: {
    id: {
      [Op.gt]: 623
    },
    name: {
      [Op.like]: 'Foo %'
    }
  }
});
```

The above will generate a MySQL query that looks like this:

```sql
SELECT * FROM Project USE INDEX (index_project_on_name) WHERE name LIKE 'FOO %' AND id > 623;
```

`Sequelize.IndexHints` includes `USE`, `FORCE`, and `IGNORE`.

See [Issue #9421](https://github.com/sequelize/sequelize/issues/9421) for the original API proposal.

## Engines - MySQL/MariaDB only

The default engine for a model is InnoDB.

You can change the engine for a model with the `engine` option (e.g., to MyISAM):

```js
const Person = sequelize.define('person', { /* attributes */ }, {
  engine: 'MYISAM'
});
```

Like every option for the definition of a model, this setting can also be changed globally with the `define` option of the Sequelize constructor:

```js
const sequelize = new Sequelize(db, user, pw, {
  define: { engine: 'MYISAM' }
})
```

## Table comments - MySQL/MariaDB/PostgreSQL only

You can specify a comment for a table when defining the model:

```js
class Person extends Model {}
Person.init({ /* attributes */ }, {
  comment: "I'm a table comment!",
  sequelize
})
```

The comment will be set when calling `sync()`.
