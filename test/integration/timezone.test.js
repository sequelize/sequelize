'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  dialect = Support.getTestDialect(),
  Sequelize = require(__dirname + '/../../index'),
  Promise = Sequelize.Promise;

if (dialect !== 'sqlite') {
  // Sqlite does not support setting timezone

  describe(Support.getTestDialectTeaser('Timezone'), () => {
    beforeEach(function() {
      this.sequelizeWithTimezone = Support.createSequelizeInstance({
        timezone: '+07:00'
      });
      this.sequelizeWithNamedTimezone = Support.createSequelizeInstance({
        timezone: 'America/New_York'
      });
    });

    it('returns the same value for current timestamp', function() {
      let now = 'now()';
      const startQueryTime = Date.now();

      if (dialect === 'mssql') {
        now = 'GETDATE()';
      }

      const query = 'SELECT ' + now + ' as now';
      return Promise.all([
        this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT }),
        this.sequelizeWithTimezone.query(query, { type: this.sequelize.QueryTypes.SELECT })
      ]).spread((now1, now2) => {
        const elapsedQueryTime = Date.now() - startQueryTime + 1001;
        expect(now1[0].now.getTime()).to.be.closeTo(now2[0].now.getTime(), elapsedQueryTime);
      });
    });

    if (dialect === 'mysql') {
      it('handles existing timestamps', function() {
        const NormalUser = this.sequelize.define('user', {}),
          TimezonedUser = this.sequelizeWithTimezone.define('user', {});

        return this.sequelize.sync({ force: true }).bind(this).then(() => {
          return NormalUser.create({});
        }).then(function(normalUser) {
          this.normalUser = normalUser;
          return TimezonedUser.findById(normalUser.id);
        }).then(function(timezonedUser) {
          // Expect 7 hours difference, in milliseconds.
          // This difference is expected since two instances, configured for each their timezone is trying to read the same timestamp
          // this test does not apply to PG, since it stores the timezone along with the timestamp.
          expect(this.normalUser.createdAt.getTime() - timezonedUser.createdAt.getTime()).to.be.closeTo(60 * 60 * 7 * 1000, 1000);
        });
      });

      it('handles named timezones', function() {
        const NormalUser = this.sequelize.define('user', {}),
          TimezonedUser = this.sequelizeWithNamedTimezone.define('user', {});

        return this.sequelize.sync({ force: true }).bind(this).then(() => {
          return TimezonedUser.create({});
        }).then(timezonedUser => {
          return Promise.all([
            NormalUser.findById(timezonedUser.id),
            TimezonedUser.findById(timezonedUser.id)
          ]);
        }).spread((normalUser, timezonedUser) => {
          // Expect 5 hours difference, in milliseconds, +/- 1 hour for DST
          expect(normalUser.createdAt.getTime() - timezonedUser.createdAt.getTime()).to.be.closeTo(60 * 60 * 4 * 1000 * -1, 60 * 60 * 1000);
        });
      });
    }
  });
}
