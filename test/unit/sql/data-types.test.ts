import assert from 'node:assert';
import util from 'util';
import type { DataTypeClassOrInstance, DataTypeInstance } from '@sequelize/core';
import { DataTypes, GeoJsonType, ValidationErrorItem } from '@sequelize/core';
import { expect } from 'chai';
import { v1 as uuidV1, v4 as uuidV4 } from 'uuid';
import { expectsql, sequelize, getTestDialect, getTestDialectTeaser, createTester } from '../../support';

const dialectName = getTestDialect();
const dialect = sequelize.dialect;

// Notice: [] will be replaced by dialect specific tick/quote character when the default expectation is used.

describe(getTestDialectTeaser('SQL'), () => {

  describe('DataTypes', () => {
    const testsql = createTester((it, description: string, dataType: DataTypeClassOrInstance, expectation) => {
      it(description, () => {
        let result: Error | string;

        try {
          result = sequelize.normalizeDataType(dataType).toSql({ dialect });
        } catch (error) {
          assert(error instanceof Error);
          result = error;
        }

        return expectsql(result, expectation);
      });
    });

    describe('STRING', () => {
      const binaryCollationUnsupportedError = new Error(`${dialectName} does not support the STRING.BINARY data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('STRING', DataTypes.STRING, {
        default: 'VARCHAR(255)',
        mssql: 'NVARCHAR(255)',
        sqlite: 'TEXT',
      });

      testsql('STRING(1234)', DataTypes.STRING(1234), {
        default: 'VARCHAR(1234)',
        mssql: 'NVARCHAR(1234)',
        sqlite: 'TEXT',
      });

      testsql('STRING({ length: 1234 })', DataTypes.STRING({ length: 1234 }), {
        default: 'VARCHAR(1234)',
        mssql: 'NVARCHAR(1234)',
        sqlite: 'TEXT',
      });

      testsql('STRING(1234).BINARY', DataTypes.STRING(1234).BINARY, {
        default: 'VARCHAR(1234) BINARY',
        ibmi: binaryCollationUnsupportedError,
        db2: 'VARCHAR(1234) FOR BIT DATA',
        sqlite: 'TEXT COLLATE BINARY',
        mssql: binaryCollationUnsupportedError,
        postgres: binaryCollationUnsupportedError,
      });

      testsql('STRING.BINARY', DataTypes.STRING.BINARY, {
        default: 'VARCHAR(255) BINARY',
        ibmi: binaryCollationUnsupportedError,
        db2: 'VARCHAR(255) FOR BIT DATA',
        sqlite: 'TEXT COLLATE BINARY',
        mssql: binaryCollationUnsupportedError,
        postgres: binaryCollationUnsupportedError,
      });

      describe('validate', () => {
        it('should not throw if `value` is a string', () => {
          const type = new DataTypes.STRING();

          expect(() => type.validate('foobar')).not.to.throw();
          expect(() => type.validate(12)).to.throw();
        });
      });
    });

    describe('TEXT', () => {
      testsql('TEXT', DataTypes.TEXT, {
        default: 'TEXT',
        db2: 'VARCHAR(32672)',
        ibmi: 'VARCHAR(8192)',
        mssql: 'NVARCHAR(MAX)', // in mssql text is actually representing a non unicode text field
      });

      testsql('TEXT("tiny")', DataTypes.TEXT('tiny'), {
        default: 'TEXT',
        ibmi: 'VARCHAR(256)',
        mssql: 'NVARCHAR(256)',
        db2: 'VARCHAR(256)',
        mariadb: 'TINYTEXT',
        mysql: 'TINYTEXT',
      });

      testsql('TEXT({ length: "tiny" })', DataTypes.TEXT({ length: 'tiny' }), {
        default: 'TEXT',
        ibmi: 'VARCHAR(256)',
        mssql: 'NVARCHAR(256)',
        db2: 'VARCHAR(256)',
        mariadb: 'TINYTEXT',
        mysql: 'TINYTEXT',
      });

      testsql('TEXT("medium")', DataTypes.TEXT('medium'), {
        default: 'TEXT',
        ibmi: 'VARCHAR(8192)',
        mssql: 'NVARCHAR(MAX)',
        db2: 'VARCHAR(8192)',
        mariadb: 'MEDIUMTEXT',
        mysql: 'MEDIUMTEXT',
      });

      testsql('TEXT("long")', DataTypes.TEXT('long'), {
        default: 'TEXT',
        ibmi: 'CLOB(65536)',
        mssql: 'NVARCHAR(MAX)',
        db2: 'CLOB(65536)',
        mariadb: 'LONGTEXT',
        mysql: 'LONGTEXT',
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

    describe('CITEXT', () => {
      testsql('CITEXT', DataTypes.CITEXT, {
        default: new Error(`${dialectName} does not support the case-insensitive text (CITEXT) data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
        postgres: 'CITEXT',
        sqlite: 'TEXT COLLATE NOCASE',
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

    describe('TSVECTOR', () => {
      testsql('TSVECTOR', DataTypes.TSVECTOR, {
        default: new Error(`${dialectName} does not support the TSVECTOR data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
        postgres: 'TSVECTOR',
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

    describe('CHAR', () => {
      const binaryNotSupportedError = new Error(`${dialectName} does not support the CHAR.BINARY data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);
      const charNotSupportedError = new Error(`${dialectName} does not support the CHAR data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('CHAR', DataTypes.CHAR, {
        default: 'CHAR(255)',
        sqlite: charNotSupportedError,
      });

      testsql('CHAR(12)', DataTypes.CHAR(12), {
        default: 'CHAR(12)',
        sqlite: charNotSupportedError,
      });

      testsql('CHAR({ length: 12 })', DataTypes.CHAR({ length: 12 }), {
        default: 'CHAR(12)',
        sqlite: charNotSupportedError,
      });

      testsql('CHAR(12).BINARY', DataTypes.CHAR(12).BINARY, {
        default: 'CHAR(12) BINARY',
        ibmi: 'CLOB(12)',
        sqlite: charNotSupportedError,
        'postgres mssql': binaryNotSupportedError,
      });

      testsql('CHAR.BINARY', DataTypes.CHAR.BINARY, {
        default: 'CHAR(255) BINARY',
        ibmi: 'CLOB(255)',
        sqlite: charNotSupportedError,
        'postgres mssql': binaryNotSupportedError,
      });
    });

    describe('BOOLEAN', () => {
      testsql('BOOLEAN', DataTypes.BOOLEAN, {
        default: 'BOOLEAN',
        ibmi: 'SMALLINT',
        mssql: 'BIT',
        mariadb: 'TINYINT(1)',
        mysql: 'TINYINT(1)',
        sqlite: 'INTEGER',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.BOOLEAN();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationErrorItem, '12345 is not a valid boolean');
        });

        it('should not throw if `value` is a boolean', () => {
          const type = DataTypes.BOOLEAN();

          expect(() => type.validate(true)).not.to.throw();
          expect(() => type.validate(false)).not.to.throw();
          expect(() => type.validate('1')).to.throw();
          expect(() => type.validate('0')).to.throw();
          expect(() => type.validate('true')).to.throw();
          expect(() => type.validate('false')).to.throw();
        });
      });
    });

    describe('DATE', () => {
      testsql('DATE', DataTypes.DATE, {
        ibmi: 'TIMESTAMP',
        postgres: 'TIMESTAMP WITH TIME ZONE',
        mssql: 'DATETIMEOFFSET',
        'mariadb mysql': 'DATETIME',
        db2: 'TIMESTAMP',
        sqlite: 'TEXT',
        snowflake: 'TIMESTAMP',
      });

      testsql('DATE(6)', DataTypes.DATE(6), {
        ibmi: 'TIMESTAMP',
        postgres: 'TIMESTAMP(6) WITH TIME ZONE',
        mssql: 'DATETIMEOFFSET(6)',
        mariadb: 'DATETIME(6)',
        mysql: 'DATETIME(6)',
        db2: 'TIMESTAMP(6)',
        sqlite: 'TEXT',
        snowflake: 'TIMESTAMP',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.DATE();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, `'foobar' is not a valid date`);
        });

        it('should not throw if `value` is a date', () => {
          const type = DataTypes.DATE();

          expect(() => type.validate(new Date())).not.to.throw();
        });
      });
    });

    describe('DATEONLY', () => {
      testsql('DATEONLY', DataTypes.DATEONLY, {
        default: 'DATE',
        sqlite: 'TEXT',
      });
    });

    describe('TIME', () => {
      testsql('TIME', DataTypes.TIME, {
        default: 'TIME',
        sqlite: 'TEXT',
      });

      testsql('TIME(6)', DataTypes.TIME(6), {
        default: 'TIME(6)',
        sqlite: 'TEXT',
      });
    });

    if (sequelize.dialect.supports.dataTypes.HSTORE) {
      describe('HSTORE', () => {
        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.HSTORE();

            expect(() => {
              type.validate('foobar');
            }).to.throw(ValidationErrorItem, `'foobar' is not a valid hstore`);
          });

          it('should not throw if `value` is an hstore', () => {
            const type = DataTypes.HSTORE();

            expect(() => type.validate({ foo: 'bar' })).not.to.throw();
          });
        });
      });
    }

    describe('UUID', () => {
      testsql('UUID', DataTypes.UUID, {
        postgres: 'UUID',
        ibmi: 'CHAR(36)',
        db2: 'CHAR(36) FOR BIT DATA',
        mssql: 'UNIQUEIDENTIFIER',
        'mariadb mysql': 'CHAR(36) BINARY',
        snowflake: 'VARCHAR(36)',
        sqlite: 'TEXT',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUID();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, `'foobar' is not a valid uuid`);

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuid`);
        });

        it('should not throw if `value` is an uuid', () => {
          const type = DataTypes.UUID();

          expect(() => type.validate(uuidV4())).not.to.throw();
        });
      });
    });

    describe('UUIDV1', () => {
      testsql('UUIDV1', DataTypes.UUIDV1, {
        default: new Error('toSQL should not be called on DataTypes.UUIDV1'),
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV1();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, `'foobar' is not a valid uuid`);

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuidv1`);
        });

        it('should not throw if `value` is an uuid', () => {
          const type = DataTypes.UUIDV1();

          expect(() => type.validate(uuidV1())).not.to.throw();
        });
      });
    });

    describe('UUIDV4', () => {
      testsql('UUIDV4', DataTypes.UUIDV4, {
        default: new Error('toSQL should not be called on DataTypes.UUIDV4'),
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV4();
          const value = uuidV1();

          expect(() => {
            type.validate(value);
          }).to.throw(ValidationErrorItem, util.format('%O is not a valid uuidv4', value));

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationErrorItem, `[ 'foobar' ] is not a valid uuidv4`);
        });

        it('should not throw if `value` is an uuid', () => {
          const type = DataTypes.UUIDV4();

          expect(() => type.validate(uuidV4())).not.to.throw();
        });
      });
    });

    describe('NOW', () => {
      testsql('NOW', DataTypes.NOW, {
        default: 'NOW',
        db2: 'CURRENT TIME',
        mssql: 'GETDATE()',
      });
    });

    describe('INTEGER', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the INTEGER.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('INTEGER', DataTypes.INTEGER, {
        default: 'INTEGER',
      });

      testsql('INTEGER.UNSIGNED', DataTypes.INTEGER.UNSIGNED, {
        sqlite: 'INTEGER',
        'mysql mariadb': 'INTEGER UNSIGNED',
        'ibmi postgres db2 mssql': 'BIGINT',
      });

      testsql('INTEGER.UNSIGNED.ZEROFILL', DataTypes.INTEGER.UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mariadb mysql': 'INTEGER UNSIGNED ZEROFILL',
      });

      testsql('INTEGER(11)', DataTypes.INTEGER(11), {
        default: 'INTEGER',
        'mysql mariadb': 'INTEGER(11)',
      });

      testsql('INTEGER({ length: 11 })', DataTypes.INTEGER({ length: 11 }), {
        default: 'INTEGER',
        'mysql mariadb': 'INTEGER(11)',
      });

      testsql('INTEGER(11).UNSIGNED', DataTypes.INTEGER(11).UNSIGNED, {
        'mysql mariadb': 'INTEGER(11) UNSIGNED',
        sqlite: 'INTEGER',
        'ibmi postgres db2 mssql': 'BIGINT',
      });

      testsql('INTEGER(11).UNSIGNED.ZEROFILL', DataTypes.INTEGER(11).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'INTEGER(11) UNSIGNED ZEROFILL',
      });

      testsql('INTEGER(11).ZEROFILL', DataTypes.INTEGER(11).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'INTEGER(11) ZEROFILL',
      });

      testsql('INTEGER(11).ZEROFILL.UNSIGNED', DataTypes.INTEGER(11).ZEROFILL.UNSIGNED, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'INTEGER(11) UNSIGNED ZEROFILL',
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

    describe('TINYINT', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the TINYINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      const cases = [
        {
          title: 'TINYINT',
          dataType: DataTypes.TINYINT,
          expect: {
            // TINYINT in mssql is UNSIGNED. For the signed version, we fallback to TINYINT + check constraint
            'mssql postgres': 'SMALLINT',
            'mysql mariadb snowflake': 'TINYINT',
            sqlite: 'INTEGER',
          },
        },
        {
          // This option (length) is ignored when unavailable.
          title: 'TINYINT(2)',
          dataType: DataTypes.TINYINT(2),
          expect: {
            'mssql postgres': 'SMALLINT',
            'mysql mariadb snowflake': 'TINYINT(2)',
            sqlite: 'INTEGER',
          },
        },
        {
          title: 'TINYINT({ length: 2 })',
          dataType: DataTypes.TINYINT({ length: 2 }),
          expect: {
            'mssql postgres': 'SMALLINT',
            'mysql mariadb snowflake': 'TINYINT(2)',
            sqlite: 'INTEGER',
          },
        },
        {
          title: 'TINYINT.UNSIGNED',
          dataType: DataTypes.TINYINT.UNSIGNED,
          expect: {
            // Fallback to bigger type + check constraint
            'postgres snowflake': 'SMALLINT',
            'mysql mariadb': 'TINYINT UNSIGNED',
            // sqlite only supports INTEGER as a column type
            sqlite: 'INTEGER',
            // TINYINT is unsigned in mssql
            mssql: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2).UNSIGNED',
          dataType: DataTypes.TINYINT(2).UNSIGNED,
          expect: {
            'postgres snowflake': 'SMALLINT',
            'mysql mariadb': 'TINYINT(2) UNSIGNED',
            sqlite: 'INTEGER',
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
        testsql(row.title, row.dataType, row.expect);
      }

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

    describe('SMALLINT', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the SMALLINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      const cases = [
        {
          title: 'SMALLINT',
          dataType: DataTypes.SMALLINT,
          expect: {
            default: 'SMALLINT',
            sqlite: 'INTEGER',
          },
        },
        {
          title: 'SMALLINT(4)',
          dataType: DataTypes.SMALLINT(4),
          expect: {
            default: 'SMALLINT',
            sqlite: 'INTEGER',
            'mysql mariadb': 'SMALLINT(4)',
          },
        },
        {
          title: 'SMALLINT({ length: 4 })',
          dataType: DataTypes.SMALLINT({ length: 4 }),
          expect: {
            default: 'SMALLINT',
            sqlite: 'INTEGER',
            'mysql mariadb': 'SMALLINT(4)',
          },
        },
        {
          title: 'SMALLINT.UNSIGNED',
          dataType: DataTypes.SMALLINT.UNSIGNED,
          expect: {
            'mysql mariadb': 'SMALLINT UNSIGNED',
            // sqlite only supports INTEGER as a column type
            sqlite: 'INTEGER',
            'postgres db2 ibmi': 'INTEGER',
            mssql: 'INT',
          },
        },
        {
          title: 'SMALLINT(4).UNSIGNED',
          dataType: DataTypes.SMALLINT(4).UNSIGNED,
          expect: {
            'mysql mariadb': 'SMALLINT(4) UNSIGNED',
            sqlite: 'INTEGER',
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
        testsql(row.title, row.dataType, row.expect);
      }

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

    describe('MEDIUMINT', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the MEDIUMINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      const cases = [
        {
          title: 'MEDIUMINT',
          dataType: DataTypes.MEDIUMINT,
          expect: {
            'mariadb mysql': 'MEDIUMINT',
            // falls back to larger type + CHECK constraint
            'db2 ibmi mssql postgres snowflake sqlite': 'INTEGER',
          },
        },
        {
          title: 'MEDIUMINT(2)',
          dataType: DataTypes.MEDIUMINT(2),
          expect: {
            'mariadb mysql': 'MEDIUMINT(2)',
            'db2 ibmi mssql postgres snowflake sqlite': 'INTEGER',
          },
        },
        {
          title: 'MEDIUMINT({ length: 2 })',
          dataType: DataTypes.MEDIUMINT({ length: 2 }),
          expect: {
            'mariadb mysql': 'MEDIUMINT(2)',
            'db2 ibmi mssql postgres snowflake sqlite': 'INTEGER',
          },
        },
        {
          title: 'MEDIUMINT.UNSIGNED',
          dataType: DataTypes.MEDIUMINT.UNSIGNED,
          expect: {
            'mariadb mysql': 'MEDIUMINT UNSIGNED',
            'db2 ibmi mssql postgres snowflake sqlite': 'INTEGER',
          },
        },
        {
          title: 'MEDIUMINT(2).UNSIGNED',
          dataType: DataTypes.MEDIUMINT(2).UNSIGNED,
          expect: {
            'mariadb mysql': 'MEDIUMINT(2) UNSIGNED',
            'db2 ibmi mssql postgres snowflake sqlite': 'INTEGER',
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
        testsql(row.title, row.dataType, row.expect);
      }

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

    describe('BIGINT', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the BIGINT.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);
      const unsignedUnsupportedError = new Error(`${dialectName} does not support the BIGINT.UNSIGNED data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('BIGINT', DataTypes.BIGINT, {
        default: 'BIGINT',
        sqlite: 'INTEGER',
      });

      testsql('BIGINT.UNSIGNED', DataTypes.BIGINT.UNSIGNED, {
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT UNSIGNED',
      });

      testsql('BIGINT.UNSIGNED.ZEROFILL', DataTypes.BIGINT.UNSIGNED.ZEROFILL, {
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT UNSIGNED ZEROFILL',
      });

      testsql('BIGINT(11)', DataTypes.BIGINT(11), {
        default: 'BIGINT',
        sqlite: 'INTEGER',
        'mysql mariadb': 'BIGINT(11)',
      });

      testsql('BIGINT({ length: 11 })', DataTypes.BIGINT({ length: 11 }), {
        default: 'BIGINT',
        sqlite: 'INTEGER',
        'mysql mariadb': 'BIGINT(11)',
      });

      testsql('BIGINT(11).UNSIGNED', DataTypes.BIGINT(11).UNSIGNED, {
        // There is no type big enough to hold values between 0 & 2^32-1
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED',
      });

      testsql('BIGINT(11).UNSIGNED.ZEROFILL', DataTypes.BIGINT(11).UNSIGNED.ZEROFILL, {
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED ZEROFILL',
      });

      testsql('BIGINT(11).ZEROFILL', DataTypes.BIGINT(11).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'BIGINT(11) ZEROFILL',
      });

      testsql('BIGINT(11).ZEROFILL.UNSIGNED', DataTypes.BIGINT(11).ZEROFILL.UNSIGNED, {
        default: unsignedUnsupportedError,
        'mysql mariadb': 'BIGINT(11) UNSIGNED ZEROFILL',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BIGINT().toDialectDataType(dialect);

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, `'foobar' is not a valid ${type.toString().toLowerCase()}`);

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

    describe('REAL', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the REAL.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('REAL', DataTypes.REAL, {
        default: 'REAL',
      });

      testsql('REAL.UNSIGNED', DataTypes.REAL.UNSIGNED, {
        default: 'REAL UNSIGNED',
        sqlite: 'REAL',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12)', DataTypes.REAL(11, 12), {
        default: 'REAL(11, 12)',
        sqlite: 'REAL',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).UNSIGNED', DataTypes.REAL(11, 12).UNSIGNED, {
        default: 'REAL(11, 12) UNSIGNED',
        ibmi: 'REAL',
        sqlite: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL({ precision: 11, scale: 12 }).UNSIGNED', DataTypes.REAL({ precision: 11, scale: 12 }).UNSIGNED, {
        default: 'REAL(11, 12) UNSIGNED',
        ibmi: 'REAL',
        sqlite: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).UNSIGNED.ZEROFILL', DataTypes.REAL(11, 12).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'REAL(11, 12) UNSIGNED ZEROFILL',
      });

      testsql('REAL(11, 12).ZEROFILL', DataTypes.REAL(11, 12).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'REAL(11, 12) ZEROFILL',
      });

      testsql('REAL(11, 12).ZEROFILL.UNSIGNED', DataTypes.REAL(11, 12).ZEROFILL.UNSIGNED, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'REAL(11, 12) UNSIGNED ZEROFILL',
      });
    });

    describe('DOUBLE PRECISION', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the DOUBLE.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('DOUBLE', DataTypes.DOUBLE, {
        default: 'DOUBLE PRECISION',
        db2: 'DOUBLE',
        sqlite: 'REAL',
      });

      testsql('DOUBLE.UNSIGNED', DataTypes.DOUBLE.UNSIGNED, {
        'mysql mariadb': 'DOUBLE PRECISION UNSIGNED',
        sqlite: 'REAL',
        db2: 'DOUBLE',
        'postgres mssql': 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12)', DataTypes.DOUBLE(11, 12), {
        'mysql mariadb': 'DOUBLE PRECISION(11, 12)',
        sqlite: 'REAL',
        db2: 'DOUBLE',
        'postgres mssql': 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).UNSIGNED', DataTypes.DOUBLE(11, 12).UNSIGNED, {
        'mysql mariadb': 'DOUBLE PRECISION(11, 12) UNSIGNED',
        sqlite: 'REAL',
        db2: 'DOUBLE',
        'postgres mssql': 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11, 12).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mariadb mysql': 'DOUBLE PRECISION(11, 12) UNSIGNED ZEROFILL',
      });

      testsql('DOUBLE(11, 12).ZEROFILL', DataTypes.DOUBLE(11, 12).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mariadb mysql': 'DOUBLE PRECISION(11, 12) ZEROFILL',
      });

      testsql('DOUBLE(11, 12).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11, 12).ZEROFILL.UNSIGNED, {
        default: zeroFillUnsupportedError,
        'mariadb mysql': 'DOUBLE PRECISION(11, 12) UNSIGNED ZEROFILL',
      });

      it('requires both scale & precision to be specified', () => {
        expect(() => DataTypes.DOUBLE(10)).to.throw('The DOUBLE DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.DOUBLE({ precision: 10 })).to.throw('The DOUBLE DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.DOUBLE({ scale: 2 })).to.throw('The DOUBLE DataType requires that the "precision" option be specified if the "scale" option is specified.');
      });
    });

    describe('FLOAT', () => {
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the FLOAT.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      // Must be a single-precision floating point if available,
      // or a double-precision fallback if not.
      testsql('FLOAT', DataTypes.FLOAT, {
        // FLOAT in snowflake is double-precision (no single-precision support), but single-precision is all others
        'mysql mariadb ibmi db2 snowflake': 'FLOAT',
        // REAL in sqlite is double-precision (no single-precision support), but single-precision in all others
        'postgres mssql sqlite': 'REAL',
      });

      testsql('FLOAT.UNSIGNED', DataTypes.FLOAT.UNSIGNED, {
        'mysql mariadb': 'FLOAT UNSIGNED',
        'ibmi db2 snowflake': 'FLOAT',
        'postgres mssql sqlite': 'REAL',
      });

      testsql('FLOAT(11, 12)', DataTypes.FLOAT(11, 12), {
        'mysql mariadb': 'FLOAT(11, 12)',
        'ibmi db2 snowflake': 'FLOAT',
        'postgres mssql sqlite': 'REAL',
      });

      testsql('FLOAT(11, 12).UNSIGNED', DataTypes.FLOAT(11, 12).UNSIGNED, {
        'mysql mariadb': 'FLOAT(11, 12) UNSIGNED',
        'ibmi db2 snowflake': 'FLOAT',
        'postgres mssql sqlite': 'REAL',
      });

      testsql('FLOAT({ length: 11, decimals: 12 }).UNSIGNED', DataTypes.FLOAT({ precision: 11, scale: 12 }).UNSIGNED, {
        'mysql mariadb': 'FLOAT(11, 12) UNSIGNED',
        'ibmi db2 snowflake': 'FLOAT',
        'postgres mssql sqlite': 'REAL',
      });

      testsql('FLOAT(11, 12).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11, 12).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'FLOAT(11, 12) UNSIGNED ZEROFILL',
      });

      testsql('FLOAT(11, 12).ZEROFILL', DataTypes.FLOAT(11, 12).ZEROFILL, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'FLOAT(11, 12) ZEROFILL',
      });

      testsql('FLOAT(11, 12).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11, 12).ZEROFILL.UNSIGNED, {
        default: zeroFillUnsupportedError,
        'mysql mariadb': 'FLOAT(11, 12) UNSIGNED ZEROFILL',
      });

      it('requires both scale & precision to be specified', () => {
        expect(() => DataTypes.FLOAT(10)).to.throw('The FLOAT DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.FLOAT({ precision: 10 })).to.throw('The FLOAT DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.FLOAT({ scale: 2 })).to.throw('The FLOAT DataType requires that the "precision" option be specified if the "scale" option is specified.');
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
      const zeroFillUnsupportedError = new Error(`${dialectName} does not support the DECIMAL.ZEROFILL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);
      const unsupportedError = new Error(`${dialectName} does not support the DECIMAL data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);

      testsql('DECIMAL', DataTypes.DECIMAL, {
        default: new Error(`${dialectName} does not support unconstrained DECIMAL types. Please specify the "precision" and "scale" options.`),
        sqlite: unsupportedError,
        postgres: 'DECIMAL',
      });

      testsql('DECIMAL(10, 2)', DataTypes.DECIMAL(10, 2), {
        default: 'DECIMAL(10, 2)',
        sqlite: unsupportedError,
      });

      testsql('DECIMAL({ precision: 10, scale: 2 })', DataTypes.DECIMAL({ precision: 10, scale: 2 }), {
        default: 'DECIMAL(10, 2)',
        sqlite: unsupportedError,
      });

      testsql('DECIMAL(10, 2).UNSIGNED', DataTypes.DECIMAL(10, 2).UNSIGNED, {
        default: 'DECIMAL(10, 2)',
        'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED',
        sqlite: unsupportedError,
      });

      testsql('DECIMAL(10, 2).UNSIGNED.ZEROFILL', DataTypes.DECIMAL(10, 2).UNSIGNED.ZEROFILL, {
        default: zeroFillUnsupportedError,
        sqlite: unsupportedError,
        'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED ZEROFILL',
      });

      testsql('DECIMAL({ precision: 10, scale: 2 }).UNSIGNED', DataTypes.DECIMAL({ precision: 10, scale: 2 }).UNSIGNED, {
        default: 'DECIMAL(10, 2)',
        'mysql mariadb': 'DECIMAL(10, 2) UNSIGNED',
        sqlite: unsupportedError,
      });

      it('requires both scale & precision to be specified', () => {
        expect(() => DataTypes.DECIMAL(10)).to.throw('The DECIMAL DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.DECIMAL({ precision: 10 })).to.throw('The DECIMAL DataType requires that the "scale" option be specified if the "precision" option is specified.');
        expect(() => DataTypes.DECIMAL({ scale: 2 })).to.throw('The DECIMAL DataType requires that the "precision" option be specified if the "scale" option is specified.');
      });

      const supportsDecimal = dialect.supports.dataTypes.DECIMAL;
      if (supportsDecimal) {
        describe('validate', () => {
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
      }
    });

    describe('ENUM', () => {
      it('produces an enum', () => {
        const User = sequelize.define('User', {
          anEnum: DataTypes.ENUM('value 1', 'value 2'),
        });

        const enumType = User.rawAttributes.anEnum.type;
        assert(typeof enumType !== 'string');

        expectsql(enumType.toSql({ dialect }), {
          postgres: '"public"."enum_Users_anEnum"',
          'mysql mariadb': `ENUM('value 1', 'value 2')`,
          // SQL Server does not support enums, we use text + a check constraint instead
          mssql: `NVARCHAR(255)`,
          sqlite: 'TEXT',
        });
      });

      it('raises an error if no values are defined', () => {
        expect(() => {
          sequelize.define('omnomnom', {
            bla: { type: DataTypes.ENUM },
          });
        }).to.throwWithCause(Error, 'DataTypes.ENUM cannot be used without specifying its possible enum values.');
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.ENUM('foo');

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, `'foobar' is not a valid choice for enum [ 'foo' ]`);
        });

        it('should not throw if `value` is a valid choice', () => {
          const type = DataTypes.ENUM('foobar', 'foobiz');

          expect(() => type.validate('foobar')).not.to.throw();
          expect(() => type.validate('foobiz')).not.to.throw();
        });
      });
    });

    describe('BLOB', () => {
      testsql('BLOB', DataTypes.BLOB, {
        default: 'BLOB',
        ibmi: 'BLOB(1M)',
        mssql: 'VARBINARY(MAX)',
        postgres: 'BYTEA',
      });

      testsql('BLOB("tiny")', DataTypes.BLOB('tiny'), {
        default: 'TINYBLOB',
        ibmi: 'BLOB(255)',
        mssql: 'VARBINARY(256)',
        db2: 'BLOB(255)',
        postgres: 'BYTEA',
        sqlite: 'BLOB',
      });

      testsql('BLOB("medium")', DataTypes.BLOB('medium'), {
        default: 'MEDIUMBLOB',
        ibmi: 'BLOB(16M)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(16M)',
        postgres: 'BYTEA',
        sqlite: 'BLOB',
      });

      testsql('BLOB({ length: "medium" })', DataTypes.BLOB({ length: 'medium' }), {
        default: 'MEDIUMBLOB',
        ibmi: 'BLOB(16M)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(16M)',
        postgres: 'BYTEA',
        sqlite: 'BLOB',
      });

      testsql('BLOB("long")', DataTypes.BLOB('long'), {
        default: 'LONGBLOB',
        ibmi: 'BLOB(2G)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(2G)',
        postgres: 'BYTEA',
        sqlite: 'BLOB',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BLOB();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationErrorItem, '12345 is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
        });

        it('should not throw if `value` is a blob', () => {
          const type = DataTypes.BLOB();

          expect(() => type.validate('foobar')).not.to.throw();
          expect(() => type.validate(Buffer.from('foobar'))).not.to.throw();
        });
      });
    });

    describe('RANGE', () => {
      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.RANGE(DataTypes.INTEGER);

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationErrorItem, 'A range must either be an array with two elements, or an empty array for the empty range.');
        });

        it('should throw an error if `value` is not an array with two elements', () => {
          const type = DataTypes.RANGE(DataTypes.INTEGER);

          expect(() => {
            type.validate([1]);
          }).to.throw(ValidationErrorItem, 'A range must either be an array with two elements, or an empty array for the empty range.');
        });

        it('should not throw if `value` is a range', () => {
          const type = DataTypes.RANGE(DataTypes.INTEGER);

          expect(() => type.validate([1, 2])).not.to.throw();
        });
      });
    });

    describe('JSON', () => {
      testsql('JSON', DataTypes.JSON, {
        // All dialects must support DataTypes.JSON. If your dialect does not have a native JSON type, use an as-big-as-possible text type instead.
        'mariadb mysql postgres': 'JSON',
        // SQL server supports JSON functions, but it is stored as a string with a ISJSON constraint.
        mssql: 'NVARCHAR(MAX)',
        sqlite: 'TEXT',
      });
    });

    describe('JSONB', () => {
      testsql('JSONB', DataTypes.JSONB, {
        default: new Error(`${dialectName} does not support the JSONB data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
        postgres: 'JSONB',
      });
    });

    if (sequelize.dialect.supports.dataTypes.ARRAY) {
      describe('ARRAY', () => {
        testsql('ARRAY(VARCHAR)', DataTypes.ARRAY(DataTypes.STRING), {
          postgres: 'VARCHAR(255)[]',
        });

        testsql('ARRAY(VARCHAR(100))', DataTypes.ARRAY(DataTypes.STRING(100)), {
          postgres: 'VARCHAR(100)[]',
        });

        testsql('ARRAY(INTEGER)', DataTypes.ARRAY(DataTypes.INTEGER), {
          postgres: 'INTEGER[]',
        });

        testsql('ARRAY(HSTORE)', DataTypes.ARRAY(DataTypes.HSTORE), {
          postgres: 'HSTORE[]',
        });

        testsql('ARRAY(ARRAY(VARCHAR(255)))', DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.STRING)), {
          postgres: 'VARCHAR(255)[][]',
        });

        testsql('ARRAY(TEXT)', DataTypes.ARRAY(DataTypes.TEXT), {
          postgres: 'TEXT[]',
        });

        testsql('ARRAY(DATE)', DataTypes.ARRAY(DataTypes.DATE), {
          postgres: 'TIMESTAMP WITH TIME ZONE[]',
        });

        testsql('ARRAY(BOOLEAN)', DataTypes.ARRAY(DataTypes.BOOLEAN), {
          postgres: 'BOOLEAN[]',
        });

        const decimalSupport = dialect.supports.dataTypes.DECIMAL;
        if (decimalSupport && decimalSupport.unconstrained) {
          testsql('ARRAY(DECIMAL)', DataTypes.ARRAY(DataTypes.DECIMAL), {
            postgres: 'DECIMAL[]',
          });
        }

        testsql('ARRAY(DECIMAL(6, 4))', DataTypes.ARRAY(DataTypes.DECIMAL(6, 4)), {
          postgres: 'DECIMAL(6, 4)[]',
        });

        testsql('ARRAY(DOUBLE)', DataTypes.ARRAY(DataTypes.DOUBLE), {
          postgres: 'DOUBLE PRECISION[]',
        });

        testsql('ARRAY(REAL))', DataTypes.ARRAY(DataTypes.REAL), {
          postgres: 'REAL[]',
        });

        testsql('ARRAY(JSON)', DataTypes.ARRAY(DataTypes.JSON), {
          postgres: 'JSON[]',
        });

        if (dialect.supports.dataTypes.JSONB) {
          testsql('ARRAY(JSONB)', DataTypes.ARRAY(DataTypes.JSONB), {
            postgres: 'JSONB[]',
          });
        }

        if (dialect.supports.dataTypes.CITEXT) {
          testsql('ARRAY(CITEXT)', DataTypes.ARRAY(DataTypes.CITEXT), {
            postgres: 'CITEXT[]',
          });
        }

        it('raises an error if no values are defined', () => {
          expect(() => {
            sequelize.define('omnomnom', {
              bla: { type: DataTypes.ARRAY },
            });
          }).to.throwWithCause(Error, 'ARRAY is missing type definition for its values.');
        });

        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.ARRAY(DataTypes.INTEGER);

            expect(() => {
              type.validate('foobar');
            }).to.throw(ValidationErrorItem, `'foobar' is not a valid array`);
          });

          it('should not throw if `value` is an array', () => {
            const type = DataTypes.ARRAY(DataTypes.STRING);

            expect(() => type.validate(['foo', 'bar'])).not.to.throw();
          });
        });
      });
    }

    if (sequelize.dialect.supports.dataTypes.GEOMETRY) {
      describe('GEOMETRY', () => {
        testsql('GEOMETRY', DataTypes.GEOMETRY, {
          default: 'GEOMETRY',
        });

        testsql(`GEOMETRY('POINT')`, DataTypes.GEOMETRY(GeoJsonType.Point), {
          postgres: 'GEOMETRY(POINT)',
          mariadb: 'POINT',
          mysql: 'POINT',
        });

        testsql(`GEOMETRY('LINESTRING')`, DataTypes.GEOMETRY(GeoJsonType.LineString), {
          postgres: 'GEOMETRY(LINESTRING)',
          mariadb: 'LINESTRING',
          mysql: 'LINESTRING',
        });

        testsql(`GEOMETRY('POLYGON')`, DataTypes.GEOMETRY(GeoJsonType.Polygon), {
          postgres: 'GEOMETRY(POLYGON)',
          mariadb: 'POLYGON',
          mysql: 'POLYGON',
        });

        testsql(`GEOMETRY('POINT',4326)`, DataTypes.GEOMETRY(GeoJsonType.Point, 4326), {
          postgres: 'GEOMETRY(POINT,4326)',
          mariadb: 'POINT',
          mysql: 'POINT',
        });
      });
    }

    describe('GEOGRAPHY', () => {
      testsql('GEOGRAPHY', DataTypes.GEOGRAPHY, {
        default: new Error(`${dialectName} does not support the GEOGRAPHY data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
        postgres: 'GEOGRAPHY',
      });
    });

    describe('HSTORE', () => {
      testsql('HSTORE', DataTypes.HSTORE, {
        default: new Error(`${dialectName} does not support the HSTORE data type.\nSee https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`),
        postgres: 'HSTORE',
      });
    });
  });
});
