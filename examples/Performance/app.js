var Sequelize    = require(__dirname + "/../../index")
  , config       = require("../../test/config")
  , sequelize    = new Sequelize(config.database, config.username, config.password, {logging: false, host: config.host})
  , QueryChainer = Sequelize.Utils.QueryChainer

var Person = sequelize.define('person', { name: Sequelize.STRING })

Person.sync({force: true}).on('success', function() {
  var start   = Date.now()
    , count   = 10000
    , offset  = 0
    , stepWidth = 50
    , queries = []
    , chainer = new QueryChainer
  
  var perform = function(cb) {
    console.log("Begin to create " + offset + " - " + (offset+stepWidth) + " items!")
    
    for(var i = offset; i < (offset + stepWidth); i++)
      chainer.add(Person.create({name: 'someone'}))
    
    chainer.run().on('success', function() {
      if(count - offset > 0) {
        offset += stepWidth
        perform(cb)
      } else {
        console.log("Saving " + count + " items took: " + (Date.now() - start) + "ms")
        cb && cb.call()
      }
    }).on('failure', function(err) {
      console.log(err)
    })
  }
  
  perform(function() {
    start = Date.now()
    console.log("Will now read them from the database:")

    Person.findAll().on('success', function(people) {
      console.log("Reading " + people.length + " items took: " + (Date.now() - start) + "ms")
    })
  })
}).on('failure', function(err) {
  console.log(err)
})