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

  Sequelize.chainQueries([{save: person}, {save: pet1}, {save: pet2}], function() {
    person.setPets([pet1], function(pets) {

      Sequelize.Helper.log('my pet: ' + pets[0].name )
      Sequelize.Helper.log("Now let's get the same data with fetchData!")

      person.fetchAssociations(function(data) {
        Sequelize.Helper.log("And here we are: " + data.pets[0].name)
        Sequelize.Helper.log("The object should now also contain the data: " + person.fetchedAssociations.pets[0].name)

        Sequelize.Helper.log('This won\'t do a database request!')
        person.getPets(function(pets) {

          Sequelize.Helper.log("Pets: " + pets.map(function(pet) { return pet.name }).join(", "))
          Sequelize.Helper.log("Let's associate with another pet...")

          person.setPets([pet1, pet2], function() {

            Sequelize.Helper.log("The set call has stored the pets as associated data!")
            Sequelize.Helper.log("And now let's find the pets again! This will make no new database request but serve the already stored pets Bob and Aaron!")

            person.getPets(function(pets) {

              Sequelize.Helper.log("Pets: " + pets.map(function(pet) { return pet.name }).join(", "))
              Sequelize.Helper.log("Now let's force the reloading of pets!")

              person.getPets({refetchAssociations: true}, function(pets) {

                Sequelize.Helper.log("Pets: " + pets.map(function(pet) { return pet.name }).join(", "))

                Person.find(person.id, { fetchAssociations: true }, function(p) {
                  var petNames = p.fetchedAssociations.pets.map(function(pet) { return pet.name }).join(", ")
                  Sequelize.Helper.log('Works with find as well: ' + petNames)
                })

                Person.findAll({ fetchAssociations: true }, function(people) {
                  var petNames = people[0].fetchedAssociations.pets.map(function(pet) { return pet.name }).join(", ")
                  Sequelize.Helper.log('And also with findAll: ' + petNames)
                })

              })
            })
          })
        })
      })
    })
  })
})