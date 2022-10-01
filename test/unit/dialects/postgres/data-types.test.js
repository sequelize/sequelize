'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes: BaseTypes } = require('@sequelize/core');
const DataTypes = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/data-types.js')(BaseTypes);
const { PostgresQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/query-generator.js');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] DataTypes', () => {
    beforeEach(function () {
      this.queryGenerator = new QueryGenerator({
        sequelize: this.sequelize,
        dialect: this.sequelize.dialect,
      });
    });

    describe('GEOMETRY', () => {
      it('should use bindParam fn', function () {
        const value = { type: 'Point' };
        const bind = {};
        const bindParam = this.queryGenerator.bindParam(bind);
        const result = DataTypes.GEOMETRY.prototype.bindParam(value, { bindParam });
        expect(result).to.equal('ST_GeomFromGeoJSON($sequelize_1)');
        expect(bind).to.eql({ sequelize_1: value });
      });
    });

    describe('GEOGRAPHY', () => {
      it('should use bindParam fn', function () {
        const value = { type: 'Point' };
        const bind = {};
        const bindParam = this.queryGenerator.bindParam(bind);
        const result = DataTypes.GEOGRAPHY.prototype.bindParam(value, { bindParam });
        expect(result).to.equal('ST_GeomFromGeoJSON($sequelize_1)');
        expect(bind).to.eql({ sequelize_1: value });
      });
    });
  });
}
