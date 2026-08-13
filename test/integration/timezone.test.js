import * as chai from 'chai';
import Support from './support.js';
import Sequelize from '../../index.js';

const expect = chai.expect;

const Promise = Sequelize.Promise;

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

  // A session timezone is applied via one of two mutually exclusive statements:
  // `SET TIME ZONE '<name>'` for a named zone, and `SET TIME ZONE INTERVAL '<offset>'
  // HOUR TO MINUTE` for a UTC offset. They are not interchangeable -- Postgres reads a
  // bare '+07:00' under the POSIX convention, so feeding an offset to the named-zone
  // branch silently lands the session on UTC-07 instead of UTC+07. Rendering a known
  // instant is what distinguishes them; `now()` does not, because it comes back as a
  // timestamptz whose offset the driver uses to recover the correct absolute time
  // either way.
  const renderKnownInstant = (sequelize) => {
    return sequelize
      .query("SELECT (timestamptz '2015-01-20 00:00:00+00')::text AS rendered", {
        type: sequelize.QueryTypes.SELECT
      })
      .then((rows) => rows[0].rendered);
  };

  it('applies a named timezone to the session', function () {
    return renderKnownInstant(this.sequelizeWithNamedTimezone).then((rendered) => {
      expect(rendered).to.equal('2015-01-19 19:00:00-05');
    });
  });

  it('applies an offset timezone to the session with the sign the user intended', function () {
    return renderKnownInstant(this.sequelizeWithTimezone).then((rendered) => {
      expect(rendered).to.equal('2015-01-20 07:00:00+07');
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
