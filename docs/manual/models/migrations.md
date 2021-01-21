# Migrations

Just like you use [version control](https://en.wikipedia.org/wiki/Version_control) systems such as [Git](https://en.wikipedia.org/wiki/Git) to manage changes in your source code, you can use **migrations** to keep track of changes to the database. With migrations you can transfer your existing database into another state and vice versa: Those state transitions are saved in migration files, which describe how to get to the new state and how to revert the changes in order to get back to the old state.

A Migration in Sequelize is javascript file which exports two functions, `up` and `down`, that dictate how to perform the migration and undo it. You define those functions manually, but you don't call them manually; they will be called automatically by the CLI. In these functions, you should simply perform whatever queries you need, with the help of `sequelize.query` and whichever other methods Sequelize provides to you. There is no extra magic beyond that.

## Project bootstrapping

To create an empty project you will need to execute `init` command

```text
npx sequelize-cli init
```

This will create following folders

- `config`, contains config file, which tells CLI how to connect with database
- `models`, contains all models for your project
- `migrations`, contains all migration files
- `seeders`, contains all seed files

### Configuration

Before continuing further we will need to tell the CLI how to connect to the database. To do that let's open default config file `config/config.json`. It looks something like this:

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
    "database": "database_production",
    "host": "127.0.0.1",
    "dialect": "mysql"
  }
}
```

Note that the Sequelize CLI assumes mysql by default. If you're using another dialect, you need to change the content of the `"dialect"` option.

Now edit this file and set correct database credentials and dialect. The keys of the objects (e.g. "development") are used on `model/index.js` for matching `process.env.NODE_ENV` (When undefined, "development" is a default value).

Sequelize will use the default connection port for each dialect (for example, for postgres, it is port 5432). If you need to specify a different port, use the `"port"` field (it is not present by default in `config/config.js` but you can simply add it).

**Note:** _If your database doesn't exist yet, you can just call `db:create` command. With proper access it will create that database for you._

## Creating the first Model (and Migration)

Once you have properly configured CLI config file you are ready to create your first migration. It's as simple as executing a simple command.

We will use `model:generate` command. This command requires two options:

- `name`: the name of the model;
- `attributes`: the list of model attributes.

Let's create a model named `User`.

```text
npx sequelize-cli model:generate --name User --attributes firstName:string,lastName:string,email:string
```

This will:

- Create a model file `user` in `models` folder;
- Create a migration file with name like `XXXXXXXXXXXXXX-create-user.js` in `migrations` folder.

**Note:** _Sequelize will only use Model files, it's the table representation. On the other hand, the migration file is a change in that model or more specifically that table, used by CLI. Treat migrations like a commit or a log for some change in database._

## Running Migrations

Until this step, we haven't inserted anything into the database. We have just created required model and migration files for our first model `User`. Now to actually create that table in database you need to run `db:migrate` command.

```text
npx sequelize-cli db:migrate
```

This command will execute these steps:

- Will ensure a table called `SequelizeMeta` in database. This table is used to record which migrations have run on the current database
- Start looking for any migration files which haven't run yet. This is possible by checking `SequelizeMeta` table. In this case it will run `XXXXXXXXXXXXXX-create-user.js` migration, which we created in last step.
- Creates a table called `Users` with all columns as specified in its migration file.

## Undoing Migrations

Now our table has been created and saved in database. With migration you can revert to old state by just running a command.

You can use `db:migrate:undo`, this command will revert most recent migration.

```text
npx sequelize-cli db:migrate:undo
```

You can revert back to initial state by undoing all migrations with `db:migrate:undo:all` command. You can also revert back to a specific migration by passing its name in `--to` option.

```text
npx sequelize-cli db:migrate:undo:all --to XXXXXXXXXXXXXX-create-posts.js
```

## Migration Skeleton

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

We can generate this file using `migration:generate`. This will create `xxx-migration-skeleton.js` in your migration folder.

```text
npx sequelize-cli migration:generate --name migration-skeleton
```

The passed `queryInterface` object can be used to modify the database. The `Sequelize` object stores the available data types such as `STRING` or `INTEGER`. Function `up` or `down` should return a `Promise`. Let's look at an example:

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Person', {
      name: Sequelize.DataTypes.STRING,
      isBetaMember: {
        type: Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Person');
  }
};
```

