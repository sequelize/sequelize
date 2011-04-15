var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne('task', Task)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign id with underscore': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne('task', Task)
    assert.eql(Task.attributes['user'+num+'_id'], "INT")
  },
  'it should define getter and setter': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne('task', Task)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTask)
    assert.isDefined(u.getTask)
  }
}