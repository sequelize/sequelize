import assert from 'node:assert';
import type { Range } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { getDataTypeDialectMeta } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialect-toolbox.js';
import { PostgresConnectionManager } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/connection-manager.js';
import * as PostgresDataTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/postgres/data-types.js';
import { expect } from 'chai';
import identity from 'lodash/identity';
import isObject from 'lodash/isObject';
import { sequelize } from '../../support';

// TODO: instead of testing RANGE.parse, test actual db serialization/deserialization

const dialect = sequelize.dialect;
if (dialect.name === 'postgres') {
  // Don't try to load pg until we know we're running on postgres.
  const pg = require('pg');

  const connectionManager = sequelize.connectionManager;
  assert(connectionManager instanceof PostgresConnectionManager);

  describe('[POSTGRES Specific] DataTypes.RANGE.parse', () => {
    it('should handle native postgres timestamp format', async () => {
      // Make sure nameOidMap is loaded
      const connection = await connectionManager.getConnection();
      await connectionManager.releaseConnection(connection);

      const meta = getDataTypeDialectMeta(DataTypes.DATE, 'postgres');
      assert(Array.isArray(meta));

      const tsName = meta[0];
      assert(typeof tsName === 'string');

      const tsOid = connectionManager.nameOidMap[tsName].oid;
      const parser = pg.types.getTypeParser(tsOid);

      const parseResult = PostgresDataTypes.RANGE.parse('(2016-01-01 08:00:00-04,)', { parser });
      assert(isObject(parseResult[0]));
      assert(parseResult[0].value instanceof Date);

      expect(parseResult[0].value.toISOString()).to.equal('2016-01-01T12:00:00.000Z');
    });

    const rangeParseOptions = { parser: PostgresDataTypes.INTEGER.parse };

    describe('parse', () => {
      it('should handle empty range string correctly', () => {
        expect(PostgresDataTypes.RANGE.parse('empty')).to.deep.equal([]);
      });

      it('should handle empty bounds correctly', () => {
        expect(PostgresDataTypes.RANGE.parse('(1,)', rangeParseOptions)).to.deep.equal([{ value: 1, inclusive: false }, { value: null, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(,1)', rangeParseOptions)).to.deep.equal([{ value: null, inclusive: false }, { value: 1, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(,)', rangeParseOptions)).to.deep.equal([{ value: null, inclusive: false }, { value: null, inclusive: false }]);
      });

      it('should handle infinity/-infinity bounds correctly', () => {
        expect(PostgresDataTypes.RANGE.parse('(infinity,1)', rangeParseOptions)).to.deep.equal([{ value: Number.POSITIVE_INFINITY, inclusive: false }, { value: 1, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(1,infinity)', rangeParseOptions)).to.deep.equal([{ value: 1, inclusive: false }, { value: Number.POSITIVE_INFINITY, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(-infinity,1)', rangeParseOptions)).to.deep.equal([{ value: Number.NEGATIVE_INFINITY, inclusive: false }, { value: 1, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(1,-infinity)', rangeParseOptions)).to.deep.equal([{ value: 1, inclusive: false }, { value: Number.NEGATIVE_INFINITY, inclusive: false }]);
        expect(PostgresDataTypes.RANGE.parse('(-infinity,infinity)', rangeParseOptions)).to.deep.equal([{ value: Number.NEGATIVE_INFINITY, inclusive: false }, { value: Number.POSITIVE_INFINITY, inclusive: false }]);
      });

      it('should throw if a range cannot be parsed', () => {
        expect(() => PostgresDataTypes.RANGE.parse('some_non_array')).to.throw('Sequelize could not parse range "some_non_array" as its format is incompatible');
      });
    });

    describe('stringify and parse', () => {
      it('should stringify then parse back the same structure', () => {
        const testRange: Range<number> = [{ value: 5, inclusive: true }, { value: 10, inclusive: true }];
        const rangeType = DataTypes.RANGE(DataTypes.INTEGER).toDialectDataType(dialect);

        const stringified = rangeType.toBindableValue(testRange, {
          dialect,
          escape: identity,
        });

        expect(PostgresDataTypes.RANGE.parse(stringified, rangeParseOptions)).to.deep.equal(testRange);
      });
    });
  });
}
