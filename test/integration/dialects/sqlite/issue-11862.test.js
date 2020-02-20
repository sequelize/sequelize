'use strict';

var Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] Prevents security issue #11862', function() {
    it('Prevents security issue #11862', function() {
      var Vulnerability = this.sequelize.define('Vulnerability', {
        name: DataTypes.STRING
      });
      return Vulnerability.sync({ force: true }).then(function() {
        // Before #11862 was fixed, the following call would crash the process.
        // Here we test that this is no longer the case - the promise should settle properly.
        // Ideally it should resolve, of course (not reject!), but from the point of view of the
        // security issue, rejecting the promise is by far not as bad as crashing the process.
        return Vulnerability.create({ name: 'SELECT tbl_name FROM sqlite_master' }).reflect();
        // Note that in Sequelize v5+, the above call behaves correctly (resolves).
      });
    });
  });
}
