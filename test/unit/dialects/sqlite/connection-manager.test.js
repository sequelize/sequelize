'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
  sinon = require('sinon');

if (dialect === 'sqlite') {
  describe('connectionManager', () => {
    describe('getConnection', () => {
      it('Should respect storage=\'\'', () => {
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
