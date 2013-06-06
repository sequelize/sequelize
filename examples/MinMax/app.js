var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var Person  = sequelize.define('Person',
  { name: Sequelize.STRING,
    age : Sequelize.INTEGER

  })
  , chainer = new Sequelize.Utils.QueryChainer

sequelize.sync({force: true}).on('success', function() {
  var count   = 10,
      queries = []

  for(var i = 0; i < count; i++)
    chainer.add(Person.create({name: 'someone' + (i % 3), age : i+5}))

  console.log("Begin to save " + count + " items!")

  chainer.run().on('success', function() {
    console.log("finished")
    Person.max('age').on('success', function(max) {
      console.log("Oldest person: " + max)
    });
    Person.min('age').on('success', function(min) {
      console.log("Youngest person: " + min)
    });
  })
})