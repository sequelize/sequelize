import type {
  CreationAttributes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
} from '@sequelize/core';
import { DataTypes, Model, QueryTypes, ValidationError, fn, sql } from '@sequelize/core';
import { expect } from 'chai';
import dayjs from 'dayjs';
import DayjsTimezone from 'dayjs/plugin/timezone';
import pick from 'lodash/pick';
import moment from 'moment';
import 'moment-timezone';
import type { Moment } from 'moment-timezone';
import { Blob } from 'node:buffer';
import { allowDeprecationsInSuite, beforeAll2, sequelize, setResetMode } from '../support';

dayjs.extend(DayjsTimezone);

const dialect = sequelize.dialect;

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
  // arrays are separated by commas, this checks arrays of enums are properly parsed
  'D,E' = 'D,E',
}

describe('DataTypes', () => {
  setResetMode('none');

  // TODO: merge STRING & TEXT: remove default length limit on STRING instead of using 255.
  describe('STRING(<length>)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare stringAttr: string;
      }

      User.init(
        {
          stringAttr: {
            type: DataTypes.STRING(5),
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'stringAttr', '1235', '1235');
    });

    // TODO: add length check constraint in sqlite
    if (dialect.name !== 'sqlite3') {
      it('throws if the string is too long', async () => {
        await expect(
          vars.User.create({
            stringAttr: '123456',
          }),
        ).to.be.rejected;
      });
    }

    it('rejects non-string values', async () => {
      await expect(
        vars.User.create({
          // @ts-expect-error -- testing that this throws
          stringAttr: 12,
        }),
      ).to.be.rejectedWith(
        ValidationError,
        'Validation error: 12 is not a valid string. Only the string type is accepted for non-binary strings.',
      );

      await expect(
        vars.User.create({
          // @ts-expect-error -- testing that this throws
          stringAttr: Buffer.from('abc'),
        }),
      ).to.be.rejectedWith(
        ValidationError,
        'Validation error: <Buffer 61 62 63> is not a valid string. Only the string type is accepted for non-binary strings.',
      );
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      await testSimpleInOutRaw(vars.User, 'stringAttr', '1235', '1235');
    });
  });

  describe('STRING.BINARY', () => {
    if (!dialect.supports.dataTypes.COLLATE_BINARY) {
      it('throws if STRING.BINARY is used', () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.STRING(5).BINARY,
          });
        }).to.throwWithCause(`${dialect.name} does not support the STRING.BINARY data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryStringAttr: ArrayBuffer | string | Blob;
      }

      User.init(
        {
          binaryStringAttr: {
            type: DataTypes.STRING.BINARY,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'binaryStringAttr', 'abc', 'abc');
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      await testSimpleInOutRaw(vars.User, 'binaryStringAttr', 'abc', 'abc');
    });
  });

  describe('STRING(100).BINARY', () => {
    // previous test suite tests this error message
    if (!dialect.supports.dataTypes.COLLATE_BINARY) {
      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryStringAttr: string;
      }

      User.init(
        {
          binaryStringAttr: {
            type: DataTypes.STRING(5).BINARY,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    // TODO: add length check constraint in sqlite
    if (dialect.name !== 'sqlite3') {
      it('throws if the string is too long', async () => {
        await expect(
          vars.User.create({
            binaryStringAttr: '123456',
          }),
        ).to.be.rejected;
      });
    }
  });

  describe('TEXT', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare textAttr: string;
      }

      User.init(
        {
          textAttr: {
            type: DataTypes.TEXT,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'textAttr', '123456', '123456');
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      await testSimpleInOutRaw(vars.User, 'textAttr', 'abc', 'abc');
    });
  });

  describe(`TEXT(<size>)`, () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare tinyText: string;
        declare mediumText: string;
        declare longText: string;
      }

      User.init(
        {
          tinyText: {
            type: DataTypes.TEXT('tiny'),
            allowNull: false,
          },
          mediumText: {
            type: DataTypes.TEXT('medium'),
            allowNull: false,
          },
          longText: {
            type: DataTypes.TEXT('long'),
            allowNull: false,
          },
        },
        { sequelize, timestamps: false },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      const data = { tinyText: '123', mediumText: '456', longText: '789' };

      await vars.User.create(data);
      const user = await vars.User.findOne({ rejectOnEmpty: true });
      expect(pick(user.get(), ['tinyText', 'mediumText', 'longText'])).to.deep.eq(data);
    });

    // TODO: once we have centralized logging, check a warning message has been emitted when length is not supported:
    //  https://github.com/sequelize/sequelize/issues/11832
  });

  describe('CHAR(<length>)', () => {
    if (!dialect.supports.dataTypes.CHAR) {
      it('throws, because this dialect does not support CHAR', async () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.CHAR,
          });
        }).to.throwWithCause(`${dialect.name} does not support the CHAR data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare charAttr: string;
      }

      User.init(
        {
          charAttr: {
            type: DataTypes.CHAR(20),
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      if (dialect.name === 'mysql' || dialect.name === 'mariadb') {
        // mysql trims CHAR columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOut(vars.User, 'charAttr', '12345 ', '12345');
      } else {
        await testSimpleInOut(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
      }
    });

    it('throws if the string is too long', async () => {
      await expect(
        vars.User.create({
          charAttr: '1'.repeat(21),
        }),
      ).to.be.rejected;
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      if (dialect.name === 'mysql' || dialect.name === 'mariadb') {
        // mysql trims CHAR columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOutRaw(vars.User, 'charAttr', '12345 ', '12345');
      } else {
        await testSimpleInOutRaw(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
      }
    });
  });

  describe('CHAR(<length>).BINARY', () => {
    if (!dialect.supports.dataTypes.CHAR) {
      it('throws, because this dialect does not support CHAR', async () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.CHAR(5),
          });
        }).to.throwWithCause(`${dialect.name} does not support the CHAR data type.`);
      });

      return;
    }

    if (!dialect.supports.dataTypes.COLLATE_BINARY) {
      it('throws if CHAR.BINARY is used', () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.CHAR(5).BINARY,
          });
        }).to.throwWithCause(`${dialect.name} does not support the CHAR.BINARY data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryCharAttr: string | ArrayBuffer | Uint8Array | Blob;
      }

      User.init(
        {
          binaryCharAttr: {
            type: DataTypes.CHAR(5).BINARY,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('is serialized/deserialized as strings', async () => {
      // mysql does not pad columns, unless PAD_CHAR_TO_FULL_LENGTH is true
      if (dialect.name === 'db2') {
        await testSimpleInOut(vars.User, 'binaryCharAttr', '1234', '1234 ');
      } else {
        await testSimpleInOut(vars.User, 'binaryCharAttr', '1234', '1234');
      }
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      // mysql does not pad columns, unless PAD_CHAR_TO_FULL_LENGTH is true
      // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
      if (dialect.name === 'db2') {
        await testSimpleInOutRaw(vars.User, 'binaryCharAttr', Buffer.from(' 234'), ' 234 ');
      } else {
        await testSimpleInOutRaw(vars.User, 'binaryCharAttr', Buffer.from(' 234'), ' 234');
      }
    });
  });

  describe('CITEXT', () => {
    if (!dialect.supports.dataTypes.CITEXT) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            ciTextAttr: DataTypes.CITEXT,
          });
        }).to.throwWithCause(
          `${dialect.name} does not support the case-insensitive text (CITEXT) data type.`,
        );
      });
    } else {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare ciTextAttr: string;
        }

        User.init(
          {
            ciTextAttr: {
              type: DataTypes.CITEXT,
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('serialize/deserializes strings', async () => {
        await vars.User.create({
          ciTextAttr: 'ABCdef',
        });

        const user = await vars.User.findOne({
          rejectOnEmpty: true,
          where: { ciTextAttr: 'abcDEF' },
        });
        expect(user.ciTextAttr).to.eq('ABCdef');
      });

      it('is deserialized as a string when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'ciTextAttr', 'abcDEF', 'abcDEF');
      });
    }
  });

  describe('TSVECTOR', () => {
    if (!dialect.supports.dataTypes.TSVECTOR) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            ciTextAttr: DataTypes.TSVECTOR,
          });
        }).to.throwWithCause(`${dialect.name} does not support the TSVECTOR data type.`);
      });
    } else {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare tsvectorAttr: string;
        }

        User.init(
          {
            tsvectorAttr: {
              type: DataTypes.TSVECTOR,
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('converts strings to TSVector', async () => {
        await testSimpleInOut(
          vars.User,
          'tsvectorAttr',
          'a:1A fat:2B,4C cat:5D',
          `'a':1A 'cat':5 'fat':2B,4C`,
        );
      });

      it('accepts ts_tsvector() functions', async () => {
        await testSimpleInOut(
          vars.User,
          'tsvectorAttr',
          // @ts-expect-error -- TODO: .create()'s typings should accept fn, literal, and cast
          fn('to_tsvector', 'english', 'The Fat Rats'),
          `'fat':2 'rat':3`,
        );
      });

      it('is deserialized as a string when DataType is not specified', async () => {
        await testSimpleInOutRaw(
          vars.User,
          'tsvectorAttr',
          'a:1A fat:2B,4C cat:5D',
          `'a':1A 'cat':5 'fat':2B,4C`,
        );
      });
    }
  });

  describe('BOOLEAN', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare booleanAttr: boolean | string | number | bigint | Buffer;
      }

      User.init(
        {
          booleanAttr: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts booleans', async () => {
      await testSimpleInOut(vars.User, 'booleanAttr', true, true);
      await testSimpleInOut(vars.User, 'booleanAttr', false, false);
    });

    it('rejects numbers', async () => {
      await expect(vars.User.create({ booleanAttr: 0 })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 1 })).to.be.rejected;
    });

    // these values are allowed when parsed from the Database, but not when inputted by the user.
    it('rejects strings', async () => {
      await expect(vars.User.create({ booleanAttr: 'true' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 'false' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: '1' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: '0' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 't' })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 'f' })).to.be.rejected;
    });

    it('rejects bigints', async () => {
      await expect(vars.User.create({ booleanAttr: 1n })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: 0n })).to.be.rejected;
    });

    it('rejects buffers', async () => {
      // Some dialects use BIT for their boolean. The DB can return a buffer (which we convert to boolean),
      // but the user cannot input a buffer.
      await expect(vars.User.create({ booleanAttr: Buffer.from([0]) })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: Buffer.from([1]) })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: Buffer.from([]) })).to.be.rejected;
    });

    if (dialect.name === 'mysql' || dialect.name === 'sqlite3' || dialect.name === 'mariadb') {
      // MySQL uses TINYINT(1). We can't know if the value is a boolean if the DataType is not specified.
      // SQLite: sqlite3 does not tell us which type a column is, so we can't know if the value is a boolean.
      it('is deserialized as a number when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'booleanAttr', true, 1);
        await testSimpleInOutRaw(vars.User, 'booleanAttr', false, 0);
      });
    } else {
      it('is deserialized as a boolean when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'booleanAttr', true, true);
        await testSimpleInOutRaw(vars.User, 'booleanAttr', false, false);
      });
    }
  });

  const maxIntValueSigned = {
    TINYINT: 127,
    SMALLINT: 32_767,
    MEDIUMINT: 8_388_607,
    INTEGER: 2_147_483_647,
  };

  const minIntValueSigned = {
    TINYINT: -128,
    SMALLINT: -32_768,
    MEDIUMINT: -8_388_608,
    INTEGER: -2_147_483_648,
  };

  const maxIntValueUnsigned = {
    TINYINT: 255,
    SMALLINT: 65_535,
    MEDIUMINT: 16_777_215,
    INTEGER: 4_294_967_295,
  };

  for (const intTypeName of ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INTEGER'] as const) {
    describe(`${intTypeName} (signed)`, () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare intAttr: number | bigint | string;
        }

        User.init(
          {
            intAttr: {
              type: DataTypes[intTypeName],
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('accepts numbers, bigints, strings', async () => {
        await testSimpleInOut(vars.User, 'intAttr', 123, 123);
        await testSimpleInOut(vars.User, 'intAttr', 123n, 123);
        await testSimpleInOut(vars.User, 'intAttr', '123', 123);

        await testSimpleInOut(
          vars.User,
          'intAttr',
          maxIntValueSigned[intTypeName],
          maxIntValueSigned[intTypeName],
        );
        await testSimpleInOut(
          vars.User,
          'intAttr',
          minIntValueSigned[intTypeName],
          minIntValueSigned[intTypeName],
        );
      });

      // TODO: add check constraints on types that overflow
      it.skip('rejects out-of-range numbers', async () => {
        await expect(vars.User.create({ intAttr: maxIntValueSigned[intTypeName] + 1 })).to.be
          .rejected;
        await expect(vars.User.create({ intAttr: minIntValueSigned[intTypeName] - 1 })).to.be
          .rejected;
      });

      it('rejects non-integer numbers', async () => {
        await expect(vars.User.create({ intAttr: 123.4 })).to.be.rejected;
        await expect(vars.User.create({ intAttr: Number.NaN })).to.be.rejected;
        await expect(vars.User.create({ intAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
        await expect(vars.User.create({ intAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
      });

      it('rejects non-integer strings', async () => {
        await expect(vars.User.create({ intAttr: '' })).to.be.rejected;
        await expect(vars.User.create({ intAttr: 'abc' })).to.be.rejected;
        await expect(vars.User.create({ intAttr: '123.4' })).to.be.rejected;
      });

      it('is deserialized as a JS number when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'intAttr', 123, 123);
      });
    });

    describe(`${intTypeName}.UNSIGNED`, () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare intAttr: number | bigint | string;
        }

        User.init(
          {
            intAttr: {
              type: DataTypes[intTypeName].UNSIGNED,
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('accepts numbers, bigints, strings', async () => {
        await testSimpleInOut(vars.User, 'intAttr', 123, 123);
        await testSimpleInOut(vars.User, 'intAttr', 123n, 123);
        await testSimpleInOut(vars.User, 'intAttr', '123', 123);

        await testSimpleInOut(
          vars.User,
          'intAttr',
          maxIntValueUnsigned[intTypeName],
          maxIntValueUnsigned[intTypeName],
        );
        await testSimpleInOut(vars.User, 'intAttr', 0, 0);
      });

      // TODO: re-enable once CHECK constraints have been implemented for all dialects
      it.skip('rejects out-of-range numbers', async () => {
        await expect(vars.User.create({ intAttr: maxIntValueUnsigned[intTypeName] + 1 })).to.be
          .rejected;
        await expect(vars.User.create({ intAttr: -1 })).to.be.rejected;
      });
    });
  }

  if (dialect.supports.dataTypes.BIGINT) {
    describe('BIGINT', () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare bigintAttr: number | bigint | string;
        }

        User.init(
          {
            bigintAttr: {
              type: DataTypes.BIGINT,
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('accepts numbers, bigints, strings', async () => {
        await testSimpleInOut(vars.User, 'bigintAttr', 123, '123');
        await testSimpleInOut(vars.User, 'bigintAttr', 123n, '123');
        await testSimpleInOut(vars.User, 'bigintAttr', '123', '123');

        await testSimpleInOut(vars.User, 'bigintAttr', 9_007_199_254_740_991n, '9007199254740991');
      });

      it('does not lose precision', async () => {
        await testSimpleInOut(vars.User, 'bigintAttr', 9_007_199_254_740_993n, '9007199254740993');
        await testSimpleInOut(
          vars.User,
          'bigintAttr',
          -9_007_199_254_740_993n,
          '-9007199254740993',
        );
        await testSimpleInOut(vars.User, 'bigintAttr', '9007199254740993', '9007199254740993');
        await testSimpleInOut(vars.User, 'bigintAttr', '-9007199254740993', '-9007199254740993');
      });

      it('rejects unsafe integers', async () => {
        await expect(vars.User.create({ bigintAttr: 9_007_199_254_740_992 })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: -9_007_199_254_740_992 })).to.be.rejected;

        await expect(vars.User.create({ bigintAttr: 123.4 })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: Number.NaN })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
      });

      it('rejects non-integer strings', async () => {
        await expect(vars.User.create({ bigintAttr: '' })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: 'abc' })).to.be.rejected;
        await expect(vars.User.create({ bigintAttr: '123.4' })).to.be.rejected;
      });

      it('is deserialized as a string when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'bigintAttr', 123n, '123');
      });

      if (dialect.supports.dataTypes.INTS.unsigned) {
        describe(`BIGINT.UNSIGNED`, () => {
          const vars2 = beforeAll2(async () => {
            class User extends Model<InferAttributes<User>> {
              declare intAttr: number | bigint | string;
            }

            User.init(
              {
                intAttr: {
                  type: DataTypes.BIGINT.UNSIGNED,
                  allowNull: false,
                },
              },
              { sequelize },
            );

            await User.sync({ force: true });

            return { User };
          });

          it('rejects out-of-range numbers', async () => {
            await expect(vars2.User.create({ intAttr: 18_446_744_073_709_551_615n + 1n })).to.be
              .rejected;
            await expect(vars2.User.create({ intAttr: -1 })).to.be.rejected;
          });
        });
      }
    });
  }

  for (const attrType of ['REAL', 'DOUBLE', 'FLOAT'] as const) {
    describe(`${attrType}`, () => {
      allowDeprecationsInSuite(['SEQUELIZE0014']);

      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare attr: number | bigint | string;
        }

        User.init(
          {
            attr: {
              type: DataTypes[attrType],
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it(`accepts numbers, bigints, strings, +-Infinity`, async () => {
        await testSimpleInOut(vars.User, 'attr', 100.5, 100.5);
        await testSimpleInOut(vars.User, 'attr', 123n, 123);
        await testSimpleInOut(vars.User, 'attr', '100.5', 100.5);
      });

      it(`accepts number strings written using the scientific notation`, async () => {
        await testSimpleInOut(vars.User, 'attr', '1e2', 100);
        await testSimpleInOut(vars.User, 'attr', '5e-1', 0.5);
        await testSimpleInOut(vars.User, 'attr', '1e+2', 100);
      });

      if (dialect.supports.dataTypes[attrType].NaN) {
        it(`accepts NaN`, async () => {
          await testSimpleInOut(vars.User, 'attr', Number.NaN, Number.NaN);
        });
      } else {
        it(`rejects NaN`, async () => {
          await expect(vars.User.create({ attr: Number.NaN })).to.be.rejected;
        });
      }

      if (dialect.supports.dataTypes[attrType].infinity) {
        it(`accepts +-Infinity`, async () => {
          await testSimpleInOut(
            vars.User,
            'attr',
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
          );
          await testSimpleInOut(
            vars.User,
            'attr',
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
          );
        });
      } else {
        it(`rejects +-Infinity`, async () => {
          await expect(vars.User.create({ attr: Number.POSITIVE_INFINITY })).to.be.rejected;
          await expect(vars.User.create({ attr: Number.NEGATIVE_INFINITY })).to.be.rejected;
        });
      }

      it(`rejects non-number strings`, async () => {
        await expect(vars.User.create({ attr: '' })).to.be.rejected;
        await expect(vars.User.create({ attr: 'abc' })).to.be.rejected;
      });

      it(`is deserialized as a JS number when DataType is not specified`, async () => {
        await testSimpleInOutRaw(vars.User, 'attr', 100.5, 100.5);
        await testSimpleInOutRaw(vars.User, 'attr', 123n, 123);

        if (dialect.supports.dataTypes[attrType].NaN) {
          await testSimpleInOutRaw(vars.User, 'attr', Number.NaN, Number.NaN);
        }

        if (dialect.supports.dataTypes[attrType].infinity) {
          await testSimpleInOutRaw(
            vars.User,
            'attr',
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
          );
          await testSimpleInOutRaw(
            vars.User,
            'attr',
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
          );
        }
      });
    });

    // TODO: re-enable once CHECK constraints have been implemented for all dialects
    describe.skip(`${attrType}.UNSIGNED`, () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare attr: number | bigint | string;
        }

        User.init(
          {
            attr: {
              type: DataTypes[attrType].UNSIGNED,
              allowNull: false,
            },
          },
          { sequelize },
        );

        await User.sync({ force: true });

        return { User };
      });

      it(`${attrType}.UNSIGNED rejects negative numbers`, async () => {
        await expect(vars.User.create({ attr: -1 })).to.be.rejected;
      });
    });
  }

  describe('DECIMAL (unconstrained)', () => {
    const decimalSupport = dialect.supports.dataTypes.DECIMAL;
    if (!decimalSupport) {
      it('throws, as DECIMAL is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.DECIMAL,
          });
        }).to.throwWithCause(`${dialect.name} does not support the DECIMAL data type.`);
      });

      return;
    }

    if (!decimalSupport.unconstrained) {
      it('throws, as unconstrained DECIMAL is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.DECIMAL,
          });
        }).to.throwWithCause(`${dialect.name} does not support unconstrained DECIMAL types.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare decimalAttr: number | bigint | string;
      }

      User.init(
        {
          decimalAttr: {
            type: DataTypes.DECIMAL,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'decimalAttr', 123.4, '123.4');
      await testSimpleInOut(vars.User, 'decimalAttr', 123n, '123');
      await testSimpleInOut(vars.User, 'decimalAttr', '123.4', '123.4');
    });

    if (decimalSupport.NaN) {
      it('accepts NaN', async () => {
        await testSimpleInOut(vars.User, 'decimalAttr', Number.NaN, Number.NaN);
      });
    } else {
      it('rejects NaN', async () => {
        await expect(vars.User.create({ decimalAttr: Number.NaN })).to.be.rejected;
      });
    }

    it('rejects unsafe integers', async () => {
      await expect(vars.User.create({ decimalAttr: 9_007_199_254_740_992 })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: -9_007_199_254_740_992 })).to.be.rejected;
    });

    it('rejects non-representable values', async () => {
      await expect(vars.User.create({ decimalAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: 'abc' })).to.be.rejected;
    });

    if (dialect.name === 'sqlite3') {
      // sqlite3 doesn't give us a way to do sql type-based parsing, *and* returns bigints as js numbers.
      // this behavior is undesired but is still tested against to ensure we update this test when this is finally fixed.
      it('is deserialized as a number when DataType is not specified (undesired sqlite limitation)', async () => {
        await testSimpleInOutRaw(vars.User, 'decimalAttr', 123n, 123);
      });
    } else {
      it(`is deserialized as a string when DataType is not specified`, async () => {
        await testSimpleInOutRaw(vars.User, 'decimalAttr', 123n, '123');
      });
    }
  });

  describe('DECIMAL (constrained)', () => {
    const decimalSupport = dialect.supports.dataTypes.DECIMAL;
    // DECIMAL (unconstrained) already tests this & constrained falls back to unconstrained
    if (!decimalSupport || decimalSupport.constrained) {
      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare decimalAttr: number | bigint | string;
      }

      User.init(
        {
          decimalAttr: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        123.4,
        dialect.name === 'mssql' ? '123.4' : '123.40',
      );
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        123n,
        dialect.name === 'mssql' ? '123' : '123.00',
      );
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        '123.4',
        dialect.name === 'mssql' ? '123.4' : '123.40',
      );
      await testSimpleInOut(vars.User, 'decimalAttr', '123.451', '123.45');
    });

    if (decimalSupport.NaN) {
      it('accepts NaN', async () => {
        await testSimpleInOut(vars.User, 'decimalAttr', Number.NaN, Number.NaN);
      });
    } else {
      it('rejects NaN', async () => {
        await expect(vars.User.create({ decimalAttr: Number.NaN })).to.be.rejected;
      });
    }

    it('does not lose precision', async () => {
      // FIXME: Tedious parses Decimal as a JS number, which loses precision.
      //  https://github.com/tediousjs/tedious/issues/678
      if (dialect.name === 'mssql') {
        return;
      }

      // This ensures the value is not accidentally parsed as a JS number.
      // 9007199254740993 is not representable as a JS number, and gets rounded to 9007199254740992
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        9_007_199_254_740_993n,
        '9007199254740993.00',
      );
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        -9_007_199_254_740_993n,
        '-9007199254740993.00',
      );
      await testSimpleInOut(vars.User, 'decimalAttr', '9007199254740993.12', '9007199254740993.12');
      await testSimpleInOut(
        vars.User,
        'decimalAttr',
        '-9007199254740993.12',
        '-9007199254740993.12',
      );
    });

    it('rejects unsafe integers', async () => {
      await expect(vars.User.create({ decimalAttr: 9_007_199_254_740_992 })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: -9_007_199_254_740_992 })).to.be.rejected;
    });

    it('rejects non-representable values', async () => {
      await expect(vars.User.create({ decimalAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: '' })).to.be.rejected;
      await expect(vars.User.create({ decimalAttr: 'abc' })).to.be.rejected;
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(
        vars.User,
        'decimalAttr',
        123n,
        dialect.name === 'mssql' ? '123' : '123.00',
      );
    });
  });

  // TODO: enable once CHECK constraints have been added to all dialects
  describe.skip('DECIMAL.UNSIGNED', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare decimalAttr: number | bigint | string;
      }

      User.init(
        {
          decimalAttr: {
            type: DataTypes.DECIMAL(10, 2).UNSIGNED,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('rejects negative numbers', async () => {
      await expect(vars.User.create({ decimalAttr: -1 })).to.be.rejected;
    });
  });

  describe('DATE', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare dateAttr: Date | string | number | Moment | dayjs.Dayjs;
      }

      User.init(
        {
          dateAttr: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts Date objects, strings', async () => {
      const date = new Date('2022-01-01T00:00:00Z');

      await testSimpleInOut(vars.User, 'dateAttr', date, date);
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', date);

      // parses DateOnly string inputs as UTC, not local time
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01', date);

      // timestamp
      await testSimpleInOut(vars.User, 'dateAttr', 1_640_995_200_000, date);
    });

    it('handles timezones (moment)', async () => {
      await testSimpleInOut(
        vars.User,
        'dateAttr',
        moment.tz('2014-06-01 12:00', 'America/New_York'),
        new Date('2014-06-01T16:00:00.000Z'),
      );
    });

    it('handles timezones (dayjs)', async () => {
      await testSimpleInOut(
        vars.User,
        'dateAttr',
        dayjs.tz('2014-06-01 12:00', 'America/New_York'),
        new Date('2014-06-01T16:00:00.000Z'),
      );
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(
        vars.User,
        'dateAttr',
        '2022-01-01T00:00:00Z',
        dialect.name === 'mssql'
          ? '2022-01-01 00:00:00.000+00'
          : // sqlite decided to have a weird format that is not ISO 8601 compliant
            dialect.name === 'sqlite3'
            ? '2022-01-01 00:00:00.000 +00:00'
            : dialect.name === 'db2'
              ? '2022-01-01 00:00:00.000000+00'
              : '2022-01-01 00:00:00+00',
      );
    });
  });

  describe('DATE(precision)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare dateMinPrecisionAttr: Date | string | null;
        declare dateTwoPrecisionAttr: Date | string | null;
        declare dateMaxPrecisionAttr: Date | string | null;
      }

      User.init(
        {
          dateMinPrecisionAttr: {
            type: DataTypes.DATE(0),
            allowNull: true,
          },
          dateTwoPrecisionAttr: {
            type: DataTypes.DATE(2),
            allowNull: true,
          },
          dateMaxPrecisionAttr: {
            type: DataTypes.DATE(6),
            allowNull: true,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('clamps to specified precision', async () => {
      // sqlite does not support restricting the precision
      if (dialect.name !== 'sqlite3') {
        await testSimpleInOut(
          vars.User,
          'dateMinPrecisionAttr',
          '2022-01-01T12:13:14.123Z',
          new Date('2022-01-01T12:13:14.000Z'),
        );
        await testSimpleInOut(
          vars.User,
          'dateTwoPrecisionAttr',
          '2022-01-01T12:13:14.123Z',
          new Date('2022-01-01T12:13:14.120Z'),
        );

        // Date is also used for inserting, so we also lose precision during insert.
        if (dialect.name === 'mysql' || dialect.name === 'mariadb' || dialect.name === 'db2') {
          await testSimpleInOutRaw(
            vars.User,
            'dateMaxPrecisionAttr',
            '2022-01-01T12:13:14.123456Z',
            '2022-01-01 12:13:14.123000+00',
          );
        } else {
          await testSimpleInOutRaw(
            vars.User,
            'dateMaxPrecisionAttr',
            '2022-01-01T12:13:14.123456Z',
            '2022-01-01 12:13:14.123+00',
          );
        }
      }

      // The Date object doesn't go further than milliseconds.
      await testSimpleInOut(
        vars.User,
        'dateMaxPrecisionAttr',
        '2022-01-01T12:13:14.123456Z',
        new Date('2022-01-01T12:13:14.123Z'),
      );
    });
  });

  describe('DATEONLY', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare dateAttr: string | Date | null;
        declare id: CreationOptional<number>;
      }

      User.init(
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          dateAttr: DataTypes.DATEONLY,
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01', '2022-01-01');
    });

    it('should return set DATEONLY field to NULL correctly', async () => {
      const testDate = '2022-01-01';

      const record2 = await vars.User.create({ dateAttr: testDate });
      expect(record2.dateAttr).to.eq(testDate);

      const record1 = await vars.User.findByPk(record2.id, { rejectOnEmpty: true });
      expect(record1.dateAttr).to.eq(testDate);

      const record0 = await record1.update({
        dateAttr: null,
      });

      const record = await record0.reload();
      expect(record.dateAttr).to.be.eql(null);
    });

    it('does not offset its input based on the system time zone (#10982)', async () => {
      const tz = process.env.TZ;

      process.env.TZ = 'GMT-24';

      try {
        await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01', '2022-01-01');
        await testSimpleInOut(vars.User, 'dateAttr', new Date('2022-01-01'), '2022-01-01');
      } finally {
        process.env.TZ = tz;
      }
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'dateAttr', '2022-01-01', '2022-01-01');
    });
  });

  describe('TIME(precision)', () => {
    if (!dialect.supports.dataTypes.TIME.precision) {
      it('throws, as TIME(precision) is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.TIME(2),
          });
        }).to.throwWithCause(`${dialect.name} does not support the TIME(precision) data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare timeMinPrecisionAttr: string | null;
        declare timeTwoPrecisionAttr: string | null;
        declare timeMaxPrecisionAttr: string | null;
      }

      User.init(
        {
          timeMinPrecisionAttr: DataTypes.TIME(0),
          timeTwoPrecisionAttr: DataTypes.TIME(2),
          timeMaxPrecisionAttr: DataTypes.TIME(6),
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(
        vars.User,
        'timeMinPrecisionAttr',
        '04:05:06.123456',
        dialect.name === 'mssql'
          ? '04:05:06.000'
          : // sqlite3 does not support restricting the precision of TIME
            dialect.name === 'sqlite3'
            ? '04:05:06.123456'
            : '04:05:06',
      );

      await testSimpleInOut(
        vars.User,
        'timeTwoPrecisionAttr',
        '04:05:06.123456',
        dialect.name === 'mssql'
          ? '04:05:06.120'
          : // sqlite3 does not support restricting the precision of TIME
            dialect.name === 'sqlite3'
            ? '04:05:06.123456'
            : '04:05:06.12',
      );

      // FIXME: Tedious loses precision because it pre-parses TIME as a JS Date object
      //  https://github.com/tediousjs/tedious/issues/678
      await testSimpleInOut(
        vars.User,
        'timeMaxPrecisionAttr',
        '04:05:06.123456',
        dialect.name === 'mssql' ? '04:05:06.123' : '04:05:06.123456',
      );
    });
  });

  describe('UUID', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.UUID,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    const uuidV1 = '4b39e726-d455-11ec-9d64-0242ac120002';
    const uuidV4 = '48fbbb25-b00c-4711-add4-fae864a09d8d';

    it('accepts UUID strings', async () => {
      await testSimpleInOut(vars.User, 'attr', uuidV1, uuidV1);
      await testSimpleInOut(vars.User, 'attr', uuidV4, uuidV4);
    });

    it('rejects non-UUID strings', async () => {
      await expect(vars.User.create({ attr: 'not-a-uuid-at-all' })).to.be.rejected;
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', uuidV4, uuidV4);
    });
  });

  describe('UUID default values', () => {
    beforeAll2(async () => {
      if (dialect.name === 'postgres') {
        await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      }
    });

    it('supports sql.uuidV1', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare attr: CreationOptional<string>;
      }

      User.init(
        {
          attr: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV1,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      const user = await User.create({});
      expect(user.attr).to.not.be.empty;
    });

    it('supports sql.uuidV1.asJavaScript', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare attr: CreationOptional<string>;
      }

      User.init(
        {
          attr: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV1.asJavaScript,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      const user = await User.create({});
      expect(user.attr).to.not.be.empty;
    });

    it('supports sql.uuidV4', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare attr: CreationOptional<string>;
      }

      User.init(
        {
          attr: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      const user = await User.create({});
      expect(user.attr).to.not.be.empty;
    });

    it('supports sql.uuidV4.asJavaScript', async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare attr: CreationOptional<string>;
      }

      User.init(
        {
          attr: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4.asJavaScript,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      const user = await User.create({});
      expect(user.attr).to.not.be.empty;
    });
  });

  describe('BLOB', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: ArrayBuffer | string | Buffer | Uint8Array;
      }

      User.init(
        {
          attr: {
            type: DataTypes.BLOB,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'attr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
    });

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      // Uint8Arrays
      await testSimpleInOut(
        vars.User,
        'attr',
        new Uint8Array([49, 50, 51, 52]),
        Buffer.from([49, 50, 51, 52]),
      );
      // ArrayBuffer
      await testSimpleInOut(
        vars.User,
        'attr',
        new Uint8Array([49, 50, 51, 52]).buffer,
        Buffer.from([49, 50, 51, 52]),
      );
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(
          vars.User.create({
            // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- error only appears in TS 5.5+
            // @ts-ignore -- intentionally testing invalid input
            attr: new Blob(['abcd']),
          }),
        ).to.be.rejectedWith(
          ValidationError,
          'Validation error: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.',
        );

        await expect(
          vars.User.create({
            // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- error only appears in TS 5.5+
            // @ts-ignore -- intentionally testing invalid input
            attr: new Uint16Array([49, 50, 51, 52]),
          }),
        ).to.be.rejectedWith(
          ValidationError,
          'Validation error: Uint16Array(4) [ 49, 50, 51, 52 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.',
        );
      });
    }

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', 'abc', Buffer.from([97, 98, 99]));
    });

    it(`is deserialized as a Buffer when DataType is not specified`, async () => {
      await testSimpleInOutRaw(
        vars.User,
        'attr',
        new Uint8Array([49, 50, 51, 52]),
        Buffer.from([49, 50, 51, 52]),
      );
    });
  });

  for (const jsonTypeName of ['JSON', 'JSONB'] as const) {
    const JsonType = DataTypes[jsonTypeName];
    describe(`DataTypes.${jsonTypeName}`, () => {
      if (!dialect.supports.dataTypes[jsonTypeName]) {
        it('throws, as it is not supported', async () => {
          expect(() => {
            sequelize.define('User', {
              attr: JsonType,
            });
          }).to.throwWithCause(`${dialect.name} does not support the ${jsonTypeName} data type.`);
        });

        return;
      }

      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare jsonStr: string;
          declare jsonBoolean: boolean;
          declare jsonNumber: number;
          declare jsonArray: any[];
          declare jsonObject: object;
          declare jsonNull: any;
        }

        User.init(
          {
            // test default values are properly serialized
            jsonStr: {
              type: JsonType,
              allowNull: false,
              defaultValue: 'abc',
            },
            jsonBoolean: {
              type: JsonType,
              allowNull: false,
              defaultValue: true,
            },
            jsonNumber: {
              type: JsonType,
              allowNull: false,
              defaultValue: 1,
            },
            jsonArray: {
              type: JsonType,
              allowNull: false,
              defaultValue: ['a', 'b'],
            },
            jsonObject: {
              type: JsonType,
              allowNull: false,
              defaultValue: { key: 'abc' },
            },
            jsonNull: {
              type: JsonType,
              allowNull: true,
            },
          },
          { sequelize, timestamps: false },
        );

        await User.sync({ force: true });

        return { User };
      });

      it('produces the right DataType in the database', async () => {
        const table = await sequelize.queryInterface.describeTable(vars.User.table);
        switch (dialect.name) {
          // mssql & sqlite use text columns with CHECK constraints
          case 'mssql':
            expect(table.jsonStr.type).to.equal('NVARCHAR(MAX)');
            break;
          case 'sqlite3':
            expect(table.jsonStr.type).to.equal('TEXT');
            break;
          case 'mariadb':
            // TODO: expected for mariadb 10.4 : https://jira.mariadb.org/browse/MDEV-15558
            expect(table.jsonStr.type).to.equal('LONGTEXT');
            break;
          default:
            expect(table.jsonStr.type).to.equal(jsonTypeName);
        }
      });

      it('properly serializes default values', async () => {
        const createdUser = await vars.User.create();
        await createdUser.reload();
        expect(createdUser.get()).to.deep.eq({
          jsonStr: 'abc',
          jsonBoolean: true,
          jsonNumber: 1,
          jsonNull: null,
          jsonArray: ['a', 'b'],
          jsonObject: { key: 'abc' },
          id: 1,
        });
      });

      it('properly serializes values', async () => {
        await testSimpleInOut(vars.User, 'jsonStr', 'abc', 'abc');
        await testSimpleInOut(vars.User, 'jsonBoolean', true, true);
        await testSimpleInOut(vars.User, 'jsonBoolean', false, false);
        await testSimpleInOut(vars.User, 'jsonNumber', 123.4, 123.4);
        await testSimpleInOut(vars.User, 'jsonArray', [1, 2], [1, 2]);
        await testSimpleInOut(vars.User, 'jsonObject', { a: 1 }, { a: 1 });
        await testSimpleInOut(vars.User, 'jsonNull', null, null);
      });

      // MariaDB: supports a JSON type, but:
      // - MariaDB 10.5 says it's a JSON col, on which we enabled automatic JSON parsing.
      // - MariaDB 10.4 says it's a string, so we can't parse it based on the type.
      // TODO [2024-06-18]: Re-enable this test when we drop support for MariaDB < 10.5
      if (dialect.name !== 'mariadb') {
        if (dialect.name === 'mssql' || dialect.name === 'sqlite3') {
          // MSSQL: does not have a JSON type, so we can't parse it if our DataType is not specified.
          // SQLite: sqlite3 does not tell us the type of a column, we cannot parse based on it.
          it(`is deserialized as a JSON string value when DataType is not specified`, async () => {
            await testSimpleInOutRaw(vars.User, 'jsonStr', 'abc', '"abc"');
            await testSimpleInOutRaw(vars.User, 'jsonBoolean', true, 'true');
            await testSimpleInOutRaw(vars.User, 'jsonBoolean', false, 'false');
            // node-sqlite3 quirk: it returns this value as a JS number for some reason.
            await testSimpleInOutRaw(vars.User, 'jsonNumber', 123.4, '123.4');
            await testSimpleInOutRaw(vars.User, 'jsonArray', [1, 2], '[1,2]');
            await testSimpleInOutRaw(vars.User, 'jsonObject', { a: 1 }, '{"a":1}');
            await testSimpleInOutRaw(vars.User, 'jsonNull', null, 'null');
          });
        } else {
          it(`is deserialized as a parsed JSON value when DataType is not specified`, async () => {
            await testSimpleInOutRaw(vars.User, 'jsonStr', 'abc', 'abc');
            await testSimpleInOutRaw(vars.User, 'jsonBoolean', true, true);
            await testSimpleInOutRaw(vars.User, 'jsonBoolean', false, false);
            await testSimpleInOutRaw(vars.User, 'jsonNumber', 123.4, 123.4);
            await testSimpleInOutRaw(vars.User, 'jsonArray', [1, 2], [1, 2]);
            await testSimpleInOutRaw(vars.User, 'jsonObject', { a: 1 }, { a: 1 });
            await testSimpleInOutRaw(vars.User, 'jsonNull', null, null);
          });
        }
      }
    });
  }

  describe('HSTORE', () => {
    if (!dialect.supports.dataTypes.HSTORE) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.HSTORE,
          });
        }).to.throwWithCause(`${dialect.name} does not support the HSTORE data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: Record<string, string> | string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.HSTORE,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    const hash = { key1: 'value1', key2: 'value2' };

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'attr', hash, hash);
    });

    it(`is deserialized as a parsed record when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', hash, hash);
    });

    it('rejects hstores that contain non-string values', async () => {
      await expect(
        vars.User.create({
          // @ts-expect-error -- key2 cannot be an int in a hstore.
          attr: { key1: 'value1', key2: 1 },
        }),
      ).to.be.rejected;
    });
  });

  describe('ARRAY', () => {
    if (!dialect.supports.dataTypes.ARRAY) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.ARRAY(DataTypes.INTEGER),
          });
        }).to.throwWithCause(`${dialect.name} does not support the ARRAY data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare enumArray: TestEnum[] | null;
        declare intArray: Array<string | number | bigint> | null;
        declare bigintArray: Array<string | number | bigint> | null;
        declare booleanArray: Array<string | number | bigint | boolean> | null;
        declare dateArray: Array<string | Date> | null;
        declare stringArray: string[];
        declare arrayOfArrayOfStrings: string[][];
      }

      User.init(
        {
          enumArray: DataTypes.ARRAY(DataTypes.ENUM(Object.values(TestEnum))),
          intArray: DataTypes.ARRAY(DataTypes.INTEGER),
          bigintArray: DataTypes.ARRAY(DataTypes.BIGINT),
          booleanArray: DataTypes.ARRAY(DataTypes.BOOLEAN),
          dateArray: DataTypes.ARRAY(DataTypes.DATE),
          stringArray: DataTypes.ARRAY(DataTypes.TEXT),
          arrayOfArrayOfStrings: DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.TEXT)),
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes arrays', async () => {
      await testSimpleInOut(
        vars.User,
        'enumArray',
        [TestEnum.A, TestEnum.B, TestEnum['D,E']],
        [TestEnum.A, TestEnum.B, TestEnum['D,E']],
      );
      await testSimpleInOut(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
      await testSimpleInOut(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
      await testSimpleInOut(vars.User, 'booleanArray', [true, false], [true, false]);
      await testSimpleInOut(
        vars.User,
        'dateArray',
        ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')],
        [new Date('2022-01-01T00:00:00Z'), new Date('2022-01-01T00:00:00Z')],
      );
      await testSimpleInOut(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
      await testSimpleInOut(
        vars.User,
        'arrayOfArrayOfStrings',
        [
          ['a', 'b,c'],
          ['c', 'd'],
        ],
        [
          ['a', 'b,c'],
          ['c', 'd'],
        ],
      );
    });

    it(`is deserialized as a parsed array when DataType is not specified`, async () => {
      await testSimpleInOutRaw(
        vars.User,
        'enumArray',
        [TestEnum.A, TestEnum.B, TestEnum['D,E']],
        [TestEnum.A, TestEnum.B, TestEnum['D,E']],
      );
      await testSimpleInOutRaw(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
      await testSimpleInOutRaw(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
      await testSimpleInOutRaw(vars.User, 'booleanArray', [true, false], [true, false]);
      await testSimpleInOutRaw(
        vars.User,
        'dateArray',
        ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')],
        ['2022-01-01 00:00:00+00', '2022-01-01 00:00:00+00'],
      );
      await testSimpleInOutRaw(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
      await testSimpleInOutRaw(
        vars.User,
        'arrayOfArrayOfStrings',
        [
          ['a', 'b,c'],
          ['c', 'd'],
        ],
        [
          ['a', 'b,c'],
          ['c', 'd'],
        ],
      );
    });

    it('rejects non-array values', async () => {
      await expect(
        vars.User.create({
          // @ts-expect-error -- we're voluntarily going against the typing to test that it fails.
          booleanArray: 1,
        }),
      ).to.be.rejected;
    });
  });

  describe('CIDR', () => {
    if (!dialect.supports.dataTypes.CIDR) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.CIDR,
          });
        }).to.throwWithCause(`${dialect.name} does not support the CIDR data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.CIDR,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '10.1.2.3/32', '10.1.2.3/32');
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', '10.1.2.3/32', '10.1.2.3/32');
    });
  });

  describe('INET', () => {
    if (!dialect.supports.dataTypes.INET) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.INET,
          });
        }).to.throwWithCause(`${dialect.name} does not support the INET data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.INET,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '127.0.0.1', '127.0.0.1');
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', '127.0.0.1', '127.0.0.1');
    });
  });

  describe('MACADDR', () => {
    if (!dialect.supports.dataTypes.MACADDR) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.MACADDR,
          });
        }).to.throwWithCause(`${dialect.name} does not support the MACADDR data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.MACADDR,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', '01:23:45:67:89:ab', '01:23:45:67:89:ab');
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', '01:23:45:67:89:ab', '01:23:45:67:89:ab');
    });
  });

  describe('MACADDR8', () => {
    if (!dialect.supports.dataTypes.MACADDR8) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            attr: DataTypes.MACADDR8,
          });
        }).to.throwWithCause(`${dialect.name} does not support the MACADDR8 data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init(
        {
          attr: {
            type: DataTypes.MACADDR8,
            allowNull: false,
          },
        },
        { sequelize },
      );

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(
        vars.User,
        'attr',
        '01:23:45:67:89:ab:cd:ef',
        '01:23:45:67:89:ab:cd:ef',
      );
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(
        vars.User,
        'attr',
        '01:23:45:67:89:ab:cd:ef',
        '01:23:45:67:89:ab:cd:ef',
      );
    });
  });
});

export async function testSimpleInOut<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: CreationAttributes<M>[Key],
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });
  const fetchedUser = await model.findOne({
    rejectOnEmpty: true,
    where: {
      // @ts-expect-error -- it's not worth it to type .id for these internal tests.
      id: createdUser.id,
    },
  });
  expect(fetchedUser[attributeName]).to.deep.eq(outVal, message);
}

export async function testSimpleInOutRaw<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: unknown,
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });

  const quotedTableName = model.queryGenerator.quoteIdentifier(model.tableName);
  const quotedId = model.queryGenerator.quoteIdentifier('id');
  const fetchedUser = await model.sequelize.query<any>(
    `SELECT * FROM ${quotedTableName} WHERE ${quotedId} = :id`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        // @ts-expect-error -- it's not worth it to type .id for these internal tests.
        id: createdUser.id,
      },
    },
  );

  expect(fetchedUser[0][attributeName]).to.deep.eq(outVal, message);
}
