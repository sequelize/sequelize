import type { DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { allowDeprecationsInSuite, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

describe('DataTypes.REAL', () => {
  allowDeprecationsInSuite(['SEQUELIZE0014']);

  const zeroFillUnsupportedError =
    new Error(`${dialectName} does not support the REAL.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

  testDataTypeSql('REAL', DataTypes.REAL, {
    default: 'REAL',
  });

  testDataTypeSql('REAL.UNSIGNED', DataTypes.REAL.UNSIGNED, {
    default: 'REAL UNSIGNED',
    'sqlite3 snowflake ibmi db2 mssql postgres': 'REAL',
  });

  testDataTypeSql('REAL(11, 12)', DataTypes.REAL(11, 12), {
    default: 'REAL(11, 12)',
    'sqlite3 snowflake ibmi db2 mssql postgres': 'REAL',
  });

  testDataTypeSql('REAL(11, 12).UNSIGNED', DataTypes.REAL(11, 12).UNSIGNED, {
    default: 'REAL(11, 12) UNSIGNED',
    'sqlite3 snowflake ibmi db2 mssql postgres': 'REAL',
  });

  testDataTypeSql(
    'REAL({ precision: 11, scale: 12 }).UNSIGNED',
    DataTypes.REAL({ precision: 11, scale: 12 }).UNSIGNED,
    {
      default: 'REAL(11, 12) UNSIGNED',
      'sqlite3 snowflake ibmi db2 mssql postgres': 'REAL',
    },
  );

  testDataTypeSql('REAL(11, 12).UNSIGNED.ZEROFILL', DataTypes.REAL(11, 12).UNSIGNED.ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'REAL(11, 12) UNSIGNED ZEROFILL',
  });

  testDataTypeSql('REAL(11, 12).ZEROFILL', DataTypes.REAL(11, 12).ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'REAL(11, 12) ZEROFILL',
  });

  testDataTypeSql('REAL(11, 12).ZEROFILL.UNSIGNED', DataTypes.REAL(11, 12).ZEROFILL.UNSIGNED, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'REAL(11, 12) UNSIGNED ZEROFILL',
  });
});

describe('DataTypes.DOUBLE', () => {
  const zeroFillUnsupportedError =
    new Error(`${dialectName} does not support the DOUBLE.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

  testDataTypeSql('DOUBLE', DataTypes.DOUBLE, {
    default: 'DOUBLE PRECISION',
    'db2 ibmi': 'DOUBLE',
    sqlite3: 'REAL',
    snowflake: 'FLOAT',
  });

  testDataTypeSql('DOUBLE.UNSIGNED', DataTypes.DOUBLE.UNSIGNED, {
    'mysql mariadb': 'DOUBLE PRECISION UNSIGNED',
    sqlite3: 'REAL',
    'db2 ibmi': 'DOUBLE',
    'postgres mssql': 'DOUBLE PRECISION',
    snowflake: 'FLOAT',
  });

  testDataTypeSql('DOUBLE(11, 12)', DataTypes.DOUBLE(11, 12), {
    'mysql mariadb': 'DOUBLE PRECISION(11, 12)',
    sqlite3: 'REAL',
    'db2 ibmi': 'DOUBLE',
    'postgres mssql': 'DOUBLE PRECISION',
    snowflake: 'FLOAT',
  });

  testDataTypeSql('DOUBLE(11, 12).UNSIGNED', DataTypes.DOUBLE(11, 12).UNSIGNED, {
    'mysql mariadb': 'DOUBLE PRECISION(11, 12) UNSIGNED',
    sqlite3: 'REAL',
    'db2 ibmi': 'DOUBLE',
    'postgres mssql': 'DOUBLE PRECISION',
    snowflake: 'FLOAT',
  });

  testDataTypeSql('DOUBLE(11, 12).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11, 12).UNSIGNED.ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mariadb mysql': 'DOUBLE PRECISION(11, 12) UNSIGNED ZEROFILL',
  });

  testDataTypeSql('DOUBLE(11, 12).ZEROFILL', DataTypes.DOUBLE(11, 12).ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mariadb mysql': 'DOUBLE PRECISION(11, 12) ZEROFILL',
  });

  testDataTypeSql('DOUBLE(11, 12).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11, 12).ZEROFILL.UNSIGNED, {
    default: zeroFillUnsupportedError,
    'mariadb mysql': 'DOUBLE PRECISION(11, 12) UNSIGNED ZEROFILL',
  });

  it('requires both scale & precision to be specified', () => {
    expect(() => DataTypes.DOUBLE(10)).to.throw(
      'The DOUBLE DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.DOUBLE({ precision: 10 })).to.throw(
      'The DOUBLE DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.DOUBLE({ scale: 2 })).to.throw(
      'The DOUBLE DataType requires that the "precision" option be specified if the "scale" option is specified.',
    );
  });
});

