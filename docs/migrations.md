# Migrations

Just like you use Git / SVN to manage changes in your source code, you can use migrations to keep track of changes to database. With migrations you can transfer your existing database into another state and vice versa: Those state transitions are saved in migration files, which describe the way how to get to the new state and how to revert the changes in order to get back to the old state.

You will need [Sequelize CLI][0]. The CLI ships support for migrations and project bootstrapping.

## The CLI

### Installing CLI
Lets start with installing CLI, you can find instructions [here][0]. Most preferred way is installing locally like this

```bash
$ npm install --save sequelize-cli
```

### Bootstrapping
To create an empty project you will need to execute `init` command

```bash
$ node_modules/.bin/sequelize init
```

This will create following folders

1) `config`, contains config file, which tells CLI how to connect with database
2) `models`, contains all models for your project
3) `migrations`, contains all migration files
4) `seeders`, contains all seed files

#### Configuration
Before continuing further we will need to tell CLI how to connect to database. To do that lets open default config file `config/config.json`. It looks something like this

```json
{
  development: {
    username: 'root',
    password: null,
    database: 'database_development',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  test: {
    username: 'root',
    password: null,
    database: 'database_test',
    host: '127.0.0.1',
    dialect: 'mysql'
  },
  production: {
    username: 'root',
    password: null,
    database: 'database_production',
    host: '127.0.0.1',
    dialect: 'mysql'
  }
}
```

Now edit this file and set correct database credentials and dialect.

**Note:** _If your database doesn't exists yet, you can just call `db:create` command. With proper access it will create that database for you._

### Creating first Model (and Migration)
Once you have properly configured CLI config file you are ready to create you first migration. Its as simple as executing a simple command.

We will use `model:generate` command. This command requires two options

1) `name`, Name of the model
2) `attributes`, List of model attributes

Lets create a model named `User`

```bash
$ node_modules/.bin/sequelize model:generate --name User --attributes firstName:string,lastName:string,email:string
```

This will do following

1) Create a model named `User` in `models` folder
2) Create a migration file with name like `XXXXXXXXXXXXXX-create-user.js` in `migrations` folder

**Note:** _Sequelize will only use Model files, its the table representation. On other hand migration file is a change in that model or more specifically that table, used by CLI. Treat migrations like a commit or a log for some change in database._

### Running Migrations
Now till this step CLI haven't inserted anything into database. We have just created required model and migration files for our first model `User`. Now to actually create that table in database you need to run `db:migrate` command.

```bash
$ node_modules/.bin/sequelize db:migrate
```

This command will execute these steps

1) It will ensure a table called `SequelizeMeta` in database. This table is used to record which migration have ran on current database
2) Start looking for any migration files which haven't ran yet. This is possible by checking `SequelizeMeta` table. In this case it will run `XXXXXXXXXXXXXX-create-user.js` migration, which we created in last step.
3) Creates a table called `User` with all columns as specified in its migration file.

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

The passed `queryInterface` object can be used to modify the database. The `Sequelize` object stores the available data types such as `STRING` or `INTEGER`. Function `up` or `down` should return a `Promise`. Lets look at an example

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
This is a special configuration file. It let you specify various options that you would usually pass as arguments to CLI. Some scenarios where you can use it.

1) You want to override default path to `migrations`, `models`, `seeders` or `config` folder.
2) You want to rename `config.json` to something else like `database.json`

And a whole lot more. Let see how you can use this file for custom configuration.

For starters lets create an empty file in root directory of your project.

```bash
$ touch .sequelizerc
```

Now lets work with an example config.

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

1) Use `config/database.json` file for config settings
2) Use `db/models` as models folder
3) Use `db/seeders` as seeders folder
4) Use `db/migrations` as migrations folder

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
var fs = require('fs');

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
Sometime you want to specify a dialectOption, if its a general config you can just add it in `config/config.json`. Sometime you want to execute some code to get dialectOptions, you should use dynamic config file for those cases.

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

## Query Interface Functions

Using the `queryInterface` object described before, you will have access to most of already introduced functions. Furthermore there are some other methods, which are designed to actually change the database schema.

### createTable(tableName, attributes, options)

This method allows creation of new tables. It is allowed to pass simple or complex attribute definitions. You can define the encoding of the table and the table's engine via options

```js
queryInterface.createTable(
  'nameOfTheNewTable',
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    createdAt: {
      type: Sequelize.DATE
    },
    updatedAt: {
      type: Sequelize.DATE
    },
    attr1: Sequelize.STRING,
    attr2: Sequelize.INTEGER,
    attr3: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    //foreign key usage
    attr4: {
      type: Sequelize.INTEGER,
      references: {
        model: 'another_table_name',
        key: 'id'
      },
      onUpdate: 'cascade',
      onDelete: 'cascade'
    }
  },
  {
    engine: 'MYISAM',                     // default: 'InnoDB'
    charset: 'latin1',                    // default: null
    schema: 'public'                      // default: public, PostgreSQL only.
  }
)
```

### dropTable(tableName, options)

This method allows deletion of an existing table.

```js
queryInterface.dropTable('nameOfTheExistingTable')
```

### dropAllTables(options)

This method allows deletion of all existing tables in the database.

```js
queryInterface.dropAllTables()
```

### renameTable(before, after, options)

This method allows renaming of an existing table.

```js
queryInterface.renameTable('Person', 'User')
```

### showAllTables(options)

This method returns the name of all existing tables in the database.

```js
queryInterface.showAllTables().then(tableNames => {})
```

### describeTable(tableName, options)

This method returns an array of hashes containing information about all attributes in the table.

