'use strict';

const { MsSqlQuery: Query } = require('@sequelize/mssql');
const Support = require('../../../support');

const dialect = Support.getTestDialect();
const sequelize = Support.sequelize;
const expect = require('chai').expect;
const tedious = require('tedious');

const connectionStub = { lib: tedious };

let query;

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Query', () => {
    beforeEach(() => {
      const options = {
        transaction: { name: 'transactionName' },
        isolationLevel: 'REPEATABLE_READ',
        logging: false,
      };
      query = new Query(connectionStub, sequelize, options);
    });

    describe('getSQLTypeFromJsType', () => {
      const TYPES = tedious.TYPES;
      const CP1252 = { codepage: 'CP1252' };
      const CP932 = { codepage: 'CP932' };
      const UTF8 = { codepage: 'utf-8' };
      const UNMAPPED = {};

      function addAndValidateStringParameter(value, databaseCollation) {
        const request = new tedious.Request('SELECT @value', () => {});
        const paramType = query.getSQLTypeFromJsType(value, tedious.TYPES, databaseCollation);
        request.addParameter('value', paramType.type, paramType.value, paramType.typeOptions);
        request.validateParameters(databaseCollation);

        return { paramType, request };
      }

      it('uses VarChar for ASCII strings when the collation has a mapped code page', () => {
        for (const collation of [CP1252, CP932, UTF8]) {
          expect(query.getSQLTypeFromJsType('plain', tedious.TYPES, collation)).to.eql({
            type: tedious.TYPES.VarChar,
            typeOptions: {},
            value: 'plain',
          });
        }
      });

      it('uses NVarChar for non-ASCII strings', () => {
        expect(query.getSQLTypeFromJsType('café', tedious.TYPES, CP1252)).to.eql({
          type: tedious.TYPES.NVarChar,
          typeOptions: {},
          value: 'café',
        });
      });

      it('falls back to NVarChar without a mapped code page', () => {
        for (const collation of [undefined, UNMAPPED]) {
          expect(query.getSQLTypeFromJsType('plain', tedious.TYPES, collation)).to.eql({
            type: tedious.TYPES.NVarChar,
            typeOptions: {},
            value: 'plain',
          });
        }

        const customModuleConnection = { databaseCollation: undefined };
        expect(
          query.getSQLTypeFromJsType(
            'plain',
            tedious.TYPES,
            customModuleConnection.databaseCollation,
          ).type,
        ).to.equal(tedious.TYPES.NVarChar);
      });

      it('preserves null, boolean, number, bigint, and buffer branches', () => {
        expect(query.getSQLTypeFromJsType(null, tedious.TYPES, CP1252).type).to.equal(
          tedious.TYPES.NVarChar,
        );
        expect(query.getSQLTypeFromJsType(true, tedious.TYPES, CP1252).type).to.equal(
          tedious.TYPES.Bit,
        );
        expect(query.getSQLTypeFromJsType(123, tedious.TYPES, CP1252).type).to.equal(
          tedious.TYPES.Int,
        );
        expect(query.getSQLTypeFromJsType(123n, tedious.TYPES, CP1252).type).to.equal(
          tedious.TYPES.Int,
        );
        expect(
          query.getSQLTypeFromJsType(Buffer.from('abc'), tedious.TYPES, CP1252).type,
        ).to.equal(tedious.TYPES.VarBinary);
      });

      describe('string Request parameters', () => {
        it('passes Tedious validation for mapped legacy and UTF-8 code pages', () => {
          for (const databaseCollation of [CP1252, CP932, UTF8]) {
            const { paramType } = addAndValidateStringParameter('plain', databaseCollation);
            expect(paramType.type).to.equal(tedious.TYPES.VarChar);
          }
        });

        it('selects NVarChar before validation when the code page is unavailable', () => {
          for (const databaseCollation of [undefined, UNMAPPED]) {
            const { paramType } = addAndValidateStringParameter('plain', databaseCollation);
            expect(paramType.type).to.equal(tedious.TYPES.NVarChar);
          }
        });

        it('preserves empty, control, and NUL bytes with a mapped code page', () => {
          for (const value of ['', '\0', '\t', '\n', '\x7f']) {
            const { paramType } = addAndValidateStringParameter(value, CP1252);
            expect(paramType.type).to.equal(tedious.TYPES.VarChar);
          }
        });

        it('infers varchar(8000) and varchar(max) at the Tedious boundary', () => {
          const atLimit = addAndValidateStringParameter('x'.repeat(8_000), CP1252);
          const overLimit = addAndValidateStringParameter('x'.repeat(8_001), CP1252);

          expect(atLimit.request.makeParamsParameter(atLimit.request.parameters)).to.equal(
            '@value varchar(8000)',
          );
          expect(overLimit.request.makeParamsParameter(overLimit.request.parameters)).to.equal(
            '@value varchar(max)',
          );
        });
      });

      it('should return correct parameter type', () => {
        expect(query.getSQLTypeFromJsType(2_147_483_647, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: 2_147_483_647,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_648, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: -2_147_483_648,
        });

        expect(query.getSQLTypeFromJsType(2_147_483_648, TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: 2_147_483_648,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_649, TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: -2_147_483_649,
        });

        expect(query.getSQLTypeFromJsType(2_147_483_647n, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: 2_147_483_647,
        });
        expect(query.getSQLTypeFromJsType(-2_147_483_648n, TYPES)).to.eql({
          type: TYPES.Int,
          typeOptions: {},
          value: -2_147_483_648,
        });

        expect(query.getSQLTypeFromJsType(BigInt(Number.MAX_SAFE_INTEGER), TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: Number.MAX_SAFE_INTEGER,
        });
        expect(query.getSQLTypeFromJsType(BigInt(Number.MIN_SAFE_INTEGER), TYPES)).to.eql({
          type: TYPES.BigInt,
          typeOptions: {},
          value: Number.MIN_SAFE_INTEGER,
        });

        const overMaxSafe = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
        expect(query.getSQLTypeFromJsType(overMaxSafe, TYPES)).to.eql({
          type: TYPES.VarChar,
          typeOptions: {},
          value: overMaxSafe.toString(),
        });
        const underMinSafe = BigInt(Number.MIN_SAFE_INTEGER) - 1n;
        expect(query.getSQLTypeFromJsType(underMinSafe, TYPES)).to.eql({
          type: TYPES.VarChar,
          typeOptions: {},
          value: underMinSafe.toString(),
        });

        const buffer = Buffer.from('abc');
        expect(query.getSQLTypeFromJsType(buffer, TYPES)).to.eql({
          type: TYPES.VarBinary,
          typeOptions: {},
          value: buffer,
        });
      });

      it('should return parameter type correct scale for float', () => {
        expect(query.getSQLTypeFromJsType(1.23, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 2 },
          value: 1.23,
        });
        expect(query.getSQLTypeFromJsType(0.300_000_000_000_000_04, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 17 },
          value: 0.300_000_000_000_000_04,
        });
        expect(query.getSQLTypeFromJsType(2.5e-15, TYPES)).to.eql({
          type: TYPES.Numeric,
          typeOptions: { precision: 30, scale: 16 },
          value: 2.5e-15,
        });
      });
    });
  });
}
