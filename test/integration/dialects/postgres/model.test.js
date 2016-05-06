'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

describe('[POSTGRES]', function() {

  beforeEach(function() {
    var self = this;
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      version: { type: DataTypes.INTEGER, defaultValue: 0 },
    });
    return this.User.sync({ force: true }).then(function(user) {
      return self.User.create({ username: 'Versioned User'});
    });
  });

  describe('ensureAffectedRows on update', function() {
    it('should save if conditions match and ensureAffectedRows is true', function() {
      var self = this;
      return this.User.update({ version: 314 }, { where: {username: 'Versioned User'}, ensureAffectedRows: true }
      ).spread(function(affectedCount, affectedRows) {
        expect(affectedCount).to.be.equal(1);
        return self.User.findOne({where: {version: 314}}).then(function(user) {
          expect(user.username).to.be.equal('Versioned User');
        });
      });
    });

    it('should raise error if conditions do not match and ensureAffectedRows is true', function() {
      var self = this;
      return this.User.update({ version: 42 }, { where: {username: 'Missing User'}, ensureAffectedRows: true }
      ).catch(function(err) {
        expect(err.name).to.be.equal('SequelizeNoAffectedRowsError');
        return self.User.findOne({where: {version: 42}}).then(function(user) {
          expect(user).to.be.null;
        });
      });
    });
  });

});