```js
queryInterface.describeTable('Person').then(attributes => {
  /*
    attributes will be something like:
 
    {
      name: {
        type:         'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
        allowNull:    true,
        defaultValue: null
      },
      isBetaMember: {
        type:         'TINYINT(1)', // this will be 'BOOLEAN' for pg!
        allowNull:    false,
        defaultValue: false
      }
    }
  */
})
```

### addColumn(tableNameOrOptions, attributeName, dataTypeOrOptions, options)

This method allows adding columns to an existing table. The data type can be simple or complex.

```js
queryInterface.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  Sequelize.STRING
)
 
// or
 
queryInterface.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  {
    type: Sequelize.STRING,
    allowNull: false
  }
)

// or with first attribute to put the column at the beginning of the table
// currently supports only in MySQL

queryInterface.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  {
    type: Sequelize.STRING,
    first: true
  }
)

// or with after attribute to put the column after a specific column
// currently supports only in MySQL

queryInterface.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  {
    type: Sequelize.STRING,
    after: 'nameOfAnExistingColumn'
  }
)

// or with an explicit schema:

queryInterface.addColumn({
    tableName: 'Person',
    schema: 'public'
  },
  'signature',
  Sequelize.STRING
)

```

### removeColumn(tableNameOrOptions, attributeName, options)

This method allows deletion of a specific column of an existing table.

```js
queryInterface.removeColumn('Person', 'signature')

// or with an explicit schema:

queryInterface.removeColumn({
  tableName: 'Person',
  schema: 'public'
}, 'signature');
```

### changeColumn(tableName, attributeName, dataTypeOrOptions, options)

This method changes the meta data of an attribute. It is possible to change the default value, allowance of null or the data type. Please make sure, that you are completely describing the new data type.

```js
queryInterface.changeColumn(
  'nameOfAnExistingTable',
  'nameOfAnExistingAttribute',
  {
    type: Sequelize.FLOAT,
    allowNull: false,
    defaultValue: 0.0
  }
)
```

### renameColumn(tableName, attrNameBefore, attrNameAfter, options)

This methods allows renaming attributes.

```js
queryInterface.renameColumn('Person', 'signature', 'sig')
```

### addIndex(tableName, attributes, options)

This methods creates indexes for specific attributes of a table. The index name will be automatically generated if it is not passed via in the options (see below).

```js
// This example will create the index person_firstname_lastname
queryInterface.addIndex('Person', ['firstname', 'lastname'])

// This example will create a unique index with the name SuperDuperIndex using the optional 'options' field.
// Possible options:
// - indicesType: UNIQUE|FULLTEXT|SPATIAL
// - indexName: The name of the index. Default is __
// - parser: For FULLTEXT columns set your parser
// - indexType: Set a type for the index, e.g. BTREE. See the documentation of the used dialect
// - logging: A function that receives the sql query, e.g. console.log
// - where: A hash of attributes to limit your index(Filtered Indexes - MSSQL & PostgreSQL only)
queryInterface.addIndex(
  'Person',
  ['firstname', 'lastname'],
  {
    indexName: 'SuperDuperIndex',
    indicesType: 'UNIQUE'
  }
)

queryInterface.addIndex(
  'Person',
  ['firstname', 'lastname'],
  {
    where: {
      lastname: {
        $ne: null
      }
    }
  }
)
```

### removeIndex(tableName, indexNameOrAttributes, options)

This method deletes an existing index of a table.

```js
queryInterface.removeIndex('Person', 'SuperDuperIndex')
 
// or
 
queryInterface.removeIndex('Person', ['firstname', 'lastname'])
```

### addConstraint(tableName, attributes, options)
This method adds a new constraint of the specified type.
 - tableName - Name of the table to add the constraint on
 - attributes - Array of column names to apply the constraint over
 - options - An object to define the constraint name, type etc.

Available options:
 - type - Type of constraint. One of the values in available constraints(case insensitive)
 - name - Name of the constraint. If not specified, sequelize automatically creates a named constraint based on constraint type, table & column names
 - defaultValue - The value for the default constraint
 - where - Where clause/expression for the CHECK constraint
 - references - Object specifying target table, column name to create foreign key constraint
 - references.table - Target table name or table
 - references.field - Target column name
Available constraints:
 - UNIQUE
 - DEFAULT (MSSQL only)
 - CHECK (MySQL - Ignored by the database engine )
 - FOREIGN KEY
 - PRIMARY KEY

```js
//UNIQUE
queryInterface.addConstraint('Users', ['email'], {
  type: 'unique',
  name: 'custom_unique_constraint_name'
});

//CHECK
queryInterface.addConstraint('Users', ['roles'], {
  type: 'check',
  where: {
    roles: ['user', 'admin', 'moderator', 'guest']
  }
});

//Default - MSSQL only
queryInterface.addConstraint('Users', ['roles'], {
  type: 'default',
  defaultValue: 'guest'
});

//Primary Key
queryInterface.addConstraint('Users', ['username'], {
  type: 'primary key',
  name: 'custom_primary_constraint_name'
});

//Foreign Key
queryInterface.addConstraint('Posts', ['username'], {
  type: 'FOREIGN KEY',
  name: 'custom_fkey_constraint_name',
  references: { //Required field
    table: 'target_table_name',
    field: 'target_column_name'
  },
  onDelete: 'cascade',
  onUpdate: 'cascade'
});
```

### removeConstraint(tableName, constraintName, options)

This method deletes an existing constraint of a table

```js
queryInterface.removeConstraint('Users', 'my_constraint_name');

```

### showConstraint(tableName, options)

Lists all the constraints on the given table.

```js
queryInterface.showConstraint('Users');
// Returns array of objects/constraints
```


[0]: https://github.com/sequelize/cli
[1]: https://github.com/sequelize/umzug
