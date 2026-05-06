import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialectName = sequelize.dialect.name;

describe('DataTypes.BLOB', () => {
  testDataTypeSql('BLOB', DataTypes.BLOB, {
    default: 'BLOB',
    'ibmi db2': 'BLOB(1M)',
    mssql: 'VARBINARY(MAX)',
    postgres: 'BYTEA',
  });

  testDataTypeSql('BLOB("tiny")', DataTypes.BLOB('tiny'), {
    default: 'TINYBLOB',
    ibmi: 'BLOB(255)',
    mssql: 'VARBINARY(256)',
    db2: 'BLOB(255)',
    postgres: 'BYTEA',
    sqlite3: 'BLOB',
    oracle: 'BLOB',
  });

  testDataTypeSql('BLOB("medium")', DataTypes.BLOB('medium'), {
    default: 'MEDIUMBLOB',
    ibmi: 'BLOB(16M)',
    mssql: 'VARBINARY(MAX)',
    db2: 'BLOB(16M)',
    postgres: 'BYTEA',
    sqlite3: 'BLOB',
    oracle: 'BLOB',
  });

  testDataTypeSql('BLOB({ length: "medium" })', DataTypes.BLOB({ length: 'medium' }), {
    default: 'MEDIUMBLOB',
    ibmi: 'BLOB(16M)',
    mssql: 'VARBINARY(MAX)',
    db2: 'BLOB(16M)',
    postgres: 'BYTEA',
    sqlite3: 'BLOB',
    oracle: 'BLOB',
  });

  testDataTypeSql('BLOB("long")', DataTypes.BLOB('long'), {
    default: 'LONGBLOB',
    ibmi: 'BLOB(2G)',
    mssql: 'VARBINARY(MAX)',
    db2: 'BLOB(2G)',
    postgres: 'BYTEA',
    sqlite3: 'BLOB',
    oracle: 'BLOB',
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.BLOB();

      expect(() => {
        type.validate(12_345);
      }).to.throw(
        ValidationErrorItem,
        '12345 is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.',
      );
    });

    it('should not throw if `value` is a blob', () => {
      const type = DataTypes.BLOB();

      expect(() => type.validate('foobar')).not.to.throw();
      expect(() => type.validate(Buffer.from('foobar'))).not.to.throw();
    });
  });
});

describe('DataTypes.VARBINARY', () => {
  const varbinaryUnsupportedError = new Error(
    `${dialectName} does not support the VARBINARY data type.\nSee https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`,
  );

  describe('toSql', () => {
    testDataTypeSql('VARBINARY(32)', DataTypes.VARBINARY(32), {
      default: varbinaryUnsupportedError,
      'mysql mariadb mssql': 'VARBINARY(32)',
    });

    testDataTypeSql('VARBINARY({ length: 255 })', DataTypes.VARBINARY({ length: 255 }), {
      default: varbinaryUnsupportedError,
      'mysql mariadb mssql': 'VARBINARY(255)',
    });
  });

  describe('constructor validation', () => {
    it('should throw if length is not a positive integer', () => {
      expect(() => DataTypes.VARBINARY(0)).to.throw(TypeError, '"length"');
      expect(() => DataTypes.VARBINARY(-1)).to.throw(TypeError, '"length"');
      expect(() => DataTypes.VARBINARY(65_536)).to.throw(TypeError, '"length"');
      expect(() => DataTypes.VARBINARY(1.5)).to.throw(TypeError, '"length"');
    });

    it('should not throw for valid lengths', () => {
      expect(() => DataTypes.VARBINARY(1)).not.to.throw();
      expect(() => DataTypes.VARBINARY(255)).not.to.throw();
      expect(() => DataTypes.VARBINARY(65_535)).not.to.throw();
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.VARBINARY(32);

      expect(() => {
        type.validate(12_345);
      }).to.throw(
        ValidationErrorItem,
        '12345 is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.',
      );
    });

    it('should not throw if `value` is a valid binary value', () => {
      const type = DataTypes.VARBINARY(32);

      expect(() => type.validate('foobar')).not.to.throw();
      expect(() => type.validate(Buffer.from('foobar'))).not.to.throw();
      expect(() => type.validate(new Uint8Array(4))).not.to.throw();
    });
  });
});
