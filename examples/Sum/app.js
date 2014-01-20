var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var Person  = sequelize.define('Person',
  { name: Sequelize.STRING,
    age : Sequelize.INTEGER,
    gender: Sequelize.ENUM('male', 'female')
  })
  , chainer = new Sequelize.Utils.QueryChainer

sequelize.sync({force: true}).on('success', function() {
  var count   = 10,
      queries = []

  for(var i = 0; i < count; i++)
    chainer.add(Person.create({name: 'someone' + (i % 3), age : i+5, gender: (i % 2 == 0) ? 'male' : 'female'}))

  console.log("Begin to save " + count + " items!")

  chainer.run().on('success', function() {
    console.log("finished")
    Person.sum('age').on('success', function(sum) {
      console.log("Sum of all peoples' ages: " + sum)
    });
    Person.sum('age', { where: { 'gender': 'male' } }).on('success', function(sum) {
      console.log("Sum of all males' ages: " + sum)
    });
  })
})
