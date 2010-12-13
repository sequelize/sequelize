var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, { disableLogging: true })

var Person = sequelize.define('person', { name: Sequelize.STRING })

Sequelize.chainQueries({drop: sequelize}, {sync: sequelize}, function() {
  var count   = 10,
      queries = []
  
  for(var i = 0; i < count; i++) {
    var p = new Person({name: 'someone' + (i%3)})
    queries.push({ save: p })
  }
  
  Sequelize.Helper.log("Begin to save " + count + " items!")
  Sequelize.chainQueries(queries, function() {
    Sequelize.Helper.log("Finished!")

    Person.count(function(count) {
      Sequelize.Helper.log("Counted " + count + " elements!")
    })
    
    Person.count({name: 'someone2'}, function(count) {
      Sequelize.Helper.log("Counted " + count + " elements with name = someone2!")
    })
  })
})