'use strict';

var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize;


if (current.dialect.supports.tmpTableTrigger) {
  describe(Support.getTestDialectTeaser('Model'), function() {
    describe('trigger', function() {
      var User;
      var triggerQuery = 'create trigger User_ChangeTracking on [users] for insert,update, delete \n' +
                          'as\n' +
                            'SET NOCOUNT ON\n' +
                            'if exists(select 1 from inserted)\n' +
                            'begin\n' +
                              'select * from inserted\n' +
                            'end\n' +
                            'if exists(select 1 from deleted)\n' +
                            'begin\n' +
                              'select * from deleted\n' +
                            'end\n';

      beforeEach(function () {
        User = this.sequelize.define('user', {
          username: {
            type: Sequelize.STRING,
            field:'user_name'
          }
        },{
          hasTrigger:true
        });
      });

      it('should return output rows after insert', function() {
        return User.sync({force: true}).bind(this).then(function () {
          return this.sequelize.query(triggerQuery,{type:this.sequelize.QueryTypes.RAW});
        }).then(function(){
          return User.create({
            username: 'triggertest'
          });
        }).then(function () {
          return User.find({username: 'triggertest'}).then(function(user) {
            expect(user.username).to.equal('triggertest');
          });
        });

      });

      it('should return output rows after bulk insert', function() {
        return User.sync({force: true}).bind(this).then(function () {
          return this.sequelize.query(triggerQuery,{type:this.sequelize.QueryTypes.RAW});
        }).then(function(){
          return User.bulkCreate([
            {username: 'shak'},
            {username: 'mike'},
            {username: 'blah'},
            {username: 'argh'}]);
        }).then(function () {
          return User.findAll().then(function(users) {
            expect(users.length).to.equal(4);
          });
        });
      });

      it('should return output rows after update', function() {
        return User.sync({force: true}).bind(this).then(function () {
          return this.sequelize.query(triggerQuery,{type:this.sequelize.QueryTypes.RAW});
        }).then(function(){
          return User.create({
            username: 'triggertest'
          });
        })
        .then(function(user){
          user.username = 'usernamechanged';
          return user.save();
        })
        .then(function (user) {
          return User.find({username: 'usernamechanged'}).then(function(user) {
            expect(user.username).to.equal('usernamechanged');
          });
        });
      });


      it('should successfully delete with a trigger on the table', function() {
        return User.sync({force: true}).bind(this).then(function () {
          return this.sequelize.query(triggerQuery,{type:this.sequelize.QueryTypes.RAW});
        }).then(function(){
          return User.create({
            username: 'triggertest'
          });
        })
        .then(function(user){
          return user.destroy();
        })
        .then(function (user) {
          return User.find({username: 'triggertest'}).then(function(user) {
            /* jshint expr:true */
            expect(user).to.be.null;
          });
        });
      });

    });
  });
}
