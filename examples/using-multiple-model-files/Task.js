module.exports = function(sequelize, DataTypes) {
  return sequelize.define("Task", {
    name: DataTypes.STRING,
    deadline: DataTypes.DATE,
    importance: DataTypes.INTEGER
  })
}