# v1.6.0 #
- [DEPENDENCIES] upgraded most dependencies. most important: mysql was upgraded to 2.0.0-alpha-3
- [REFACTORING] separated tests for dialects
- [BUG] fixed wrong version in sequelize binary
- [BUG] local options have higher priority than global options (thanks to guersam)
- [BUG] fixed where clause when passing an empty array (thanks to kbackowski)
- [FEATURE] added association prefetching for find and findAll
- [FEATURE] it's now possible to use callbacks of async functions inside migrations (thanks to mphilpot)
- [FEATURE] improved comfort of sequelize.query. just pass an sql string to it and wait for the result
- [FEATURE] Migrations now understand NODE_ENV (thanks to gavri)
- [FEATURE] Performance improvements (thanks to Mick-Hansen and janmeier from innofluence)
- [FEATURE] Model.find and Model.findAll can now take a String with an ID. (thanks to ghernandez345)
- [FEATURE] Compatibility for JSON-like strings in Postgres (thanks to aslakhellesoy)
- [FEATURE] honor maxConcurrentQueries option (thanks to dchester)
- [FEATURE] added support for stored procedures (inspired by wuyuntao)
- [FEATURE] added possibility to use pg lib's native api (thanks to denysonique)
- [FEATURE] added possibility to define the attributes of received associations (thanks to joshm)
- [FEATURE] added findOrCreate, which returns a the already existing instance or creates one (thanks to eveiga)
- [FEATURE] minConnections option for MySQL pooling (thanks to dominiklessel)

# v1.5.0 #
- [REFACTORING] use underscore functions for Utils.isHash (thanks to Mick-Hansen/innofluence)
- [REFACTORING] removed the 'failure' event and replaced it with 'error'
- [BUG] fixed booleans for sqlite (thanks to vlmonk)
- [BUG] obsolete reference attribute for many-to-many associations are removed correctly
- [BUG] associations can be cleared via passing null to the set method
- [BUG] "fixed" quota handling (thanks to dgf)
- [BUG] fixed destroy in postgresql (thanks to robraux)
- [FEATURE] added possibility to set protocol and to remove port from postgresql connection uri (thanks to danielschwartz)
- [FEATURE] added possibility to not use a junction table for many-to-many associations on the same table (thanks to janmeier/innofluence)
- [FEATURE] results of the `import` method is now cached (thanks to janmeier/innofluence)
- [FEATURE] added possibility to check if a specific object or a whole bunch of objects is currently associated with another object (thanks to janmeier/innofluence)
- [FEATURE] added possibility to globally disable adding of NULL values to sql queries (thanks to janmeier/innofluence)
- [FEATURE] Model.create can now also be used to specify values for mass assignment (thanks to janmeier/innofluence)
- [FEATURE] QueryChainer will now provide the results of the added emitters in the order the emitters have been added (thanks to LaurentZuijdwijk and me ;))
- [FEATURE] QueryChainer can now be initialized with serial items
- [FEATURE] node 0.8 compatibility
- [FEATURE] added options to hasMany getters (thanks to janmeier/innofluence)
- [FEATURE] pooling option is now correctly passed to postgres (thanks to megshark)

# v1.4.1 #
- [DEPRECATION] Added deprecation warning for node < v0.6.
- [FEATURE] added selective saving of instances (thanks to kioopi)
- [FEATURE] added command to binary for creating a migration skeleton with current timestamp
- [FEATURE] added `complete` function for each finder method (thanks to sstoiana)
- [BUG] fixed quotation for sqlite statements (thanks to vlmonk)
- [BUG] fixed timestamp parsing in migratios (thanks to grn)
- [FEATURE] added consistent logging behaviour to postgres (thanks to reacuna)

