import { DataTypes, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

describe('DataTypes.TINYINT', () => {
  describe('toSql', () => {
    const zeroFillUnsupportedError =
      new Error(`${dialectName} does not support the TINYINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    const cases = [
      {
        title: 'TINYINT',
        dataType: DataTypes.TINYINT,
        expect: {
          // TINYINT in mssql is UNSIGNED. For the signed version, we fallback to TINYINT + check constraint
          'mssql postgres db2 ibmi': 'SMALLINT',
          'mysql mariadb': 'TINYINT',
          'sqlite3 snowflake': 'INTEGER',
        },
      },
      {
        // This option (length) is ignored when unavailable.
        title: 'TINYINT(2)',
        dataType: DataTypes.TINYINT(2),
        expect: {
          'mssql postgres db2 ibmi': 'SMALLINT',
          'mysql mariadb': 'TINYINT(2)',
          'sqlite3 snowflake': 'INTEGER',
        },
      },
      {
        title: 'TINYINT({ length: 2 })',
        dataType: DataTypes.TINYINT({ length: 2 }),
        expect: {
          'mssql postgres db2 ibmi': 'SMALLINT',
          'mysql mariadb': 'TINYINT(2)',
          'sqlite3 snowflake': 'INTEGER',
        },
      },
      {
        title: 'TINYINT.UNSIGNED',
        dataType: DataTypes.TINYINT.UNSIGNED,
        expect: {
          // Fallback to bigger type + check constraint
          'postgres db2 ibmi': 'SMALLINT',
          'mysql mariadb': 'TINYINT UNSIGNED',
          // sqlite3 & snowflake only supports INTEGER as a column type
          'sqlite3 snowflake': 'INTEGER',
          // TINYINT is unsigned in mssql
          mssql: 'TINYINT',
        },
      },
      {
        title: 'TINYINT(2).UNSIGNED',
        dataType: DataTypes.TINYINT(2).UNSIGNED,
        expect: {
          'postgres db2 ibmi': 'SMALLINT',
          'mysql mariadb': 'TINYINT(2) UNSIGNED',
          'sqlite3 snowflake': 'INTEGER',
          mssql: 'TINYINT',
        },
      },
      {
        title: 'TINYINT.UNSIGNED.ZEROFILL',
        dataType: DataTypes.TINYINT.UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'TINYINT(2).UNSIGNED.ZEROFILL',
        dataType: DataTypes.TINYINT(2).UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT(2) UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'TINYINT.ZEROFILL',
        dataType: DataTypes.TINYINT.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT ZEROFILL',
        },
      },
      {
        title: 'TINYINT(2).ZEROFILL',
        dataType: DataTypes.TINYINT(2).ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT(2) ZEROFILL',
        },
      },
      {
        title: 'TINYINT.ZEROFILL.UNSIGNED',
        dataType: DataTypes.TINYINT.ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'TINYINT(2).ZEROFILL.UNSIGNED',
        dataType: DataTypes.TINYINT(2).ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'TINYINT(2) UNSIGNED ZEROFILL',
        },
      },
    ];

    for (const row of cases) {
      testDataTypeSql(row.title, row.dataType, row.expect);
    }
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.TINYINT();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid tinyint`);

      expect(() => {
        type.validate(123.45);
      }).to.throw(ValidationErrorItem, '123.45 is not a valid tinyint');
    });

    it('should not throw if `value` is an integer', () => {
      const type = DataTypes.TINYINT();

      expect(() => type.validate(-128)).not.to.throw();
      expect(() => type.validate('127')).not.to.throw();
    });
  });
});

