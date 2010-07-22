var kiwi = require("kiwi")
kiwi.require("NoSpec")

new NoSpec()
  .define("Sequelize", __dirname + "/../sequelize", "Sequelize")
  .load(__dirname + "/specs") // use this to load all files in a folder and its subfolders
  .run()