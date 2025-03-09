'use strict';

exports.default = function (sequelize, DataTypes) {
  return sequelize.define(`Project${Number.parseInt(Math.random() * 9_999_999_999_999_999, 10)}`, {
    name: DataTypes.STRING,
  });
};
