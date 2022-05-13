import { DataTypes } from '@sequelize/core';
import type { GeoJSON } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/data-types.js';
import { expect } from 'chai';
import identity from 'lodash/identity';
import { sequelize } from '../../../support';

const dialect = sequelize.dialect;

if (dialect.name.startsWith('postgres')) {
  describe('[POSTGRES Specific] DataTypes', () => {
    const queryGenerator = sequelize.getQueryInterface().queryGenerator;

    describe('GEOMETRY', () => {
      it('should use bindParam fn', () => {
        const value: GeoJSON = { type: 'Point' };
        const bind = {};
        const bindParam = queryGenerator.bindParam(bind);
        const result = DataTypes.GEOMETRY('Point').toDialectDataType(dialect).bindParam(value, { bindParam, escape: identity, dialect });
        expect(result).to.equal('ST_GeomFromGeoJSON($sequelize_1)');
        expect(bind).to.eql({ sequelize_1: value });
      });
    });

    describe('GEOGRAPHY', () => {
      it('should use bindParam fn', () => {
        const value: GeoJSON = { type: 'Point' };
        const bind = {};
        const bindParam = queryGenerator.bindParam(bind);
        const result = DataTypes.GEOGRAPHY('Point').toDialectDataType(dialect).bindParam(value, { bindParam, escape: identity, dialect });
        expect(result).to.equal('ST_GeomFromGeoJSON($sequelize_1)');
        expect(bind).to.eql({ sequelize_1: value });
      });
    });
  });
}
