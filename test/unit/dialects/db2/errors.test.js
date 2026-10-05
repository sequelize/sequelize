'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();
const queryProto = Support.sequelize.dialect.Query.prototype;

if (dialect === 'db2') {
  describe('[DB2 Specific] UniqueConstraintError - error message parsing', () => {
    const query = Object.create(queryProto, { options: { value: {} } });
    const duplicateKeyMessage = 'One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "12" constrains table "DB2INST1.users" from having duplicate values for the index key.  SQLSTATE=23505';

    it('parses unique constraint errors', () => {
      const fakeErr = new Error(`[IBM][CLI Driver][DB2/LINUXX8664] SQL0803N  ${duplicateKeyMessage}`);

      const parsedErr = query.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Sequelize.UniqueConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
    });

    it('parses unique constraint errors of recent versions of the CLI driver', () => {
      const fakeErr = new Error(`[IBM][CLI Driver][DB2/LINUXX8664] SQL0803N  An error or warning occurred.  ${duplicateKeyMessage}`);

      const parsedErr = query.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Sequelize.UniqueConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
    });

    it('looks up the index using its full id', () => {
      const fakeErr = new Error(`[IBM][CLI Driver][DB2/LINUXX8664] SQL0803N  An error or warning occurred.  ${duplicateKeyMessage}`);
      let indexQuery;
      const conn = {
        querySync(sql) {
          indexQuery = sql;

          return [{ INDNAME: 'users_username_unique' }];
        }
      };

      query.formatError(fakeErr, undefined, conn);

      expect(indexQuery).to.include('IID = 12 ').and.include("TABSCHEMA = 'DB2INST1'").and.include("TABNAME = 'users'");
    });
  });
}
