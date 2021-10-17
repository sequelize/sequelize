'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
  sinon = require('sinon');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] ConnectionManager', () => {
    describe('getConnection', () => {
      it('should forward empty string storage to SQLite connector to create temporary disk-based database', () => {
        // storage='' means anonymous disk-based database
        const sequelize = new Sequelize('', '', '', { dialect: 'sqlite', storage: '' });

        sinon.stub(sequelize.connectionManager, 'lib').value({
          Database: function FakeDatabase(_s, _m, cb) {
            cb();
            return {};
          }
        });
        sinon.stub(sequelize.connectionManager, 'connections').value({ default: { run: () => {} } });
        
        const options = {};
        sequelize.dialect.connectionManager.getConnection(options);
        expect(options.storage).to.be.equal('');
      });
    });
  });
}