# v1.4.0 #
- [BUG] fixed booleans in sqlite (thanks to alexstrat)
- [BUG] fixed forced sync of many-to-many associations (thanks to SirUli)
- [FEATURE] objects are now compatible to JSON.stringify. (thanks to grayt0r)
- [FEATURE] When instantiating the sequelize object, you can now pass a function to logging. This allows you to customize the logging behavior. Default is now: console.log (thanks to kenperkins)
- [BUG] The default logging is still console.log but is wrapped after initialization as it crashes node < 0.6.x.
- [FEATURE] postgresql support. (thanks to swoodtke)
- [FEATURE] connection-pooling for mysql. (thanks to megshark)
- [FEATURE] added possibility to define NOW as default value for date data-types. Use Sequelize.NOW as defaultValue
- [BUG] Fixed date handling in sqlite (thanks to iizukanao)

# v1.3.7 #
- [BUG] fixed issue where multiple belongsTo or hasOne associations to the same table overwrite each other
- [BUG] fixed memory leaks (thanks to megshark)

# v1.3.6 #
- [BUG] don't update an existing updatedAt-attribute if timestamps option for a DAO is false

# v1.3.5 #
- [BUG] fixed missed DAO renaming in migrations (thanks to nov)

# v1.3.4 #
- [REFACTORING] renamed Model/ModelFactory/ModelFactoryManager to DAO/DAOFactory/DAOFactoryManager
- [IMPROVEMENT] `npm test` will run the test suite (thanks to gabrielfalcao)
- [IMPROVEMENT] documentation about setting up local development environment (thanks to gabrielfalcao)
- [REFACTORING] removed updatedAt + createdAt from SequelizeMeta

# v1.3.3 #
- [BUG] fixed sql-event emitter in all possible locations (thanks to megshark)

# v1.3.2 #
- [FEATURE] sqlite is now emitting the 'sql'-event as well (thanks to megshark)

# v1.3.1 #
- [REFACTORING] renamed ModelManager to ModelFactoryManager
- [IMPROVEMENT] decreased delay of CustomEventEmitter execution from 5ms to 1ms
- [IMPROVEMENT] improved performance of association handling (many-to-many) (thanks to magshark)
- [FEATURE] added possibility to specify name of the join table (thanks to magshark)
- [FEATURE] mysql is emitting a 'sql'-event when executing a query
- [BUG] correctly delete existing SequelizeMeta entry from database after undoing migration
- [BUG] fix path of migration files in executable (thanks to bcg)

