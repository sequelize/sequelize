import { expect } from 'chai';
import { gte } from 'semver';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
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
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATE(0)', DataTypes.DATE(0), {
      postgres: 'TIMESTAMP(0) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(0)',
      'mariadb mysql': 'DATETIME(0)',
      'db2 ibmi snowflake': 'TIMESTAMP(0)',
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATE(6)', DataTypes.DATE(6), {
      'db2 ibmi snowflake': 'TIMESTAMP(6)',
      postgres: 'TIMESTAMP(6) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(6)',
      mariadb: 'DATETIME(6)',
      mysql: 'DATETIME(6)',
      sqlite: 'TEXT',
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
      sqlite: 'TEXT',
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

describe('DataTypes.DATETIME', () => {
  const unsupportedError = new TypeError(`${dialect.name} does not support the DATETIME data type. Please use DATETIME.OFFSET, DATETIME.ZONED or DATETIME.PLAIN instead.`);
  describe('toSql', () => {
    testDataTypeSql('DATETIME', DataTypes.DATETIME, {
      default: unsupportedError,
    });

    testDataTypeSql('DATETIME(0)', DataTypes.DATETIME(0), {
      default: unsupportedError,
    });

    testDataTypeSql('DATETIME(6)', DataTypes.DATETIME(6), {
      default: unsupportedError,
    });
  });
});

describe('DataTypes.DATETIME.OFFSET', () => {
  describe('toSql', () => {
    const unsupportedError = new TypeError(`${dialect.name} does not support the DATETIME.OFFSET data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);
    testDataTypeSql('DATETIME.OFFSET', DataTypes.DATETIME.OFFSET, {
      default: unsupportedError,
      'postgres snowflake': 'TIMESTAMP WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET',
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATETIME(0).OFFSET', DataTypes.DATETIME(0).OFFSET, {
      default: unsupportedError,
      'postgres snowflake': 'TIMESTAMP(0) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(0)',
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATETIME(6).OFFSET', DataTypes.DATETIME(6).OFFSET, {
      default: unsupportedError,
      'postgres snowflake': 'TIMESTAMP(6) WITH TIME ZONE',
      mssql: 'DATETIMEOFFSET(6)',
      sqlite: 'TEXT',
    });
  });

  if (dialect.supports.dataTypes.DATETIME.offset && gte(process.version, 'v19.0.0')) {
    const type = DataTypes.DATETIME().OFFSET.toDialectDataType(dialect);
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

      it('does not throw if the value is a Temporal.Instant string or object', () => {
        expect(() => type.validate('2021-01-01T00:00:00Z')).not.to.throw();
        expect(() => type.validate(Temporal.Instant.from('2021-01-01T00:00:00Z'))).not.to.throw();
      });
    });

    describe('sanitize', () => {
      it('sanitizes a Date object or string to a Temporal.Instant object', () => {
        expect(type.sanitize(now)).to.be.instanceOf(Temporal.Instant);
        expect(type.sanitize(nowString)).to.be.instanceOf(Temporal.Instant);
      });

      it('sanitizes a Temporal.Instant string or object to a Temporal.Instant object', () => {
        expect(type.sanitize('2021-01-01T00:00:00Z')).to.be.instanceOf(Temporal.Instant);
        expect(type.sanitize(Temporal.Instant.from('2021-01-01T00:00:00Z'))).to.be.instanceOf(Temporal.Instant);
      });
    });
  }
});

describe('DataTypes.DATETIME.PLAIN', () => {
  describe('toSql', () => {
    testDataTypeSql('DATETIME.PLAIN', DataTypes.DATETIME.PLAIN, {
      'db2 ibmi postgres': 'TIMESTAMP',
      'mariadb mysql': 'DATETIME',
      mssql: 'DATETIME2',
      snowflake: 'TIMESTAMP WITHOUT TIME ZONE',
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATETIME(0).PLAIN', DataTypes.DATETIME(0).PLAIN, {
      'db2 ibmi postgres': 'TIMESTAMP(0)',
      'mariadb mysql': 'DATETIME(0)',
      mssql: 'DATETIME2(0)',
      snowflake: 'TIMESTAMP(0) WITHOUT TIME ZONE',
      sqlite: 'TEXT',
    });

    testDataTypeSql('DATETIME(6).PLAIN', DataTypes.DATETIME(6).PLAIN, {
      'db2 ibmi postgres': 'TIMESTAMP(6)',
      'mariadb mysql': 'DATETIME(6)',
      mssql: 'DATETIME2(6)',
      snowflake: 'TIMESTAMP(6) WITHOUT TIME ZONE',
      sqlite: 'TEXT',
    });
  });

  if (dialect.supports.dataTypes.DATETIME.plain && gte(process.version, 'v19.0.0')) {
    const type = DataTypes.DATETIME().PLAIN.toDialectDataType(dialect);
    describe('validate', () => {
      it('should throw an error if `value` is invalid', () => {
        expect(() => {
          type.validate('foobar');
        }).to.throw(ValidationErrorItem, `'foobar' is not a valid date`);
      });

      it('throws an error if the value is a ISO string or Date object', () => {
        expect(() => type.validate(now)).to.throw();
        expect(() => type.validate(nowString)).to.throw();
      });

      it('does not throw if the value is a Temporal.PlainDateTime string or object', () => {
        expect(() => type.validate('2021-01-01T00:00:00')).not.to.throw();
        expect(() => type.validate(Temporal.PlainDateTime.from('2021-01-01T00:00:00'))).not.to.throw();
      });
    });

    describe('sanitize', () => {
      it('does not sanitize a Date object or string to a Temporal.PlainDateTime object', () => {
        expect(() => type.sanitize(now)).to.throw();
        expect(() => type.sanitize(nowString)).to.throw();
      });

      it('sanitizes a Temporal.PlainDateTime string or object to a Temporal.PlainDateTime object', () => {
        expect(type.sanitize('2021-01-01T00:00:00')).to.be.instanceOf(Temporal.PlainDateTime);
        expect(type.sanitize(Temporal.PlainDateTime.from('2021-01-01T00:00:00'))).to.be.instanceOf(Temporal.PlainDateTime);
      });
    });
  }
});

describe('DataTypes.DATETIME.ZONED', () => {
  describe('toSql', () => {
    const unsupportedError = new TypeError(`${dialect.name} does not support the DATETIME.ZONED data type.
      As a workaround, you can split the attribute into two columns, one for the plain datetime and one for the timezone.`);
    testDataTypeSql('DATETIME.ZONED', DataTypes.DATETIME.ZONED, {
      default: unsupportedError,
    });

    testDataTypeSql('DATETIME(0).ZONED', DataTypes.DATETIME(0).ZONED, {
      default: unsupportedError,
    });

    testDataTypeSql('DATETIME(6).ZONED', DataTypes.DATETIME(6).ZONED, {
      default: unsupportedError,
    });
  });
});

describe('DataTypes.TIME', () => {
  describe('toSql', () => {
    testDataTypeSql('TIME', DataTypes.TIME, {
      default: 'TIME',
      sqlite: 'TEXT',
    });

    testDataTypeSql('TIME(6)', DataTypes.TIME(6), {
      default: 'TIME(6)',
      db2: new Error(`db2 does not support the TIME(precision) data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
      sqlite: 'TEXT',
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
