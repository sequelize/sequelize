# Migrations

Just like you use Git / SVN to manage changes in your source code, you can use migrations to keep track of changes to the database. With migrations you can transfer your existing database into another state and vice versa: Those state transitions are saved in migration files, which describe how to get to the new state and how to revert the changes in order to get back to the old state.

You will need [Sequelize CLI][0]. The CLI ships support for migrations and project bootstrapping.

## The CLI

### Installing CLI
Let's start with installing CLI, you can find instructions [here][0]. Most preferred way is installing locally like this

```bash
$ npm install --save sequelize-cli
```

### Bootstrapping
To create an empty project you will need to execute `init` command

```bash
$ node_modules/.bin/sequelize init
```

This will create following folders

- `config`, contains config file, which tells CLI how to connect with database
- `models`, contains all models for your project
- `migrations`, contains all migration files
- `seeders`, contains all seed files

#### Configuration
Before continuing further we will need to tell CLI how to connect to database. To do that let's open default config file `config/config.json`. It looks something like this

```json
{
  "development": {
    "username": "root",
    "password": null,
    "database": "database_development",
    "host": "127.0.0.1",
    "dialect": "mysql"
  },
  "test": {
    "username": "root",
    "password": null,
    "database": "database_test",
    "host": "127.0.0.1",
    "dialect": "mysql"
  },
  "production": {
    "username": "root",
    "password": null,
    "database": "database_test",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

Now edit this file and set correct database credentials and dialect.

**Note:** _If your database doesn't exists yet, you can just call `db:create` command. With proper access it will create that database for you._

### Creating first Model (and Migration)
Once you have properly configured CLI config file you are ready to create your first migration. It's as simple as executing a simple command.

We will use `model:generate` command. This command requires two options

- `name`, Name of the model
- `attributes`, List of model attributes

Let's create a model named `User`.

```bash
$ node_modules/.bin/sequelize model:generate --name User --attributes firstName:string,lastName:string,email:string
```

This will do following

- Create a model file `user` in `models` folder
- Create a migration file with name like `XXXXXXXXXXXXXX-create-user.js` in `migrations` folder

**Note:** _Sequelize will only use Model files, it's the table representation. On the other hand, the migration file is a change in that model or more specifically that table, used by CLI. Treat migrations like a commit or a log for some change in database._

### Running Migrations
Until this step, we haven't inserted anything into the database. We have just created required model and migration files for our first model `User`. Now to actually create that table in database you need to run `db:migrate` command.

```bash
$ node_modules/.bin/sequelize db:migrate
```

This command will execute these steps:

- Will ensure a table called `SequelizeMeta` in database. This table is used to record which migrations have run on the current database
- Start looking for any migration files which haven't run yet. This is possible by checking `SequelizeMeta` table. In this case it will run `XXXXXXXXXXXXXX-create-user.js` migration, which we created in last step.
- Creates a table called `Users` with all columns as specified in its migration file.

### Undoing Migrations
Now our table has been created and saved in database. With migration you can revert to old state by just running a command.

You can use `db:migrate:undo`, this command will revert most recent migration.

```bash
$ node_modules/.bin/sequelize db:migrate:undo
```

You can revert back to initial state by undoing all migrations with `db:migrate:undo:all` command. You can also revert back to a specific migration by passing its name in `--to` option.

```bash
$ node_modules/.bin/sequelize db:migrate:undo:all --to XXXXXXXXXXXXXX-create-posts.js
```

### Creating First Seed
Suppose we want to insert some data into a few tables by default. If we follow up on previous example we can consider creating a demo user for `User` table.

To manage all data migrations you can use seeders. Seed files are some change in data that can be used to populate database table with sample data or test data.

Let's create a seed file which will add a demo user to our `User` table.

```bash
$ node_modules/.bin/sequelize seed:generate --name demo-user
```

This command will create a seed file in `seeders` folder. File name will look something like `XXXXXXXXXXXXXX-demo-user.js`. It follows the same `up / down` semantics as the migration files.

Now we should edit this file to insert demo user to `User` table.

```js
'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('Users', [{
        firstName: 'John',
        lastName: 'Doe',
        email: 'demo@demo.com'
      }], {});
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Users', null, {});
  }
};

