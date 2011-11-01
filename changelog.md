# v0.1.0 #
- first stable version
- implemented all basic functions
- associations are working

# v0.2.0 #
- added methods for setting associations
- added method for chaining an arbitraty amount of queries

# v0.2.1 #
- fixed date bug

# v0.2.2 #
- released project as npm package

# v0.2.3 #
- added latest mysql connection library
  - fixed id handling on save
  - fixed text handling (varchar > 255; text)
- using the inflection library for naming tables more convenient
- Sequelize.TEXT is now using MySQL datatype TEXT instead of varchar(4000)

# v0.2.4 #
- fixed bug when using cross associated tables (many to many associations)

# v0.2.5 #
- added BOOLEAN type
- added FLOAT type
- fixed DATE type issue
- fixed npm package

# v0.2.6 #
- refactored Sequelize to fit CommonJS module conventions

# v0.3.0 #
- added possibility to define class and instance methods for models
- added import method for loading model definition from a file

# v0.4.0 #
- added error handling when defining invalid database credentials
- Sequelize#sync, Sequelize#drop, model#sync, model#drop returns errors via callback
- code is now located under lib/sequelize to use it with nDistro
- added possibility to use non default mysql database (host/port)
- added error handling when defining invalid database port/host
- schema definitions can now contain default values and null allowance
- database credentials can now also contain an empty / no password

# v0.4.1 #
- THIS UPDATE CHANGES TABLE STRUCTURES MASSIVELY!
- MAKE SURE TO DROP YOUR CURRENT TABLES AND LET THEM CREATE AGAIN!

- names of many-to-many-association-tables are chosen from passed association names
- foreign keys are chosen from passed association name
- added many-to-many association on the same model
- added hasManyAndBelongsTo
- added hasOneAndBelongsTo
- nodejs-mysql-native 0.4.2

# v0.4.2 #
- fixed bugs from 0.4.1
- added the model instance method loadAssociatedData which adds the hash Model#associatedData to an instance which contains all associated data

# v0.4.3 #
- renamed loadAssociatedData to fetchAssociations
- renamed Model#associatedData to fetchedAssociations
- added fetchAssociations to finder methods
- store data found by finder method in the associatedData hash + grep them from there if reload is not forced
- added option to sequelize constructor for disabling the pluralization of tablenames: disableTableNameModification
- allow array as value for chainQueries => Sequelize.chainQueries([save: [a,b,c]], callback)
- remove the usage of an array => Sequelize.chainQueries({save: a}, {destroy: b}, callback)

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

# v1.0.1 #
- Added Model.count(callback), which returns the number of elements saved in the database
- Fixed self associations

# v1.0.2 #
- Fixed where clause generation for models with explicit primary keys (allanca)
- Set insertId for non-default auto increment fields (allanca)

# v1.1.0 #
- defaultValue 0 is now working
- REVERTED mysql-pool usage (will give it a new try later)
- updated node-mysql to 0.9.4

# v1.1.1 #
- fixed memory leaks
- added query queueing (adjustable via maxConcurrentQueries in config; default: 50)

# v1.1.2 #
- prevent malfunction after being idle

# v1.1.3 #
- [BUG] scoped options in model => a model can now have the attribute options
- [FEATURE] added drop method for sequelize, that drops all currently registered tables

# v1.1.4 #
- [BUG] tables with identical prefix (e.g. wp_) can now be used in many-to-many associations

# v1.2.0 #
- [FEATURE] min/max function for models, which return the min/max value in a column
- [FEATURE] getModel for modelManager for getting a model without storing it in a variable; use it via sequelize.modelManager.getModel('User')
- [TEST] test suite refactoring for jasmine

# v1.2.1 #
- [REFACTORING] renamed the global options for sync, query and define on sequelize; before: options.queryOptions; now: options.query
- [FEATURE] allow definition of charset via global define option in sequelize or via charset option in sequelize.define
- [FEATURE] allow definition of mysql engine via global define option in sequelize or via engine option in sequelize.define; default is InnoDB now
- [FEATURE] find and findAll will now search in a list of values via: Model.findAll({where: { id: [1,2,3] }}); will return all models with id 1, 2 and 3
- [TEST] force latin1 charset for travis
