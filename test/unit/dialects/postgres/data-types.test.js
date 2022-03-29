'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes: BaseTypes } = require('@sequelize/core');
const DataTypes = require('@sequelize/core/lib/dialects/postgres/data-types')(BaseTypes);
const { PostgresQueryGenerator: QueryGenerator } = require('@sequelize/core/lib/dialects/postgres/query-generator');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] DataTypes', () => {
    beforeEach(function () {
      this.queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        _dialect: this.sequelize.dialect,
      });
    });

    describe('GEOMETRY', () => {
      it('should use bindParam fn', function () {
        const value = { type: 'Point' };
        const bind = [];
        const bindParam = this.queryGenerator.bindParam(bind);
        const result = DataTypes.GEOMETRY.prototype.bindParam(value, { bindParam });
        expect(result).to.equal('ST_GeomFromGeoJSON($1)');
        expect(bind).to.eql([value]);
      });
    });

    describe('GEOGRAPHY', () => {
      it('should use bindParam fn', function () {
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
