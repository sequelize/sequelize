## Installation

Sequelize is available via NPM.

```bash
$ npm install --save sequelize

# And one of the following:
$ npm install --save pg pg-hstore
$ npm install --save mysql // For both mysql and mariadb dialects
$ npm install --save sqlite3
$ npm install --save tedious // MSSQL
```

## Setting up a connection

Sequelize will setup a connection pool on initialization so you should ideally only ever create one instance per database.

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
var sequelize = new Sequelize('postgres://user:pass@example.com:5432/dbname');
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
  define: {
    timestamps: false // true by default
  }
});

var User = sequelize.define('user', {}); // timestamps is false by default
var Post = sequelize.define('post', {}, {
  timestamps: true // timestamps will now be true
});
```

## Promises
Sequelize uses promises to control async control-flow. If you are unfamilar with how promises work, now might be a good time to brush up on them, [here](https://github.com/wbinnssmith/awesome-promises) and [here](https://github.com/petkaantonov/bluebird#what-are-promises-and-why-should-i-use-them)

Basically a promise represents a value which will be present at some point - "I promise you I will give you a result or an error at some point". This means that

```js
// DON'T DO THIS
user = User.findOne()

console.log(user.name);
```

_will never work!_ This is because `user` is a promise object, not a data row from the DB. The right way to do it is:

```js
User.findOne().then(function (user) {
    console.log(user.name);
});
```

Once you've got the hang of what promises are and how they work, use the [bluebird API reference](https://github.com/petkaantonov/bluebird/blob/master/API.md) as your go to tool. In particular, you'll probably be using [`.all`](https://github.com/petkaantonov/bluebird/blob/master/API.md#all---promise) a lot.  
