'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.sequelize.options.quoteIdentifiers = false;

    // This is purposefully named 'User', as it's an SQL reserved keyword
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN
    });

    return this.User.sync({ force: true });
  });

  afterEach(function() {
    this.sequelize.options.quoteIdentifiers = undefined;
  });

  describe('find', function() {
    describe('general / basic function', function() {
      beforeEach(function() {
        return this.User.create({username: 'barfooz'});
      });

      it('doesn\'t throw an error when finding with reserved keyword in table name', function() {
        return this.User.findOne().then(function(user) {
          expect(user.username).to.equal('barfooz');
        });
      });
    });
  });
});
