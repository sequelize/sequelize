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
})
