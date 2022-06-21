import type {
  CreationAttributes,
  InferAttributes,
  ModelStatic,
  CreationOptional, InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, fn, Model } from '@sequelize/core';
import { expect } from 'chai';
import dayjs from 'dayjs';
import DayjsTimezone from 'dayjs/plugin/timezone';
import moment from 'moment';
import 'moment-timezone';
import type { Moment } from 'moment-timezone';
import { beforeEach2, sequelize } from '../support';

dayjs.extend(DayjsTimezone);

const dialect = sequelize.dialect;

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
}

// TODO: add UNIT test to ensure validation is run on all model methods (including create, update, where)

describe('DataTypes.STRING(<length>)', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare stringAttr: string;
    }

    User.init({
      stringAttr: {
        type: DataTypes.STRING(5),
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes strings and numbers', async () => {
    await testSimpleInOut(vars.User, 'stringAttr', '1235', '1235');

    // @ts-expect-error -- we don't allow it in TypeScript, but we can stringify some values automatically for legacy reasons
    await testSimpleInOut(vars.User, 'stringAttr', 12, '12');
  });

  it('throws if the string is too long', async () => {
    await expect(vars.User.create({
      stringAttr: '123456',
    })).to.be.rejected;
  });
});

describe('DataTypes.STRING.BINARY', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare binaryStringAttr: Buffer | string;
    }

    User.init({
      binaryStringAttr: {
        type: DataTypes.STRING.BINARY,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes buffers', async () => {
    await testSimpleInOut(vars.User, 'binaryStringAttr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
  });

  // TODO: support native ArrayBuffers.
  // it('accepts ArrayBuffers', async () => {
  //   await testSimpleInOut(vars.User, 'binaryStringAttr', new Uint8Array([97, 98, 99]), Buffer.from([97, 98, 99]));
  // });

  // TODO: support native Blobs.
  // it('accepts Blobs', async () => {
  //   await testSimpleInOut(vars.User, 'binaryStringAttr', new Blob(['abc']), Buffer.from([97, 98, 99]));
  // });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'binaryStringAttr', 'abc', Buffer.from([97, 98, 99]));
  });
});

// TODO: throw if binary + limit is not supported in this dialect (postgres)
describe('DataTypes.STRING(100).BINARY', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare binaryStringAttr: string;
    }

    User.init({
      binaryStringAttr: {
        type: DataTypes.STRING(5).BINARY,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  // We want to have this, but is 'length' the number of bytes or the number of characters?
  // More research needed.
  it.skip('throws if the string is too long', async () => {
    await expect(vars.User.create({
      binaryStringAttr: '123456',
    })).to.be.rejected;
  });
});

describe('DataTypes.TEXT', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare textAttr: string;
    }

    User.init({
      textAttr: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes strings', async () => {
    await testSimpleInOut(vars.User, 'textAttr', '123456', '123456');
  });
});

// TODO: throw if not supported in this dialect
describe(`DataTypes.TEXT(<size>)`, () => {
  const vars = beforeEach2(async () => {
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

    await User.sync();

    return { User };
  });

  it('serialize/deserializes strings', async () => {
    const data = { tinyText: '123', mediumText: '456', longText: '789' };

    await vars.User.create(data);
    const user = await vars.User.findOne({ rejectOnEmpty: true });
    expect(user.get()).to.deep.eq(data);
  });
});

describe('DataTypes.CHAR(<length>)', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare charAttr: string;
    }

    User.init({
      charAttr: {
        type: DataTypes.CHAR(20),
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes strings', async () => {
    await testSimpleInOut(vars.User, 'charAttr', '123456', '123456'.padEnd(20, ' '));
  });

  it('throws if the string is too long', async () => {
    await expect(vars.User.create({
      charAttr: '1'.repeat(21),
    })).to.be.rejected;
  });
});

