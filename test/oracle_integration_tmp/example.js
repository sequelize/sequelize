'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , Sequelize=require('../../index')
  , uuid = require('node-uuid');


describe(Support.getTestDialectTeaser('Oracle tests tmp'), function() {
  beforeEach(function () {
  });

  it(' divers', function ()  {
    var sequelize=this.sequelize;

    var User = this.sequelize.define('User', {
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

    return User.sync({ 
      force: true 
    }).then(function(user) {
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
    }).then(function(user) {
        expect(user).to.be.ok;
        expect(user.id === undefined).to.equal(false);      
    }).then(function(user) {
      return User.create({
        username: 'janedoe',
        birthday: new Date(1982, 6, 20)
      });
    }).then(function(user) {
        expect(user).to.be.ok;
        expect(user.id === undefined).to.equal(false);  
    }).then(function(user) {
      return User.findAll({
        where: {
          username: 'janedoe'
        },
        raw: true
      });
    }).then(function(user) {
        expect(user.length).to.equal(2); 
    }).then(function(user) {
      return sequelize.query('select * from "Users"', { 
        raw: true
      });
    }).then(function(users) {
        expect(users.length).to.equal(2); 
    }).then(function(user) {
      return sequelize.query({
        query: 'select ? as "foo", ? as "bar" from dual',  
        values: [1, 2] 
      }, { 
        type: sequelize.QueryTypes.SELECT 
      });
    }).then(function(data) {
        expect(data[0].foo).to.equal(1); 
        expect(data[0].bar).to.equal(2); 
    });
  });
});

// var sequelize = new Sequelize('XE', 'hr', 'welcome', {
//   host:'localhost',
//   dialect:'oracle',
//   // logging: null,
//   pool:{
//     maxConnections: 5,
//     minConnections: 0,
//     maxIdleTime: 1000
//   }
// });