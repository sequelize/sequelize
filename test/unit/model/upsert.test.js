'use strict';

/* jshint -W030 */
let chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , sinon = require('sinon')
  , Promise = current.Promise
  , DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {

  if (current.dialect.supports.upserts) {
    describe('method upsert', function() {
      const User = current.define('User', {
        name: DataTypes.STRING,
        secretValue: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      });

      before(function() {
        this.query = current.query;
        current.query = sinon.stub().returns(Promise.resolve());
      });

      after(function() {
        current.query = this.query;
      });

      it('skip validations for missing fields', function() {
        return expect(User.upsert({
          name: 'Grumpy Cat'
        })).not.to.be.rejectedWith(current.ValidationError);
      });
    });
  }
});
