# v0.1.0 #
- first stable version
- implemented all basic functions
- associations are working

# v0.2.0 #
- added methods for setting associations
- added method for chaining an arbitraty amount of queries

# 0.2.1 #
- fixed date bug

# 0.2.2 #
- released project as npm package

# 0.2.3 #
- added latest mysql connection library
  - fixed id handling on save
  - fixed text handling (varchar > 255; text)
- using the inflection library for naming tables more convenient
- Sequelize.TEXT is now using MySQL datatype TEXT instead of varchar(4000)

# 0.2.4 #
- fixed bug when using cross associated tables (many to many associations)

# 0.2.5 #
- added BOOLEAN type
- added FLOAT type
- fixed DATE type issue
- fixed npm package

# 0.2.6 #
- refactored Sequelize to fit CommonJS module conventions

# 0.3.0 #
- added possibility to define class and instance methods for models
- added import method for loading model definition from a file

# 0.3.1 #
- added error handling when defining invalid database credentials
- Sequelize#sync, Sequelize#drop, model#sync, model#drop returns errors via callback
- code is now located under lib/sequelize to use it with nDistro
- added possibility to use non default mysql database (host/port)