# Standard Implementation Guide

This is a step-by-step tutorial for a standard setup of sequelize using Node.js and Express.js.

**Code Examples**

* [sequelize-ui](https://sequelizeui.app/) is a GUI for building models and relations and it outputs a framework agnostic implementation of sequelize.
* [Express-examples](https://github.com/sequelize/express-example) Contains two different examples of sequelize implementation inside express.

## Setup Connection

Sequelize works with many flavors of SQL databases, so install one of them your computer. For this example, we will be using PostgreSQL as our database dialect. So install PostgreSQL and then create your db

```bash
$ createdb my-db
```

Next Install `sequelize`, `sequelize-cli`, and your database's driver modules (here postgres):

```bash
$ npm install sequelize sequelize-cli pg pg-hstore
```

Next create a `.sequelizerc` file to direct `sequelize-cli` to instantiate all files and folders into a folder called `/db`. So make that file with the following contents:

```
const path = require('path');
module.exports = {
  "config": path.resolve('./db/config', 'config.json'),
  "models-path": path.resolve('./db/models'),
  "seeders-path": path.resolve('./db/seeders'),
  "migrations-path": path.resolve('./db/migrations')
};
```

Now that we have the `.sequelizerc` file setup, let's initialize Sequelize with the command line tool.

```bash
  $ sequelize init
```

This will create the following folder and file structure:

```
  /db
    /config
      - config.json
    /models
      - index.js
    /migrations
    /seeders
```

The `config/config.json` file has the configuration setup for your development, test, and production environments. The `models/index.js` file has boilerplate code that will unify and associate the models you put in the `models` directory.

Customize the `config/config.json` file so the database name lines up with the database you created above:

```
{
  "development": {
    "username": null,
    "password": null,
    "database": "db-name",
    "host": "127.0.0.1",
    "dialect": "postgres"
  },
  "test": {
    "username": null,
    "password": null,
    "database": "db-name-test",
    "host": "127.0.0.1",
    "dialect": "postgres"
  },
  "production": {
    "use_env_variable": "PROD_DATABASE_URL"
  }
}
```

Test that your connection is live. In your `models/index.js` file add the following code after the variable `sequelize` is defined.

```js
sequelize.authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });
```

Your database setup and connected! Now we just need to define models and migrations to begin reading and writing to our database.

## Define and Run a Migration

Now that we've made a connection to our new database, its time to define a migration to create a table in our SQL database and a corresponding model so we can use Sequelize to read and write to it.

For this example we'll pretend we are making a todo list app and want to create a `Todos` migration and table and then a `Todo` model.

To define a migration use the `sequelize-cli` generator:

```bash
$ sequelize migration:generate --name create-todo
```

This will create a migration file in the `db/migrations` folder with the standard `up` and `down` method boilerplate. To create a `Todos` table update those methods as follows:

```js
// migrations/20201206223919-create-todo.js
'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('todos', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING
      },
      desc: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('todos');
  }
};
```

Once your migration is created its time to run it:

```bash
$ sequelize db:migrate
```

It is not recommended to roll back migrations once the've been run in production, instead simply make another migration. However, you do have the option to roll back a migration with the following command.

```bash
$ sequelize db:migrate:undo
```

## Define a Model

To create a model, add a file called `todo.js` do your `db/models` directory. In that file add the following code:

```js
// models/todo.js
'use strict';
module.exports = (sequelize, DataTypes) => {
  const Todo = sequelize.define('todo', {
    title: DataTypes.STRING,
    desc: DataTypes.TEXT
  }, {});

  Todo.associate = function(models) {
    // associations can be defined here
  };

  return Todo;
};
```

Using this `Todo` model we can use Sequelize's query API to read and write data to the `Todos` table.

## Write Queries

You can run queries such as:

```js
const models  = require('../db/models');
// INDEX

models.Todo.findAll({ where: { finished: true } }).then(todos => {
  let completedTodos = todos;
}).catch(err => { console.log(err) })

```

```js
// CREATE

let todo = await models.Todo.create(req.body);

```

```js
// UPDATE

let todo = await models.Todo.findById(todoId);
todo = await task.update(req.body);

```

```js
// DESTROY
Todo.findById(todoId).then(todo => {
  todo.destroy()
}).catch(err => ({ console.log(err) })
```
