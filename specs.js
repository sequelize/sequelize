var vows    = require('vows'),
    assert  = require('assert'),
    Sequelize = require(__dirname + "/sequelize").Sequelize,
    SequelizeHelper = require(__dirname + "/sequelize").SequelizeHelper

vows.describe('Sequelize').addBatch({
  'constants': {
    topic: function() { return Sequelize },
    'STRING': function(Sequelize) {
      assert.isString(Sequelize.STRING)
    },
    'TEXT': function(Sequelize) {
      assert.isString(Sequelize.TEXT)
    },
    'INTEGER': function(Sequelize) {
      assert.isString(Sequelize.INTEGER)
    }
  },
  'constructor': {
    topic: function() {
      return new Sequelize('database', 'username', 'password')
    },
    'sets config correctly': function(s) {
      assert.equal(s.config.database, 'database')
      assert.equal(s.config.username, 'username')
      assert.equal(s.config.password, 'password')
    },
    'creates a connection object': function(s) {
      assert.isObject(s.connection)
    },
    'initializes empty table hash': function(s) {
      assert.isObject(s.tables)
    }
  },
  'Sequalize#asTableName': {
    topic: function() {
      return new Sequelize('database', 'username', 'password')
    },
    'should return the correct name': function(s) {
      assert.equal(s.asTableName('Name'), 'Names')
    }
  },
  'Sequelize#define': {
    topic: function() {
      var s = new Sequelize('database', 'username', 'password')
      return [s, s.define('Day', { name: Sequelize.TEXT })]
    },
    'should return a function': function(obj) {
      var s   = obj[0],
          Day = obj[1]
          
      assert.isFunction(Day)
    },
    'should store attributes': function(obj) {
      var s   = obj[0],
          Day = obj[1]
          
      assert.isObject(Day.attributes)
      assert.deepEqual(Day.attributes, { name: Sequelize.TEXT })
    },
    'should add new table to tables': function(obj) {
      var s   = obj[0],
          Day = obj[1]
      
      assert.include(s.tables, 'Day')
    }
  },
  'Sequelize#tableNames': {
    topic: function() {
      return new Sequelize('database', 'username', 'password')
    },
    'should be an empty array if no tables are specified': function(s) {
      assert.deepEqual(s.tableNames, [])
    },
    'should be no empty array if tables are specified': function(s) {
      s.define('Day', { name: Sequelize.TEXT })
      assert.deepEqual(s.tableNames, ['Days'])
    }
  },
  'Table#sync': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      return s.define('Day', { name: s.TEXT })
    },
    'send sync call': function(Day) {
/*      Day.sync()*/
    }
  },
  'Table#drop': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      return s.define('Day', { name: s.TEXT })
    },
    'send drop call': function(Day) {
      // create table before drop...

    }
  },
  'Table#constructor': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var Day = s.define('Day', { name: Sequelize.STRING })
      return new Day({ name: 'Monday', foo: 'asd'})
    },
    'should ignore passed attributes which are not in the schema': function(day) {
      assert.equal(day.name, 'Monday')
      assert.isUndefined(day.foo)
    },
    'should save the defined table name': function(day) {
      assert.equal(day.tableName, 'Days')
    },
    'should overwrite id with null': function(day) {
      assert.isNull(day.id)
    },
    'should save attributes': function(day) {
      assert.deepEqual(day.attributes, { name: Sequelize.STRING })
    }
  },

}).export(module)

vows.describe('SequelizeHelper').addBatch({
  'values': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var Day = s.define('Day', { name: Sequelize.STRING })
      return new Day({ name: 'Monday', foo: 'asd'})
    },
    'should return {name: Monday}': function(day) {
      assert.deepEqual(SequelizeHelper.values(day), {name: 'Monday'})
    }
  },
  'valuesForInsertQuery': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var Day = s.define('Day', { name: Sequelize.STRING, foo: Sequelize.INTEGER })
      return new Day({ name: 'Monday', foo: 2})
    },
    'should return an array': function(day) {
      assert.isArray(SequelizeHelper.valuesForInsertQuery(day))
    },
    'should return an encoded string': function(day) {
      assert.isString(SequelizeHelper.valuesForInsertQuery(day)[0])
      assert.equal(SequelizeHelper.valuesForInsertQuery(day)[0], "'Monday'")
    },
    'should return a number if passed': function(day) {
      assert.isNumber(SequelizeHelper.valuesForInsertQuery(day)[1])
      assert.equal(SequelizeHelper.valuesForInsertQuery(day)[1], 2)
    }
  },
  'fieldsForInsertQuery': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var Day = s.define('Day', { name: Sequelize.STRING, foo: Sequelize.INTEGER })
      return new Day({ name: 'Monday', foo: 2})
    },
    'should return a string': function(day) {
      assert.isString(SequelizeHelper.fieldsForInsertQuery(day))
    },
    'should be a comma seperated string': function(day) {
      assert.equal(SequelizeHelper.fieldsForInsertQuery(day), "name, foo")
    }
  }
}).export(module)