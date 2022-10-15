'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const { Sequelize } = require('@sequelize/core');

const dialect = Support.getTestDialect();

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] ConnectionManager', () => {
    describe('getConnection', () => {
      it('should forward empty string storage to SQLite connector to create temporary disk-based database', async () => {
        // storage='' means anonymous disk-based database
        const sequelize = new Sequelize('', '', '', { dialect: 'sqlite', storage: '' });

        const connection = await sequelize.dialect.connectionManager.getConnection({});
        expect(connection.filename).to.be.equal('');
      });
    });
  });
}
