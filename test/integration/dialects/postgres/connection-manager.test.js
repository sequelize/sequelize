'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Sequelize', () => {
    function checkTimezoneParsing(baseOptions) {
      const options = Object.assign({}, baseOptions, { timezone: 'Asia/Kolkata', timestamps: true });
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
  });

  describe('Dynamic OIDs', () => {
    const dynamicTypesToCheck = [
      DataTypes.GEOMETRY,
      DataTypes.HSTORE,
      DataTypes.GEOGRAPHY,
      DataTypes.ENUM,
      DataTypes.CITEXT
    ];

    it('should fetch dynamic oids from the database', () => {
      dynamicTypesToCheck.forEach(type => {
        type.types.postgres.oids = [];
        type.types.postgres.array_oids = [];
      });

      // Model is needed to test the ENUM dynamic OID
      const User = Support.sequelize.define('User', {
        perms: DataTypes.ENUM([
          'foo', 'bar'
        ])
      });

      return User.sync({force: true}).then(() => {
        dynamicTypesToCheck.forEach(type => {
          expect(type.types.postgres.oids, `DataType.${type.key}`).to.not.be.empty;
          expect(type.types.postgres.array_oids, `DataType.${type.key}`).to.not.be.empty;
        });
      });
    });
  });
}
