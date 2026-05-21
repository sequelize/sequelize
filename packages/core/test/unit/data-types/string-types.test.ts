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

if (sequelize.dialect.supports?.dataTypes?.VECTOR) {
  describe('DataTypes.VECTOR', () => {
    describe('constructor', () => {
      it('stores empty options when no args are passed', () => {
        const type = DataTypes.VECTOR();

        expect(type.options).to.deep.equal({});
      });

      it('stores dimension when only dimension is passed', () => {
        const type = DataTypes.VECTOR(4);

        expect(type.options).to.deep.equal({ dimension: 4 });
      });

      it('stores dimension and format when both args are passed', () => {
        const type = DataTypes.VECTOR(3, 'float32');

        expect(type.options).to.deep.equal({ dimension: 3, format: 'float32' });
      });

      it('supports object-style options', () => {
        const type = DataTypes.VECTOR({ dimension: 8, format: 'float64' });

        expect(type.options).to.deep.equal({ dimension: 8, format: 'float64' });
      });

      it('supports object-style options with only dimension', () => {
        const type = DataTypes.VECTOR({ dimension: 8 });

        expect(type.options).to.deep.equal({ dimension: 8 });
      });

      it('normalizes binary format casing in constructor options', () => {
        const type = DataTypes.VECTOR(24, 'BINARY');

        expect(type.options).to.deep.equal({ dimension: 24, format: 'binary' });
      });

      it('rejects invalid dimensions', () => {
        expect(() => DataTypes.VECTOR(0)).to.throw(TypeError, 'Invalid VECTOR dimension');
      });

      it('rejects invalid object-style dimensions', () => {
        expect(() => DataTypes.VECTOR({ dimension: 0 })).to.throw(
          TypeError,
          'Invalid VECTOR dimension',
        );
        expect(() => DataTypes.VECTOR({ dimension: 1.5 })).to.throw(
          TypeError,
          'Invalid VECTOR dimension',
        );
      });

      it('rejects unknown formats', () => {
        expect(() => DataTypes.VECTOR(3, 'float32) DROP TABLE x; --')).to.throw(
          TypeError,
          'Invalid VECTOR format',
        );
      });

      it('rejects unknown object-style formats', () => {
        expect(() => DataTypes.VECTOR({ dimension: 3, format: 'drop table x' })).to.throw(
          TypeError,
          'Invalid VECTOR format',
        );
      });
    });

    describe('toSql', () => {
      testDataTypeSql('VECTOR', DataTypes.VECTOR, {
        default: new Error(`${dialectName} does not support the VECTOR data type.
  See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR',
        postgres: 'VECTOR',
        snowflake: new Error('Snowflake VECTOR requires a positive integer "dimension" option.'),
      });

      testDataTypeSql('VECTOR(4)', DataTypes.VECTOR(4), {
        default: new Error(`${dialectName} does not support the VECTOR data type.
  See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR(4)',
        postgres: 'VECTOR(4)',
        snowflake: 'VECTOR(FLOAT, 4)',
      });

      testDataTypeSql("VECTOR(3, 'float32')", DataTypes.VECTOR(3, 'float32'), {
        default: new Error(`${dialectName} does not support the VECTOR data type.
  See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR(3, FLOAT32)',
        postgres: 'VECTOR(3)',
        snowflake: 'VECTOR(FLOAT, 3)',
      });

      testDataTypeSql("VECTOR(24, 'binary')", DataTypes.VECTOR(24, 'binary'), {
        default: new Error(`${dialectName} does not support the VECTOR data type.
  See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`),
        oracle: 'VECTOR(24, BINARY)',
        postgres: 'VECTOR(24)',
        snowflake: new Error('Invalid Snowflake VECTOR format: binary'),
      });
    });

    describe('validate', () => {
      it('should throw an error if value is invalid', () => {
        const type: DataTypeInstance = DataTypes.VECTOR();

        expect(() => {
          type.validate('vector');
        }).to.throw(ValidationErrorItem, "'vector' is not a valid vector");
      });

      it('should not throw if value is an array', () => {
        const type: DataTypeInstance = DataTypes.VECTOR();

        expect(() => type.validate([1, 2, 3])).not.to.throw();
      });

      it('should not throw if value is a typed array', () => {
        const type: DataTypeInstance = DataTypes.VECTOR();

        expect(() => type.validate(new Float32Array([1, 2, 3]))).not.to.throw();
      });

      it('should not validate vector elements in the base type', () => {
        const type: DataTypeInstance = DataTypes.VECTOR();

        expect(() => type.validate([1, Infinity, 3])).not.to.throw();
      });
    });
  });
}