describe('DataTypes.FLOAT', () => {
  const zeroFillUnsupportedError =
    new Error(`${dialectName} does not support the FLOAT.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

  // Must be a single-precision floating point if available,
  // or a double-precision fallback if not.
  testDataTypeSql('FLOAT', DataTypes.FLOAT, {
    // FLOAT in snowflake is double-precision (no single-precision support), but single-precision is all others
    'mysql mariadb snowflake': 'FLOAT',
    // REAL in sqlite is double-precision (no single-precision support), but single-precision in all others
    'postgres mssql sqlite3 db2 ibmi': 'REAL',
  });

  testDataTypeSql('FLOAT.UNSIGNED', DataTypes.FLOAT.UNSIGNED, {
    'mysql mariadb': 'FLOAT UNSIGNED',
    snowflake: 'FLOAT',
    'postgres mssql sqlite3 db2 ibmi': 'REAL',
  });

  testDataTypeSql('FLOAT(11, 12)', DataTypes.FLOAT(11, 12), {
    'mysql mariadb': 'FLOAT(11, 12)',
    snowflake: 'FLOAT',
    'postgres mssql sqlite3 db2 ibmi': 'REAL',
  });

  testDataTypeSql('FLOAT(11, 12).UNSIGNED', DataTypes.FLOAT(11, 12).UNSIGNED, {
    'mysql mariadb': 'FLOAT(11, 12) UNSIGNED',
    snowflake: 'FLOAT',
    'postgres mssql sqlite3 db2 ibmi': 'REAL',
  });

  testDataTypeSql(
    'FLOAT({ length: 11, decimals: 12 }).UNSIGNED',
    DataTypes.FLOAT({ precision: 11, scale: 12 }).UNSIGNED,
    {
      'mysql mariadb': 'FLOAT(11, 12) UNSIGNED',
      snowflake: 'FLOAT',
      'postgres mssql sqlite3 db2 ibmi': 'REAL',
    },
  );

  testDataTypeSql('FLOAT(11, 12).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11, 12).UNSIGNED.ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'FLOAT(11, 12) UNSIGNED ZEROFILL',
  });

  testDataTypeSql('FLOAT(11, 12).ZEROFILL', DataTypes.FLOAT(11, 12).ZEROFILL, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'FLOAT(11, 12) ZEROFILL',
  });

  testDataTypeSql('FLOAT(11, 12).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11, 12).ZEROFILL.UNSIGNED, {
    default: zeroFillUnsupportedError,
    'mysql mariadb': 'FLOAT(11, 12) UNSIGNED ZEROFILL',
  });

  it('requires both scale & precision to be specified', () => {
    expect(() => DataTypes.FLOAT(10)).to.throw(
      'The FLOAT DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.FLOAT({ precision: 10 })).to.throw(
      'The FLOAT DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.FLOAT({ scale: 2 })).to.throw(
      'The FLOAT DataType requires that the "precision" option be specified if the "scale" option is specified.',
    );
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.FLOAT();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid float`);
    });

    it('should not throw if `value` is a float', () => {
      const type = DataTypes.FLOAT();

      expect(() => type.validate(1.2)).not.to.throw();
      expect(() => type.validate('1')).not.to.throw();
      expect(() => type.validate('1.2')).not.to.throw();
      expect(() => type.validate('-0.123')).not.to.throw();
      expect(() => type.validate('-0.22250738585072011e-307')).not.to.throw();
    });
  });
});

