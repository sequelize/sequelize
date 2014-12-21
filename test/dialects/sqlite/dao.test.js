'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect();

chai.config.includeStack = true;

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', function() {
    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      this.User.sync({ force: true }).success(function() {
        done();
      });
    });

    describe('findAll', function() {
      it('handles dates correctly', function(done) {
        var self = this
          , user = this.User.build({ username: 'user' });

        user.dataValues['createdAt'] = new Date(2011, 4, 4);

        user.save().success(function() {
          self.User.create({ username: 'new user' }).success(function() {
            self.User.findAll({
              where: ['createdAt > ?', new Date(2012, 1, 1)]
            }).success(function(users) {
              expect(users).to.have.length(1);
              done();
            });
          });
        });
      });
    });
  });
}
