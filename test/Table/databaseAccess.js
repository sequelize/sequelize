var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var s = new Sequelize('sequelize_test', 'root', null, {disableLogging: true})
var Day = s.define('Day', { name: Sequelize.TEXT })

module.exports = {
 'save should set the id of a newly created object': function(assert, beforeExit) {
    var subject = null
    var SaveTest = s.define('SaveTest', {name: Sequelize.STRING})
    SaveTest.drop(function(){
      SaveTest.sync(function() {
         new SaveTest({name:'s'}).save(function(_saveTest){
          subject = _saveTest
        })
      })
    })

    beforeExit(function() {
      assert.isNotNull(subject.id)
    })
  },
  'updateAttributes should update available attributes': function(assert, beforeExit) {
    var subject = null
    var UpdateMe = s.define('UpdateMe', {name: Sequelize.STRING})
    Sequelize.chainQueries([{drop: UpdateMe}, {sync: UpdateMe}], function() {
      new UpdateMe({name:'Monday'}).save(function(u) {
        u.updateAttributes({name: 'Sunday', foo: 'bar'}, function(u) {
          subject = u
        })
      })
    })

    beforeExit(function() {
      assert.isNotNull(subject)
      assert.equal(subject.name, 'Sunday')
      assert.isUndefined(subject.foo)
    })
  },
  'destroy should make the object unavailable': function(assert, beforeExit) {
    var subject = 1
    var UpdateAttributesTest = s.define('UpdateAttributeTest', {name: Sequelize.STRING})
    Sequelize.chainQueries([{drop: UpdateAttributesTest}, {sync: UpdateAttributesTest}], function() {
      new UpdateAttributesTest({name:'Monday'}).save(function(day) {
        day.destroy(function() {
          UpdateAttributesTest.find(day.id, function(result) {
            subject = result
          })
        })
      })
    })
    beforeExit(function() {
      assert.isNull(subject)
    })
  },
  'boolean ==> save': function(assert, beforeExit) {
    var BooleanTest = s.define("BooleanTest", {flag: Sequelize.BOOLEAN})
    var testIsFinished = false
    BooleanTest.sync(function() {
      new BooleanTest({flag: true}).save(function(obj) {
        assert.equal(obj.flag, true)
        obj.updateAttributes({flag: false}, function(obj2) {
          assert.equal(obj2.flag, false)
          testIsFinished = true
        })
      })
    })
    beforeExit(function() { assert.equal(true, testIsFinished) })
  },
  'sync ==> failure': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})

    Fail.sync(function(table, err) {
      assert.isDefined(err)
      assert.isDefined(err.message)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  },
  'drop ==> failure': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})

    Fail.drop(function(table, err) {
      assert.isDefined(err)
      assert.isDefined(err.message)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  }
}