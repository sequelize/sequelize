/*jslint node:true */
"use strict";

module.exports = function(sequelize, DataTypes) {
    return sequelize.define('Video', {
        title: {
            type: DataTypes.STRING
        },
        sequence: {
            type: DataTypes.INTEGER
        },
        description: {
            type: DataTypes.TEXT
        },
        // set relationship (hasOne) with `Series`
        series_id: {
            type: DataTypes.INTEGER,
            references: "Series",
            referencesKey: 'id'
        }
    }, {
        // don't need timestamp attributes for this model
        timestamps: false,
        underscored: true
    });
};