describe('DataTypes.SMALLINT', () => {
  describe('toSql', () => {
    const zeroFillUnsupportedError =
      new Error(`${dialectName} does not support the SMALLINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    const cases = [
      {
        title: 'SMALLINT',
        dataType: DataTypes.SMALLINT,
        expect: {
          default: 'SMALLINT',
          'sqlite3 snowflake': 'INTEGER',
        },
      },
      {
        title: 'SMALLINT(4)',
        dataType: DataTypes.SMALLINT(4),
        expect: {
          default: 'SMALLINT',
          'sqlite3 snowflake': 'INTEGER',
          'mysql mariadb': 'SMALLINT(4)',
        },
      },
      {
        title: 'SMALLINT({ length: 4 })',
        dataType: DataTypes.SMALLINT({ length: 4 }),
        expect: {
          default: 'SMALLINT',
          'sqlite3 snowflake': 'INTEGER',
          'mysql mariadb': 'SMALLINT(4)',
        },
      },
      {
        title: 'SMALLINT.UNSIGNED',
        dataType: DataTypes.SMALLINT.UNSIGNED,
        expect: {
          'mysql mariadb': 'SMALLINT UNSIGNED',
          // sqlite3 & snowflake only supports INTEGER as a column type
          'sqlite3 snowflake': 'INTEGER',
          'postgres db2 ibmi': 'INTEGER',
          mssql: 'INT',
        },
      },
      {
        title: 'SMALLINT(4).UNSIGNED',
        dataType: DataTypes.SMALLINT(4).UNSIGNED,
        expect: {
          'mysql mariadb': 'SMALLINT(4) UNSIGNED',
          'sqlite3 snowflake': 'INTEGER',
          'postgres db2 ibmi': 'INTEGER',
          mssql: 'INT',
        },
      },
      {
        title: 'SMALLINT.UNSIGNED.ZEROFILL',
        dataType: DataTypes.SMALLINT.UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'SMALLINT(4).UNSIGNED.ZEROFILL',
        dataType: DataTypes.SMALLINT(4).UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT(4) UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'SMALLINT.ZEROFILL',
        dataType: DataTypes.SMALLINT.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT ZEROFILL',
        },
      },
      {
        title: 'SMALLINT(4).ZEROFILL',
        dataType: DataTypes.SMALLINT(4).ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT(4) ZEROFILL',
        },
      },
      {
        title: 'SMALLINT.ZEROFILL.UNSIGNED',
        dataType: DataTypes.SMALLINT.ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'SMALLINT(4).ZEROFILL.UNSIGNED',
        dataType: DataTypes.SMALLINT(4).ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mysql mariadb': 'SMALLINT(4) UNSIGNED ZEROFILL',
        },
      },
    ];

    for (const row of cases) {
      testDataTypeSql(row.title, row.dataType, row.expect);
    }
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.SMALLINT();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid smallint`);

      expect(() => {
        type.validate(123.45);
      }).to.throw(ValidationErrorItem, '123.45 is not a valid smallint');
    });

    it('should not throw if `value` is an integer', () => {
      const type = DataTypes.SMALLINT();

      expect(() => type.validate(-32_768)).not.to.throw();
      expect(() => type.validate('32767')).not.to.throw();
    });
  });
});

