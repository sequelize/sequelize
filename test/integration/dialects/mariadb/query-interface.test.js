'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect();

if (dialect.match(/^mariadb/)) {
  describe('QueryInterface', () => {

    describe('databases', () => {
      it('should create and drop database', function() {
        return this.sequelize.query('SHOW DATABASES')
          .then(res => {
            const databaseNumber = res[0].length;
            return this.sequelize.getQueryInterface().createDatabase('myDB')
              .then(() => {
                return this.sequelize.query('SHOW DATABASES');
              })
              .then(databases => {
                expect(databases[0]).to.have.length(databaseNumber + 1);
                return this.sequelize.getQueryInterface().dropDatabase('myDB');
              });
          });
      });
    });
  });
}
