/*
  Title: Working with associations

  This example demonstrates the use of associations.
  First of all, Person is getting associated via many-to-many with other Person objects (e.g. Person.hasMany('brothers')).
  Afterwards a Person becomes associated with a 'father' and a mother using a one-to-one association created by hasOneAndBelongsTo.
  The last association has the type many-to-one and is defined by the function hasManyAndBelongsTo.
  The rest of the example is about setting and getting the associated data.
*/

var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../spec/config/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  , Person    = sequelize.define('Person', { name: Sequelize.STRING })
  , Pet       = sequelize.define('Pet',    { name: Sequelize.STRING })

Person.hasMany(Person, {as: 'Brothers'})
Person.hasMany(Person, {as: 'Sisters'})
Person.hasOne(Person, {as: 'Father', foreignKey: 'FatherId'})
Person.hasOne(Person, {as: 'Mother', foreignKey: 'MotherId'})
Person.hasMany(Pet)

var chainer = new Sequelize.Utils.QueryChainer
  , person  = Person.build({ name: 'Luke' })
  , mother  = Person.build({ name: 'Jane' })
  , father  = Person.build({ name: 'John' })
  , brother = Person.build({ name: 'Brother' })
  , sister  = Person.build({ name: 'Sister' })
  , pet     = Pet.build({ name: 'Bob' })

sequelize.sync({force:true}).on('success', function() {
  chainer
    .add(person.save())
    .add(mother.save())
    .add(father.save())
    .add(brother.save())
    .add(sister.save())
    .add(pet.save())

  chainer.run().on('success', function() {
    person.setMother(mother).on('success', function() { person.getMother().on('success', function(mom) {
       console.log('my mom: ', mom.name)
    })})
    person.setFather(father).on('success', function() { person.getFather().on('success', function(dad) {
       console.log('my dad: ', dad.name)
    })})
    person.setBrothers([brother]).on('success', function() { person.getBrothers().on('success', function(brothers) {
       console.log("my brothers: " + brothers.map(function(b) { return b.name }))
    })})
    person.setSisters([sister]).on('success', function() { person.getSisters().on('success', function(sisters) {
       console.log("my sisters: " + sisters.map(function(s) { return s.name }))
    })})
    person.setPets([pet]).on('success', function() { person.getPets().on('success', function(pets) {
      console.log("my pets: " + pets.map(function(p) { return p.name }))
    })})
  }).on('failure', function(err) {
    console.log(err)
  })
})