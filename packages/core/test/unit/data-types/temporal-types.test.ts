import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;

const now = new Date();
const nowString = now.toISOString();
const nowDateOnly = nowString.slice(0, 10);

describe('DataTypes.DATE', () => {
  describe('toSql', () => {
    testDataTypeSql('DATE', DataTypes.DATE, {
      'db2 ibmi snowflake': 'TIMESTAMP',
      postgres: 'TIMESTAMP WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET',
      'mariadb mysql': 'DATETIME',
      sqlite3: 'TEXT',
    });

    testDataTypeSql('DATE(0)', DataTypes.DATE(0), {
      postgres: 'TIMESTAMP(0) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(0)',
      'mariadb mysql': 'DATETIME(0)',
      'db2 ibmi snowflake': 'TIMESTAMP(0)',
      sqlite3: 'TEXT',
    });

    testDataTypeSql('DATE(6)', DataTypes.DATE(6), {
      'db2 ibmi snowflake': 'TIMESTAMP(6)',
      postgres: 'TIMESTAMP(6) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(6)',
      mariadb: 'DATETIME(6)',
      mysql: 'DATETIME(6)',
      sqlite3: 'TEXT',
    });
  });

  const type = DataTypes.DATE().toDialectDataType(dialect);
  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid date`);
    });

    it('does not throw if the value is a date string or Date object', () => {
      expect(() => type.validate(now)).not.to.throw();
      expect(() => type.validate(nowString)).not.to.throw();
    });

    if (dialect.supports.dataTypes.DATETIME.infinity) {
      it('accepts Infinity/-Infinity', () => {
        expect(() => type.validate(Number.POSITIVE_INFINITY)).not.to.throw();
        expect(() => type.validate(Number.NEGATIVE_INFINITY)).not.to.throw();
      });
    }
  });

  describe('sanitize', () => {
    it('sanitizes a Date object or string to a Date object', () => {
      expect(type.sanitize(now)).to.equalTime(now);
      expect(type.sanitize(nowString)).to.equalTime(now);
    });

    if (dialect.supports.dataTypes.DATETIME.infinity) {
      it('does not modify numeric Infinity/-Infinity', () => {
        expect(type.sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(type.sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('sanitizes string "Infinity"/"-Infinity" to numeric Infinity/-Infinity', () => {
        expect(type.sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(type.sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });
    }
  });

  describe('toBindableValue', () => {
    if (dialect.supports.dataTypes.DATETIME.infinity) {
      it('stringifies numeric Infinity/-Infinity', () => {
        expect(type.toBindableValue(Number.POSITIVE_INFINITY)).to.equal('infinity');
        expect(type.toBindableValue(Number.NEGATIVE_INFINITY)).to.equal('-infinity');
      });
    }
  });
});

describe('DataTypes.DATEONLY', () => {
  describe('toSql', () => {
    testDataTypeSql('DATEONLY', DataTypes.DATEONLY, {
      default: 'DATE',
      sqlite3: 'TEXT',
    });
  });

  const type = DataTypes.DATEONLY().toDialectDataType(dialect);
  describe('validate', () => {
    if (dialect.supports.dataTypes.DATEONLY.infinity) {
      it('DATEONLY should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(type.toBindableValue(Number.POSITIVE_INFINITY)).to.equal('infinity');
        expect(type.toBindableValue(Number.NEGATIVE_INFINITY)).to.equal('-infinity');
      });
    }
  });

  describe('sanitize', () => {
    it('sanitizes a Date object or string to a string', () => {
      expect(type.sanitize(now)).to.equal(nowDateOnly);
      expect(type.sanitize(nowString)).to.equal(nowDateOnly);
    });

    if (dialect.supports.dataTypes.DATEONLY.infinity) {
      it('does not modify numeric infinity', () => {
        expect(type.sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(type.sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('sanitizes string Infinity/-Infinity to their numeric counterpart', () => {
        expect(type.sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(type.sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });
    }
  });
});

describe('DataTypes.TIME', () => {
  describe('toSql', () => {
    testDataTypeSql('TIME', DataTypes.TIME, {
      default: 'TIME',
      sqlite3: 'TEXT',
    });

    testDataTypeSql('TIME(6)', DataTypes.TIME(6), {
      default: 'TIME(6)',
      db2: new Error(`db2 does not support the TIME(precision) data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      sqlite3: 'TEXT',
    });
  });
});

describe('DataTypes.NOW', () => {
  describe('toSql', () => {
    testDataTypeSql('NOW', DataTypes.NOW, {
      default: 'NOW',
      db2: 'CURRENT TIME',
      mssql: 'GETDATE()',
    });
  });
});
