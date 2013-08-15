/*jslint node:true */
"use strict";

var Sequelize = require('sequelize');

// initialize database connection
var sequelize = new Sequelize('testsequelize', 'testsequelize', 'testsequelize', {
    dialect: 'postgres',
    port: 5432,
    define: {
        freezeTableName: true
    }
});

// load models
var models = [
    'Trainer',
    'Series',
    'Video'
];

models.forEach(function(model) {
    module.exports[model] = sequelize.import(__dirname + '/' + model);
});

// describe relationships
(function(m) {
    m.Series.hasOne(m.Video);
    m.Trainer.hasMany(m.Series);
})(module.exports);

// export connection
module.exports.sequelize = sequelize;