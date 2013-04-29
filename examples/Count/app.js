var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var Person  = sequelize.define('Person', { name: Sequelize.STRING })
  , chainer = new Sequelize.Utils.QueryChainer

sequelize.sync({force: true}).on('success', function() {
  var count   = 10,
      queries = []

  for(var i = 0; i < count; i++)
    chainer.add(Person.create({name: 'someone' + (i % 3)}))

  console.log("Begin to save " + count + " items!")

  chainer.run().on('success', function() {
    console.log("finished")
    Person.count().on('success', function(count) {
      console.log("Counted " + count + " elements!")
    })
    Person.count({where: {name: 'someone2'}}).on('success', function(count) {
      console.log("Counted " + count + " elements with name = someone2!")
    })
  })
})