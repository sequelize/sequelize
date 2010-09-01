var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "root", null, {
      // use other database server or port
      host: 'my.srv.tld',
      port: 12345,
      
      // disable logging
      disableLogging: true
    }),
    Smth      = sequelize.define('Smth', {foo: Sequelize.STRING})

Smth.sync(function(_, err) {
  if(err) Sequelize.Helper.log(err)
  else Sequelize.Helper.log('Hey we established the connection successfully! Woot!')
})