describe('DataTypes.CHAR(<length>).BINARY', () => {
  if (dialect.supports.dataTypes.CHAR.BINARY) {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare binaryCharAttr: string | Buffer;
      }

      User.init({
        binaryCharAttr: {
          type: DataTypes.CHAR(5).BINARY,
          allowNull: false,
        },
      }, { sequelize });

      await User.sync();

      return { User };
    });

    it('serialize/deserializes buffers with padding if the length is insufficient', async () => {
      await testSimpleInOut(vars.User, 'binaryCharAttr', Buffer.from('1234'), Buffer.from([32, 49, 50, 51, 52]));
    });

    // TODO: support native ArrayBuffers.
    // it('accepts ArrayBuffers', async () => {
    //   await testSimpleInOut(vars.User, 'binaryCharAttr', new Uint8Array([49, 50, 51, 52]), Buffer.from([32, 49, 50, 51, 52]));
    // });

    // TODO: support native Blobs.
    // it('accepts Blobs', async () => {
    //   await testSimpleInOut(vars.User, 'binaryCharAttr', new Blob(['1234']), Buffer.from([32, 49, 50, 51, 52]));
    // });

    it('accepts strings', async () => {
      await testSimpleInOut(vars.User, 'binaryCharAttr', '1234', Buffer.from([32, 49, 50, 51, 52]));
    });
  } else {
    it('throws if CHAR.BINARY is used', () => {
      expect(() => {
        sequelize.define('CrashedModel', {
          attr: DataTypes.CHAR.BINARY,
        });
      }).to.throwWithCause(`An error occurred for attribute attr on model CrashedModel.
Caused by: ${dialect.name} does not support the CHAR.BINARY DataType.
See https://sequelize.org/docs/v7/other-topics/other-data-types/#strings for a list of supported DataTypes.`);
    });
  }
});

// TODO: throw if not supported in this dialect
describe('DataTypes.CITEXT', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare ciTextAttr: string;
    }

    User.init({
      ciTextAttr: {
        type: DataTypes.CITEXT,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes strings', async () => {
    await vars.User.create({
      ciTextAttr: 'ABCdef',
    });

    const user = await vars.User.findOne({ rejectOnEmpty: true, where: { ciTextAttr: 'abcDEF' } });
    expect(user.ciTextAttr).to.eq('ABCdef');
  });
});

describe('DataTypes.TSVECTOR', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare tsvectorAttr: string;
    }

    User.init({
      tsvectorAttr: {
        type: DataTypes.TSVECTOR,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

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
});

describe('DataTypes.BOOLEAN', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare booleanAttr: boolean | string | number | bigint | Buffer;
    }

    User.init({
      booleanAttr: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts booleans', async () => {
    await testSimpleInOut(vars.User, 'booleanAttr', true, true);
    await testSimpleInOut(vars.User, 'booleanAttr', false, false);
  });

  it('accepts some strings', async () => {
    await testSimpleInOut(vars.User, 'booleanAttr', 'true', true);
    await testSimpleInOut(vars.User, 'booleanAttr', 't', true);
    await testSimpleInOut(vars.User, 'booleanAttr', '1', true);
    await testSimpleInOut(vars.User, 'booleanAttr', 'false', false);
    await testSimpleInOut(vars.User, 'booleanAttr', 'f', false);
    await testSimpleInOut(vars.User, 'booleanAttr', '0', false);
  });

  it('rejects non-boolean strings', async () => {
    await expect(vars.User.create({ booleanAttr: '' })).to.be.rejected;
    await expect(vars.User.create({ booleanAttr: 'abc' })).to.be.rejected;
  });

  it('accepts some numbers', async () => {
    await testSimpleInOut(vars.User, 'booleanAttr', 1, true);
    await testSimpleInOut(vars.User, 'booleanAttr', 0, false);
  });

  it('rejects non-boolean numbers', async () => {
    await expect(vars.User.create({ booleanAttr: -1 })).to.be.rejected;
    await expect(vars.User.create({ booleanAttr: 2 })).to.be.rejected;
  });

  it('accepts some bigints', async () => {
    await testSimpleInOut(vars.User, 'booleanAttr', 1n, true);
    await testSimpleInOut(vars.User, 'booleanAttr', 0n, false);
  });

  it('rejects non-boolean bigints', async () => {
    await expect(vars.User.create({ booleanAttr: -1n })).to.be.rejected;
    await expect(vars.User.create({ booleanAttr: 2n })).to.be.rejected;
  });

  it('accepts some buffers', async () => {
    await testSimpleInOut(vars.User, 'booleanAttr', Buffer.from([1]), true);
    await testSimpleInOut(vars.User, 'booleanAttr', Buffer.from([0]), false);
  });
});

