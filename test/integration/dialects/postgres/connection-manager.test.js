'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  _ = require('lodash');

if ( dialect.match(/^postgres/) ) {
  describe('[POSTGRES] Sequelize', () => {
    function checkTimezoneParsing(baseOptions) {
      const options = _.extend({}, baseOptions, { timezone: 'Asia/Kolkata', timestamps: true });
      const sequelize = Support.createSequelizeInstance(options);

      const tzTable = sequelize.define('tz_table', { foo: DataTypes.STRING });
      return tzTable.sync({force: true}).then(() => {
        return tzTable.create({foo: 'test'}).then(row => {
          expect(row).to.be.not.null;
        });
      });
    }

    it('should correctly parse the moment based timezone', function() {
      return checkTimezoneParsing(this.sequelize.options);
    });

    it('should correctly parse the moment based timezone while fetching hstore oids', function() {
      // reset oids so we need to refetch them
      DataTypes.HSTORE.types.postgres.oids = [];
      DataTypes.HSTORE.types.postgres.array_oids = [];
      return checkTimezoneParsing(this.sequelize.options);
    });

    if ( process.env.DIALECT === 'postgres' ) {

      // This test will only run with node-pg 7.3.0 or greater. node-pg requires node-pg-native 2.0.0 or greater.
      // node-pg-native 2.0.0 breaks a bunch of tests.
      it.skip('should properly pass statement_timeout to postgres', function() {
        const options = _.extend({}, this.sequelize.options, { dialectOptions: { 'statement_timeout': 10 } });
        const sequelize = Support.createSequelizeInstance(options);

        return sequelize.query('SHOW statement_timeout')
          .then( result => {
            const timeout = _.get( result, '[0].statement_timeout' );
            expect(timeout).to.equal('10ms');
          });
      });

      // This test will only run with node-pg 7.3.0 or greater. node-pg requires node-pg-native 2.0.0 or greater.
      // node-pg-native 2.0.0 breaks a bunch of tests.
      it.skip('should properly error when a statement is cancelled due to a statement_timeout', function() {
        const self = this;
        const options = _.extend({}, this.sequelize.options, { dialectOptions: { 'statement_timeout': 10 } });
        const sequelize = Support.createSequelizeInstance(options);

        return sequelize.query('SELECT pg_sleep(1)')
          .then( () => {
            expect.fail('Postgres should have cancelled the query with an error');
          })
          .catch( self.sequelize.DatabaseError, error => {
            expect(error.parent.code).to.equal('57014'); // postgres query_cancelled error
          });
      });
    }

  });
}
