'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = require(__dirname + '/../../index'),
  Promise = Sequelize.Promise;

// Sqlite does not support setting timezone

describe(Support.getTestDialectTeaser('Timezone'), () => {
  beforeEach(function () {
    this.sequelizeWithTimezone = Support.createSequelizeInstance({
      timezone: '+07:00'
    });
    this.sequelizeWithNamedTimezone = Support.createSequelizeInstance({
      timezone: 'America/New_York'
    });
  });

  it('returns the same value for current timestamp', function () {
    const now = 'now()';
    const startQueryTime = Date.now();

    const query = 'SELECT ' + now + ' as now';
    return Promise.all([
      this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT }),
      this.sequelizeWithTimezone.query(query, { type: this.sequelize.QueryTypes.SELECT })
    ]).then(([now1, now2]) => {
      const elapsedQueryTime = Date.now() - startQueryTime + 1001;
      expect(now1[0].now.getTime()).to.be.closeTo(now2[0].now.getTime(), elapsedQueryTime);
    });
  });
});
