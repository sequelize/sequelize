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
  
  var createPerson = function() {
    Person.create({name: 'someone'}).on('success', function() {
      if(++done == count) {
        var duration = (Date.now() - start)
        console.log("\nFinished creation of " + count + " people. Took: " + duration + "ms (avg: " + (duration/count) + "ms)")
        
        start = Date.now()
        console.log("Will now read them from the database:")
      
        Person.findAll().on('success', function(people) {
          console.log("Reading " + people.length + " items took: " + (Date.now() - start) + "ms")
        })
      } else {
        (done % 100 == 0) && sys.print('.')
      }
    }).on('failure', function(err) {
      console.log(err)
    })
  }

  console.log('Creating people :)')
  for(var i = 0; i < count; i++) {
    createPerson()
  }
    
}).on('failure', function(err) {
  console.log(err)
})