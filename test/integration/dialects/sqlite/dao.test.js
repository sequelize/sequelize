'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , dialect = Support.getTestDialect();

chai.config.includeStack = true;

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', function() {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      return this.User.sync({ force: true });
    });

    describe('findAll', function() {
      it('handles dates correctly', function() {
        var self = this
          , user = this.User.build({ username: 'user' });

        user.dataValues.createdAt = new Date(2011, 4, 4);

        return user.save().then(function() {
          return self.User.create({ username: 'new user' }).then(function() {
            return self.User.findAll({
              where: ['createdAt > ?', new Date(2012, 1, 1)]
            }).then(function(users) {
              expect(users).to.have.length(1);
            });
          });
        });
      });
    });
  });
}
