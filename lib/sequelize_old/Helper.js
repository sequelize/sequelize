var Helper = function(Sequelize) {
  this.Sequelize = Sequelize
  this.Inflection = require(__dirname + "/../inflection/inflection")
  this.QueryChainer = new (require("./Helper/QueryChainer").QueryChainer)(this)
  this.options = {}

  require(__dirname + "/Helper/Basics.js")(this)
  require(__dirname + "/Helper/SQL.js")(this)
  require(__dirname + "/Helper/Hash.js")(this)
  require(__dirname + "/Helper/Array.js")(this)
}

exports.Helper = Helper