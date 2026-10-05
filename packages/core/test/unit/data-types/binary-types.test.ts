import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

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

  describe('escape', () => {
    const type = DataTypes.BLOB().toDialectDataType(sequelize.dialect);

    it('escapes typed arrays and array buffers as binary values', () => {
      const bytes = new Uint8Array(Buffer.from('foo'));

      for (const value of [bytes, bytes.buffer, Buffer.from(bytes)]) {
        expectsql(type.escape(value), {
          default: `X'666f6f'`,
          postgres: `'\\x666f6f'`,
          mssql: '0x666f6f',
          db2: `BLOB('foo')`,
          ibmi: `BLOB(X'666f6f')`,
          oracle: `'666f6f'`,
        });
      }
    });

    it('rejects values that are not binary, even if type validation is disabled', () => {
      // escape() is also called when the noTypeValidation option is enabled
      expect(() => type.escape(["') OR 1=1; --"] as any)).to.throw(
        ValidationErrorItem,
        'is not a valid binary value',
      );
    });
  });
});
