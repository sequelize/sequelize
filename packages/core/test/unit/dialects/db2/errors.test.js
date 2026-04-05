'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../../support');

const { Sequelize } = require('@sequelize/core');

const dialect = Support.getTestDialect();
const queryProto = Support.sequelize.dialect.Query.prototype;

if (dialect === 'db2') {
  describe('[DB2 Specific] UniqueConstraintError - error message parsing', () => {
    it('parses duplicate key errors with variable whitespace', () => {
      const query = Object.create(queryProto);
      query.options = {};

      const fakeErr = new Error(
        'SQL0803N An error or warning occurred. One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "1" constrains table "DB2INST1.Users" from having duplicate values for the index key. SQLSTATE=23505',
      );

      const parsedErr = query.formatError(fakeErr, {
        querySync() {
          return [];
        },
      });

      expect(parsedErr).to.be.instanceOf(Sequelize.UniqueConstraintError);
      expect(parsedErr.cause).to.equal(fakeErr);
      expect(parsedErr.errors).to.deep.equal([]);
      expect(parsedErr.fields).to.deep.equal({});
    });
  });
}
