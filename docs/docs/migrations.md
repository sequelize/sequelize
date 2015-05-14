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

Further and more detailled information about the available commands
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

The following skeleton shows a typical migration file&period; All migrations are expected to be located in a folder called `migrations` at the very top of the project&period; The sequelize binary can generate a migration skeleton&period; See the aboves section for more details&period;

```js
module.exports = {
  up: function(migration, DataTypes, done) {
    // logic for transforming into the new state
    done() // sets the migration as finished
  },
 
  down: function(migration, DataTypes, done) {
    // logic for reverting the changes
    done() // sets the migration as finished
  }
}
```

The passed `migration` object can be used to modify the database&period; The `DataTypes` object stores the available data types such as `STRING` or `INTEGER`&period; The third parameter is a callback function which needs to be called once everything was executed&period; The first parameter of the callback function can be used to pass a possible error&period; In that case&comma; the migration will be marked as failed&period; Here is some code&colon;

```js
module.exports = {
  up: function(migration, DataTypes, done) {
    migration.dropAllTables().complete(done)
 
    // equals:
    migration.dropAllTables().complete(function(err) {
      if (err) {
        done(err)
      } else {
        done(null)
      }
    })
  }
}
```

The available methods of the migration object are the following&period;

## Functions

Using the `migration` object describe before&comma; you will have access to most of already introduced functions&period; Furthermore there are some other methods&comma; which are designed to actually change the database schema&period;

### createTable&lpar;tableName&comma; attributes&comma; options&rpar;

This method allows creation of new tables&period; It is allowed to pass simple or complex attribute definitions&period; You can define the encoding of the table and the table's engine via options

```js
migration.createTable(
  'nameOfTheNewTable',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    createdAt: {
      type: DataTypes.DATE
    },
    updatedAt: {
      type: DataTypes.DATE
    },
    attr1: DataTypes.STRING,
    attr2: DataTypes.INTEGER,
    attr3: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  },
  {
    engine: 'MYISAM', // default: 'InnoDB'
    charset: 'latin1' // default: null
  }
)
```

### dropTable&lpar;tableName&comma; options&rpar;

This method allows deletion of an existing table&period;

```js
migration.dropTable('nameOfTheExistingTable')
```

### dropAllTables&lpar;options&rpar;

This method allows deletion of all existing tables in the database&period;

```js
migration.dropAllTables()
```

### renameTable&lpar;before&comma; after&comma; options&rpar;

This method allows renaming of an existing table&period;

```js
migration.renameTable('Person', 'User')
```

### showAllTables&lpar;options&rpar;

This method returns the name of all existing tables in the database&period;

```js
migration.showAllTables().success(function(tableNames) {})
```

### describeTable&lpar;tableName&comma; options&rpar;

This method returns an array of hashes containing information about all attributes in the table&period;

```js
migration.describeTable('Person').success(function(attributes) {
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

### addColumn&lpar;tableName&comma; attributeName&comma; dataTypeOrOptions&comma; options&rpar;

This method allows adding columns to an existing table&period; The data type can be simple or complex&period;

```js
migration.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  DataTypes.STRING
)
 
// or
 
migration.addColumn(
  'nameOfAnExistingTable',
  'nameOfTheNewAttribute',
  {
    type: DataTypes.STRING,
    allowNull: false
  }
)
```

### removeColumn&lpar;tableName&comma; attributeName&comma; options&rpar;

This method allows deletion of a specific column of an existing table&period;

```js
migration.removeColumn('Person', 'signature')
```

### changeColumn&lpar;tableName&comma; attributeName&comma; dataTypeOrOptions&comma; options&rpar;

This method changes the meta data of an attribute&period; It is possible to change the default value&comma; allowance of null or the data type&period; Please make sure&comma; that you are completely describing the new data type&period; Missing information are expected to be defaults&period;

```js
migration.changeColumn(
  'nameOfAnExistingTable',
  'nameOfAnExistingAttribute',
  DataTypes.STRING
)
 
// or
 
migration.changeColumn(
  'nameOfAnExistingTable',
  'nameOfAnExistingAttribute',
  {
    type: DataTypes.FLOAT,
    allowNull: false,
    default: 0.0
  }
)
```

### renameColumn&lpar;tableName&comma; attrNameBefore&comma; attrNameAfter&comma; options&rpar;

This methods allows renaming attributes&period;

```js
migration.renameColumn('Person', 'signature', 'sig')
```

### addIndex&lpar;tableName&comma; attributes&comma; options&rpar;

This methods creates indexes for specific attributes of a table&period; The index name will be automatically generated if it is not passed via in the options &lpar;see below&rpar;&period;

```js
// This example will create the index person_firstname_lastname
migration.addIndex('Person', ['firstname', 'lastname'])

// This example will create a unique index with the name SuperDuperIndex using the optional 'options' field.
// Possible options:
// - indicesType: UNIQUE|FULLTEXT|SPATIAL
// - indexName: The name of the index. Default is __
// - parser: For FULLTEXT columns set your parser
// - indexType: Set a type for the index, e.g. BTREE. See the documentation of the used dialect
// - logging: A function that receives the sql query, e.g. console.log
migration.addIndex(
  'Person',
  ['firstname', 'lastname'],
  {
    indexName: 'SuperDuperIndex',
    indicesType: 'UNIQUE'
  }
)
```

### removeIndex&lpar;tableName&comma; indexNameOrAttributes&comma; options&rpar;

This method deletes an existing index of a table&period;

```js
migration.removeIndex('Person', 'SuperDuperIndex')
 
// or
 
migration.removeIndex('Person', ['firstname', 'lastname'])
```

## Programmatic use

If you need to interact with the migrator within your code, you can easily achieve that via `sequelize.getMigrator`. You can specify the path to your migrations as well as a pattern which represents the files that contain the migrations.

```js
var migrator = sequelize.getMigrator({
  path:        process.cwd() + '/database/migrations',
  filesFilter: /\.coffee$/
})
```

Once you have a migrator object, you can run its migration with `migrator.migrate`. By default, this will execute all the up methods within your pending migrations. If you want to rollback a migration, just call it like this:

```js
migrator
  .migrate({ method: 'down' })
  .success(function() {
    // The migrations have been executed!
  })
```

[0]: http://gulpjs.com/
[1]: https://github.com/sequelize/cli
[2]: https://github.com/sequelize/gulp-sequelize
