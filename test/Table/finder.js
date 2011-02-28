var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
  , config    = require(__dirname + '/../config')
  , s         = new Sequelize(config.database, config.username, config.password, {disableLogging: true})
  , Day       = s.define('Day', { name: Sequelize.TEXT })
  , assert    = require("assert")
  
module.exports = {
  'findAll should return all items as class objects': function(beforeExit) {
    var allFindAllTestItems = null
    var FindAllTest = s.define('FindAllTest', {})

    Sequelize.chainQueries([
      {drop: FindAllTest}, {sync: FindAllTest}, {save: new FindAllTest({})}, {save: new FindAllTest({})}
    ], function() {
      FindAllTest.findAll(function(findAlls) {
        allFindAllTestItems = findAlls
      })
    })

    beforeExit(function(){
      assert.equal(allFindAllTestItems.length, 2)
      allFindAllTestItems.forEach(function(item) {
        assert.equal(item instanceof FindAllTest, true)
      })
    })
  },
  'find returns the correct item': function(beforeExit) {
    var item = null
    var itemToMatch = null
    var FindTest = s.define('FindTest', { name: Sequelize.STRING })
    FindTest.drop(function() {
      FindTest.sync(function() {
        itemToMatch = new FindTest({name: 'foo'})
        itemToMatch.save(function() {
          new FindTest({name: 'bar'}).save(function() {
            FindTest.find({name: 'foo'}, function(result) {
              item = result
            })
          })
        })
      })
    })

    beforeExit(function() {
      assert.equal(itemToMatch.id, item.id)
      assert.equal(itemToMatch.name, item.name)
    })
  },
  'find returns data in correct attributes': function(beforeExit) {
    var assertMe = null
    var FindMeNow = s.define('FindMeNow', { title: Sequelize.STRING, content: Sequelize.TEXT })
    FindMeNow.drop(function() {
      FindMeNow.sync(function() {
        new FindMeNow({title: 'a title', content: 'a content'}).save(function(blubb) {
          assertMe = blubb
        })
      })
    })
    beforeExit(function() {
      assert.isNotNull(Me)
      assert.equal(Me.title, 'a title')
      assert.equal(Me.content, 'a content')
    })
  }
}