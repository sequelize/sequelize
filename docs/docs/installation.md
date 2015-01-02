Sequelize is available via NPM.

```bash
$ npm install --save sequelize

# And one of the following:
$ npm install --save pg
$ npm install --save mysql
$ npm install --save mariasql
$ npm install --save sqlite3
```

## Setting up a connection

Sequelize will setup a connection pool on initialization so you should ideally only ever create on instance per application.

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql'|'mariadb'|'sqlite'|'postgres'|'mssql'
});

// Or you can simply use a connection uri
var sequelize = new Sequelize('postgress://user:pass@example.com:5432/dbname');
```

The Sequelize constructor takes a whole slew of options that are available via the [API reference](http://sequelize.readthedocs.org/en/latest/api/sequelize/).