describe('DataTypes.MEDIUMINT', () => {
  describe('toSql', () => {
    const zeroFillUnsupportedError =
      new Error(`${dialectName} does not support the MEDIUMINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    const cases = [
      {
        title: 'MEDIUMINT',
        dataType: DataTypes.MEDIUMINT,
        expect: {
          'mariadb mysql': 'MEDIUMINT',
          // falls back to larger type + CHECK constraint
          'db2 ibmi mssql postgres snowflake sqlite3': 'INTEGER',
        },
      },
      {
        title: 'MEDIUMINT(2)',
        dataType: DataTypes.MEDIUMINT(2),
        expect: {
          'mariadb mysql': 'MEDIUMINT(2)',
          'db2 ibmi mssql postgres snowflake sqlite3': 'INTEGER',
        },
      },
      {
        title: 'MEDIUMINT({ length: 2 })',
        dataType: DataTypes.MEDIUMINT({ length: 2 }),
        expect: {
          'mariadb mysql': 'MEDIUMINT(2)',
          'db2 ibmi mssql postgres snowflake sqlite3': 'INTEGER',
        },
      },
      {
        title: 'MEDIUMINT.UNSIGNED',
        dataType: DataTypes.MEDIUMINT.UNSIGNED,
        expect: {
          'mariadb mysql': 'MEDIUMINT UNSIGNED',
          'db2 ibmi mssql postgres snowflake sqlite3': 'INTEGER',
        },
      },
      {
        title: 'MEDIUMINT(2).UNSIGNED',
        dataType: DataTypes.MEDIUMINT(2).UNSIGNED,
        expect: {
          'mariadb mysql': 'MEDIUMINT(2) UNSIGNED',
          'db2 ibmi mssql postgres snowflake sqlite3': 'INTEGER',
        },
      },
      {
        title: 'MEDIUMINT.UNSIGNED.ZEROFILL',
        dataType: DataTypes.MEDIUMINT.UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'MEDIUMINT(2).UNSIGNED.ZEROFILL',
        dataType: DataTypes.MEDIUMINT(2).UNSIGNED.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT(2) UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'MEDIUMINT.ZEROFILL',
        dataType: DataTypes.MEDIUMINT.ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT ZEROFILL',
        },
      },
      {
        title: 'MEDIUMINT(2).ZEROFILL',
        dataType: DataTypes.MEDIUMINT(2).ZEROFILL,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT(2) ZEROFILL',
        },
      },
      {
        title: 'MEDIUMINT.ZEROFILL.UNSIGNED',
        dataType: DataTypes.MEDIUMINT.ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT UNSIGNED ZEROFILL',
        },
      },
      {
        title: 'MEDIUMINT(2).ZEROFILL.UNSIGNED',
        dataType: DataTypes.MEDIUMINT(2).ZEROFILL.UNSIGNED,
        expect: {
          default: zeroFillUnsupportedError,
          'mariadb mysql': 'MEDIUMINT(2) UNSIGNED ZEROFILL',
        },
      },
    ];

    for (const row of cases) {
      testDataTypeSql(row.title, row.dataType, row.expect);
    }
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.MEDIUMINT();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid mediumint`);

      expect(() => {
        type.validate(123.45);
      }).to.throw(ValidationErrorItem, '123.45 is not a valid mediumint');
    });

    it('should not throw if `value` is an integer', () => {
      const type = DataTypes.MEDIUMINT();

      expect(() => type.validate(-8_388_608)).not.to.throw();
      expect(() => type.validate('8388607')).not.to.throw();
    });
  });
});

