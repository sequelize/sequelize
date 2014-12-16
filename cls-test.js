"use strict";

var Sequelize = require('./index');
var DataTypes = Sequelize;
var inflection = require('inflection');
var Bluebird = require('q');

var Promise = Sequelize.Promise;
var db, sequelize;

// db = sequelize = new Sequelize('sequelize_test', 'postgres', 'postgres', {
    // dialect: 'postgres',
var sequelize = new Sequelize('sequelize_test', 'root', null, {
    // dialect: 'sqlite',
    // dialect: 'mariadb',
    omitNull: true,
    // logging: console.log,
    // logging: false,
    host: '127.0.0.1',
    define: {
      // freezeTableName:true,
      // underscoredAll: true,
      underscored: false,
      timestamps: true,
    }
});






var cls = require('continuation-local-storage');
var sequelize_cls = cls.getNamespace('sequelize');

var User = sequelize.define('User', {});
// var Project = sequelize.define('project', {});

sequelize.authenticate({
  // logging: console.log,
  force: true
}).then(function() {
// sequelize.Promise.resolve().then(function () {
  sequelize.transaction(function () {
    console.log('inside transaction 1');
    console.log(sequelize_cls.get('transaction').id);

    return User.findAll();
  });

  sequelize.transaction(function () {
    console.log('inside transaction 2');
    console.log(sequelize_cls.get('transaction').id);

    return User.findAll();
  });
  sequelize.Promise.delay(2000).then(function () {
    console.log('in a totally different context');
    console.log(!!sequelize_cls.get('transaction'));
  });

  sequelize.transaction(function () {
    console.log('inside transaction 3');
    console.log(sequelize_cls.get('transaction').id);

    return sequelize.Promise.delay(2000).then(function () {
      console.log('inside transaction 3, very delayed');
      console.log(sequelize_cls.get('transaction').id);
    });
  }).then(function () {
    console.log('transaction done ')
    console.log(!!sequelize_cls.get('transaction'));
  });


  sequelize.transaction(function () {
    console.log('inside transaction 4');
    console.log(sequelize_cls.get('transaction').id);

    User.findAll();

    return sequelize.Promise.delay(200).then(function () {
      console.log('inside transaction 4, delayed');
      console.log(sequelize_cls.get('transaction').id);

      return User.findAll();
    })
  })

  // sequelize.authenticate().then(function () {
  //   sequelize.transaction(function() {
  //     console.log('inside authenticate, inside transaction')
  //     console.log(sequelize_cls.get('transaction').id);

  //     return User.findAll();
  //   })
  // })


}).then(function(user) {

}).catch(function (e) {
  console.log('catcher!')
  console.log(e);
}).done();
