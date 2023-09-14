import { expect } from 'chai';
import { lt } from 'semver';
import type { InferAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { beforeAll2, sequelize, setResetMode } from '../support';
import { testSimpleInOut, testSimpleInOutRaw } from './_utils';

const dialect = sequelize.dialect;

describe('Temporal DataTypes', () => {
  setResetMode('none');

  if (lt(process.version, 'v19.0.0')) {
    return;
  }

  if (dialect.supports.dataTypes.DATETIME.offset) {
    describe('DATETIME.OFFSET', () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare dateAttr: Temporal.Instant | Date | string;
        }

        User.init({
          dateAttr: {
            type: DataTypes.DATETIME.OFFSET,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('accepts Date objects and ISO strings', async () => {
        const date = new Date('2022-01-01T00:00:00Z');
        const temporalInstant = date.toTemporalInstant();

        await testSimpleInOut(vars.User, 'dateAttr', date, temporalInstant);
        await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', temporalInstant);
      });

      it('accepts Temporal.Instant objects and strings', async () => {
        const temporal = Temporal.Instant.from('2022-01-01T00:00:00Z');

        await testSimpleInOut(vars.User, 'dateAttr', temporal, temporal);
        await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', temporal);
      });

      it(`is deserialized as a string when DataType is not specified`, async () => {
        await testSimpleInOutRaw(
          vars.User,
          'dateAttr',
          '2022-01-01T00:00:00Z',
          dialect.name === 'postgres' ? '2022-01-01 00:00:00+00'
          : dialect.name === 'mssql' ? '2022-01-01 00:00:00.000+00'
          : '2022-01-01T00:00:00+00:00',
        );
      });
    });

    describe('DATETIME(precision).OFFSET', () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare dateMinPrecisionAttr: Temporal.Instant | Date | string | null;
          declare dateTwoPrecisionAttr: Temporal.Instant | Date | string | null;
          declare dateMaxPrecisionAttr: Temporal.Instant | Date | string | null;
        }

        User.init({
          dateMinPrecisionAttr: {
            type: DataTypes.DATETIME(0).OFFSET,
            allowNull: true,
          },
          dateTwoPrecisionAttr: {
            type: DataTypes.DATETIME(2).OFFSET,
            allowNull: true,
          },
          dateMaxPrecisionAttr: {
            type: DataTypes.DATETIME(6).OFFSET,
            allowNull: true,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('clamps to specified precision', async () => {
        // sqlite does not support restricting the precision
        if (dialect.name !== 'sqlite') {
          await testSimpleInOut(vars.User, 'dateMinPrecisionAttr', '2022-01-01T12:13:14.123Z', Temporal.Instant.from('2022-01-01T12:13:14.000Z'));
          await testSimpleInOut(vars.User, 'dateTwoPrecisionAttr', '2022-01-01T12:13:14.123Z', Temporal.Instant.from('2022-01-01T12:13:14.120Z'));

        }

        if (dialect.name === 'mssql') {
          await testSimpleInOut(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', Temporal.Instant.from('2022-01-01T12:13:14.123Z'));
        } else {
          await testSimpleInOut(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', Temporal.Instant.from('2022-01-01T12:13:14.123456Z'));
        }

        if (dialect.name === 'mssql') {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', '2022-01-01 12:13:14.123+00');
        } else if (dialect.name === 'sqlite') {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', '2022-01-01T12:13:14.123456+00:00');
        } else {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456Z', '2022-01-01 12:13:14.123456+00');
        }
      });
    });
  }

  if (dialect.supports.dataTypes.DATETIME.plain) {
    describe('DATETIME.PLAIN', () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare dateAttr: Temporal.PlainDateTime | Date | string;
        }

        User.init({
          dateAttr: {
            type: DataTypes.DATETIME.PLAIN,
            allowNull: false,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('accepts Temporal.PlainDateTime objects and strings', async () => {
        const temporal = Temporal.PlainDateTime.from('2022-01-01T00:00:00');

        await testSimpleInOut(vars.User, 'dateAttr', temporal, temporal);
        await testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00', temporal);
      });

      it('does not accept Date objects or ISO strings', async () => {
        const date = new Date('2022-01-01T00:00:00Z');

        await expect(testSimpleInOut(vars.User, 'dateAttr', date, date)).to.be.rejectedWith(Error);
        await expect(testSimpleInOut(vars.User, 'dateAttr', '2022-01-01T00:00:00Z', date)).to.be.rejectedWith(Error);
      });

      it(`is deserialized as a string when DataType is not specified`, async () => {
        await testSimpleInOutRaw(
          vars.User,
          'dateAttr',
          '2022-01-01T00:00:00',
          ['mariadb', 'mysql'].includes(dialect.name) ? '2022-01-01 00:00:00+00'
          : dialect.name === 'postgres' ? '2022-01-01 00:00:00'
          : dialect.name === 'mssql' ? '2022-01-01 00:00:00.000+00'
          : dialect.name === 'db2' ? '2022-01-01 00:00:00.000000+00'
          : '2022-01-01T00:00:00',
        );
      });
    });

    describe('DATETIME(precision).PLAIN', () => {
      const vars = beforeAll2(async () => {
        class User extends Model<InferAttributes<User>> {
          declare dateMinPrecisionAttr: Temporal.PlainDateTime | string | null;
          declare dateTwoPrecisionAttr: Temporal.PlainDateTime | string | null;
          declare dateMaxPrecisionAttr: Temporal.PlainDateTime | string | null;
        }

        User.init({
          dateMinPrecisionAttr: {
            type: DataTypes.DATETIME(0).PLAIN,
            allowNull: true,
          },
          dateTwoPrecisionAttr: {
            type: DataTypes.DATETIME(2).PLAIN,
            allowNull: true,
          },
          dateMaxPrecisionAttr: {
            type: DataTypes.DATETIME(6).PLAIN,
            allowNull: true,
          },
        }, { sequelize });

        await User.sync({ force: true });

        return { User };
      });

      it('clamps to specified precision', async () => {
        // sqlite does not support restricting the precision
        if (dialect.name !== 'sqlite') {
          await testSimpleInOut(vars.User, 'dateMinPrecisionAttr', '2022-01-01T12:13:14.123', Temporal.PlainDateTime.from('2022-01-01T12:13:14.000'));
          await testSimpleInOut(vars.User, 'dateTwoPrecisionAttr', '2022-01-01T12:13:14.123', Temporal.PlainDateTime.from('2022-01-01T12:13:14.120'));

        }

        // mssql returns the raw value as a Date object loosing precision
        if (dialect.name === 'mssql') {
          await testSimpleInOut(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', Temporal.PlainDateTime.from('2022-01-01T12:13:14.123'));
        } else {
          await testSimpleInOut(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', Temporal.PlainDateTime.from('2022-01-01T12:13:14.123456'));
        }

        if (['db2', 'ibmi', 'mariadb', 'mysql'].includes(dialect.name)) {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', '2022-01-01 12:13:14.123456+00');
        } else if (dialect.name === 'mssql') {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', '2022-01-01 12:13:14.123+00');
        } else if (dialect.name === 'sqlite') {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', '2022-01-01T12:13:14.123456');
        } else {
          await testSimpleInOutRaw(vars.User, 'dateMaxPrecisionAttr', '2022-01-01T12:13:14.123456', '2022-01-01 12:13:14.123456');
        }
      });
    });
  }
});
