var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
  , config    = require(__dirname + '/../config')
  , s         = new Sequelize(config.database, config.username, config.password, {disableLogging: true})
  , Day       = s.define('Day', { name: Sequelize.TEXT })
  , assert    = require("assert")
  
module.exports = {
 'prepareAssociations belongsTo': function() {
    var s = new Sequelize(config.database, config.username, config.password, {disableLogging: true})
    var Me = s.define('Me', {})
    var You = s.define('You', {})
    var assoc = Me.hasOne('you', You)
    You.belongsTo('me', Me, assoc)

    Me.prepareAssociations()
    You.prepareAssociations()

    assert.includes(Sequelize.Helper.Hash.keys(You.attributes), 'meId')
    assert.isDefined(You.attributes.meId)
    assert.isNotNull(You.attributes.meId)
  },
  'prepareAssociations hasMany': function() {
    var House = s.define('House', {})
    var Person = s.define('Person', {})

    House.hasMany('members', Person, 'households')
    House.prepareAssociations()
    Person.prepareAssociations()

    assert.isUndefined(House.attributes.personId)
    assert.isUndefined(House.attributes.membersId)
    assert.isUndefined(Person.attributes.houseId)

    assert.isDefined(s.tables.HouseholdsMembers)
  } 
}