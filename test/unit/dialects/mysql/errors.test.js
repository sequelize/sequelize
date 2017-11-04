'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const queryProto = Support.sequelize.dialect.Query.prototype;

if (dialect === 'mysql') {
  describe('[MYSQL Specific] ForeignKeyConstraintError - error message parsing', () => {
    it('FK Errors with ` quotation char are parsed correctly', () => {
      const fakeErr = new Error('Cannot delete or update a parent row: a foreign key constraint fails (`table`.`brothers`, CONSTRAINT `brothers_ibfk_1` FOREIGN KEY (`personId`) REFERENCES `people` (`id`) ON UPDATE CASCADE).');

      fakeErr.code = 1451;

      const parsedErr = queryProto.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Support.sequelize.ForeignKeyConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
      expect(parsedErr.reltype).to.equal('parent');
      expect(parsedErr.table).to.equal('people');
      expect(parsedErr.fields).to.be.an('array').to.deep.equal(['personId']);
      expect(parsedErr.value).to.be.undefined;
      expect(parsedErr.index).to.equal('brothers_ibfk_1');
    });

    it('FK Errors with " quotation char are parsed correctly', () => {
      const fakeErr = new Error('Cannot delete or update a parent row: a foreign key constraint fails ("table"."brothers", CONSTRAINT "brothers_ibfk_1" FOREIGN KEY ("personId") REFERENCES "people" ("id") ON UPDATE CASCADE).');

      fakeErr.code = 1451;

      const parsedErr = queryProto.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Support.sequelize.ForeignKeyConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
      expect(parsedErr.reltype).to.equal('parent');
      expect(parsedErr.table).to.equal('people');
      expect(parsedErr.fields).to.be.an('array').to.deep.equal(['personId']);
      expect(parsedErr.value).to.be.undefined;
      expect(parsedErr.index).to.equal('brothers_ibfk_1');
    });
  });
}
