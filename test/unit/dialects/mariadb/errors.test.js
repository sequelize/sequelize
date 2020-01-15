'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();
const queryProto = Support.sequelize.dialect.Query.prototype;

if (dialect === 'mariadb') {
  describe('[MARIADB Specific] ForeignKeyConstraintError - error message parsing', () => {
    it('FK Errors with ` quotation char are parsed correctly', () => {
      const fakeErr = new Error('Cannot delete or update a parent row: a foreign key constraint fails (`table`.`brothers`, CONSTRAINT `brothers_ibfk_1` FOREIGN KEY (`personId`) REFERENCES `people` (`id`) ON UPDATE CASCADE).');

      fakeErr.errno = 1451;

      const parsedErr = queryProto.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Sequelize.ForeignKeyConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
      expect(parsedErr.reltype).to.equal('parent');
      expect(parsedErr.table).to.equal('people');
      expect(parsedErr.fields).to.be.an('array').to.deep.equal(['personId']);
      expect(parsedErr.value).to.be.undefined;
      expect(parsedErr.index).to.equal('brothers_ibfk_1');
    });

    it('FK Errors with " quotation char are parsed correctly', () => {
      const fakeErr = new Error('Cannot delete or update a parent row: a foreign key constraint fails ("table"."brothers", CONSTRAINT "brothers_ibfk_1" FOREIGN KEY ("personId") REFERENCES "people" ("id") ON UPDATE CASCADE).');

      fakeErr.errno = 1451;

      const parsedErr = queryProto.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Sequelize.ForeignKeyConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
      expect(parsedErr.reltype).to.equal('parent');
      expect(parsedErr.table).to.equal('people');
      expect(parsedErr.fields).to.be.an('array').to.deep.equal(['personId']);
      expect(parsedErr.value).to.be.undefined;
      expect(parsedErr.index).to.equal('brothers_ibfk_1');
    });

    it('newlines contained in err message are parsed correctly', () => {
      const fakeErr = new Error('(conn=43, no: 1062, SQLState: 23000) Duplicate entry \'unique name one\r\' for key \'models_uniqueName2_unique\'\nsql: INSERT INTO `models` (`id`,`uniqueName1`,`uniqueName2`,`createdAt`,`updatedAt`) VALUES (DEFAULT,?,?,?,?); - parameters:[\'this is ok\',\'unique name one\',\'2019-01-18 09:05:28.496\',\'2019-01-18 09:05:28.496\']');

      fakeErr.errno = 1062;

      const parsedErr = queryProto.formatError(fakeErr);

      expect(parsedErr).to.be.instanceOf(Sequelize.UniqueConstraintError);
      expect(parsedErr.parent).to.equal(fakeErr);
      expect(parsedErr.fields.models_uniqueName2_unique).to.equal('unique name one\r');
    });
  });
}