```

### Running Seeds
In last step you have create a seed file. It's still not committed to database. To do that we need to run a simple command.

```bash
$ node_modules/.bin/sequelize db:seed:all
```

This will execute that seed file and you will have a demo user inserted into `User` table.

**Note:** _Seeders execution is not stored anywhere unlike migrations, which use the `SequelizeMeta` table. If you wish to override this please read `Storage` section_

### Undoing Seeds
Seeders can be undone if they are using any storage. There are two commands available for that:

If you wish to undo most recent seed

```bash
node_modules/.bin/sequelize db:seed:undo
```

If you wish to undo all seeds

```bash
node_modules/.bin/sequelize db:seed:undo:all
```

## Advance Topics

### Migration Skeleton
The following skeleton shows a typical migration file.

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    // logic for transforming into the new state
  },
 
  down: (queryInterface, Sequelize) => {
    // logic for reverting the changes
  }
}
```

The passed `queryInterface` object can be used to modify the database. The `Sequelize` object stores the available data types such as `STRING` or `INTEGER`. Function `up` or `down` should return a `Promise`. Let's look at an example:

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Person', {
        name: Sequelize.STRING,
        isBetaMember: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }
      });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Person');
  }
}
```

### The `.sequelizerc` File
This is a special configuration file. It lets you specify various options that you would usually pass as arguments to CLI. Some scenarios where you can use it.

- You want to override default path to `migrations`, `models`, `seeders` or `config` folder.
- You want to rename `config.json` to something else like `database.json`

And a whole lot more. Let's see how you can use this file for custom configuration.

For starters, let's create an empty file in root directory of your project.

```bash
$ touch .sequelizerc
```

Now let's work with an example config.

```js
const path = require('path');

module.exports = {
  'config': path.resolve('config', 'database.json'),
  'models-path': path.resolve('db', 'models'),
  'seeders-path': path.resolve('db', 'seeders'),
  'migrations-path': path.resolve('db', 'migrations')
}
```

With this config you are telling CLI to

- Use `config/database.json` file for config settings
- Use `db/models` as models folder
- Use `db/seeders` as seeders folder
- Use `db/migrations` as migrations folder

### Dynamic Configuration
Configuration file is by default a JSON file called `config.json`. But sometimes you want to execute some code or access environment variables which is not possible in JSON files.

Sequelize CLI can read from both `JSON` and `JS` files. This can be setup with `.sequelizerc` file. Let see how

First you need to create a `.sequelizerc` file in root folder of your project. This file should override config path to a `JS` file. Like this

```js
const path = require('path');

module.exports = {
  'config': path.resolve('config', 'config.js')
}
```

Now Sequelize CLI will load `config/config.js` for getting configuration options. Since this is a JS file you can have any code executed and export final dynamic configuration file.

An example of `config/config.js` file

```js
const fs = require('fs');

