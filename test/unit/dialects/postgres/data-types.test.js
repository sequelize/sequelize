'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  BaseTypes = require('sequelize/lib/data-types'),
  DataTypes = require('sequelize/lib/dialects/postgres/data-types')(BaseTypes),
  QueryGenerator = require('sequelize/lib/dialects/postgres/query-generator');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DataTypes', () => {
    beforeEach(function() {
      this.queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect
      });
    });

    describe('GEOMETRY', () => {
      it('should use bindParam fn', function() {
        const value = { type: 'Point' };
        const bind = [];
        const bindParam = this.queryGenerator.bindParam(bind);
        const result = DataTypes.GEOMETRY.prototype.bindParam(value, { bindParam });
        expect(result).to.equal('ST_GeomFromGeoJSON($1)');
        expect(bind).to.eql([value]);
      });
    });

    describe('GEOGRAPHY', () => {
      it('should use bindParam fn', function() {
        const value = { type: 'Point' };
        const bind = [];
        const bindParam = this.queryGenerator.bindParam(bind);
        const result = DataTypes.GEOGRAPHY.prototype.bindParam(value, { bindParam });
        expect(result).to.equal('ST_GeomFromGeoJSON($1)');
        expect(bind).to.eql([value]);
      });
    });
  });
}
