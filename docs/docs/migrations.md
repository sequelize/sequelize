Sequelize `2.0.0` introduces a new CLI which is based on [gulp][0] and combines [sequelize-cli][1] and [gulp-sequelize][2]. The CLI ships support for migrations and project bootstrapping. With migrations you can transfer your existing database into another state and vice versa: Those state transitions are saved in migration files, which describe the way how to get to the new state and how to revert the changes in order to get back to the old state.

## The CLI

In order to use the CLI you need to install the respective package:

```bash
$ npm install --save sequelize-cli
```

As with any npm package, you can use the global flag (`-g`) to install the CLI globally. If you have installed the CLI without the global flag, use `node_modules/.bin/sequelize [command]` instead of `sequelize [command]`.

The CLI currently supports the following commands:

```bash
$ sequelize db:migrate        # Run pending migrations.
$ sequelize db:migrate:undo   # Revert the last migration run.
$ sequelize help              # Display this help text.
$ sequelize init              # Initializes the project.
$ sequelize migration:create  # Generates a new migration file.
$ sequelize version           # Prints the version number.
```

Further and more detailed information about the available commands
can be obtained via the help command:

```bash
$ sequelize help:init
$ sequelize help:db:migrate
$ sequelize help:db:migrate:undo
# etc
```

The latter one for example will print out the following output:

```bash
Sequelize [CLI: v0.0.2, ORM: v1.7.5]

COMMANDS
    sequelize db:migrate:undo -- Revert the last migration run.

DESCRIPTION
    Revert the last migration run.

OPTIONS
    --env           The environment to run the command in. Default: development
    --options-path  The path to a JSON file with additional options. Default: none
    --coffee        Enables coffee script support. Default: false
    --config        The path to the config file. Default: config/config.json
```

## Skeleton

The following skeleton shows a typical migration file. All migrations are expected to be located in a folder called `migrations` at the very top of the project. The sequelize binary can generate a migration skeleton. See the above section for more details.

```js
module.exports = {
  up: function(queryInterface, Sequelize) {
    // logic for transforming into the new state
  },
 
  down: function(queryInterface, Sequelize) {
    // logic for reverting the changes
  }
}
```

The passed `queryInterface` object can be used to modify the database. The `Sequelize` object stores the available data types such as `STRING` or `INTEGER`. Function `up` or `down` should return a `Promise`. Here is some code:

```js
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.dropAllTables();
  }
}
```

The available methods of the queryInterface object are the following.

## Functions

Using the `queryInterface` object describe before, you will have access to most of already introduced functions. Furthermore there are some other methods, which are designed to actually change the database schema.

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
    engine: 'MYISAM', // default: 'InnoDB'
    charset: 'latin1' // default: null
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
queryInterface.showAllTables().then(function(tableNames) {})
```

### describeTable(tableName, options)

This method returns an array of hashes containing information about all attributes in the table.

```js
queryInterface.describeTable('Person').then(function(attributes) {
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

### addColumn(tableName, attributeName, dataTypeOrOptions, options)

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
```

### removeColumn(tableName, attributeName, options)

This method allows deletion of a specific column of an existing table.

```js
queryInterface.removeColumn('Person', 'signature')
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
queryInterface.addIndex(
  'Person',
  ['firstname', 'lastname'],
  {
    indexName: 'SuperDuperIndex',
    indicesType: 'UNIQUE'
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

## Programmatic use
Sequelize has a [sister library](https://github.com/sequelize/umzug) for programmatically handling execution and logging of migration tasks.


[0]: http://gulpjs.com/
[1]: https://github.com/sequelize/cli
[2]: https://github.com/sequelize/gulp-sequelize
