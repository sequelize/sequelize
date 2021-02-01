# Sequelize CLI

[Sequelize Command-Line Interface (sequelize-cli)](https://github.com/sequelize/cli) gives you command line support to initialize your project, create and run migration files, and various generators that help with quickly getting your project up and running.

## Installing the CLI

To install the Sequelize CLI:

```text
npm install sequelize-cli
```

For details see the [CLI GitHub repository](https://github.com/sequelize/cli).

### The `.sequelizerc` file

This is a special configuration file. It lets you specify the following options that you would usually pass as arguments to CLI:

- `env`: The environment to run the command in
- `config`: The path to the config file
- `options-path`: The path to a JSON file with additional options
- `migrations-path`: The path to the migrations folder
- `seeders-path`: The path to the seeders folder
- `models-path`: The path to the models folder
- `url`: The database connection string to use. Alternative to using --config files
- `debug`: When available show various debug information

Some scenarios where you can use it:

- You want to override default path to `migrations`, `models`, `seeders` or `config` folder.
- You want to rename `config.json` to something else like `database.json`

And a whole lot more. Let's see how you can use this file for custom configuration.

For example, if you created a `.sequelizerc` file in the root directory of your project, with the following content:

```js
// .sequelizerc

const path = require('path');

module.exports = {
  'config': path.resolve('config', 'database.json'),
  'models-path': path.resolve('db', 'models'),
  'seeders-path': path.resolve('db', 'seeders'),
  'migrations-path': path.resolve('db', 'migrations')
};
```

This changes the default paths to the following:

- Use `config/database.json` file for config settings;
- Use `db/models` as models folder;
- Use `db/seeders` as seeders folder;
- Use `db/migrations` as migrations folder.

### Dynamic configuration

The configuration file is by default a JSON file called `config.json`. But sometimes you need a dynamic configuration, for example to access environment variables or execute some other code to determine the configuration.

Thankfully, the Sequelize CLI can read from both `.json` and `.js` files. This can be setup with `.sequelizerc` file. You just have to provide the path to your `.js` file as the `config` option of your exported object:

```js
const path = require('path');

module.exports = {
  'config': path.resolve('config', 'config.js')
}
```

Now the Sequelize CLI will load `config/config.js` for getting configuration options.

**Security Reminder**: Always use environment variables for config settings. This is because secrets such as passwords should never be part of the source code (and especially not committed to version control).

An example of `config/config.js` file:

```js
const fs = require('fs');

module.exports = {
  development: {
    username: 'database_dev',
    password: 'database_dev',
    database: 'database_dev',
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
    dialectOptions: {
      bigNumberStrings: true
    }
  },
  test: {
    username: process.env.CI_DB_USERNAME,
    password: process.env.CI_DB_PASSWORD,
    database: process.env.CI_DB_NAME,
    host: '127.0.0.1',
    port: 3306,
    dialect: 'mysql',
    dialectOptions: {
      bigNumberStrings: true
    }
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_NAME,
    host: process.env.PROD_DB_HOSTNAME,
    port: process.env.PROD_DB_PORT,
    dialect: 'mysql',
    dialectOptions: {
      bigNumberStrings: true,
      ssl: {
        ca: fs.readFileSync(__dirname + '/mysql-ca-master.crt')
      }
    }
  }
};
```

The example above also shows how to add custom dialect options to the configuration.

### Using Babel

To enable more modern constructions in your migrations and seeders, you can simply install `babel-register` and require it at the beginning of `.sequelizerc`:

```text
npm i --save-dev babel-register
```

```js
// .sequelizerc

require("babel-register");

const path = require('path');

module.exports = {
  'config': path.resolve('config', 'config.json'),
  'models-path': path.resolve('models'),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations')
}
```

Of course, the outcome will depend upon your babel configuration (such as in a `.babelrc` file). Learn more at [babeljs.io](https://babeljs.io).
