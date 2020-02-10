'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] Prevents security issue #11862', () => {
    it('Prevents security issue #11862', function() {
      const Vulnerability = this.sequelize.define('Vulnerability', {
        name: DataTypes.STRING
      });
      return Vulnerability.sync({ force: true }).then(() => {
        return expect(
          Vulnerability.create({ name: 'SELECT tbl_name FROM sqlite_master' })
        ).to.eventually.be.rejected;
      });
    });
  });
}
