'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  BaseTypes = require('sequelize/lib/data-types'),
  DataTypes = require('sequelize/lib/dialects/sqlite/data-types')(BaseTypes);

if (dialect.match(/^sqlite/)) {
  describe('[SQLITE Specific] DataTypes', () => {

    const TEST_DATE = new Date('2023-01-01T00:00:00.000Z');

    describe('DATE', () => {
      it('should be work when date param type is number', () => {
        expect(DataTypes.DATE.parse(TEST_DATE.getTime()).getTime()).eq(TEST_DATE.getTime());
      });

      it('should be work when date param type is Date', () => {
        expect(DataTypes.DATE.parse(TEST_DATE).getTime()).eq(TEST_DATE.getTime());
      });
    });

  });
}
