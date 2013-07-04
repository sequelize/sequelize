/*jslint node:true */
"use strict";

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Trainer', {
        first_name: {
            type: DataTypes.STRING
        },
        last_name: {
            type: DataTypes.STRING
        }
    }, {
        // don't need timestamp attributes for this model
        timestamps: false,
        underscored: true
    });
};
