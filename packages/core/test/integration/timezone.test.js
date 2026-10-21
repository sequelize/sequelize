'use strict';

const chai = require('chai');
const sinon = require('sinon');
const { ConnectionError } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('./support');

const dialectName = Support.getTestDialect();
const dialect = Support.sequelize.dialect;
const queryGenerator = Support.sequelize.queryGenerator;

describe(Support.getTestDialectTeaser('Timezone'), () => {
  if (!dialect.supports.globalTimeZoneConfig) {
    return;
  }

  before(function () {
    this.sequelizeWithTimezone = Support.createSequelizeInstance({
      timezone: '+07:00',
    });
    this.sequelizeWithNamedTimezone = Support.createSequelizeInstance({
      timezone: 'America/New_York',
    });
  });

  after(function () {
    this.sequelizeWithTimezone.close();
    this.sequelizeWithNamedTimezone.close();
  });

  it('returns the same value for current timestamp', async function () {
    const startQueryTime = Date.now();

    const now = dialectName === 'mssql' ? 'GETDATE()' : 'now()';
    const query = `SELECT ${now} as ${queryGenerator.quoteIdentifier('now')}`;

    const [now1, now2, now3] = await Promise.all([
      this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT }),
      this.sequelizeWithTimezone.query(query, { type: this.sequelize.QueryTypes.SELECT }),
      this.sequelizeWithNamedTimezone.query(query, { type: this.sequelize.QueryTypes.SELECT }),
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
    it('handles existing timestamps', async function () {
      const NormalUser = this.sequelize.define('user', {});
      const TimezonedUser = this.sequelizeWithTimezone.define('user', {});

      await this.sequelize.sync({ force: true });
      const normalUser = await NormalUser.create({});
      this.normalUser = normalUser;
      const timezonedUser = await TimezonedUser.findByPk(normalUser.id);
      // Expect 7 hours difference, in milliseconds.
      // This difference is expected since two instances, configured for each their timezone is trying to read the same timestamp
      // this test does not apply to PG, since it stores the timezone along with the timestamp.
      expect(this.normalUser.createdAt.getTime() - timezonedUser.createdAt.getTime()).to.be.closeTo(
        60 * 60 * 7 * 1000,
        1000,
      );
    });

    it('handles named timezones', async function () {
      const NormalUser = this.sequelize.define('user', {});
      const TimezonedUser = this.sequelizeWithNamedTimezone.define('user', {});

      await this.sequelize.sync({ force: true });
      const timezonedUser0 = await TimezonedUser.create({});

      const [normalUser, timezonedUser] = await Promise.all([
        NormalUser.findByPk(timezonedUser0.id),
        TimezonedUser.findByPk(timezonedUser0.id),
      ]);

      // Expect 5 hours difference, in milliseconds, +/- 1 hour for DST
      expect(normalUser.createdAt.getTime() - timezonedUser.createdAt.getTime()).to.be.closeTo(
        60 * 60 * 4 * 1000 * -1,
        60 * 60 * 1000,
      );
    });
  }

  for (const [title, timezone] of [
    ['an invalid timezone', 'Invalid/Timezone'],
    ['an invalid timezone offset', '+01:70'],
  ]) {
    it(`throws a ConnectionError and closes the connection when passing ${title}`, async () => {
      const sequelize = Support.createSequelizeInstance({ timezone });
      const { connectionManager } = sequelize.dialect;
      const connectSpy = sinon.spy(connectionManager, 'connect');

      try {
        await expect(sequelize.authenticate()).to.be.rejectedWith(ConnectionError);
        expect(connectSpy).to.have.been.calledOnce;

        // Some dialects check or set the time zone while connecting, in which case connect() rejects
        // and there is no connection to check. Postgres sets it once connected.
        const connection = await connectSpy.firstCall.returnValue.catch(() => null);
        if (dialectName === 'postgres') {
          expect(connection, 'connect() should have resolved').to.be.ok;
        }

        if (connection) {
          expect(connectionManager.validate(connection), 'the connection was not closed').to.equal(
            false,
          );
        }
      } finally {
        connectSpy.restore();
        await sequelize.close();
      }
    });
  }
});
