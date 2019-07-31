'use strict';

module.exports = (sequelize, DataTypes) => {
  class Project extends sequelize.Model { }

  Project.init({
    name: DataTypes.STRING,
    description: DataTypes.TEXT
  }, { sequelize, modelName: `Project${parseInt(Math.random() * 9999999999999999, 10)}` });

  return Project;
};
