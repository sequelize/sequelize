'use strict';
exports.default = function (sequelize, DataTypes) {
  return sequelize.define('Project' + parseInt(Math.random() * 999999999999999), {
    name: DataTypes.STRING
  });
};