describe('DataTypes.INTEGER', () => {
  describe('toSql', () => {
    const zeroFillUnsupportedError =
      new Error(`${dialectName} does not support the INTEGER.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

    testDataTypeSql('INTEGER', DataTypes.INTEGER, {
      default: 'INTEGER',
    });

    testDataTypeSql('INTEGER.UNSIGNED', DataTypes.INTEGER.UNSIGNED, {
      // sqlite & snowflake are both 64 bits integers (actually snowflake accepts up to 99999999999999999999999999999999999999)
      'sqlite3 snowflake': 'INTEGER',
      'mysql mariadb': 'INTEGER UNSIGNED',
      'ibmi postgres db2 mssql': 'BIGINT',
    });

    testDataTypeSql('INTEGER.UNSIGNED.ZEROFILL', DataTypes.INTEGER.UNSIGNED.ZEROFILL, {
      default: zeroFillUnsupportedError,
      'mariadb mysql': 'INTEGER UNSIGNED ZEROFILL',
    });

    testDataTypeSql('INTEGER(11)', DataTypes.INTEGER(11), {
      default: 'INTEGER',
      'mysql mariadb': 'INTEGER(11)',
    });

    testDataTypeSql('INTEGER({ length: 11 })', DataTypes.INTEGER({ length: 11 }), {
      default: 'INTEGER',
      'mysql mariadb': 'INTEGER(11)',
    });

    testDataTypeSql('INTEGER(11).UNSIGNED', DataTypes.INTEGER(11).UNSIGNED, {
      'mysql mariadb': 'INTEGER(11) UNSIGNED',
      'sqlite3 snowflake': 'INTEGER',
      'ibmi postgres db2 mssql': 'BIGINT',
    });

    testDataTypeSql('INTEGER(11).UNSIGNED.ZEROFILL', DataTypes.INTEGER(11).UNSIGNED.ZEROFILL, {
      default: zeroFillUnsupportedError,
      'mysql mariadb': 'INTEGER(11) UNSIGNED ZEROFILL',
    });

    testDataTypeSql('INTEGER(11).ZEROFILL', DataTypes.INTEGER(11).ZEROFILL, {
      default: zeroFillUnsupportedError,
      'mysql mariadb': 'INTEGER(11) ZEROFILL',
    });

    testDataTypeSql('INTEGER(11).ZEROFILL.UNSIGNED', DataTypes.INTEGER(11).ZEROFILL.UNSIGNED, {
      default: zeroFillUnsupportedError,
      'mysql mariadb': 'INTEGER(11) UNSIGNED ZEROFILL',
    });
  });

  describe('validate', () => {
    it('should throw an error if `value` is invalid', () => {
      const type = DataTypes.INTEGER();

      expect(() => {
        type.validate('foobar');
      }).to.throw(ValidationErrorItem, `'foobar' is not a valid integer`);

      expect(() => {
        type.validate('123.45');
      }).to.throw(ValidationErrorItem, `'123.45' is not a valid integer`);

      expect(() => {
        type.validate(123.45);
      }).to.throw(ValidationErrorItem, '123.45 is not a valid integer');
    });

    it('should not throw if `value` is a valid integer', () => {
      const type = DataTypes.INTEGER();

      expect(() => type.validate('12345')).not.to.throw();
      expect(() => type.validate(12_345)).not.to.throw();
      expect(() => type.validate(12_345n)).not.to.throw();
    });
  });
});

if (dialect.supports.dataTypes.BIGINT) {
  describe('DataTypes.BIGINT', () => {
    describe('toSql', () => {
      const zeroFillUnsupportedError =
        new Error(`${dialectName} does not support the BIGINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);
      const unsignedUnsupportedError =
        new Error(`${dialectName} does not support the BIGINT.UNSIGNED data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);

      testDataTypeSql('BIGINT', DataTypes.BIGINT, {
        default: 'BIGINT',
        'sqlite3 snowflake': 'INTEGER',
      });

      testDataTypeSql('BIGINT.UNSIGNED', DataTypes.BIGINT.UNSIGNED, {
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT UNSIGNED',
        // INTEGER in snowflake goes up to 99999999999999999999999999999999999999, which is enough to store an unsigned 64-bit integer.
        snowflake: 'INTEGER',
      });

      testDataTypeSql('BIGINT.UNSIGNED.ZEROFILL', DataTypes.BIGINT.UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'BIGINT UNSIGNED ZEROFILL',
      });

      testDataTypeSql('BIGINT(11)', DataTypes.BIGINT(11), {
        default: 'BIGINT',
        'sqlite3 snowflake': 'INTEGER',
        'mysql mariadb': 'BIGINT(11)',
      });

      testDataTypeSql('BIGINT({ length: 11 })', DataTypes.BIGINT({ length: 11 }), {
        default: 'BIGINT',
        'sqlite3 snowflake': 'INTEGER',
        'mysql mariadb': 'BIGINT(11)',
      });

      testDataTypeSql('BIGINT(11).UNSIGNED', DataTypes.BIGINT(11).UNSIGNED, {
        // There is no type big enough to hold values between 0 & 2^32-1
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED',
        snowflake: 'INTEGER',
      });

      testDataTypeSql('BIGINT(11).UNSIGNED.ZEROFILL', DataTypes.BIGINT(11).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED ZEROFILL',
      });

      testDataTypeSql('BIGINT(11).ZEROFILL', DataTypes.BIGINT(11).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'BIGINT(11) ZEROFILL',
      });

      testDataTypeSql('BIGINT(11).ZEROFILL.UNSIGNED', DataTypes.BIGINT(11).ZEROFILL.UNSIGNED, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED ZEROFILL',
      });
    });

    describe('validate', () => {
      it('should throw an error if `value` is invalid', () => {
        const type = DataTypes.BIGINT().toDialectDataType(dialect);

        expect(() => {
          type.validate('foobar');
        }).to.throw(
          ValidationErrorItem,
          `'foobar' is not a valid ${type.toString().toLowerCase()}`,
        );

        expect(() => {
          type.validate(123.45);
        }).to.throw(ValidationErrorItem, `123.45 is not a valid ${type.toString().toLowerCase()}`);
      });

      it('should not throw if `value` is an integer', () => {
        const type = DataTypes.BIGINT();

        expect(() => type.validate('9223372036854775807')).not.to.throw();
      });
    });
  });
}
