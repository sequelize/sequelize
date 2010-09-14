var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, { disableLogging: true })

var Person = sequelize.define('person', { name: Sequelize.STRING })

Sequelize.chainQueries([{drop: sequelize}, {sync: sequelize}], function() {
  var start   = Date.now(),
      count   = 10000,
      queries = []
  
  for(var i = 0; i < count; i++) {
    var p = new Person({name: 'someone'})
    queries.push({ save: p })
  }
  
  Sequelize.Helper.log("Begin to save " + count + " items!")
  Sequelize.chainQueries(queries, function() {
    Sequelize.Helper.log("Saving " + count + " items took: " + (Date.now() - start) + "ms")
    
    start   = Date.now()
    Sequelize.Helper.log("Will now read them from the database:")
    Person.findAll(function(persons) {
      Sequelize.Helper.log("Reading " + persons.length + " items took: " + (Date.now() - start) + "ms")
    })
  })
})