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
      pet1    = new Pet({ name: 'Bob' }),
      pet2    = new Pet({ name: 'Aaron' })

  Sequelize.chainQueries([{save: person}, {save: pet1}, {save: pet2], function() {
    person.setPets([pet1], function(pets) {
      console.log('my pet: ' + pets[0].name )
      console.log("Now let's get the same data with fetchData!")
      person.fetchAssociations(function(data) {
        Sequelize.Helper.log("And here we are: " + data.pets[0].name)
        Sequelize.Helper.log("The object should now also contain the data: " + person.fetchedAssociations.pets[0].name)

        Sequelize.Helper.log('This should do a database request!')
        person.getPets(function(pets) {
          Sequelize.Helper.log("Pets: " + pets.map(function(pet) { return pet.name }).join(", "))
          Sequelize.Helper.log("Let's associate with another pet...")



          Sequelize.Helper.log('This should do no database request and just serves the already received pets')
          person.getPets(function(pets) {

          })
        })


        Person.find(person.id, { fetchAssociations: true }, function(p) {
          Sequelize.Helper.log('Works with find as well: ' + p.fetchedAssociations.pets[0].name)
        })

        Person.findAll({ fetchAssociations: true }, function(people) {
          Sequelize.Helper.log('And also with findAll:' + people[0].fetchedAssociations.pets[0].name)
        })


      })
    })
  })
})