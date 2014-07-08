"use strict";

var chai        = require('chai')
  , expect      = chai.expect
  , Support     = require(__dirname + '/support')
  , dialect     = Support.getTestDialect()
  , Transaction = require(__dirname + '/../lib/transaction')
  , Sequelize   = require(__dirname + '/../index')
  , Promise     = Sequelize.Promise
  , sinon       = require('sinon');

if (dialect !== 'sqlite') {
  // Sqlite does not support setting timezone

  describe.only(Support.getTestDialectTeaser('Timezone'), function () {
    beforeEach(function () {
      this.sequelizeWithTimezone = Support.createSequelizeInstance({
        timezone: '+07:00',
        dialect: dialect
      });
    });

    it('returns the same value for current timestamp', function () {
      var query = "SELECT now() as now";
      return Promise.all([
        this.sequelize.query(query),
        this.sequelizeWithTimezone.query(query)
      ]).spread(function (now1, now2) {
        expect(now1[0].now.getTime()).to.be.closeTo(now2[0].now.getTime(), 50);
      });
    });

    if (Support.dialectIsMySQL()) {
      it('handles existing timestamps', function () {
        var NormalUser = this.sequelize.define('user', {})
          , TimezonedUser = this.sequelizeWithTimezone.define('user', {});

        return this.sequelize.sync({ force: true }).bind(this).then(function () {
          return NormalUser.create({});
        }).then(function (normalUser) {
          this.normalUser = normalUser;
          return TimezonedUser.find(normalUser.id);
        }).then(function (timezonedUser) {
          // Expect 7 hours difference, in milliseconds.
          // This difference is expected since two instances, configured for each their timezone is trying to read the same timestamp
          // this test does not apply to PG, since it stores the timezone along with the timestamp.
          expect(this.normalUser.createdAt.getTime() - timezonedUser.createdAt.getTime() ).to.be.closeTo(60 * 60 * 7 * 1000, 50);
        });
      });
    }
  });
}
