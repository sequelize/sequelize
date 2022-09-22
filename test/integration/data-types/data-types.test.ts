import { Blob } from 'node:buffer';
import type {
  CreationAttributes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
} from '@sequelize/core';
import { DataTypes, fn, Model, QueryTypes, ValidationError } from '@sequelize/core';
import { expect } from 'chai';
import dayjs from 'dayjs';
import DayjsTimezone from 'dayjs/plugin/timezone';
import moment from 'moment';
import 'moment-timezone';
import type { Moment } from 'moment-timezone';
import { beforeAll2, disableDatabaseResetForSuite, sequelize } from '../support';

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
  disableDatabaseResetForSuite();

  describe('STRING(<length>)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare stringAttr: string;
      }

      User.init({
        stringAttr: {
          type: DataTypes.STRING(5),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      await testSimpleInOut(vars.User, 'stringAttr', '1235', '1235');
    });

    it('throws if the string is too long', async () => {
      await expect(vars.User.create({
        stringAttr: '123456',
      })).to.be.rejected;
    });

    it('rejects non-string values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error
        stringAttr: 12,
      })).to.be.rejectedWith(ValidationError, 'Validation error: 12 is not a valid string. Only the string type is accepted for non-binary strings.');
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      await testSimpleInOutRaw(vars.User, 'stringAttr', '1235', '1235');
    });
  });

  describe('STRING.BINARY', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryStringAttr: ArrayBuffer | string | Blob;
      }

      User.init({
        binaryStringAttr: {
          type: DataTypes.STRING.BINARY,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'binaryStringAttr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
    });

    // unfortunately mysql2's typecast function does not let us know whether the string is binary or not.
    // we cannot normalize this ourselves, it must remain a string.
    if (dialect.name === 'mysql') {
      it('is deserialized as a string when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'binaryStringAttr', 'abc', 'abc');
      });
    } else {
      it('is deserialized as a buffer when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'binaryStringAttr', 'abc', Buffer.from([97, 98, 99]));
      });
    }

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      // Uint8Arrays
      await testSimpleInOut(vars.User, 'binaryStringAttr', new Uint8Array([97, 98, 99]), Buffer.from([97, 98, 99]));
      // ArrayBuffer
      await testSimpleInOut(vars.User, 'binaryStringAttr', new Uint8Array([97, 98, 99]).buffer, Buffer.from([97, 98, 99]));
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(vars.User.create({
          binaryStringAttr: new Blob(['abc']),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

        await expect(vars.User.create({
          binaryStringAttr: new Uint16Array([97, 98, 99]),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Uint16Array(3) [ 97, 98, 99 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
      });
    }

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'binaryStringAttr', 'abc', Buffer.from([97, 98, 99]));
    });
  });

  describe('STRING(100).BINARY', () => {
    if (dialect.name === 'postgres') {
      // TODO: once we have centralized logging, check a warning message has been emitted:
      //  https://github.com/sequelize/sequelize/issues/11670
      it.skip('throws, because postgres does not support setting a limit on binary strings', async () => {
        sequelize.define('User', {
          binaryStringAttr: {
            type: DataTypes.STRING(5).BINARY,
            allowNull: false,
          },
        });
      });
    } else {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare binaryStringAttr: string;
        }

        User.init({
          binaryStringAttr: {
            type: DataTypes.STRING(5).BINARY,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      // We want to have this, but is 'length' the number of bytes or the number of characters?
      // More research needed.
      it('throws if the string is too long', async () => {
        await expect(vars.User.create({
          binaryStringAttr: '123456',
        })).to.be.rejected;
      });
    }
  });

  describe('TEXT', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare textAttr: string;
      }

      User.init({
        textAttr: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      }, { sequelize });

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

      User.init({
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
      }, { sequelize, timestamps: false, noPrimaryKey: true });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      const data = { tinyText: '123', mediumText: '456', longText: '789' };

      await vars.User.create(data);
      const user = await vars.User.findOne({ rejectOnEmpty: true });
      expect(user.get()).to.deep.eq(data);
    });

    // TODO: once we have centralized logging, check a warning message has been emitted when length is not supported:
    //  https://github.com/sequelize/sequelize/issues/11670
  });

  describe('CHAR(<length>)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare charAttr: string;
      }

      User.init({
        charAttr: {
          type: DataTypes.CHAR(20),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes strings', async () => {
      if (dialect.name === 'mysql') {
        // mysql trims CHAR columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOut(vars.User, 'charAttr', '12345 ', '12345');
      } else {
        await testSimpleInOut(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
      }
    });

    it('throws if the string is too long', async () => {
      await expect(vars.User.create({
        charAttr: '1'.repeat(21),
      })).to.be.rejected;
    });

    it('is deserialized as a string when DataType is not specified', async () => {
      if (dialect.name === 'mysql') {
        // mysql trims CHAR columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOutRaw(vars.User, 'charAttr', '12345 ', '12345');
      } else {
        await testSimpleInOutRaw(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
      }
    });
  });

  describe('CHAR(<length>).BINARY', () => {
    if (!dialect.supports.dataTypes.CHAR.BINARY) {
      it('throws if CHAR.BINARY is used', () => {
        expect(() => {
          sequelize.define('CrashedModel', {
            attr: DataTypes.CHAR.BINARY,
          });
        }).to.throwWithCause(`${dialect.name} does not support the CHAR.BINARY data type.`);
      });

      return;
    }

    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryCharAttr: string | ArrayBuffer | Uint8Array | Blob;
      }

      User.init({
        binaryCharAttr: {
          type: DataTypes.CHAR(5).BINARY,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes buffers with padding if the length is insufficient', async () => {
      if (dialect.name === 'mysql') {
        // mysql does not pad columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOut(vars.User, 'binaryCharAttr', Buffer.from(' 234'), Buffer.from([32, 50, 51, 52]));
      } else {
        await testSimpleInOut(vars.User, 'binaryCharAttr', Buffer.from('1234'), Buffer.from([32, 49, 50, 51, 52]));
      }
    });

    // unfortunately mysql2's typecast function does not let us know whether the string is binary or not.
    // we cannot normalize this ourselves, it must remain a string.
    if (dialect.name === 'mysql') {
      it('is deserialized as a string when DataType is not specified', async () => {
        // mysql does not pad columns, unless PAD_CHAR_TO_FULL_LENGTH is true
        // https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html#sqlmode_pad_char_to_full_length
        await testSimpleInOutRaw(vars.User, 'binaryCharAttr', Buffer.from(' 234'), ' 234');
      });
    } else {
      it('is deserialized as a buffer when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'binaryCharAttr', Buffer.from('1234'), Buffer.from([32, 49, 50, 51, 52]));
      });
    }

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      const result = dialect.name === 'mysql' ? Buffer.from([49, 50, 51, 52]) : Buffer.from([32, 49, 50, 51, 52]);

      // Uint8Arrays
      await testSimpleInOut(vars.User, 'binaryCharAttr', new Uint8Array([49, 50, 51, 52]), result);
      // ArrayBuffer
      await testSimpleInOut(vars.User, 'binaryCharAttr', new Uint8Array([49, 50, 51, 52]).buffer, result);
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(vars.User.create({
          binaryCharAttr: new Blob(['abcd']),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

        await expect(vars.User.create({
          binaryCharAttr: new Uint16Array([49, 50, 51, 52]),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Uint16Array(4) [ 49, 50, 51, 52 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
      });
    }

    it('accepts strings', async () => {
      const result = dialect.name === 'mysql' ? Buffer.from([49, 50, 51, 52]) : Buffer.from([32, 49, 50, 51, 52]);

      await testSimpleInOut(vars.User, 'binaryCharAttr', '1234', Buffer.from(result));
    });
  });

  describe('CITEXT', () => {
    if (!dialect.supports.dataTypes.CITEXT) {
      it('throws, as it is not supported', async () => {
        expect(() => {
          sequelize.define('User', {
            ciTextAttr: DataTypes.CITEXT,
          });
        }).to.throwWithCause(`${dialect.name} does not support the CITEXT data type.`);
      });
    } else {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare ciTextAttr: string;
        }

        User.init({
          ciTextAttr: {
            type: DataTypes.CITEXT,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('serialize/deserializes strings', async () => {
        await vars.User.create({
          ciTextAttr: 'ABCdef',
        });

        const user = await vars.User.findOne({ rejectOnEmpty: true, where: { ciTextAttr: 'abcDEF' } });
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
        }).to.throwWithCause(`${dialect.name} does not support the TSVECTOR DataType.`);
      });
    } else {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare tsvectorAttr: string;
        }

        User.init({
          tsvectorAttr: {
            type: DataTypes.TSVECTOR,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('converts strings to TSVector', async () => {
        await testSimpleInOut(vars.User, 'tsvectorAttr', 'a:1A fat:2B,4C cat:5D', `'a':1A 'cat':5 'fat':2B,4C`);
      });

      it('accepts ts_tsvector() functions', async () => {
        await testSimpleInOut(
          vars.User,
          'tsvectorAttr',
          // TODO: .create()'s typings should accept fn, literal, and cast
          // @ts-expect-error
          fn('to_tsvector', 'english', 'The Fat Rats'),
          `'fat':2 'rat':3`,
        );
      });

      it('is deserialized as a string when DataType is not specified', async () => {
        await testSimpleInOutRaw(vars.User, 'tsvectorAttr', 'a:1A fat:2B,4C cat:5D', `'a':1A 'cat':5 'fat':2B,4C`);
      });
    }
  });

  describe('BOOLEAN', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare booleanAttr: boolean | string | number | bigint | Buffer;
      }

      User.init({
        booleanAttr: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts booleans', async () => {
      await testSimpleInOut(vars.User, 'booleanAttr', true, true);
      await testSimpleInOut(vars.User, 'booleanAttr', false, false);
    });

    it('accepts 0 & 1', async () => {
      // This is necessary for MySQL (for now), because MySQL doesn't have a native BOOLEAN type, TINYINT can be used instead
      // so our only way is to convert 1/0 to true/false in AbstractDataType#sanitize,
      // which is called on both user input and database output.
      await testSimpleInOut(vars.User, 'booleanAttr', 1, true);
      await testSimpleInOut(vars.User, 'booleanAttr', 0, false);
    });

    it('rejects numbers other than 0 & 1', async () => {
      await expect(vars.User.create({ booleanAttr: 2 })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: -1 })).to.be.rejected;
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

    it('accepts 1 byte buffers containing 0 or 1', async () => {
      // This is necessary for MySQL (for now), because MySQL doesn't have a native BOOLEAN type, BIT can be used instead
      // so our only way is to convert 1/0 to true/false in AbstractDataType#sanitize,
      // which is called on both user input and database output.
      await testSimpleInOut(vars.User, 'booleanAttr', Buffer.from([1]), true);
      await testSimpleInOut(vars.User, 'booleanAttr', Buffer.from([0]), false);
    });

    it('rejects all other buffers', async () => {
      await expect(vars.User.create({ booleanAttr: Buffer.from([2]) })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: Buffer.from([-1]) })).to.be.rejected;
      await expect(vars.User.create({ booleanAttr: Buffer.from([]) })).to.be.rejected;
    });

    if (dialect.name === 'mysql') {
      // MySQL uses TINYINT(1). We can't know if the value is a boolean if the DataType is not specified.
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

  // const maxIntValueUnsigned = {
  //   TINYINT: 255,
  //   SMALLINT: 65_535,
  //   MEDIUMINT: 16_777_215,
  //   INTEGER: 4_294_967_295,
  // };

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  for (const intTypeName of ['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INTEGER'] as const) {
    describe(intTypeName, () => {
      if (!dialect.supports.dataTypes[intTypeName]) {
        it('throws, as it is not supported', async () => {
          expect(() => {
            sequelize.define('User', {
              attr: DataTypes[intTypeName],
            });
          }).to.throwWithCause(`${dialect.name} does not support the ${intTypeName} data type.`);
        });
      } else {
        const vars = beforeAll2(async () => {
          class User extends Model<InferAttributes<User>> {
            declare intAttr: number | bigint | string;
          }

          User.init({
            intAttr: {
              type: DataTypes[intTypeName],
              allowNull: false,
            },
          }, { sequelize });

          await User.sync({ force: true });

          return { User };
        });

        it('accepts numbers, bigints, strings', async () => {
          await testSimpleInOut(vars.User, 'intAttr', 123, 123);
          await testSimpleInOut(vars.User, 'intAttr', 123n, 123);
          await testSimpleInOut(vars.User, 'intAttr', '123', 123);

          await testSimpleInOut(vars.User, 'intAttr', maxIntValueSigned[intTypeName], maxIntValueSigned[intTypeName]);
          await testSimpleInOut(vars.User, 'intAttr', minIntValueSigned[intTypeName], minIntValueSigned[intTypeName]);
        });

        it('rejects out-of-range numbers', async () => {
          await expect(vars.User.create({ intAttr: maxIntValueSigned[intTypeName] + 1 })).to.be.rejected;
          await expect(vars.User.create({ intAttr: minIntValueSigned[intTypeName] - 1 })).to.be.rejected;
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
      }
    });
  }

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('BIGINT', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare bigintAttr: number | bigint | string;
      }

      User.init({
        bigintAttr: {
          type: DataTypes.BIGINT,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'bigintAttr', 123, '123');
      await testSimpleInOut(vars.User, 'bigintAttr', 123n, '123');
      await testSimpleInOut(vars.User, 'bigintAttr', '123', '123');

      await testSimpleInOut(vars.User, 'bigintAttr', 9_007_199_254_740_992n, '9007199254740992');
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
  });

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('REAL, DataTypes.DOUBLE, DataTypes.FLOAT', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare realAttr: number | bigint | string | null;
        declare doubleAttr: number | bigint | string | null;
        declare floatAttr: number | bigint | string | null;
      }

      User.init({
        realAttr: {
          type: DataTypes.REAL,
          allowNull: true,
        },
        doubleAttr: {
          type: DataTypes.DOUBLE,
          allowNull: true,
        },
        floatAttr: {
          type: DataTypes.FLOAT,
          allowNull: true,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    for (const [attrType, attrName] of [['REAL', 'realAttr'], ['DOUBLE', 'doubleAttr'], ['FLOAT', 'floatAttr']] as const) {
      it(`${attrType} accepts numbers, bigints, strings, +-Infinity`, async () => {
        await testSimpleInOut(vars.User, attrName, 123.4, 123.4);
        await testSimpleInOut(vars.User, attrName, 123n, 123);
        await testSimpleInOut(vars.User, attrName, '123.4', 123.4);
      });

      if (dialect.supports.dataTypes[attrType].NaN) {
        it(`${attrType} accepts NaN`, async () => {
          await testSimpleInOut(vars.User, attrName, Number.NaN, Number.NaN);
        });
      } else {
        it(`${attrType} rejects NaN`, async () => {
          await expect(vars.User.create({ [attrName]: Number.NaN })).to.be.rejected;
        });
      }

      if (dialect.supports.dataTypes[attrType].infinity) {
        it(`${attrType} accepts +-Infinity`, async () => {
          await testSimpleInOut(vars.User, attrName, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
          await testSimpleInOut(vars.User, attrName, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
        });
      } else {
        it(`${attrType} rejects +-Infinity`, async () => {
          await expect(vars.User.create({ [attrName]: Number.POSITIVE_INFINITY })).to.be.rejected;
          await expect(vars.User.create({ [attrName]: Number.NEGATIVE_INFINITY })).to.be.rejected;
        });
      }

      it(`${attrType} rejects non-number strings`, async () => {
        await expect(vars.User.create({ [attrName]: '' })).to.be.rejected;
        await expect(vars.User.create({ [attrName]: 'abc' })).to.be.rejected;
      });

      it(`${attrType} is deserialized as a JS number when DataType is not specified`, async () => {
        await testSimpleInOutRaw(vars.User, attrName, 123n, 123);

        if (dialect.supports.dataTypes[attrType].NaN) {
          await testSimpleInOutRaw(vars.User, attrName, Number.NaN, Number.NaN);
        }

        if (dialect.supports.dataTypes[attrType].infinity) {
          await testSimpleInOutRaw(vars.User, attrName, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
          await testSimpleInOutRaw(vars.User, attrName, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
        }
      });
    }
  });

  describe('DECIMAL (unconstrained)', () => {
    if (!dialect.supports.dataTypes.DECIMAL.unconstrained) {
      it('throws, as it is not supported', async () => {
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

      User.init({
        decimalAttr: {
          type: DataTypes.DECIMAL,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'decimalAttr', 123.4, '123.4');
      await testSimpleInOut(vars.User, 'decimalAttr', 123n, '123');
      await testSimpleInOut(vars.User, 'decimalAttr', '123.4', '123.4');
    });

    it('accepts NaN', async () => {
      await testSimpleInOut(vars.User, 'decimalAttr', Number.NaN, Number.NaN);
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
      await testSimpleInOutRaw(vars.User, 'decimalAttr', 123n, '123');
    });
  });

  // !TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
  describe('DECIMAL (constrained)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare decimalAttr: number | bigint | string;
      }

      User.init({
        decimalAttr: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts numbers, bigints, strings', async () => {
      await testSimpleInOut(vars.User, 'decimalAttr', 123.4, '123.40');
      await testSimpleInOut(vars.User, 'decimalAttr', 123n, '123.00');
      await testSimpleInOut(vars.User, 'decimalAttr', '123.4', '123.40');
    });

    if (dialect.supports.dataTypes.DECIMAL.NaN) {
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

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'decimalAttr', 123n, '123.00');
    });
  });

  describe('DATE', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare dateAttr: Date | string | number | Moment | dayjs.Dayjs;
      }

      User.init({
        dateAttr: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts Date objects, strings', async () => {
      const date = new Date('2022-01-01T00:00:00Z');

      await testSimpleInOut(vars.User, 'dateAttr', date, date);
      await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', date);

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
      await testSimpleInOutRaw(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', '2022-01-01 00:00:00+00');
    });
  });

  describe('DATE(precision)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare dateMinPrecisionAttr: Date | string | null;
        declare dateTwoPrecisionAttr: Date | string | null;
        declare dateMaxPrecisionAttr: Date | string | null;
      }

      User.init({
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
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('clamps to specified precision', async () => {
      await testSimpleInOut(vars.User, 'dateMinPrecisionAttr', '2022-01-01T12:13:14.123Z', new Date('2022-01-01T12:13:14.000Z'));
      await testSimpleInOut(vars.User, 'dateTwoPrecisionAttr', '2022-01-01T12:13:14.123Z', new Date('2022-01-01T12:13:14.120Z'));

      // The Date object doesn't go further than milliseconds.
      await testSimpleInOut(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', new Date('2022-01-01T12:13:14.123Z'));

      // Date is also used for inserting, so we also lose precision during insert.
      if (dialect.name === 'mysql') {
        await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', '2022-01-01 12:13:14.123000+00');
      } else {
        await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', '2022-01-01 12:13:14.123+00');
      }
    });
  });

  describe('DATEONLY', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare dateAttr: string | null;
        declare id: CreationOptional<number>;
      }

      User.init({
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        dateAttr: DataTypes.DATEONLY,
      }, { sequelize });

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

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'dateAttr', '2022-01-01', '2022-01-01');
    });
  });

  describe('TIME(precision)', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare timeMinPrecisionAttr: string | null;
        declare timeTwoPrecisionAttr: string | null;
        declare timeMaxPrecisionAttr: string | null;
      }

      User.init({
        timeMinPrecisionAttr: DataTypes.TIME, // defaults to 0
        timeTwoPrecisionAttr: DataTypes.TIME(2),
        timeMaxPrecisionAttr: DataTypes.TIME(6),
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'timeMinPrecisionAttr', '04:05:06.123456', '04:05:06');
      await testSimpleInOut(vars.User, 'timeTwoPrecisionAttr', '04:05:06.123456', '04:05:06.12');
      await testSimpleInOut(vars.User, 'timeMaxPrecisionAttr', '04:05:06.123456', '04:05:06.123456');
    });
  });

  describe('UUID', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: string;
      }

      User.init({
        attr: {
          type: DataTypes.UUID,
          allowNull: false,
        },
      }, { sequelize });

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

  // !TODO: (mariadb, mysql): TINYBLOB, MEDIUMBLOB
  describe('BLOB', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: ArrayBuffer | string | Blob;
      }

      User.init({
        attr: {
          type: DataTypes.BLOB,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'attr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
    });

    it('accepts ArrayBuffers & Uint8Arrays', async () => {
      // Uint8Arrays
      await testSimpleInOut(vars.User, 'attr', new Uint8Array([49, 50, 51, 52]), Buffer.from([49, 50, 51, 52]));
      // ArrayBuffer
      await testSimpleInOut(vars.User, 'attr', new Uint8Array([49, 50, 51, 52]).buffer, Buffer.from([49, 50, 51, 52]));
    });

    // Node 14 doesn't support Blob
    if (Blob) {
      it('rejects Blobs & non-Uint8Array ArrayBufferViews', async () => {
        await expect(vars.User.create({
          attr: new Blob(['abcd']),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.');

        await expect(vars.User.create({
          attr: new Uint16Array([49, 50, 51, 52]),
        })).to.be.rejectedWith(ValidationError, 'Validation error: Uint16Array(4) [ 49, 50, 51, 52 ] is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.');
      });
    }

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'attr', 'abc', Buffer.from([97, 98, 99]));
    });

    it(`is deserialized as a Buffer when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', new Uint8Array([49, 50, 51, 52]), Buffer.from([49, 50, 51, 52]));
    });
  });

  describe('ENUM', () => {
    const vars = beforeAll2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare attr: TestEnum;
      }

      User.init({
        attr: {
          type: DataTypes.ENUM(Object.values(TestEnum)),
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('accepts values that are part of the enum', async () => {
      await testSimpleInOut(vars.User, 'attr', TestEnum.A, TestEnum.A);
    });

    it('rejects values not part of the enum', async () => {
      // @ts-expect-error -- 'fail' is not a valid value for this enum.
      await expect(vars.User.create({ attr: 'fail' })).to.be.rejected;
    });

    it(`is deserialized as a string when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', TestEnum.A, TestEnum.A);
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

        User.init({
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
        }, { sequelize, timestamps: false });

        await User.sync({ force: true });

        return { User };
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

      it(`is deserialized as a parsed JSON value when DataType is not specified`, async () => {
        await testSimpleInOutRaw(vars.User, 'jsonStr', 'abc', 'abc');
        await testSimpleInOutRaw(vars.User, 'jsonBoolean', true, true);
        await testSimpleInOutRaw(vars.User, 'jsonBoolean', false, false);
        await testSimpleInOutRaw(vars.User, 'jsonNumber', 123.4, 123.4);
        await testSimpleInOutRaw(vars.User, 'jsonArray', [1, 2], [1, 2]);
        await testSimpleInOutRaw(vars.User, 'jsonObject', { a: 1 }, { a: 1 });
        await testSimpleInOutRaw(vars.User, 'jsonNull', null, null);
      });
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

      User.init({
        attr: {
          type: DataTypes.HSTORE,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    const hash = { key1: 'value1', key2: 'value2' };

    it('serialize/deserializes buffers', async () => {
      await testSimpleInOut(vars.User, 'attr', hash, hash);
    });

    it(`is deserialized as a parsed JSON value when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'attr', hash, hash);
    });

    it('rejects hstores that contain non-string values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error -- key2 cannot be an int in a hstore.
        attr: { key1: 'value1', key2: 1 },
      })).to.be.rejected;
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

      User.init({
        enumArray: DataTypes.ARRAY(DataTypes.ENUM(Object.values(TestEnum))),
        intArray: DataTypes.ARRAY(DataTypes.INTEGER),
        bigintArray: DataTypes.ARRAY(DataTypes.BIGINT),
        booleanArray: DataTypes.ARRAY(DataTypes.BOOLEAN),
        dateArray: DataTypes.ARRAY(DataTypes.DATE),
        stringArray: DataTypes.ARRAY(DataTypes.TEXT),
        arrayOfArrayOfStrings: DataTypes.ARRAY(DataTypes.ARRAY(DataTypes.TEXT)),
      }, { sequelize });

      await User.sync({ force: true });

      return { User };
    });

    it('serialize/deserializes arrays', async () => {
      await testSimpleInOut(vars.User, 'enumArray', [TestEnum.A, TestEnum.B, TestEnum['D,E']], [TestEnum.A, TestEnum.B, TestEnum['D,E']]);
      await testSimpleInOut(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
      await testSimpleInOut(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
      await testSimpleInOut(vars.User, 'booleanArray', [true, false], [true, false]);
      await testSimpleInOut(vars.User, 'dateArray', ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')], [new Date('2022-01-01T00:00:00Z'), new Date('2022-01-01T00:00:00Z')]);
      await testSimpleInOut(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
      await testSimpleInOut(vars.User, 'arrayOfArrayOfStrings', [['a', 'b,c'], ['c', 'd']], [['a', 'b,c'], ['c', 'd']]);
    });

    it(`is deserialized as a parsed array when DataType is not specified`, async () => {
      await testSimpleInOutRaw(vars.User, 'enumArray', [TestEnum.A, TestEnum.B, TestEnum['D,E']], [TestEnum.A, TestEnum.B, TestEnum['D,E']]);
      await testSimpleInOutRaw(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
      await testSimpleInOutRaw(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
      await testSimpleInOutRaw(vars.User, 'booleanArray', [true, false], [true, false]);
      await testSimpleInOutRaw(vars.User, 'dateArray', ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')], ['2022-01-01 00:00:00+00', '2022-01-01 00:00:00+00']);
      await testSimpleInOutRaw(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
      await testSimpleInOutRaw(vars.User, 'arrayOfArrayOfStrings', [['a', 'b,c'], ['c', 'd']], [['a', 'b,c'], ['c', 'd']]);
    });

    it('rejects non-array values', async () => {
      await expect(vars.User.create({
        // @ts-expect-error -- we're voluntarily going against the typing to test that it fails.
        booleanArray: 1,
      })).to.be.rejected;
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

      User.init({
        attr: {
          type: DataTypes.CIDR,
          allowNull: false,
        },
      }, { sequelize });

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

      User.init({
        attr: {
          type: DataTypes.INET,
          allowNull: false,
        },
      }, { sequelize });

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

      User.init({
        attr: {
          type: DataTypes.MACADDR,
          allowNull: false,
        },
      }, { sequelize });

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
  outVal: CreationAttributes<M>[Key],
  message?: string,
): Promise<void> {
  // @ts-expect-error -- we can't guarantee that this model doesn't expect more than one property, but it's just a test util.
  const createdUser = await model.create({ [attributeName]: inVal });

  const quotedTableName = model.sequelize!.queryInterface.queryGenerator.quoteIdentifier(model.tableName);
  const fetchedUser = await model.sequelize!.query<any>(`SELECT * FROM ${quotedTableName} WHERE id = :id`, {
    type: QueryTypes.SELECT,
    replacements: {
      // @ts-expect-error -- it's not worth it to type .id for these internal tests.
      id: createdUser.id,
    },
  });

  expect(fetchedUser[0][attributeName]).to.deep.eq(outVal, message);
}