// TODO (mariaDB, mysql): TINYINT

// TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
describe('DataTypes.SMALLINT', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare smallIntAttr: number | bigint | string;
    }

    User.init({
      smallIntAttr: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts numbers, bigints, strings', async () => {
    await testSimpleInOut(vars.User, 'smallIntAttr', 123, 123);
    await testSimpleInOut(vars.User, 'smallIntAttr', 123n, 123);
    await testSimpleInOut(vars.User, 'smallIntAttr', '123', 123);
  });

  it('rejects non-integer numbers', async () => {
    await expect(vars.User.create({ smallIntAttr: 123.4 })).to.be.rejected;
    await expect(vars.User.create({ smallIntAttr: Number.NaN })).to.be.rejected;
    await expect(vars.User.create({ smallIntAttr: Number.NEGATIVE_INFINITY })).to.be.rejected;
    await expect(vars.User.create({ smallIntAttr: Number.POSITIVE_INFINITY })).to.be.rejected;
  });

  it('rejects non-integer strings', async () => {
    await expect(vars.User.create({ smallIntAttr: '' })).to.be.rejected;
    await expect(vars.User.create({ smallIntAttr: 'abc' })).to.be.rejected;
    await expect(vars.User.create({ smallIntAttr: '123.4' })).to.be.rejected;
  });
});

// TODO (mariaDB, mysql): MEDIUMINT

// TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
describe('DataTypes.INTEGER', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare intAttr: number | bigint | string;
    }

    User.init({
      intAttr: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts numbers, bigints, strings', async () => {
    await testSimpleInOut(vars.User, 'intAttr', 123, 123);
    await testSimpleInOut(vars.User, 'intAttr', 123n, 123);
    await testSimpleInOut(vars.User, 'intAttr', '123', 123);
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
});

// TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
describe('DataTypes.BIGINT', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare bigintAttr: number | bigint | string;
    }

    User.init({
      bigintAttr: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

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
});

// TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
describe('DataTypes.REAL, DataTypes.DOUBLE, DataTypes.FLOAT', () => {
  const vars = beforeEach2(async () => {
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

    await User.sync();

    return { User };
  });

  it('REAL accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
    await testSimpleInOut(vars.User, 'realAttr', 123.4, 123.4);
    await testSimpleInOut(vars.User, 'realAttr', 123n, 123);
    await testSimpleInOut(vars.User, 'realAttr', '123.4', 123.4);
    await testSimpleInOut(vars.User, 'realAttr', Number.NaN, Number.NaN);
    await testSimpleInOut(vars.User, 'realAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    await testSimpleInOut(vars.User, 'realAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  });

  it('DOUBLE accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
    await testSimpleInOut(vars.User, 'doubleAttr', 123.4, 123.4);
    await testSimpleInOut(vars.User, 'doubleAttr', 123n, 123);
    await testSimpleInOut(vars.User, 'doubleAttr', '123.4', 123.4);
    await testSimpleInOut(vars.User, 'doubleAttr', Number.NaN, Number.NaN);
    await testSimpleInOut(vars.User, 'doubleAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    await testSimpleInOut(vars.User, 'doubleAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  });

  it('FLOAT accepts numbers, bigints, strings, NaN, +-Infinity', async () => {
    await testSimpleInOut(vars.User, 'floatAttr', 123.4, 123.4);
    await testSimpleInOut(vars.User, 'floatAttr', 123n, 123);
    await testSimpleInOut(vars.User, 'floatAttr', '123.4', 123.4);
    await testSimpleInOut(vars.User, 'floatAttr', Number.NaN, Number.NaN);
    await testSimpleInOut(vars.User, 'floatAttr', Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    await testSimpleInOut(vars.User, 'floatAttr', Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  });

  it('rejects non-number strings', async () => {
    await expect(vars.User.create({ realAttr: '' })).to.be.rejected;
    await expect(vars.User.create({ realAttr: 'abc' })).to.be.rejected;
    await expect(vars.User.create({ doubleAttr: '' })).to.be.rejected;
    await expect(vars.User.create({ doubleAttr: 'abc' })).to.be.rejected;
    await expect(vars.User.create({ floatAttr: '' })).to.be.rejected;
    await expect(vars.User.create({ floatAttr: 'abc' })).to.be.rejected;
  });
});

// TODO (mariaDB, mysql): length, UNSIGNED, ZEROFILL
describe('DataTypes.DECIMAL', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare decimalAttr: number | bigint | string;
    }

    User.init({
      decimalAttr: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts numbers, bigints, strings', async () => {
    await testSimpleInOut(vars.User, 'decimalAttr', 123.4, '123.4');
    await testSimpleInOut(vars.User, 'decimalAttr', 123n, '123');
    await testSimpleInOut(vars.User, 'decimalAttr', '123.4', '123.4');

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
});

// TODO: DATE(precision)
// TODO: test precision
describe('DataTypes.DATE', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare dateAttr: Date | string | number | Moment | dayjs.Dayjs;
    }

    User.init({
      dateAttr: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

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
});

describe('DataTypes.DATEONLY', () => {
  const vars = beforeEach2(async () => {
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

    await User.sync();

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
});

// TODO: test precision
describe('DataTypes.TIME', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare timeAttr: string;
    }

    User.init({
      timeAttr: {
        type: DataTypes.TIME,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'timeAttr', '04:05:06', '04:05:06');
  });
});

describe('DataTypes.UUID', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: string;
    }

    User.init({
      attr: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts UUID strings', async () => {
    const uuidV1 = '4b39e726-d455-11ec-9d64-0242ac120002';
    await testSimpleInOut(vars.User, 'attr', uuidV1, uuidV1);
    const uuidV4 = '48fbbb25-b00c-4711-add4-fae864a09d8d';
    await testSimpleInOut(vars.User, 'attr', uuidV4, uuidV4);
  });

  it('rejects non-UUID strings', async () => {
    await expect(vars.User.create({ attr: 'not-a-uuid-at-all' })).to.be.rejected;
  });
});

// TODO: (mariadb, mysql): TINYBLOB, MEDIUMBLOB
describe('DataTypes.BLOB', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: ArrayBuffer | string;
    }

    User.init({
      attr: {
        type: DataTypes.BLOB,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes buffers', async () => {
    await testSimpleInOut(vars.User, 'attr', Buffer.from('abc'), Buffer.from([97, 98, 99]));
  });

  // TODO: support native ArrayBuffers
  // it('accepts ArrayBuffers', async () => {
  //   await testSimpleInOut(vars.User, 'attr', new Uint8Array([97, 98, 99]), Buffer.from([97, 98, 99]));
  // });

  // TODO: support native Blobs.
  // it('accepts Blobs', async () => {
  //   await testSimpleInOut(vars.User, 'attr', new Blob(['abc']), Buffer.from([97, 98, 99]));
  // });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'attr', 'abc', Buffer.from([97, 98, 99]));
  });
});

describe('DataTypes.ENUM', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: TestEnum;
    }

    User.init({
      attr: {
        type: DataTypes.ENUM(Object.values(TestEnum)),
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts values that are part of the enum', async () => {
    await testSimpleInOut(vars.User, 'attr', TestEnum.A, TestEnum.A);
  });

  it('rejects values not part of the enum', async () => {
    // @ts-expect-error -- 'fail' is not a valid value for this enum.
    await expect(vars.User.create({ attr: 'fail' })).to.be.rejected;
  });
});

