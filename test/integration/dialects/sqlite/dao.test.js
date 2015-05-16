'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , dialect = Support.getTestDialect();

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

    describe('regression tests', function() {

      it('do not crash while parsing unique constraint errors', function() {
        var Payments = this.sequelize.define('payments', {});

        return Payments.sync({force: true}).then(function () {
          return (expect(Payments.bulkCreate([{id: 1}, {id: 1}], { ignoreDuplicates: false })).to.eventually.be.rejected);
        });

      });
    });
  });
}