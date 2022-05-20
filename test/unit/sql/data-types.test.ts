import assert from 'node:assert';
import util from 'util';
import type { DataTypeClassOrInstance, DataTypeInstance } from '@sequelize/core';
import { DataTypes, ValidationError } from '@sequelize/core';
import { expect } from 'chai';
import { v1 as uuidV1, v4 as uuidV4 } from 'uuid';
import { expectsql, sequelize, getTestDialect, getTestDialectTeaser, createTester } from '../../support';

const dialect = getTestDialect();

// Notice: [] will be replaced by dialect specific tick/quote character when the default expectation is used.

describe(getTestDialectTeaser('SQL'), () => {

  describe('DataTypes', () => {
    const testsql = createTester((it, description: string, dataType: DataTypeClassOrInstance, expectation) => {
      it(description, () => {
        return expectsql(sequelize.normalizeDataType(dataType).toSql(), expectation);
      });
    });

    describe('STRING', () => {
      testsql('STRING', DataTypes.STRING, {
        default: 'VARCHAR(255)',
        mssql: 'NVARCHAR(255)',
      });

      testsql('STRING(1234)', DataTypes.STRING(1234), {
        default: 'VARCHAR(1234)',
        mssql: 'NVARCHAR(1234)',
      });

      testsql('STRING({ length: 1234 })', DataTypes.STRING({ length: 1234 }), {
        default: 'VARCHAR(1234)',
        mssql: 'NVARCHAR(1234)',
      });

      testsql('STRING(1234).BINARY', DataTypes.STRING(1234).BINARY, {
        default: 'VARCHAR(1234) BINARY',
        ibmi: 'BINARY(1234)',
        db2: 'VARCHAR(1234) FOR BIT DATA',
        sqlite: 'VARCHAR BINARY(1234)',
        mssql: 'BINARY(1234)',
        postgres: 'BYTEA',
      });

      testsql('STRING.BINARY', DataTypes.STRING.BINARY, {
        default: 'VARCHAR(255) BINARY',
        ibmi: 'BINARY(255)',
        db2: 'VARCHAR(255) FOR BIT DATA',
        sqlite: 'VARCHAR BINARY(255)',
        mssql: 'BINARY(255)',
        postgres: 'BYTEA',
      });

      describe('validate', () => {
        it('should not throw if `value` is a string', () => {
          const type = new DataTypes.STRING();

          expect(() => type.validate('foobar')).not.to.throw();
          expect(() => type.validate(12)).not.to.throw();
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
          }).to.throw(ValidationError, '12345 is not a valid string');
        });

        it('should not throw if `value` is a string', () => {
          const type = DataTypes.TEXT();

          expect(() => type.validate('foobar')).not.to.throw();
        });
      });
    });

    describe('CITEXT', () => {
      testsql('CITEXT', DataTypes.CITEXT, {
        default: 'CITEXT', // TODO: dialects that don't support CITEXT should throw
        postgres: 'CITEXT',
        sqlite: 'TEXT COLLATE NOCASE',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.CITEXT();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationError, '12345 is not a valid string');
        });

        it('should not throw if `value` is a string', () => {
          const type = DataTypes.CITEXT();

          expect(() => type.validate('foobar')).not.to.throw();
        });
      });
    });

    describe('TSVECTOR', () => {
      testsql('TSVECTOR', DataTypes.TSVECTOR, {
        default: 'TSVECTOR', // TODO: dialects that don't support TSVECTOR should throw
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.TSVECTOR();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationError, '12345 is not a valid string');
        });

        it('should not throw if `value` is a string', () => {
          const type = DataTypes.TSVECTOR();

          expect(() => type.validate('foobar')).not.to.throw();
        });
      });
    });

    describe('CHAR', () => {
      testsql('CHAR', DataTypes.CHAR, {
        default: 'CHAR(255)',
      });

      testsql('CHAR(12)', DataTypes.CHAR(12), {
        default: 'CHAR(12)',
      });

      testsql('CHAR({ length: 12 })', DataTypes.CHAR({ length: 12 }), {
        default: 'CHAR(12)',
      });

      testsql('CHAR(12).BINARY', DataTypes.CHAR(12).BINARY, {
        default: 'CHAR(12) BINARY',
        ibmi: 'CLOB(12)',
        sqlite: 'CHAR BINARY(12)',
        postgres: 'BYTEA',
      });

      testsql('CHAR.BINARY', DataTypes.CHAR.BINARY, {
        default: 'CHAR(255) BINARY',
        ibmi: 'CLOB(255)',
        sqlite: 'CHAR BINARY(255)',
        postgres: 'BYTEA',
      });
    });

    describe('BOOLEAN', () => {
      testsql('BOOLEAN', DataTypes.BOOLEAN, {
        ibmi: 'SMALLINT',
        postgres: 'BOOLEAN',
        db2: 'BOOLEAN',
        mssql: 'BIT',
        mariadb: 'TINYINT(1)',
        mysql: 'TINYINT(1)',
        sqlite: 'TINYINT(1)',
        snowflake: 'BOOLEAN',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.BOOLEAN();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationError, '12345 is not a valid boolean');
        });

        it('should not throw if `value` is a boolean', () => {
          const type = DataTypes.BOOLEAN();

          expect(() => type.validate(true)).not.to.throw();
          expect(() => type.validate(false)).not.to.throw();
          expect(() => type.validate('1')).not.to.throw();
          expect(() => type.validate('0')).not.to.throw();
          expect(() => type.validate('true')).not.to.throw();
          expect(() => type.validate('false')).not.to.throw();
        });
      });
    });

    describe('DATE', () => {
      testsql('DATE', DataTypes.DATE, {
        ibmi: 'TIMESTAMP',
        postgres: 'TIMESTAMP WITH TIME ZONE',
        mssql: 'DATETIMEOFFSET',
        mariadb: 'DATETIME',
        mysql: 'DATETIME',
        db2: 'TIMESTAMP',
        sqlite: 'DATETIME',
        snowflake: 'TIMESTAMP',
      });

      testsql('DATE(6)', DataTypes.DATE(6), {
        ibmi: 'TIMESTAMP',
        postgres: 'TIMESTAMP WITH TIME ZONE',
        mssql: 'DATETIMEOFFSET',
        mariadb: 'DATETIME(6)',
        mysql: 'DATETIME(6)',
        db2: 'TIMESTAMP(6)',
        sqlite: 'DATETIME',
        snowflake: 'TIMESTAMP',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.DATE();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid date');
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
      });
    });

    describe('TIME', () => {
      testsql('TIME', DataTypes.TIME, {
        default: 'TIME',
      });
    });

    if (sequelize.dialect.supports.HSTORE) {
      describe('HSTORE', () => {
        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.HSTORE();

            expect(() => {
              type.validate('foobar');
            }).to.throw(ValidationError, '"foobar" is not a valid hstore');
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
        mssql: 'CHAR(36)',
        mariadb: 'CHAR(36) BINARY',
        mysql: 'CHAR(36) BINARY',
        sqlite: 'UUID',
        snowflake: 'VARCHAR(36)',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUID();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid uuid');

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationError, '["foobar"] is not a valid uuid');
        });

        it('should not throw if `value` is an uuid', () => {
          const type = DataTypes.UUID();

          expect(() => type.validate(uuidV4())).not.to.throw();
        });
      });
    });

    describe('UUIDV1', () => {
      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV1();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid uuid');

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationError, '["foobar"] is not a valid uuid');
        });

        it('should not throw if `value` is an uuid', () => {
          const type = DataTypes.UUIDV1();

          expect(() => type.validate(uuidV1())).not.to.throw();
        });
      });
    });

    describe('UUIDV4', () => {
      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.UUIDV4();
          const value = uuidV1();

          expect(() => {
            type.validate(value);
          }).to.throw(ValidationError, util.format('%j is not a valid uuidv4', value));

          expect(() => {
            type.validate(['foobar']);
          }).to.throw(ValidationError, '["foobar"] is not a valid uuidv4');
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
      testsql('INTEGER', DataTypes.INTEGER, {
        default: 'INTEGER',
      });

      testsql('INTEGER.UNSIGNED', DataTypes.INTEGER.UNSIGNED, {
        default: 'INTEGER UNSIGNED',
        ibmi: 'INTEGER',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
        sqlite: 'INTEGER',
      });

      testsql('INTEGER.UNSIGNED.ZEROFILL', DataTypes.INTEGER.UNSIGNED.ZEROFILL, {
        default: 'INTEGER UNSIGNED ZEROFILL',
        ibmi: 'INTEGER',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
        sqlite: 'INTEGER',
      });

      testsql('INTEGER(11)', DataTypes.INTEGER(11), {
        default: 'INTEGER(11)',
        ibmi: 'INTEGER',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      testsql('INTEGER({ length: 11 })', DataTypes.INTEGER({ length: 11 }), {
        default: 'INTEGER(11)',
        ibmi: 'INTEGER',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      testsql('INTEGER(11).UNSIGNED', DataTypes.INTEGER(11).UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED',
        ibmi: 'INTEGER',
        sqlite: 'INTEGER(11)',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      testsql('INTEGER(11).UNSIGNED.ZEROFILL', DataTypes.INTEGER(11).UNSIGNED.ZEROFILL, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        ibmi: 'INTEGER',
        sqlite: 'INTEGER(11)',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      testsql('INTEGER(11).ZEROFILL', DataTypes.INTEGER(11).ZEROFILL, {
        default: 'INTEGER(11) ZEROFILL',
        ibmi: 'INTEGER',
        sqlite: 'INTEGER(11)',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      testsql('INTEGER(11).ZEROFILL.UNSIGNED', DataTypes.INTEGER(11).ZEROFILL.UNSIGNED, {
        default: 'INTEGER(11) UNSIGNED ZEROFILL',
        ibmi: 'INTEGER',
        sqlite: 'INTEGER(11)',
        postgres: 'INTEGER',
        db2: 'INTEGER',
        mssql: 'INTEGER',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.INTEGER();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate('123.45');
          }).to.throw(ValidationError, '"123.45" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(ValidationError, '123.45 is not a valid integer');
        });

        it('should not throw if `value` is a valid integer', () => {
          const type = DataTypes.INTEGER();

          expect(() => type.validate('12345')).not.to.throw();
          expect(() => type.validate(12_345)).not.to.throw();
        });
      });
    });

    describe('TINYINT', () => {
      const cases = [
        {
          title: 'TINYINT',
          dataType: DataTypes.TINYINT,
          expect: {
            default: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2)',
          dataType: DataTypes.TINYINT(2),
          expect: {
            default: 'TINYINT(2)',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
          },
        },
        {
          title: 'TINYINT({ length: 2 })',
          dataType: DataTypes.TINYINT({ length: 2 }),
          expect: {
            default: 'TINYINT(2)',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
          },
        },
        {
          title: 'TINYINT.UNSIGNED',
          dataType: DataTypes.TINYINT.UNSIGNED,
          expect: {
            default: 'TINYINT UNSIGNED',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
            sqlite: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2).UNSIGNED',
          dataType: DataTypes.TINYINT(2).UNSIGNED,
          expect: {
            default: 'TINYINT(2) UNSIGNED',
            db2: 'TINYINT',
            sqlite: 'TINYINT(2)',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
          },
        },
        {
          title: 'TINYINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.TINYINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'TINYINT UNSIGNED ZEROFILL',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
            sqlite: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2).UNSIGNED.ZEROFILL',
          dataType: DataTypes.TINYINT(2).UNSIGNED.ZEROFILL,
          expect: {
            default: 'TINYINT(2) UNSIGNED ZEROFILL',
            db2: 'TINYINT',
            sqlite: 'TINYINT(2)',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
          },
        },
        {
          title: 'TINYINT.ZEROFILL',
          dataType: DataTypes.TINYINT.ZEROFILL,
          expect: {
            default: 'TINYINT ZEROFILL',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
            sqlite: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2).ZEROFILL',
          dataType: DataTypes.TINYINT(2).ZEROFILL,
          expect: {
            default: 'TINYINT(2) ZEROFILL',
            db2: 'TINYINT',
            sqlite: 'TINYINT(2)',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
          },
        },
        {
          title: 'TINYINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.TINYINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'TINYINT UNSIGNED ZEROFILL',
            db2: 'TINYINT',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
            sqlite: 'TINYINT',
          },
        },
        {
          title: 'TINYINT(2).ZEROFILL.UNSIGNED',
          dataType: DataTypes.TINYINT(2).ZEROFILL.UNSIGNED,
          expect: {
            default: 'TINYINT(2) UNSIGNED ZEROFILL',
            db2: 'TINYINT',
            sqlite: 'TINYINT(2)',
            mssql: 'TINYINT',
            postgres: 'TINYINT',
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
          }).to.throw(ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(ValidationError, '123.45 is not a valid integer');
        });

        it('should not throw if `value` is an integer', () => {
          const type = DataTypes.TINYINT();

          expect(() => type.validate(-128)).not.to.throw();
          expect(() => type.validate('127')).not.to.throw();
        });
      });
    });

    describe('SMALLINT', () => {
      const cases = [
        {
          title: 'SMALLINT',
          dataType: DataTypes.SMALLINT,
          expect: {
            default: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT(4)',
          dataType: DataTypes.SMALLINT(4),
          expect: {
            default: 'SMALLINT(4)',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT({ length: 4 })',
          dataType: DataTypes.SMALLINT({ length: 4 }),
          expect: {
            default: 'SMALLINT(4)',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT.UNSIGNED',
          dataType: DataTypes.SMALLINT.UNSIGNED,
          expect: {
            default: 'SMALLINT UNSIGNED',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
            sqlite: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT(4).UNSIGNED',
          dataType: DataTypes.SMALLINT(4).UNSIGNED,
          expect: {
            default: 'SMALLINT(4) UNSIGNED',
            ibmi: 'SMALLINT',
            sqlite: 'SMALLINT(4)',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.SMALLINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'SMALLINT UNSIGNED ZEROFILL',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
            sqlite: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT(4).UNSIGNED.ZEROFILL',
          dataType: DataTypes.SMALLINT(4).UNSIGNED.ZEROFILL,
          expect: {
            default: 'SMALLINT(4) UNSIGNED ZEROFILL',
            ibmi: 'SMALLINT',
            sqlite: 'SMALLINT(4)',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT.ZEROFILL',
          dataType: DataTypes.SMALLINT.ZEROFILL,
          expect: {
            default: 'SMALLINT ZEROFILL',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
            sqlite: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT(4).ZEROFILL',
          dataType: DataTypes.SMALLINT(4).ZEROFILL,
          expect: {
            default: 'SMALLINT(4) ZEROFILL',
            ibmi: 'SMALLINT',
            sqlite: 'SMALLINT(4)',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.SMALLINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'SMALLINT UNSIGNED ZEROFILL',
            ibmi: 'SMALLINT',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
            sqlite: 'SMALLINT',
          },
        },
        {
          title: 'SMALLINT(4).ZEROFILL.UNSIGNED',
          dataType: DataTypes.SMALLINT(4).ZEROFILL.UNSIGNED,
          expect: {
            default: 'SMALLINT(4) UNSIGNED ZEROFILL',
            ibmi: 'SMALLINT',
            sqlite: 'SMALLINT(4)',
            postgres: 'SMALLINT',
            db2: 'SMALLINT',
            mssql: 'SMALLINT',
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
          }).to.throw(ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(ValidationError, '123.45 is not a valid integer');
        });

        it('should not throw if `value` is an integer', () => {
          const type = DataTypes.SMALLINT();

          expect(() => type.validate(-32_768)).not.to.throw();
          expect(() => type.validate('32767')).not.to.throw();
        });
      });
    });

    describe('MEDIUMINT', () => {
      const cases = [
        {
          title: 'MEDIUMINT',
          dataType: DataTypes.MEDIUMINT,
          expect: {
            default: 'MEDIUMINT',
          },
        },
        {
          title: 'MEDIUMINT(6)',
          dataType: DataTypes.MEDIUMINT(6),
          expect: {
            default: 'MEDIUMINT(6)',
          },
        },
        {
          title: 'MEDIUMINT({ length: 6 })',
          dataType: DataTypes.MEDIUMINT({ length: 6 }),
          expect: {
            default: 'MEDIUMINT(6)',
          },
        },
        {
          title: 'MEDIUMINT.UNSIGNED',
          dataType: DataTypes.MEDIUMINT.UNSIGNED,
          expect: {
            default: 'MEDIUMINT UNSIGNED',
            sqlite: 'MEDIUMINT',
          },
        },
        {
          title: 'MEDIUMINT(6).UNSIGNED',
          dataType: DataTypes.MEDIUMINT(6).UNSIGNED,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED',
            sqlite: 'MEDIUMINT(6)',
          },
        },
        {
          title: 'MEDIUMINT.UNSIGNED.ZEROFILL',
          dataType: DataTypes.MEDIUMINT.UNSIGNED.ZEROFILL,
          expect: {
            default: 'MEDIUMINT UNSIGNED ZEROFILL',
            sqlite: 'MEDIUMINT',
          },
        },
        {
          title: 'MEDIUMINT(6).UNSIGNED.ZEROFILL',
          dataType: DataTypes.MEDIUMINT(6).UNSIGNED.ZEROFILL,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED ZEROFILL',
            sqlite: 'MEDIUMINT(6)',
          },
        },
        {
          title: 'MEDIUMINT.ZEROFILL',
          dataType: DataTypes.MEDIUMINT.ZEROFILL,
          expect: {
            default: 'MEDIUMINT ZEROFILL',
            sqlite: 'MEDIUMINT',
          },
        },
        {
          title: 'MEDIUMINT(6).ZEROFILL',
          dataType: DataTypes.MEDIUMINT(6).ZEROFILL,
          expect: {
            default: 'MEDIUMINT(6) ZEROFILL',
            sqlite: 'MEDIUMINT(6)',
          },
        },
        {
          title: 'MEDIUMINT.ZEROFILL.UNSIGNED',
          dataType: DataTypes.MEDIUMINT.ZEROFILL.UNSIGNED,
          expect: {
            default: 'MEDIUMINT UNSIGNED ZEROFILL',
            sqlite: 'MEDIUMINT',
          },
        },
        {
          title: 'MEDIUMINT(6).ZEROFILL.UNSIGNED',
          dataType: DataTypes.MEDIUMINT(6).ZEROFILL.UNSIGNED,
          expect: {
            default: 'MEDIUMINT(6) UNSIGNED ZEROFILL',
            sqlite: 'MEDIUMINT(6)',
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
          }).to.throw(ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(ValidationError, '123.45 is not a valid integer');
        });

        it('should not throw if `value` is an integer', () => {
          const type = DataTypes.MEDIUMINT();

          expect(() => type.validate(-8_388_608)).not.to.throw();
          expect(() => type.validate('8388607')).not.to.throw();
        });
      });
    });

    describe('BIGINT', () => {
      testsql('BIGINT', DataTypes.BIGINT, {
        default: 'BIGINT',
      });

      testsql('BIGINT.UNSIGNED', DataTypes.BIGINT.UNSIGNED, {
        default: 'BIGINT UNSIGNED',
        ibmi: 'BIGINT',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
        sqlite: 'BIGINT',
      });

      testsql('BIGINT.UNSIGNED.ZEROFILL', DataTypes.BIGINT.UNSIGNED.ZEROFILL, {
        default: 'BIGINT UNSIGNED ZEROFILL',
        ibmi: 'BIGINT',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
        sqlite: 'BIGINT',
      });

      testsql('BIGINT(11)', DataTypes.BIGINT(11), {
        default: 'BIGINT(11)',
        ibmi: 'BIGINT',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      testsql('BIGINT({ length: 11 })', DataTypes.BIGINT({ length: 11 }), {
        default: 'BIGINT(11)',
        ibmi: 'BIGINT',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      testsql('BIGINT(11).UNSIGNED', DataTypes.BIGINT(11).UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED',
        ibmi: 'BIGINT',
        sqlite: 'BIGINT(11)',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      testsql('BIGINT(11).UNSIGNED.ZEROFILL', DataTypes.BIGINT(11).UNSIGNED.ZEROFILL, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        ibmi: 'BIGINT',
        sqlite: 'BIGINT(11)',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      testsql('BIGINT(11).ZEROFILL', DataTypes.BIGINT(11).ZEROFILL, {
        default: 'BIGINT(11) ZEROFILL',
        ibmi: 'BIGINT',
        sqlite: 'BIGINT(11)',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      testsql('BIGINT(11).ZEROFILL.UNSIGNED', DataTypes.BIGINT(11).ZEROFILL.UNSIGNED, {
        default: 'BIGINT(11) UNSIGNED ZEROFILL',
        ibmi: 'BIGINT',
        sqlite: 'BIGINT(11)',
        postgres: 'BIGINT',
        db2: 'BIGINT',
        mssql: 'BIGINT',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BIGINT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid integer');

          expect(() => {
            type.validate(123.45);
          }).to.throw(ValidationError, '123.45 is not a valid integer');
        });

        it('should not throw if `value` is an integer', () => {
          const type = DataTypes.BIGINT();

          expect(() => type.validate('9223372036854775807')).not.to.throw();
        });
      });
    });

    describe('REAL', () => {
      testsql('REAL', DataTypes.REAL, {
        default: 'REAL',
      });

      testsql('REAL.UNSIGNED', DataTypes.REAL.UNSIGNED, {
        default: 'REAL UNSIGNED',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11)', DataTypes.REAL(11), {
        default: 'REAL(11)',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL({ length: 11 })', DataTypes.REAL({ length: 11 }), {
        default: 'REAL(11)',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11).UNSIGNED', DataTypes.REAL(11).UNSIGNED, {
        default: 'REAL(11) UNSIGNED',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED(11)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11).UNSIGNED.ZEROFILL', DataTypes.REAL(11).UNSIGNED.ZEROFILL, {
        default: 'REAL(11) UNSIGNED ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED ZEROFILL(11)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11).ZEROFILL', DataTypes.REAL(11).ZEROFILL, {
        default: 'REAL(11) ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL ZEROFILL(11)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11).ZEROFILL.UNSIGNED', DataTypes.REAL(11).ZEROFILL.UNSIGNED, {
        default: 'REAL(11) UNSIGNED ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED ZEROFILL(11)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12)', DataTypes.REAL(11, 12), {
        default: 'REAL(11,12)',
        ibmi: 'REAL',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).UNSIGNED', DataTypes.REAL(11, 12).UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED(11,12)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL({ length: 11, decimals: 12 }).UNSIGNED', DataTypes.REAL({ length: 11, decimals: 12 }).UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED(11,12)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).UNSIGNED.ZEROFILL', DataTypes.REAL(11, 12).UNSIGNED.ZEROFILL, {
        default: 'REAL(11,12) UNSIGNED ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED ZEROFILL(11,12)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).ZEROFILL', DataTypes.REAL(11, 12).ZEROFILL, {
        default: 'REAL(11,12) ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL ZEROFILL(11,12)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });

      testsql('REAL(11, 12).ZEROFILL.UNSIGNED', DataTypes.REAL(11, 12).ZEROFILL.UNSIGNED, {
        default: 'REAL(11,12) UNSIGNED ZEROFILL',
        ibmi: 'REAL',
        sqlite: 'REAL UNSIGNED ZEROFILL(11,12)',
        postgres: 'REAL',
        db2: 'REAL',
        mssql: 'REAL',
      });
    });

    describe('DOUBLE PRECISION', () => {
      testsql('DOUBLE', DataTypes.DOUBLE, {
        db2: 'DOUBLE',
        default: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE.UNSIGNED', DataTypes.DOUBLE.UNSIGNED, {
        default: 'DOUBLE PRECISION UNSIGNED',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11)', DataTypes.DOUBLE(11), {
        default: 'DOUBLE PRECISION(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11).UNSIGNED', DataTypes.DOUBLE(11).UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED',
        sqlite: 'DOUBLE PRECISION UNSIGNED(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE({ length: 11 }).UNSIGNED', DataTypes.DOUBLE({ length: 11 }).UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED',
        sqlite: 'DOUBLE PRECISION UNSIGNED(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11).UNSIGNED.ZEROFILL, {
        default: 'DOUBLE PRECISION(11) UNSIGNED ZEROFILL',
        sqlite: 'DOUBLE PRECISION UNSIGNED ZEROFILL(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11).ZEROFILL', DataTypes.DOUBLE(11).ZEROFILL, {
        default: 'DOUBLE PRECISION(11) ZEROFILL',
        sqlite: 'DOUBLE PRECISION ZEROFILL(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11).ZEROFILL.UNSIGNED, {
        default: 'DOUBLE PRECISION(11) UNSIGNED ZEROFILL',
        sqlite: 'DOUBLE PRECISION UNSIGNED ZEROFILL(11)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12)', DataTypes.DOUBLE(11, 12), {
        default: 'DOUBLE PRECISION(11,12)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).UNSIGNED', DataTypes.DOUBLE(11, 12).UNSIGNED, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED',
        sqlite: 'DOUBLE PRECISION UNSIGNED(11,12)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).UNSIGNED.ZEROFILL', DataTypes.DOUBLE(11, 12).UNSIGNED.ZEROFILL, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED ZEROFILL',
        sqlite: 'DOUBLE PRECISION UNSIGNED ZEROFILL(11,12)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).ZEROFILL', DataTypes.DOUBLE(11, 12).ZEROFILL, {
        default: 'DOUBLE PRECISION(11,12) ZEROFILL',
        sqlite: 'DOUBLE PRECISION ZEROFILL(11,12)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });

      testsql('DOUBLE(11, 12).ZEROFILL.UNSIGNED', DataTypes.DOUBLE(11, 12).ZEROFILL.UNSIGNED, {
        default: 'DOUBLE PRECISION(11,12) UNSIGNED ZEROFILL',
        sqlite: 'DOUBLE PRECISION UNSIGNED ZEROFILL(11,12)',
        db2: 'DOUBLE',
        postgres: 'DOUBLE PRECISION',
      });
    });

    describe('FLOAT', () => {
      testsql('FLOAT', DataTypes.FLOAT, {
        default: 'FLOAT',
        postgres: 'FLOAT',
      });

      testsql('FLOAT.UNSIGNED', DataTypes.FLOAT.UNSIGNED, {
        default: 'FLOAT UNSIGNED',
        ibmi: 'FLOAT',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT(11)', DataTypes.FLOAT(11), {
        default: 'FLOAT(11)',
        postgres: 'FLOAT(11)', // 1-24 = 4 bytes; 35-53 = 8 bytes
        db2: 'FLOAT(11)', // 1-24 = 4 bytes; 35-53 = 8 bytes
        mssql: 'FLOAT(11)', // 1-24 = 4 bytes; 35-53 = 8 bytes
      });

      testsql('FLOAT(11).UNSIGNED', DataTypes.FLOAT(11).UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED',
        ibmi: 'FLOAT(11)',
        sqlite: 'FLOAT UNSIGNED(11)',
        postgres: 'FLOAT(11)',
        db2: 'FLOAT(11)',
        mssql: 'FLOAT(11)',
      });

      testsql('FLOAT(11).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        ibmi: 'FLOAT(11)',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11)',
        postgres: 'FLOAT(11)',
        db2: 'FLOAT(11)',
        mssql: 'FLOAT(11)',
      });

      testsql('FLOAT(11).ZEROFILL', DataTypes.FLOAT(11).ZEROFILL, {
        default: 'FLOAT(11) ZEROFILL',
        ibmi: 'FLOAT(11)',
        sqlite: 'FLOAT ZEROFILL(11)',
        postgres: 'FLOAT(11)',
        db2: 'FLOAT(11)',
        mssql: 'FLOAT(11)',
      });

      testsql('FLOAT({ length: 11 }).ZEROFILL', DataTypes.FLOAT({ length: 11 }).ZEROFILL, {
        default: 'FLOAT(11) ZEROFILL',
        ibmi: 'FLOAT(11)',
        sqlite: 'FLOAT ZEROFILL(11)',
        postgres: 'FLOAT(11)',
        db2: 'FLOAT(11)',
        mssql: 'FLOAT(11)',
      });

      testsql('FLOAT(11).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11) UNSIGNED ZEROFILL',
        ibmi: 'FLOAT(11)',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11)',
        postgres: 'FLOAT(11)',
        db2: 'FLOAT(11)',
        mssql: 'FLOAT(11)',
      });

      testsql('FLOAT(11, 12)', DataTypes.FLOAT(11, 12), {
        default: 'FLOAT(11,12)',
        ibmi: 'FLOAT',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT(11, 12).UNSIGNED', DataTypes.FLOAT(11, 12).UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED',
        ibmi: 'FLOAT',
        sqlite: 'FLOAT UNSIGNED(11,12)',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT({ length: 11, decimals: 12 }).UNSIGNED', DataTypes.FLOAT({ length: 11, decimals: 12 }).UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED',
        ibmi: 'FLOAT',
        sqlite: 'FLOAT UNSIGNED(11,12)',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT(11, 12).UNSIGNED.ZEROFILL', DataTypes.FLOAT(11, 12).UNSIGNED.ZEROFILL, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        ibmi: 'FLOAT',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11,12)',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT(11, 12).ZEROFILL', DataTypes.FLOAT(11, 12).ZEROFILL, {
        default: 'FLOAT(11,12) ZEROFILL',
        ibmi: 'FLOAT',
        sqlite: 'FLOAT ZEROFILL(11,12)',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      testsql('FLOAT(11, 12).ZEROFILL.UNSIGNED', DataTypes.FLOAT(11, 12).ZEROFILL.UNSIGNED, {
        default: 'FLOAT(11,12) UNSIGNED ZEROFILL',
        ibmi: 'FLOAT',
        sqlite: 'FLOAT UNSIGNED ZEROFILL(11,12)',
        postgres: 'FLOAT',
        db2: 'FLOAT',
        mssql: 'FLOAT',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.FLOAT();

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid float');
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
      testsql('DECIMAL', DataTypes.DECIMAL, {
        default: 'DECIMAL',
      });

      testsql('DECIMAL(10, 2)', DataTypes.DECIMAL(10, 2), {
        default: 'DECIMAL(10,2)',
      });

      testsql('DECIMAL({ precision: 10, scale: 2 })', DataTypes.DECIMAL({ precision: 10, scale: 2 }), {
        default: 'DECIMAL(10,2)',
      });

      testsql('DECIMAL(10)', DataTypes.DECIMAL(10), {
        default: 'DECIMAL(10)',
      });

      testsql('DECIMAL({ precision: 10 })', DataTypes.DECIMAL({ precision: 10 }), {
        default: 'DECIMAL(10)',
      });

      testsql('DECIMAL.UNSIGNED', DataTypes.DECIMAL.UNSIGNED, {
        mariadb: 'DECIMAL UNSIGNED',
        mysql: 'DECIMAL UNSIGNED',
        default: 'DECIMAL',
      });

      testsql('DECIMAL.UNSIGNED.ZEROFILL', DataTypes.DECIMAL.UNSIGNED.ZEROFILL, {
        mariadb: 'DECIMAL UNSIGNED ZEROFILL',
        mysql: 'DECIMAL UNSIGNED ZEROFILL',
        default: 'DECIMAL',
      });

      testsql('DECIMAL({ precision: 10, scale: 2 }).UNSIGNED', DataTypes.DECIMAL({ precision: 10, scale: 2 }).UNSIGNED, {
        mariadb: 'DECIMAL(10,2) UNSIGNED',
        mysql: 'DECIMAL(10,2) UNSIGNED',
        default: 'DECIMAL(10,2)',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.DECIMAL(10);

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid decimal');

          expect(() => {
            type.validate('0.1a');
          }).to.throw(ValidationError, '"0.1a" is not a valid decimal');

          expect(() => {
            type.validate(Number.NaN);
          }).to.throw(ValidationError, 'null is not a valid decimal');
        });

        it('should not throw if `value` is a decimal', () => {
          const type = DataTypes.DECIMAL(10);

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

    describe('ENUM', () => {
      it('produces an enum', () => {
        const User = sequelize.define('User', {
          anEnum: DataTypes.ENUM('value 1', 'value 2'),
        });

        const enumType = User.rawAttributes.anEnum.type;
        assert(typeof enumType !== 'string');

        expectsql(enumType.toSql(), {
          postgres: '"public"."enum_Users_anEnum"',
        });
      });

      it('raises an error if no values are defined', () => {
        expect(() => {
          sequelize.define('omnomnom', {
            bla: { type: DataTypes.ENUM },
          });
        }).to.throw(Error, 'DataTypes.ENUM cannot be used without specifying its possible enum values.');
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type: DataTypeInstance = DataTypes.ENUM('foo');

          expect(() => {
            type.validate('foobar');
          }).to.throw(ValidationError, '"foobar" is not a valid choice in ["foo"]');
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
      });

      testsql('BLOB("medium")', DataTypes.BLOB('medium'), {
        default: 'MEDIUMBLOB',
        ibmi: 'BLOB(16M)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(16M)',
        postgres: 'BYTEA',
      });

      testsql('BLOB({ length: "medium" })', DataTypes.BLOB({ length: 'medium' }), {
        default: 'MEDIUMBLOB',
        ibmi: 'BLOB(16M)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(16M)',
        postgres: 'BYTEA',
      });

      testsql('BLOB("long")', DataTypes.BLOB('long'), {
        default: 'LONGBLOB',
        ibmi: 'BLOB(2G)',
        mssql: 'VARBINARY(MAX)',
        db2: 'BLOB(2G)',
        postgres: 'BYTEA',
      });

      describe('validate', () => {
        it('should throw an error if `value` is invalid', () => {
          const type = DataTypes.BLOB();

          expect(() => {
            type.validate(12_345);
          }).to.throw(ValidationError, '12345 is not a valid blob');
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
          }).to.throw(ValidationError, '"foobar" is not a valid range');
        });

        it('should throw an error if `value` is not an array with two elements', () => {
          const type = DataTypes.RANGE(DataTypes.INTEGER);

          expect(() => {
            type.validate([1]);
          }).to.throw(ValidationError, 'A range must be an array with two elements');
        });

        it('should not throw if `value` is a range', () => {
          const type = DataTypes.RANGE(DataTypes.INTEGER);

          expect(() => type.validate([1, 2])).not.to.throw();
        });
      });
    });

    describe('JSON', () => {
      // TODO: types that don't support JSON should use an equivalent to DataTypes.TEXT
      //  and add a CHECK(ISJSON) when possible.
      testsql('JSON', DataTypes.JSON, {
        default: 'JSON',
      });
    });

    describe('JSONB', () => {
      // TODO: types that don't support JSONB should throw an error.
      testsql('JSONB', DataTypes.JSONB, {
        default: 'JSONB',
      });
    });

    if (sequelize.dialect.supports.ARRAY) {
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

        testsql('ARRAY(DECIMAL)', DataTypes.ARRAY(DataTypes.DECIMAL), {
          postgres: 'DECIMAL[]',
        });

        testsql('ARRAY(DECIMAL(6))', DataTypes.ARRAY(DataTypes.DECIMAL(6)), {
          postgres: 'DECIMAL(6)[]',
        });

        testsql('ARRAY(DECIMAL(6,4))', DataTypes.ARRAY(DataTypes.DECIMAL(6, 4)), {
          postgres: 'DECIMAL(6,4)[]',
        });

        testsql('ARRAY(DOUBLE)', DataTypes.ARRAY(DataTypes.DOUBLE), {
          postgres: 'DOUBLE PRECISION[]',
        });

        testsql('ARRAY(REAL))', DataTypes.ARRAY(DataTypes.REAL), {
          postgres: 'REAL[]',
        });

        if (sequelize.dialect.supports.JSON) {
          testsql('ARRAY(JSON)', DataTypes.ARRAY(DataTypes.JSON), {
            postgres: 'JSON[]',
          });
        }

        if (sequelize.dialect.supports.JSONB) {
          testsql('ARRAY(JSONB)', DataTypes.ARRAY(DataTypes.JSONB), {
            postgres: 'JSONB[]',
          });
        }

        if (dialect === 'postgres') {
          testsql('ARRAY(CITEXT)', DataTypes.ARRAY(DataTypes.CITEXT), {
            postgres: 'CITEXT[]',
          });
        }

        it('raises an error if no values are defined', () => {
          expect(() => {
            sequelize.define('omnomnom', {
              bla: { type: DataTypes.ARRAY },
            });
          }).to.throw(Error, 'ARRAY is missing type definition for its values.');
        });

        describe('validate', () => {
          it('should throw an error if `value` is invalid', () => {
            const type = DataTypes.ARRAY(DataTypes.INTEGER);

            expect(() => {
              type.validate('foobar');
            }).to.throw(ValidationError, '"foobar" is not a valid array');
          });

          it('should not throw if `value` is an array', () => {
            const type = DataTypes.ARRAY(DataTypes.STRING);

            expect(() => type.validate(['foo', 'bar'])).not.to.throw();
          });
        });
      });
    }

    if (sequelize.dialect.supports.GEOMETRY) {
      describe('GEOMETRY', () => {
        testsql('GEOMETRY', DataTypes.GEOMETRY, {
          default: 'GEOMETRY',
        });

        testsql('GEOMETRY(\'POINT\')', DataTypes.GEOMETRY('Point'), {
          postgres: 'GEOMETRY(POINT)',
          mariadb: 'POINT',
          mysql: 'POINT',
        });

        testsql('GEOMETRY(\'LINESTRING\')', DataTypes.GEOMETRY('LineString'), {
          postgres: 'GEOMETRY(LINESTRING)',
          mariadb: 'LINESTRING',
          mysql: 'LINESTRING',
        });

        testsql('GEOMETRY(\'POLYGON\')', DataTypes.GEOMETRY('Polygon'), {
          postgres: 'GEOMETRY(POLYGON)',
          mariadb: 'POLYGON',
          mysql: 'POLYGON',
        });

        testsql('GEOMETRY(\'POINT\',4326)', DataTypes.GEOMETRY('Point', 4326), {
          postgres: 'GEOMETRY(POINT,4326)',
          mariadb: 'POINT',
          mysql: 'POINT',
        });
      });
    }

    describe('GEOGRAPHY', () => {
      testsql('GEOGRAPHY', DataTypes.GEOGRAPHY, {
        default: 'GEOGRAPHY',
      });
    });

    describe('HSTORE', () => {
      testsql('HSTORE', DataTypes.HSTORE, {
        default: 'HSTORE',
      });
    });
  });
});
