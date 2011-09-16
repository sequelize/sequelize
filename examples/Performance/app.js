var Sequelize    = require(__dirname + "/../../index")
  , config       = require("../../test/config")
  , sequelize    = new Sequelize(config.database, config.username, config.password, {logging: false, host: config.host})
  , QueryChainer = Sequelize.Utils.QueryChainer
  , sys          = require("sys")

var Person = sequelize.define('person', { name: Sequelize.STRING })

Person.sync({force: true}).on('success', function() {
  var start = Date.now()
    , count = 10000
    , done  = 0
  
  var createPeople = function(callback) {
    Person.create({name: 'someone'}).on('success', callback).on('failure', function(err) { console.log(err) })
  }
  var createPeopleBatch = function(batchSize, callback) {
    var done = 0
    
    for(var i = 0; i < batchSize; i++) 
      createPeople(function() { (++done == batchSize) && callback() })
  }
  var batchCallback = function() {
    sys.print(".");
    
    if((done += 50) != count)
      createPeopleBatch(50, batchCallback)
    else {
      console.log("\nFinished creation of " + count + " people. Took: " + (Date.now() - start) + "ms")
      
      start = Date.now()
      console.log("Will now read them from the database:")
    
      Person.findAll().on('success', function(people) {
        console.log("Reading " + people.length + " items took: " + (Date.now() - start) + "ms")
      })
    }
  }
  
  console.log('Creating people :)')
  createPeopleBatch(50, batchCallback)
}).on('failure', function(err) {
  console.log(err)
})