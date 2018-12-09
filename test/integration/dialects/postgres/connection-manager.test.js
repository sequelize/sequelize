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
      return tzTable.sync({ force: true }).then(() => {
        return tzTable.create({ foo: 'test' }).then(row => {
          expect(row).to.be.not.null;
        });
      });
    }

    it('should correctly parse the moment based timezone while fetching hstore oids', function() {
      return checkTimezoneParsing(this.sequelize.options);
    });
  });

  describe('Dynamic OIDs', () => {
    const dynamicTypesToCheck = [
      DataTypes.GEOMETRY,
      DataTypes.HSTORE,
      DataTypes.GEOGRAPHY,
      DataTypes.CITEXT
    ];

    // Expect at least these
    const expCastTypes = {
      integer: 'int4',
      decimal: 'numeric',
      date: 'timestamptz',
      dateonly: 'date',
      bigint: 'int8'
    };

    function reloadDynamicOIDs(sequelize) {
      // Reset oids so we need to refetch them
      sequelize.connectionManager._clearDynamicOIDs();
      sequelize.connectionManager._clearTypeParser();

      // Force start of connection manager to reload dynamic OIDs
      const User = sequelize.define('User', {
        perms: DataTypes.ENUM(['foo', 'bar'])
      });

      return User.sync({ force: true });
    }

    it('should fetch regular dynamic oids and create parsers', () => {
      const sequelize = Support.sequelize;
      return reloadDynamicOIDs(sequelize).then(() => {
        dynamicTypesToCheck.forEach(type => {
          expect(type.types.postgres,
            `DataType.${type.key}.types.postgres`).to.not.be.empty;

          for (const name of type.types.postgres) {
            const entry = sequelize.connectionManager.nameOidMap[name];
            const oidParserMap = sequelize.connectionManager.oidParserMap;

            expect(entry.oid, `nameOidMap[${name}].oid`).to.be.a('number');
            expect(entry.arrayOid, `nameOidMap[${name}].arrayOid`).to.be.a('number');

            expect(oidParserMap.get(entry.oid),
              `oidParserMap.get(nameOidMap[${name}].oid)`).to.be.a('function');
            expect(oidParserMap.get(entry.arrayOid),
              `oidParserMap.get(nameOidMap[${name}].arrayOid)`).to.be.a('function');
          }

        });
      });
    });

    it('should fetch enum dynamic oids and create parsers', () => {
      const sequelize = Support.sequelize;
      return reloadDynamicOIDs(sequelize).then(() => {
        const enumOids = sequelize.connectionManager.enumOids;
        const oidParserMap = sequelize.connectionManager.oidParserMap;

        expect(enumOids.oids, 'enumOids.oids').to.not.be.empty;
        expect(enumOids.arrayOids, 'enumOids.arrayOids').to.not.be.empty;

        for (const oid of enumOids.oids) {
          expect(oidParserMap.get(oid), 'oidParserMap.get(enumOids.oids)').to.be.a('function');
        }
        for (const arrayOid of enumOids.arrayOids) {
          expect(oidParserMap.get(arrayOid), 'oidParserMap.get(enumOids.arrayOids)').to.be.a('function');
        }
      });
    });

    it('should fetch range dynamic oids and create parsers', () => {
      const sequelize = Support.sequelize;
      return reloadDynamicOIDs(sequelize).then(() => {
        for (const baseKey in expCastTypes) {
          const name = expCastTypes[baseKey];
          const entry = sequelize.connectionManager.nameOidMap[name];
          const oidParserMap = sequelize.connectionManager.oidParserMap;

          for (const key of ['rangeOid', 'arrayRangeOid']) {
            expect(entry[key], `nameOidMap[${name}][${key}]`).to.be.a('number');
          }

          expect(oidParserMap.get(entry.rangeOid),
            `oidParserMap.get(nameOidMap[${name}].rangeOid)`).to.be.a('function');
          expect(oidParserMap.get(entry.arrayRangeOid),
            `oidParserMap.get(nameOidMap[${name}].arrayRangeOid)`).to.be.a('function');
        }
      });
    });

  });
}
