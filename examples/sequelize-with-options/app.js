var Sequelize = require(__dirname + "/../../index")
  , config    = require(__dirname + "/../../test/config")
  , sequelize = new Sequelize(config.database, config.username, config.password, {
      // use other database server or port
      host: 'my.srv.tld',
      port: 12345,
      
      // disable logging
      logging: false
    })
  , Smth      = sequelize.define('Smth', {foo: Sequelize.STRING})

sequelize.sync({force: true}).on('success', function() {
  console.log('Hey we established the connection successfully! Woot!')
}).on('failure', function(err) {
  console.log(err)
})