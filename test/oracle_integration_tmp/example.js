'use strict';

var Sequelize=require('sequelize-oracle')
  , uuid = require('node-uuid');


var sequelize = new Sequelize('XE', 'hr', 'welcome', {
  host:'localhost',
  dialect:'oracle',
  // logging: null,
  pool:{
    maxConnections: 5,
    minConnections: 0,
    maxIdleTime: 1000
  }
});

var User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATEONLY,
  ch: Sequelize.CHAR(10),
  // te: Sequelize.TEXT,
  nu: Sequelize.DECIMAL(3,2),
  bi: Sequelize.BIGINT,
  i: Sequelize.INTEGER,
  fl: Sequelize.FLOAT(11),
  dou: Sequelize.DOUBLE,
  da: Sequelize.DATE,
  u: Sequelize.UUID,
  b: Sequelize.BOOLEAN
});

sequelize.sync({
  force: true
}).then(function() {
  return User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20),
    ch: 'abcd',
    // te: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,;:!ù*$./§µ%£°=)àç_è-("é&€}]@^`|[{#~¹²0987654321',
    nu: 1.23,
    bi: 98989898220,
    i: 321,
    fl: 1234567.7654321,
    dou: 1234567890.0987654321,
    da: new Date(1980, 6, 20),
    u: uuid.v4(), 
    b: true
  });
}).then(function() {
  return User.create({
    username: 'janedoe',
    birthday: new Date(1982, 6, 20)
  });
}).then(function(jane) {
  return User.findAll({
    where: {
      username: 'janedoe'
    },
    raw: true
  }).then(function(jane){
      // console.log(jane.rows[0])

      return sequelize.query('select * from "Users"', { 
        raw: true
      }).spread(function(results, metadata) {
        console.log(results);
      });

      
      // jane[0].birthday= new Date(1983, 6, 20)

      // return jane[0].save();
  }).then(function(obj){
    return sequelize.query({
        query: 'select ? as "foo", ? as "bar" from dual',  
        values: [1, 2] 
      }, { 
        type: this.sequelize.QueryTypes.SELECT 
      }).then(function(results, metadata) {
        console.log(results);
      });
      // console.log(obj)
  });
}).error(function(e){
  console.error(e);
});
