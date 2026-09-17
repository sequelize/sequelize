'use strict';

const chai = require('chai');
const { DataTypes } = require('@sequelize/core');

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

    it('does not change the session time zone if keepDefaultTimezone is true', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        timezone: 'Europe/Amsterdam',
        keepDefaultTimezone: true,
      });

      const [result] = await sequelize.query(
        'SELECT @@session.time_zone AS session, @@global.time_zone AS global',
        { type: sequelize.QueryTypes.SELECT },
      );

      expect(result.session).to.equal(result.global);
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

  describe('named timezone in both DST periods', () => {
    Support.useProcessTimezone('Asia/Tokyo');

    const january = new Date('2024-01-15T12:00:00.000Z');
    const july = new Date('2024-07-15T12:00:00.000Z');

    const sessionTimeZoneDateType = ['mysql', 'mariadb'].includes(dialectName)
      ? 'TIMESTAMP NULL'
      : DataTypes.DATE;

    async function setup(type) {
      const sequelize = Support.createSingleTestSequelizeInstance({
        timezone: 'Europe/Amsterdam',
      });
      const Event = sequelize.define('Event', { at: type }, { timestamps: false });
      await Event.sync({ force: true });

      const table = sequelize.queryGenerator.quoteTable(Event);
      const column = sequelize.queryGenerator.quoteIdentifier('at');

      return { sequelize, Event, table, column };
    }

    async function getInstants(sequelize, table, column) {
      const rows = await sequelize.query(`SELECT ${column} FROM ${table} ORDER BY ${column} ASC`, {
        type: sequelize.QueryTypes.SELECT,
      });

      return rows.map(row => new Date(row.at).toISOString());
    }

    it('writes wall-clock times using the offset of their own DST period', async () => {
      const { column, sequelize, table } = await setup(sessionTimeZoneDateType);

      await sequelize.query(
        `INSERT INTO ${table} (${column}) VALUES ('2024-01-15 13:00:00'), ('2024-07-15 14:00:00')`,
      );

      expect(await getInstants(Support.sequelize, table, column)).to.deep.equal([
        january.toISOString(),
        july.toISOString(),
      ]);
    });

    it('reads wall-clock times using the offset of their own DST period', async () => {
      const { column, sequelize, table } = await setup(sessionTimeZoneDateType);

      await Support.sequelize.query(
        `INSERT INTO ${table} (${column}) VALUES ('2024-01-15 12:00:00'), ('2024-07-15 12:00:00')`,
      );

      expect(await getInstants(sequelize, table, column)).to.deep.equal([
        january.toISOString(),
        july.toISOString(),
      ]);
    });

    it('stores Date bind parameters of raw queries as the right instant', async () => {
      const { column, sequelize, table } = await setup(sessionTimeZoneDateType);

      await sequelize.query(`INSERT INTO ${table} (${column}) VALUES ($1), ($2)`, {
        bind: [january, july],
      });

      expect(await getInstants(Support.sequelize, table, column)).to.deep.equal([
        january.toISOString(),
        july.toISOString(),
      ]);
    });

    it('stores Date bind parameters of raw queries as the right wall-clock time', async () => {
      const { column, Event, sequelize, table } = await setup(DataTypes.DATE(3));

      await sequelize.query(`INSERT INTO ${table} (${column}) VALUES ($1), ($2)`, {
        bind: [january, july],
      });

      const events = await Event.findAll({ order: [['at', 'ASC']] });

      expect(events.map(event => event.at.toISOString())).to.deep.equal([
        january.toISOString(),
        july.toISOString(),
      ]);
    });
  });
});
