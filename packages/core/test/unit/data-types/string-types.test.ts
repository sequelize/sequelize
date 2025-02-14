import type { DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

describe('DataTypes.STRING', () => {
  describe('toSql', () => {
    const binaryCollationUnsupportedError =
      new Error(`${dialectName} does not support the STRING.BINARY data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    testDataTypeSql('STRING', DataTypes.STRING, {
      default: 'VARCHAR(255)',
      mssql: 'NVARCHAR(255)',
      sqlite3: 'TEXT',
      oracle: 'NVARCHAR2(255)',
    });

    testDataTypeSql('STRING(1234)', DataTypes.STRING(1234), {
      default: 'VARCHAR(1234)',
      mssql: 'NVARCHAR(1234)',
      sqlite3: 'TEXT',
      oracle: 'NVARCHAR2(1234)',
    });

    testDataTypeSql('STRING({ length: 1234 })', DataTypes.STRING({ length: 1234 }), {
      default: 'VARCHAR(1234)',
      mssql: 'NVARCHAR(1234)',
      sqlite3: 'TEXT',
      oracle: 'NVARCHAR2(1234)',
    });

    testDataTypeSql('STRING(1234).BINARY', DataTypes.STRING(1234).BINARY, {
      default: 'VARCHAR(1234) BINARY',
      'db2 ibmi': 'VARCHAR(1234) FOR BIT DATA',
      sqlite3: 'TEXT COLLATE BINARY',
      'mssql postgres': binaryCollationUnsupportedError,
      oracle: 'RAW(1234)',
    });

    testDataTypeSql('STRING.BINARY', DataTypes.STRING.BINARY, {
      default: 'VARCHAR(255) BINARY',
      'db2 ibmi': 'VARCHAR(255) FOR BIT DATA',
      sqlite3: 'TEXT COLLATE BINARY',
      'mssql postgres': binaryCollationUnsupportedError,
      oracle: 'RAW(255)',
    });
  });

  describe('validate', () => {
    it('should not throw if `value` is a string', () => {
      const type = new DataTypes.STRING();

      expect(() => type.validate('foobar')).not.to.throw();
      expect(() => type.validate(12)).to.throw();
    });
  });
});

describe('DataTypes.TEXT', () => {
  describe('toSql', () => {
    testDataTypeSql('TEXT', DataTypes.TEXT, {
      default: 'TEXT',
      'ibmi db2': 'CLOB(2147483647)',
      mssql: 'NVARCHAR(MAX)', // in mssql text is actually representing a non unicode text field
      oracle: 'CLOB',
    });

    testDataTypeSql('TEXT("tiny")', DataTypes.TEXT('tiny'), {
      default: 'TEXT',
      'ibmi db2': 'VARCHAR(256)',
      mssql: 'NVARCHAR(256)',
      'mariadb mysql': 'TINYTEXT',
      oracle: 'CLOB',
    });

    testDataTypeSql('TEXT({ length: "tiny" })', DataTypes.TEXT({ length: 'tiny' }), {
      default: 'TEXT',
      'ibmi db2': 'VARCHAR(256)',
      mssql: 'NVARCHAR(256)',
      'mariadb mysql': 'TINYTEXT',
      oracle: 'CLOB',
    });

    testDataTypeSql('TEXT("medium")', DataTypes.TEXT('medium'), {
      default: 'TEXT',
      'ibmi db2': 'CLOB(16777216)',
      mssql: 'NVARCHAR(MAX)',
      'mariadb mysql': 'MEDIUMTEXT',
      oracle: 'CLOB',
    });

    testDataTypeSql('TEXT("long")', DataTypes.TEXT('long'), {
      default: 'TEXT',
      'ibmi db2': 'CLOB(2147483647)',
      mssql: 'NVARCHAR(MAX)',
      'mariadb mysql': 'LONGTEXT',
      oracle: 'CLOB',
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.TEXT();

      expect(() => {
        type.validate(12_345);
      }).to.throw(ValidationErrorItem, '12345 is not a valid string');
    });

    it('should not throw if `value` is a string', () => {
      const type = DataTypes.TEXT();

      expect(() => type.validate('foobar')).not.to.throw();
    });
  });
});

describe('DataTypes.CITEXT', () => {
  describe('toSql', () => {
    testDataTypeSql('CITEXT', DataTypes.CITEXT, {
      default:
        new Error(`${dialectName} does not support the case-insensitive text (CITEXT) data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      postgres: 'CITEXT',
      sqlite3: 'TEXT COLLATE NOCASE',
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.CITEXT();

      expect(() => {
        type.validate(12_345);
      }).to.throw(ValidationErrorItem, '12345 is not a valid string');
    });

    it('should not throw if `value` is a string', () => {
      const type = DataTypes.CITEXT();

      expect(() => type.validate('foobar')).not.to.throw();
    });
  });
});

describe('DataTypes.CHAR', () => {
  describe('toSql', () => {
    const binaryNotSupportedError =
      new Error(`${dialectName} does not support the CHAR.BINARY data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);
    const charNotSupportedError = new Error(`${dialectName} does not support the CHAR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    testDataTypeSql('CHAR', DataTypes.CHAR, {
      default: 'CHAR(255)',
      sqlite3: charNotSupportedError,
    });

    testDataTypeSql('CHAR(12)', DataTypes.CHAR(12), {
      default: 'CHAR(12)',
      sqlite3: charNotSupportedError,
    });

    testDataTypeSql('CHAR({ length: 12 })', DataTypes.CHAR({ length: 12 }), {
      default: 'CHAR(12)',
      sqlite3: charNotSupportedError,
    });

    testDataTypeSql('CHAR(12).BINARY', DataTypes.CHAR(12).BINARY, {
      default: 'CHAR(12) BINARY',
      'db2 ibmi': 'CHAR(12) FOR BIT DATA',
      sqlite3: charNotSupportedError,
      'postgres mssql': binaryNotSupportedError,
      oracle: 'RAW(12)',
    });

    testDataTypeSql('CHAR.BINARY', DataTypes.CHAR.BINARY, {
      default: 'CHAR(255) BINARY',
      'db2 ibmi': 'CHAR(255) FOR BIT DATA',
      sqlite3: charNotSupportedError,
      'postgres mssql': binaryNotSupportedError,
      oracle: 'RAW(255)',
    });
  });
});

describe('DataTypes.TSVECTOR', () => {
  describe('toSql', () => {
    testDataTypeSql('TSVECTOR', DataTypes.TSVECTOR, {
      default: new Error(`${dialectName} does not support the TSVECTOR data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
      postgres: 'TSVECTOR',
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.TSVECTOR();

      expect(() => {
        type.validate(12_345);
      }).to.throw(ValidationErrorItem, '12345 is not a valid string');
    });

    it('should not throw if `value` is a string', () => {
      const type = DataTypes.TSVECTOR();

      expect(() => type.validate('foobar')).not.to.throw();
    });
  });
});
