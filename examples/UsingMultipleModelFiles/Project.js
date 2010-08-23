exports.getProjectClass = function(Sequelize, sequelize) {
  var Project = sequelize.define("Project", {
    name: Sequelize.STRING,
    description: Sequelize.TEXT
  })
  
  /*
    Here comes further Project logic
  */
}