describe('DECIMAL', () => {
  const zeroFillUnsupportedError =
    new Error(`${dialectName} does not support the DECIMAL.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);
  const unsupportedError = new Error(`${dialectName} does not support the DECIMAL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

  testDataTypeSql('DECIMAL', DataTypes.DECIMAL, {
    default: new Error(
      `${dialectName} does not support unconstrained DECIMAL types. Please specify the "precision" and "scale" options.`,
    ),
    sqlite3: unsupportedError,
    postgres: 'DECIMAL',
  });

  testDataTypeSql('DECIMAL(10, 2)', DataTypes.DECIMAL(10, 2), {
    default: 'DECIMAL(10, 2)',
    sqlite3: unsupportedError,
  });

  testDataTypeSql(
    'DECIMAL({ precision: 10, scale: 2 })',
    DataTypes.DECIMAL({ precision: 10, scale: 2 }),
    {
      default: 'DECIMAL(10, 2)',
      sqlite3: unsupportedError,
    },
  );

  testDataTypeSql('DECIMAL(10, 2).UNSIGNED', DataTypes.DECIMAL(10, 2).UNSIGNED, {
    default: 'DECIMAL(10, 2)',
    'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED',
    sqlite3: unsupportedError,
  });

  testDataTypeSql('DECIMAL(10, 2).UNSIGNED.ZEROFILL', DataTypes.DECIMAL(10, 2).UNSIGNED.ZEROFILL, {
    default: zeroFillUnsupportedError,
    sqlite3: unsupportedError,
    'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED ZEROFILL',
  });

  testDataTypeSql(
    'DECIMAL({ precision: 10, scale: 2 }).UNSIGNED',
    DataTypes.DECIMAL({ precision: 10, scale: 2 }).UNSIGNED,
    {
      default: 'DECIMAL(10, 2)',
      'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED',
      sqlite3: unsupportedError,
    },
  );

  it('requires both scale & precision to be specified', () => {
    expect(() => DataTypes.DECIMAL(10)).to.throw(
      'The DECIMAL DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.DECIMAL({ precision: 10 })).to.throw(
      'The DECIMAL DataType requires that the "scale" option be specified if the "precision" option is specified.',
    );
    expect(() => DataTypes.DECIMAL({ scale: 2 })).to.throw(
      'The DECIMAL DataType requires that the "precision" option be specified if the "scale" option is specified.',
    );
  });

  describe('validate', () => {
    const supportsDecimal = dialect.supports.dataTypes.DECIMAL;
    if (!supportsDecimal) {
      return;
    }

    it('should throw an error if `value` is invalid', () => {
      const type: DataTypeInstance = DataTypes.DECIMAL(10, 2).toDialectDataType(dialect);
      const typeName = supportsDecimal.constrained ? 'decimal(10, 2)' : 'decimal';

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid ${typeName}`);

      expect(() => {
        type.validate('0.1a');
      }).to.throw(ValidationErrorItem, `'0.1a' is not a valid ${typeName}`);

      if (!supportsDecimal.NaN) {
        expect(() => {
          type.validate(Number.NaN);
        }).to.throw(ValidationErrorItem, `NaN is not a valid ${typeName}`);
      } else {
        expect(() => {
          type.validate(Number.NaN);
        }).not.to.throw();
      }
    });

    it('should not throw if `value` is a decimal', () => {
      const type = DataTypes.DECIMAL(10, 2);

      expect(() => type.validate(123)).not.to.throw();
      expect(() => type.validate(1.2)).not.to.throw();
      expect(() => type.validate(-0.25)).not.to.throw();
      expect(() => type.validate(0.000_000_000_000_1)).not.to.throw();
      expect(() => type.validate('123')).not.to.throw();
      expect(() => type.validate('1.2')).not.to.throw();
      expect(() => type.validate('-0.25')).not.to.throw();
      expect(() => type.validate('0.0000000000001')).not.to.throw();
    });
  });
});
