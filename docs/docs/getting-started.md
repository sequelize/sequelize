## Installation

Sequelize is available via NPM.

```bash
$ npm install --save sequelize

# And one of the following:
$ npm install --save pg
$ npm install --save mysql
$ npm install --save mariasql
$ npm install --save sqlite3
$ npm install --save tedious // MSSQL
```

## Setting up a connection

Sequelize will setup a connection pool on initialization so you should ideally only ever create on instance per application.

```js
var sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'mysql'|'mariadb'|'sqlite'|'postgres'|'mssql',

  pool: {
    max: 5,
    min: 0,
    idle: 10000
  },

  // SQLite only
  storage: 'path/to/database.sqlite'
});

// Or you can simply use a connection uri
var sequelize = new Sequelize('postgress://user:pass@example.com:5432/dbname');
```

The Sequelize constructor takes a whole slew of options that are available via the [API reference](http://sequelize.readthedocs.org/en/latest/api/sequelize/).

## Your first model

Models are defined with `sequelize.define('name', {attributes}, {options})`.

```js
var User = sequelize.define('user', {
  firstName: {
    type: Sequelize.STRING,
    field: 'first_name' // Will result in an attribute that is firstName when user facing but first_name in the database
  },
  lastName: {
    type: Sequelize.STRING
  }
}, {
  freezeTableName: true // Model tableName will be the same as the model name
});

User.sync({force: true}).then(function () {
  // Table created
  return User.create({
    firstName: 'John',
    lastName: 'Hancock'
  });
});
```

Many more options can be found in the [Model API reference](http://sequelize.readthedocs.org/en/latest/api/model/)

### Application wide model options

The Sequelize constructor takes a `define` option which will be used as the default options for all defined models.

```js
var sequelize = new Sequelize('connectionUri', {
  timestamps: false // true by default
});

var User = sequelize.define('user', {}); // timestamps is false by default
var Post = sequelize.define('user', {}, {
  timestamps: true // timestamps will now be true
}); 

```