# v1.3.0 #
- [REFACTORING] Model#all is now a function and not a getter.
- [REFACTORING] Renamed ModelDefinition to ModelFactory
- [REFACTORING] Private method scoping; Attributes are still public
- [REFACTORING] Use the new util module for node 0.6.2
- [FEATURE] QueryChainer can now run serially
- [FEATURE] Association definition is chainable: Person.hasOne(House).hasMany(Address)
- [FEATURE] Validations (Thanks to [hiddentao](https://github.com/hiddentao))
- [FEATURE] jQuery-like event listeners: .success(callback) and .error(callback)
- [FEATURE] aliasing for select queries: Model.find({ where: 'id = 1', attributes: ['id', ['name', 'username']] }) ==> will return the user's name as username
- [FEATURE] cross-database support. currently supported: mysql, sqlite
- [FEATURE] migrations
- [TEST] removed all expresso tests and converted them to jasmine

# v1.2.1 #
- [REFACTORING] renamed the global options for sync, query and define on sequelize; before: options.queryOptions; now: options.query
- [FEATURE] allow definition of charset via global define option in sequelize or via charset option in sequelize.define
- [FEATURE] allow definition of mysql engine via global define option in sequelize or via engine option in sequelize.define; default is InnoDB now
- [FEATURE] find and findAll will now search in a list of values via: Model.findAll({where: { id: [1,2,3] }}); will return all models with id 1, 2 and 3
- [TEST] force latin1 charset for travis

# v1.2.0 #
- [FEATURE] min/max function for models, which return the min/max value in a column
- [FEATURE] getModel for modelManager for getting a model without storing it in a variable; use it via sequelize.modelManager.getModel('User')
- [TEST] test suite refactoring for jasmine

# v1.1.4 #
- [BUG] tables with identical prefix (e.g. wp_) can now be used in many-to-many associations

# v1.1.3 #
- [BUG] scoped options in model => a model can now have the attribute options
- [FEATURE] added drop method for sequelize, that drops all currently registered tables

# v1.1.2 #
- [BUG] prevent malfunction after being idle

# v1.1.1 #
- [BUG] fixed memory leaks
- [FEATURE] added query queueing (adjustable via maxConcurrentQueries in config; default: 50)

# v1.1.0 #
- [BUG] defaultValue 0 is now working
- [REMOVED] mysql-pool usage (will give it a new try later)
- [CHORE] updated node-mysql to 0.9.4

# v1.0.2 #
- [BUG] Fixed where clause generation for models with explicit primary keys (allanca)
- [BUG] Set insertId for non-default auto increment fields (allanca)

# v1.0.1 #
- [FEATURE] Added Model.count(callback), which returns the number of elements saved in the database
- [BUG] Fixed self associations

# v1.0.0 #
- complete rewrite
- added new emitter syntax
- sql injection protection
- select now supports hash usage of where
- select now supports array usage of where
- added a lot of options to find/findAll
- Wrapped queries correctly using `foo`
- using expresso 0.7.2
- moved config for test database into seperated config file
- Added method for adding and deleting single associations

# v0.4.3 #
- renamed loadAssociatedData to fetchAssociations
- renamed Model#associatedData to fetchedAssociations
- added fetchAssociations to finder methods
- store data found by finder method in the associatedData hash + grep them from there if reload is not forced
- added option to sequelize constructor for disabling the pluralization of tablenames: disableTableNameModification
- allow array as value for chainQueries => Sequelize.chainQueries([save: [a,b,c]], callback)
- remove the usage of an array => Sequelize.chainQueries({save: a}, {destroy: b}, callback)

# v0.4.2 #
- fixed bugs from 0.4.1
- added the model instance method loadAssociatedData which adds the hash Model#associatedData to an instance which contains all associated data

# v0.4.1 #
- THIS UPDATE CHANGES TABLE STRUCTURES MASSIVELY!
- MAKE SURE TO DROP YOUR CURRENT TABLES AND LET THEM CREATE AGAIN!

- names of many-to-many-association-tables are chosen from passed association names
- foreign keys are chosen from passed association name
- added many-to-many association on the same model
- added hasManyAndBelongsTo
- added hasOneAndBelongsTo
- nodejs-mysql-native 0.4.2

# v0.4.0 #
- added error handling when defining invalid database credentials
- Sequelize#sync, Sequelize#drop, model#sync, model#drop returns errors via callback
- code is now located under lib/sequelize to use it with nDistro
- added possibility to use non default mysql database (host/port)
- added error handling when defining invalid database port/host
- schema definitions can now contain default values and null allowance
- database credentials can now also contain an empty / no password

# v0.3.0 #
- added possibility to define class and instance methods for models
- added import method for loading model definition from a file

# v0.2.6 #
- refactored Sequelize to fit CommonJS module conventions

# v0.2.5 #
- added BOOLEAN type
- added FLOAT type
- fixed DATE type issue
- fixed npm package

# v0.2.4 #
- fixed bug when using cross associated tables (many to many associations)

# v0.2.3 #
- added latest mysql connection library
  - fixed id handling on save
  - fixed text handling (varchar > 255; text)
- using the inflection library for naming tables more convenient
- Sequelize.TEXT is now using MySQL datatype TEXT instead of varchar(4000)

# v0.2.2 #
- released project as npm package

# v0.2.1 #
- fixed date bug

# v0.2.0 #
- added methods for setting associations
- added method for chaining an arbitraty amount of queries

# v0.1.0 #
- first stable version
- implemented all basic functions
- associations are working

