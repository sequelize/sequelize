var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, { disableLogging: false })

var Person = sequelize.define('person', { name: Sequelize.STRING })

Sequelize.chainQueries({drop: sequelize}, {sync: sequelize}, function() {
  var count   = 10,
      queries = []
  
  for(var i = 0; i < count; i++) {
    var p = new Person({name: 'someone'})
    queries.push({ save: p })
  }
  
  Sequelize.Helper.log("Begin to save " + count + " items!")
  Sequelize.chainQueries(queries, function() {
    Sequelize.Helper.log("Finished!")

    Person.count(function(count) {
      Sequelize.Helper.log("Counted " + count + " elements!")
    })
  })
})