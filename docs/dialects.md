# Dialects

Sequelize is independent from specific dialects. This means that you'll have to install the respective connector library to your project yourself.

## MySQL

In order to get Sequelize working nicely together with MySQL, you'll need to install`mysql2@^1.5.2`or higher. Once that's done you can use it like this:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mysql'
})
```

**Note:** You can pass options directly to dialect library by setting the
`dialectOptions` parameter. See [Options](/manual/usage.html#options).

## MariaDB

Library for MariaDB is `mariadb`.

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mariadb',
  dialectOptions: {connectTimeout: 1000} // mariadb connector option
})
```

or using connection String:

```js
const sequelize = new Sequelize('mariadb://user:password@example.com:9821/database')
```

## SQLite

For SQLite compatibility you'll need`sqlite3@^4.0.0`. Configure Sequelize like this:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // sqlite! now!
  dialect: 'sqlite',

  // the storage engine for sqlite
  // - default ':memory:'
  storage: 'path/to/database.sqlite'
})
```

Or you can use a connection string as well with a path:

```js
const sequelize = new Sequelize('sqlite:/home/abs/path/dbname.db')
const sequelize = new Sequelize('sqlite:relativePath/dbname.db')
```

## PostgreSQL

For PostgreSQL, two libraries are needed, `pg@^7.0.0` and `pg-hstore`. You'll just need to define the dialect:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // gimme postgres, please!
  dialect: 'postgres'
})
```

To connect over a unix domain socket, specify the path to the socket directory
in the `host` option.

The socket path must start with `/`.

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  // gimme postgres, please!
  dialect: 'postgres',
  host: '/path/to/socket_directory'
})
```

## MSSQL

The library for MSSQL is`tedious@^6.0.0` You'll just need to define the dialect:

```js
const sequelize = new Sequelize('database', 'username', 'password', {
  dialect: 'mssql'
})
```
