var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    sequelize = new Sequelize("sequelize_test", "test", "test", {
      // use other database server or port
      host: 'my.srv.tld',
      port: 12345,
      
      // disable logging
      disableLogging: true
    })