for (const JsonType of [DataTypes.JSON, DataTypes.JSONB]) {
  describe(`DataTypes.${JsonType.name}`, () => {
    const vars = beforeEach2(async () => {
      class User extends Model<InferAttributes<User>> {
        declare jsonStr: string;
        declare jsonBoolean: boolean;
        declare jsonNumber: number;
        declare jsonArray: string[];
        declare jsonObject: object;
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
      }, { sequelize, timestamps: false });

      await User.sync();

      return { User };
    });

    it('properly serializes default values', async () => {
      const createdUser = await vars.User.create();
      expect(createdUser.get()).to.deep.eq({
        jsonStr: 'abc',
        jsonBoolean: true,
        jsonNumber: 1,
        jsonArray: ['a', 'b'],
        jsonObject: { key: 'abc' },
        id: 1,
      });
    });

    it('properly serializes values', async () => {
      await testSimpleInOut(vars.User, 'jsonObject', { a: 1 }, { a: 1 });
    });
  });
}

describe('DataTypes.HSTORE', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: Record<string, string> | string;
    }

    User.init({
      attr: {
        type: DataTypes.HSTORE,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('serialize/deserializes buffers', async () => {
    const hash = { key1: 'value1', key2: 'value2' };

    await testSimpleInOut(vars.User, 'attr', hash, hash);
  });

  it('rejects hstores that contain non-string values', async () => {
    await expect(vars.User.create({
      // @ts-expect-error -- key2 cannot be an int in a hstore.
      attr: { key1: 'value1', key2: 1 },
    })).to.be.rejected;
  });
});

describe('DataTypes.ARRAY', () => {
  const vars = beforeEach2(async () => {
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

    await User.sync();

    return { User };
  });

  it('serialize/deserializes arrays', async () => {
    await testSimpleInOut(vars.User, 'enumArray', [TestEnum.A, TestEnum.B], [TestEnum.A, TestEnum.B]);
    await testSimpleInOut(vars.User, 'intArray', [1n, 2, '3'], [1, 2, 3]);
    await testSimpleInOut(vars.User, 'bigintArray', [1n, 2, '3'], ['1', '2', '3']);
    // Coercion to boolean follows JavaScript Coercion Behavior.
    // Even though values can end up being stored as 'f' in the database depending on the dialect, sending 'f' to the database will be stored as true.
    await testSimpleInOut(vars.User, 'booleanArray', [1n, 0, '1', '0', 't', 'f', 'true', 'false', '', 'abc'], [true, false, true, true, true, true, true, true, false, true]);
    await testSimpleInOut(vars.User, 'dateArray', ['2022-01-01T00:00:00Z', new Date('2022-01-01T00:00:00Z')], [new Date('2022-01-01T00:00:00Z'), new Date('2022-01-01T00:00:00Z')]);
    await testSimpleInOut(vars.User, 'stringArray', ['a,b,c', 'd,e,f'], ['a,b,c', 'd,e,f']);
    await testSimpleInOut(vars.User, 'arrayOfArrayOfStrings', [['a', 'b,c'], ['c', 'd']], [['a', 'b,c'], ['c', 'd']]);
  });

  it('rejects non-array values', async () => {
    await expect(vars.User.create({
      // @ts-expect-error -- we're voluntarily going against the typing to test that it fails.
      booleanArray: 1,
    })).to.be.rejected;
  });
});

describe('DataTypes.CIDR', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: string;
    }

    User.init({
      attr: {
        type: DataTypes.CIDR,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'attr', '10.1.2.3/32', '10.1.2.3/32');
  });
});

describe('DataTypes.INET', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: string;
    }

    User.init({
      attr: {
        type: DataTypes.INET,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'attr', '127.0.0.1', '127.0.0.1');
  });
});

describe('DataTypes.MACADDR', () => {
  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      declare attr: string;
    }

    User.init({
      attr: {
        type: DataTypes.MACADDR,
        allowNull: false,
      },
    }, { sequelize });

    await User.sync();

    return { User };
  });

  it('accepts strings', async () => {
    await testSimpleInOut(vars.User, 'attr', '01:23:45:67:89:ab', '01:23:45:67:89:ab');
  });
});

export async function testSimpleInOut<M extends Model, Key extends keyof CreationAttributes<M>>(
  model: ModelStatic<M>,
  attributeName: Key,
  inVal: CreationAttributes<M>[Key],
  outVal: CreationAttributes<M>[Key],
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
  expect(fetchedUser[attributeName]).to.deep.eq(outVal);
}
