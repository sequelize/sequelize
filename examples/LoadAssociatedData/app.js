var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, {disableLogging: false})

var Person = sequelize.define('person', {
  name: Sequelize.STRING
})

var Pet = sequelize.define('pet', {
  name: Sequelize.STRING
})

Person.hasManyAndBelongsTo('pets', Pet, 'owner')

Sequelize.chainQueries([{drop: sequelize}, {sync: sequelize}], function() {
  var person  = new Person({ name: 'Luke' }),
      pet     = new Pet({ name: 'Bob' })

  Sequelize.chainQueries([{save: person}, {save: pet}], function() {
    person.setPets([pet], function(pets) {
      console.log('my pet: ' + pets[0].name )
      console.log("Now let's get the same data with loadAssociatedData!")
      person.fetchAssociations(function(data) {
        Sequelize.Helper.log("And here we are: " + data.pets[0].name)
        Sequelize.Helper.log("The object should now also contain the data: " + person.associatedData.pets[0].name)

        Person.find(person.id, { fetchAssociations: true }, function(p) {
          Sequelize.Helper.log(p)
        })

        Person.findAll({ fetchAssociations: true }, function(people) {
          Sequelize.Helper.log(people)
        })
      })
    })
  })
})