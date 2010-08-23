exports.getTaskClass = function(Sequelize, sequelize) {
  var Task = sequelize.define("Task", {
    name: Sequelize.STRING,
    deadline: Sequelize.DATE,
    importance: Sequelize.INTEGER
  })
  
  /*
    Here comes further Task logic
  */
}