The following is an example of a migration that performs two changes in the database, using an automatically-managed transaction to ensure that all instructions are successfully executed or rolled back in case of failure:

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.addColumn('Person', 'petName', {
          type: Sequelize.DataTypes.STRING
        }, { transaction: t }),
        queryInterface.addColumn('Person', 'favoriteColor', {
          type: Sequelize.DataTypes.STRING,
        }, { transaction: t })
      ]);
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.removeColumn('Person', 'petName', { transaction: t }),
        queryInterface.removeColumn('Person', 'favoriteColor', { transaction: t })
      ]);
    });
  }
};
```

The next example is of a migration that has a foreign key. You can use references to specify a foreign key:

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Person', {
      name: Sequelize.DataTypes.STRING,
      isBetaMember: {
        type: Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },
      userId: {
        type: Sequelize.DataTypes.INTEGER,
        references: {
          model: {
            tableName: 'users',
            schema: 'schema'
          },
          key: 'id'
        },
        allowNull: false
      },
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Person');
  }
}
```

The next example is of a migration that uses async/await where you create an unique index on a new column, with a manually-managed transaction:

```js
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'Person',
        'petName',
        {
          type: Sequelize.DataTypes.STRING,
        },
        { transaction }
      );
      await queryInterface.addIndex(
        'Person',
        'petName',
        {
          fields: 'petName',
          unique: true,
          transaction,
        }
      );
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Person', 'petName', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
```

The next example is of a migration that creates an unique index composed of multiple fields with a condition, which allows a relation to exist multiple times but only one can satisfy the condition:

```js
module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.createTable('Person', {
      name: Sequelize.DataTypes.STRING,
      bool: {
        type: Sequelize.DataTypes.BOOLEAN,
        defaultValue: false
      }
    }).then((queryInterface, Sequelize) => {
      queryInterface.addIndex(
        'Person',
        ['name', 'bool'],
        {
          indicesType: 'UNIQUE',
          where: { bool : 'true' },
        }
      );
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Person');
  }
}
```

### Storage

There are three types of storage that you can use: `sequelize`, `json`, and `none`.

- `sequelize` : stores migrations and seeds in a table on the sequelize database
- `json` : stores migrations and seeds on a json file
- `none` : does not store any migration/seed

#### Migration Storage

By default the CLI will create a table in your database called `SequelizeMeta` containing an entry for each executed migration. To change this behavior, there are three options you can add to the configuration file. Using `migrationStorage`, you can choose the type of storage to be used for migrations. If you choose `json`, you can specify the path of the file using `migrationStoragePath` or the CLI will write to the file `sequelize-meta.json`. If you want to keep the information in the database, using `sequelize`, but want to use a different table, you can change the table name using `migrationStorageTableName`. Also you can define a different schema for the `SequelizeMeta` table by providing the `migrationStorageTableSchema` property.

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
    "migrationStorageTableName": "sequelize_meta",

    // Use a different schema for the SequelizeMeta table
    "migrationStorageTableSchema": "custom_schema"
  }
}
```

**Note:** _The `none` storage is not recommended as a migration storage. If you decide to use it, be aware of the implications of having no record of what migrations did or didn't run._

### Configuration Connection String

As an alternative to the `--config` option with configuration files defining your database, you can use the `--url` option to pass in a connection string. For example:

```text
npx sequelize-cli db:migrate --url 'mysql://root:password@mysql_host.com/database_name'
```

### Programmatic usage

Sequelize has a sister library called [umzug](https://github.com/sequelize/umzug) for programmatically handling execution and logging of migration tasks.
