## Migrations

Sequelize`v1&period;3&period;0`introduced migrations&period; With those mechanism you can transform your existing database into another state and vice versa&period; Those state transitions are saved in migration files&comma; which describe the way how to get to the new state and how to revert the changes in order to get back to the old state&period;

### The binary

In order to run migrations&comma; sequelize comes with a handy binary file which can setup your project and run migrations&period; The following snippet shows the possible things&colon;
    
    sequelize -h
    sequelize --help
    # prints the help
    
    sequelize -V
    sequelize --version
    # prints the version
    
    sequelize -i
    sequelize --init
    # creates a migration folder
    # creates a config folder
    # saves a config.json inside the config folder
    
    sequelize -e [environment]
    sequelize --env [environment]
    # Use the passed environment. Default: development
    
    sequelize -i -f
    sequelize --init --force
    # forced creation of migration and config folder
    # existing data will be deleted first
    
    sequelize -m
    sequelize --migrate
    # needs a valid config.json
    # runs pending migrations
    # saves successfully executed migrations inside the database
    
    sequelize -m -u
    sequelize --migrate --undo
    # needs a valid config.json
    # reverts the last successfull migration
    # when there were multiple executed migrations, all of them are reverted
    
    sequelize -c [migration-name]
    sequelize --create-migration [migration-name]
    # creates the migrations folder
    # creates a file with current timestamp + migration-name
    # migration-name has the default 'unnamed-migration'
    
    sequelize -p [path]
    sequelize --migration-path [path]
    # Defines the path to the migration directory.
    
    sequelize -o [path]
    sequelize --options-path [path]
    # Defines the path to the options file.
    # The options file (.js or .json) needs to return an object.
    # Keys / values references cli options
    # e.g.: { migrationPath: 'db/migrations' }
    
    sequelize --config [path]
    # Defines the path to the configuration file.
    
    sequelize --coffee
    # Enables coffeescript support.
    

### Skeleton

The following skeleton shows a typical migration file&period; All migrations are expected to be located in a folder called`migrations`at the very top of the project&period; Sequelize`1&period;4&period;1`added the possibility to let the sequelize binary generate a migration skeleton&period; See the aboves section for more details&period;
    
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

The passed`migration`object can be used to modify the database&period; The`DataTypes`object stores the available data types such as`STRING`or`INTEGER`&period; The third parameter is a callback function which needs to be called once everything was executed&period; The first parameter of the callback function can be used to pass a possible error&period; In that case&comma; the migration will be marked as failed&period; Here is some code&colon;
    
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

The available methods of the migration object are the following&period;

### Functions

Using the`migration`object describe before&comma; you will have access to most of already introduced functions&period; Furthermore there are some other methods&comma; which are designed to actually change the database schema&period;

#### createTable&lpar;tableName&comma; attributes&comma; options&rpar;

This method allows creation of new tables&period; It is allowed to pass simple or complex attribute definitions&period; You can define the encoding of the table and the table's engine via options
    
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

#### dropTable&lpar;tableName&rpar;

This method allows deletion of an existing table&period;
    
    migration.dropTable('nameOfTheExistingTable')

#### dropAllTables&lpar;&rpar;

This method allows deletion of all existing tables in the database&period;
    
    migration.dropAllTables()

#### renameTable&lpar;before&comma; after&rpar;

This method allows renaming of an existing table&period;
    
    migration.renameTable('Person', 'User')

#### showAllTables&lpar;&rpar;

This method returns the name of all existing tables in the database&period;
    
    migration.showAllTables().success(function(tableNames) {})

#### describeTable&lpar;tableName&rpar;

This method returns an array of hashes containing information about all attributes in the table&period;
    
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

#### addColumn&lpar;tableName&comma; attributeName&comma; dataTypeOrOptions&rpar;

This method allows adding columns to an existing table&period; The data type can be simple or complex&period;
    
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

#### removeColumn&lpar;tableName&comma; attributeName&rpar;

This method allows deletion of a specific column of an existing table&period;
    
    migration.removeColumn('Person', 'signature')

#### changeColumn&lpar;tableName&comma; attributeName&comma; dataTypeOrOptions&rpar;

This method changes the meta data of an attribute&period; It is possible to change the default value&comma; allowance of null or the data type&period; Please make sure&comma; that you are completely describing the new data type&period; Missing information are expected to be defaults&period;
    
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

#### renameColumn&lpar;tableName&comma; attrNameBefore&comma; attrNameAfter&rpar;

This methods allows renaming attributes&period;
    
    migration.renameColumn('Person', 'signature', 'sig')

#### addIndex&lpar;tableName&comma; attributes&comma; options&rpar;

This methods creates indexes for specific attributes of a table&period; The index name will be automatically generated if it is not passed via in the options &lpar;see below&rpar;&period;
    
    // This example will create the index person_firstname_lastname
    migration.addIndex('Person', ['firstname', 'lastname'])

    // This example will create a unique index with the name SuperDuperIndex using the optional 'options' field.
    // Possible options:
    // - indicesType: UNIQUE|FULLTEXT|SPATIAL
    // - indexName: The name of the index. Default is __
    // - parser: For FULLTEXT columns set your parser
    // - indexType: Set a type for the index, e.g. BTREE. See the documentation of the used dialect
    migration.addIndex(
      'Person',
      ['firstname', 'lastname'],
      {
        indexName: 'SuperDuperIndex',
        indicesType: 'UNIQUE'
      }
    )

#### removeIndex&lpar;tableName&comma; indexNameOrAttributes&rpar;

This method deletes an existing index of a table&period;
    
    migration.removeIndex('Person', 'SuperDuperIndex')
     
    // or
     
    migration.removeIndex('Person', ['firstname', 'lastname'])

### Programmatic use

If you need to interact with the migrator within your code,
you can easily achieve that via `sequelize.getMigrator`.
You can specify the path to your migrations as well as a pattern
which represents the files that contain the migrations.
    
    var migrator = sequelize.getMigrator({
      path:        process.cwd() + '/database/migrations',
      filesFilter: /\.coffee$/
    })

Once you have a migrator object, you can run its migration
with `migrator.migrate`. By default, this will
execute all the up methods within your pending migrations.
If you want to rollback a migration, just call it like this:
    
    migrator
      .migrate({ method: 'down' })
      .success(function() {
        // The migrations have been executed!
      })
