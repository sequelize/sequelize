'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , dialect = Support.getTestDialect()
  , Sequelize = require(__dirname + '/../../index')
  , Promise = Sequelize.Promise
  , sinon = require('sinon');

if (dialect !== 'sqlite') {
  // Sqlite does not support setting timezone

  describe(Support.getTestDialectTeaser('Timezone'), function() {
    beforeEach(function() {
      this.sequelizeWithTimezone = Support.createSequelizeInstance({
        timezone: '+07:00'
      });
    });

    it('returns the same value for current timestamp', function() {
      var now = 'now()'
        , startQueryTime = Date.now();

      if (dialect === 'mssql') {
        now = 'GETDATE()';
      }

      var query = 'SELECT ' + now + ' as now';
      return Promise.all([
        this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT }),
        this.sequelizeWithTimezone.query(query, { type: this.sequelize.QueryTypes.SELECT })
      ]).spread(function(now1, now2) {
        var elapsedQueryTime = (Date.now() - startQueryTime) + 20;
        expect(now1[0].now.getTime()).to.be.closeTo(now2[0].now.getTime(), elapsedQueryTime);
      });
    });

    if (Support.dialectIsMySQL()) {
      it('handles existing timestamps', function() {
        var NormalUser = this.sequelize.define('user', {})
          , TimezonedUser = this.sequelizeWithTimezone.define('user', {});

        return this.sequelize.sync({ force: true }).bind(this).then(function() {
          return TimezonedUser.create({});
        }).then(function(timezonedUser) {
          this.timezonedUser = timezonedUser;
          return NormalUser.find(timezonedUser.id);
        }).then(function(normalUser) {
          // Expect 7 hours difference, in milliseconds.
          // This difference is expected since two instances, configured for each their timezone is trying to read the same timestamp
          // this test does not apply to PG, since it stores the timezone along with the timestamp.
          expect(normalUser.createdAt.getTime() - this.timezonedUser.createdAt.getTime()).to.be.closeTo(60 * 60 * 7 * 1000, 50);
        });
      });
    }
  });
}
