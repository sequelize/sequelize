var vows    = require('vows'),
    assert  = require('assert')
require(__dirname + "/../sequelize")

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
      return new Sequelize('sequelize_test', 'test', 'test')
    },
    'sets config correctly': function(s) {
      assert.equal(s.config.database, 'sequelize_test')
      assert.equal(s.config.username, 'test')
      assert.equal(s.config.password, 'test')
    },
    'initializes empty table hash': function(s) {
      assert.isObject(s.tables)
    }
  },
  'define': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      return s.define('Day', { name: Sequelize.TEXT })
    },
    'should return a function': function(Day) {
      assert.isFunction(Day)
    },
    'should store attributes': function(Day) {
      assert.isObject(Day.attributes)
      assert.deepEqual(Day.attributes, { name: Sequelize.TEXT })
    },
    'should add new table to tables': function(Day) {
      assert.include(Day.sequelize.tables, 'Day')
    }
  },
  'tableNames': {
    'should be an empty array if no tables are specified': function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      assert.deepEqual(s.tableNames, [])
    },
    'should be no empty array if tables are specified': function(s) {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      s.define('Day', { name: Sequelize.TEXT })
      assert.deepEqual(s.tableNames, ['Days'])
    }
  }
}).export(module)

vows.describe('SequelizeTable').addBatch({
  'sync': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      return s.define('ToBeSynced', { name: Sequelize.TEXT })
    },
    'should work': function(ToBeSynced) {
      ToBeSynced.sync(function() {
        assert.equal(1,1)
      })
    }
  },
  
  'drop': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      return s.define('ToBeDropped', { name: Sequelize.String })
    },
    'should work': function(ToBeDropped) {
      ToBeDropped.drop(function() {
        assert.equal(1, 1)
      })
    }
  },
  
  'constructor': {
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
  
  'save': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var SaveTest = s.define("SaveTest", { name: Sequelize.STRING })
      var self = this
      SaveTest.sync(this.callback)
      new SaveTest({name: 'test'}).save(function(result) {
        self.callback(result)
      })
    },
    'after save': {
      topic: function(instance) {
        return instance
      },
      'should save data correctly': function(obj) {
        assert.deepEqual(obj.values, {name: 'test1'})
      }
    }
/*    'should save the data correctly': function(SaveTest) {
      SaveTest.sync(function() {
        new SaveTest({name: 'test1'}).save(function(obj) {
          assert.deepEqual(obj.values, {name: 'test1'})
        })
      })
    }
*/  },
  
  'findAll': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var FindAllTest = s.define('FindAllTest', { name: Sequelize.STRING })
      return FindAllTest
    },
    'after table was synced': function(FindAllTest){
/*      FindAllTest.sync(function() {
        new FindAllTest({name : 'Monday'}).save(function() {
          new FindAllTest({name: 'Tuesday'}).save(function() {
            FindAllTest.findAll(function(bla) {
              SequelizeHelper.log(bla)
            })
          })
        })
        
        
      })*/
    }
  }
/*    Day.drop(function() { Day.sync(function() {
            new Day({name: 'Monday'}).save(function() {
              Day.findAll(self.callback)
            })
          })})
    
    
    
    'should find created entries': function(result) {
      assert.equal(1, 1)
    }
  }*/
}).export(module)




/*
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
  },
  'valuesForUpdate': {
    topic: function() {
      var s = new Sequelize('sequelize_test', 'test', 'test')
      var Day = s.define('Day', { name: Sequelize.STRING, foo: Sequelize.INTEGER })
      return new Day({ name: 'Monday', foo: 2})
    },
    'should return a string': function(day) {
      assert.isString(SequelizeHelper.valuesForUpdate(day))
    },
    'should correctly render data': function(day) {
      assert.equal(SequelizeHelper.valuesForUpdate(day), "name = 'Monday', foo = 2")
    }
  },
  'Sequalize#asTableName': {
    topic: function() {
      return new Sequelize('sequelize_test', 'test', 'test')
    },
    'should return the correct name': function(s) {
      assert.equal(s.asTableName('Name'), 'Names')
    }
  }
}).export(module)*/