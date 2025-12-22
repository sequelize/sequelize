import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { Model, QueryTypes } from '@sequelize/core';
import { CreatedAt, Table } from '@sequelize/core/decorators-legacy';
import { assert, expect } from 'chai';
import {
  beforeAll2,
  createSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser,
  sequelize,
  setResetMode,
} from './support';

const dialectName = getTestDialect();
const dialect = sequelize.dialect;

describe(getTestDialectTeaser('Timezone'), () => {
  if (!dialect.supports.globalTimeZoneConfig) {
    return;
  }

  setResetMode('none');
  const vars = beforeAll2(async () => {
    @Table({ tableName: 'users' })
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;

      @CreatedAt()
      declare createdAt: CreationOptional<Date>;
    }

    @Table({ tableName: 'users' })
    class OffsetUser extends User {}

    @Table({ tableName: 'users' })
    class NamedUser extends User {}

    const sequelizeWithTimezone = createSequelizeInstance({
      timezone: '+07:00',
    });
    const sequelizeWithNamedTimezone = createSequelizeInstance({
      timezone: 'America/Phoenix',
    });

    sequelize.addModels([User]);
    sequelizeWithTimezone.addModels([OffsetUser]);
    sequelizeWithNamedTimezone.addModels([NamedUser]);

    await sequelize.sync({ force: true });

    return {
      User,
      NamedUser,
      OffsetUser,
      sequelizeWithTimezone,
      sequelizeWithNamedTimezone,
    };
  });

  after(async () => {
    await Promise.all([
      vars.sequelizeWithTimezone.close(),
      vars.sequelizeWithNamedTimezone.close(),
    ]);
  });

  it('returns the same value for current timestamp', async () => {
    const startQueryTime = Date.now();

    const now = dialectName === 'mssql' ? 'GETDATE()' : 'now()';
    const query = `SELECT ${now} as ${sequelize.queryGenerator.quoteIdentifier('now')}`;

    const [now1, now2, now3] = await Promise.all([
      sequelize.query<{ now: Date }>(query, { type: QueryTypes.SELECT }),
      vars.sequelizeWithTimezone.query<{ now: Date }>(query, { type: QueryTypes.SELECT }),
      vars.sequelizeWithNamedTimezone.query<{ now: Date }>(query, { type: QueryTypes.SELECT }),
    ]);

    const elapsedQueryTime = Date.now() - startQueryTime + 1001;
    expect(new Date(now1[0].now).getTime()).to.be.closeTo(
      new Date(now2[0].now).getTime(),
      elapsedQueryTime,
    );
    expect(new Date(now1[0].now).getTime()).to.be.closeTo(
      new Date(now3[0].now).getTime(),
      elapsedQueryTime,
    );
  });

  if (['mysql', 'mariadb'].includes(dialectName)) {
    it('handles existing timestamps', async () => {
      const userObj = await vars.User.create({});
      const [user, offsetUser] = await Promise.all([
        vars.User.findByPk(userObj.id),
        vars.OffsetUser.findByPk(userObj.id),
      ]);

      assert(user instanceof vars.User);
      assert(offsetUser instanceof vars.OffsetUser);

      // Expect 7 hours difference, in milliseconds.
      // This difference is expected since two instances, configured for each their timezone is trying to read the same timestamp
      // this test does not apply to PG, since it stores the timezone along with the timestamp.
      expect(user.createdAt.getTime() - offsetUser.createdAt.getTime()).to.be.closeTo(
        60 * 60 * 7 * 1000,
        1000,
      );
    });

    it('handles named timezones', async () => {
      const userObj = await vars.NamedUser.create({});
      const [user, namedUser] = await Promise.all([
        vars.User.findByPk(userObj.id),
        vars.NamedUser.findByPk(userObj.id),
      ]);

      assert(user instanceof vars.User);
      assert(namedUser instanceof vars.NamedUser);

      // Expect 7 hours difference, in milliseconds
      expect(Math.abs(user.createdAt.getTime() - namedUser.createdAt.getTime())).to.equal(
        60 * 60 * 7 * 1000,
      );
    });
  }
});
