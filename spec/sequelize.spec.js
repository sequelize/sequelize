var config    = require("./config/config")
  , Sequelize = require("../index")

describe('Sequelize', function() {
  it('should pass the global options correctly', function() {
    var sequelize = new Sequelize(config.database, config.username, config.password, {
      logging: false,
      define: { underscored:true }
    })
    var Model = sequelize.define('model', {name: Sequelize.STRING})
    expect(Model.options.underscored).toBeTruthy()
  })

  it('should correctly set the host and the port', function() {
    var options   = { host: '127.0.0.1', port: 1234 }
      , sequelize = new Sequelize(config.database, config.username, config.password, options)

    expect(sequelize.config.host).toEqual(options.host)
    expect(sequelize.config.port).toEqual(options.port)
  })
})
