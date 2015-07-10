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

        return User.sync({force: true}).bind(this).then(function () {
          return this.sequelize.query(triggerQuery,{type:this.sequelize.QueryTypes.RAW});
        });
      });

      it('should return output rows after insert', function() {
        return User.create({
          username: 'triggertest'
        }).then(function () {
          return expect(User.find({username: 'triggertest'})).to.eventually.have.property('username').which.equals('triggertest');
        });
      });

      it('should return output rows after instance update', function() {
        return User.create({
          username: 'triggertest'
        }).then(function(user){
          user.username = 'usernamechanged';
          return user.save();
        })
        .then(function (user) {
          return expect(User.find({username: 'usernamechanged'})).to.eventually.have.property('username').which.equals('usernamechanged');
        });
      });

      it('should return output rows after Model update', function() {
        return User.create({
          username: 'triggertest'
        }).then(function(user){
          return User.update({
            username: 'usernamechanged'
          }, {
            where: {
              id: user.get('id')
            }
          });
        })
        .then(function (user) {
          return expect(User.find({username: 'usernamechanged'})).to.eventually.have.property('username').which.equals('usernamechanged');
        });
      });

      it('should successfully delete with a trigger on the table', function() {
        return User.create({
          username: 'triggertest'
        }).then(function(user){
          return user.destroy();
        }).then(function (user) {
          return expect(User.find({username: 'triggertest'})).to.eventually.be.null;
        });
      });
    });
  });
}
