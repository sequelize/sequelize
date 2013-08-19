/*jslint node:true */
"use strict";

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Series', {
        title: {
            type: DataTypes.STRING
        },
        sub_title: {
            type: DataTypes.STRING
        },
        description: {
            type: DataTypes.TEXT
        },
        // Set FK relationship (hasMany) with `Trainer`
        trainer_id: {
            type: DataTypes.INTEGER,
            references: "Trainer",
            referencesKey: 'id'
        }
    }, {
        // don't need timestamp attributes for this model
        timestamps: false,
        underscored: true
    });
};