module.exports = {
  development: {
    username: 'database_dev',
    password: 'database_dev',
    database: 'database_dev',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: 'database_test',
    password: null,
    database: 'database_test',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      }
    }
  }
};
```

### Using Environment Variables
With CLI you can directly access the environment variables inside the `config/config.js`. You can use `.sequelizerc` to tell CLI to use `config/config.js` for configuration. This is explained in last section.

Then you can just expose file with proper environment variables.

```js
module.exports = {
  development: {
    username: 'database_dev',
    password: 'database_dev',
    database: 'database_dev',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: process.env.CI_DB_USERNAME,
    password: process.env.CI_DB_PASSWORD,
    database: process.env.CI_DB_NAME,
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_NAME,
    host: process.env.PROD_DB_HOSTNAME,
    dialect: 'mysql'
  }
```

### Specifying Dialect Options
Sometime you want to specify a dialectOption, if it's a general config you can just add it in `config/config.json`. Sometime you want to execute some code to get dialectOptions, you should use dynamic config file for those cases.

```json
{
    "production": {
        "dialect":"mysql",
        "dialectOptions": {
            "bigNumberStrings": true
        }
    }
}
```

### Production Usages
Some tips around using CLI and migration setup in production environment.

1) Use environment variables for config settings. This is better achieved with dynamic configuration. A sample production safe configuration may look like.

```js
const fs = require('fs');

module.exports = {
  development: {
    username: 'database_dev',
    password: 'database_dev',
    database: 'database_dev',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: 'database_test',
    password: null,
    database: 'database_test',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOSTNAME,
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      }
    }
  }
};
```

Our goal is to use environment variables for various database secrets and not accidentally check them in to source control.

### Storage
There are three types of storage that you can use: `sequelize`, `json`, and `none`.

- `sequelize` : stores migrations and seeds in a table on the sequelize database
- `json` : stores migrations and seeds on a json file
- `none` : does not store any migration/seed


#### Migration Storage
By default the CLI will create a table in your database called `SequelizeMeta` containing an entry
for each executed migration. To change this behavior, there are three options you can add to the
configuration file. Using `migrationStorage`, you can choose the type of storage to be used for
migrations. If you choose `json`, you can specify the path of the file using `migrationStoragePath`
or the CLI will write to the file `sequelize-meta.json`. If you want to keep the information in the
database, using `sequelize`, but want to use a different table, you can change the table name using
`migrationStorageTableName`.

```json
{
  "development": {
    "username": "root",
    "password": null,
    "database": "database_development",
    "host": "127.0.0.1",
    "dialect": "mysql",

    // Use a different storage type. Default: sequelize
    "migrationStorage": "json",

    // Use a different file name. Default: sequelize-meta.json
    "migrationStoragePath": "sequelizeMeta.json",

    // Use a different table name. Default: SequelizeMeta
    "migrationStorageTableName": "sequelize_meta"
  }
}
```

**Note:** _The `none` storage is not recommended as a migration storage. If you decide to use it, be
aware of the implications of having no record of what migrations did or didn't run._

#### Seed Storage
By default the CLI will not save any seed that is executed. If you choose to change this behavior (!),
you can use `seederStorage` in the configuration file to change the storage type. If you choose `json`,
you can specify the path of the file using `seederStoragePath` or the CLI will write to the file
`sequelize-data.json`. If you want to keep the information in the database, using `sequelize`, you can
specify the table name using `seederStorageTableName`, or it will default to `SequelizeData`.

```json
{
  "development": {
    "username": "root",
    "password": null,
    "database": "database_development",
    "host": "127.0.0.1",
    "dialect": "mysql",
    // Use a different storage. Default: none
    "seederStorage": "json",
    // Use a different file name. Default: sequelize-data.json
    "seederStoragePath": "sequelizeData.json",
    // Use a different table name. Default: SequelizeData
    "seederStorageTableName": "sequelize_data"
  }
}
```

### Configuration Connection String
As an alternative to the `--config` option with configuration files defining your database, you can
use the `--url` option to pass in a connection string. For example:

```bash
$ node_modules/.bin/sequelize db:migrate --url 'mysql://root:password@mysql_host.com/database_name'
```

### Connecting over SSL
Ensure ssl is specified in both `dialectOptions` and in the base config.

```json
{
    "production": {
        "dialect":"postgres",
        "ssl": true,
        "dialectOptions": {
            "ssl": true
        }
    }
}
```

### Programmatic use
Sequelize has a [sister library][1] for programmatically handling execution and logging of migration tasks.

## Query Interface

Using `queryInterface` object described before you can change database schema. To see full list of public methods it supports check [QueryInterface API][2]


[0]: https://github.com/sequelize/cli
[1]: https://github.com/sequelize/umzug
[2]: /class/lib/query-interface.js~QueryInterface.html
