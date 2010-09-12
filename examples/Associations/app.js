var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, {disableLogging: true})

var Person = sequelize.define('person', {
  name: Sequelize.STRING
})

var Pet = sequelize.define('pet', {
  name: Sequelize.STRING
})

Person.hasMany('brothers')
Person.hasMany('sisters')
Person.hasOneAndBelongsTo('father', Person)
Person.hasOneAndBelongsTo('mother', Person)
Person.hasManyAndBelongsTo('pets', Pet, 'owner')

Sequelize.chainQueries([{drop: sequelize}, {sync: sequelize}], function() {
  var person  = new Person({ name: 'Luke' }),
      mother  = new Person({ name: 'Jane' }),
      father  = new Person({ name: 'John' }),
      brother = new Person({ name: 'Brother' }),
      sister  = new Person({ name: 'Sister' }),
      pet     = new Pet({ name: 'Bob' })
   
  Sequelize.chainQueries([{save: person}, {save: mother}, {save: father}, {save: brother}, {save: sister}, {save: pet}], function() {
    person.setMother(mother, function(mom) { Sequelize.Helper.log('my mom: ' + mom.name) })
    person.setFather(father, function(dad) { Sequelize.Helper.log('my dad: ' + dad.name) })
    person.setBrothers([brother], function(bros) { Sequelize.Helper.log("ma bro: " + bros[0].name)})
    person.setSisters([sister], function(sis) { Sequelize.Helper.log("ma sis: " + sis[0].name)})
    person.setPets([pet], function(pets) { Sequelize.Helper.log('my pet: ' + pets[0].name )})
  })
})