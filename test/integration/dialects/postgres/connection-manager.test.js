'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Sequelize', () => {
    async function checkTimezoneParsing(baseOptions) {
      const options = { ...baseOptions, timezone: 'Asia/Kolkata', timestamps: true };
      const sequelize = Support.createSequelizeInstance(options);

      const tzTable = sequelize.define('tz_table', { foo: DataTypes.STRING });
      await tzTable.sync({ force: true });
      const row = await tzTable.create({ foo: 'test' });
      expect(row).to.be.not.null;
    }

    it('should correctly parse the moment based timezone while fetching hstore oids', async function() {
      await checkTimezoneParsing(this.sequelize.options);
    });

    it('should set client_min_messages to warning by default', async () => {
      const result = await Support.sequelize.query('SHOW client_min_messages');
      expect(result[0].client_min_messages).to.equal('warning');
    });

    it('should allow overriding client_min_messages (deprecated in v7)', async () => {
      const sequelize = Support.createSequelizeInstance({ clientMinMessages: 'ERROR' });
      const result = await sequelize.query('SHOW client_min_messages');
      expect(result[0].client_min_messages).to.equal('error');
    });

    it('should not set client_min_messages if clientMinMessages is false (deprecated in v7)', async () => {
      const sequelize = Support.createSequelizeInstance({ clientMinMessages: false });
      const result = await sequelize.query('SHOW client_min_messages');
      // `notice` is Postgres's default
      expect(result[0].client_min_messages).to.equal('notice');
    });

    it('should allow overriding client_min_messages', async () => {
      const sequelize = Support.createSequelizeInstance({ dialectOptions: { clientMinMessages: 'ERROR' } });
      const result = await sequelize.query('SHOW client_min_messages');
      expect(result[0].client_min_messages).to.equal('error');
    });

    it('should not set client_min_messages if clientMinMessages is ignore', async () => {
      const sequelize = Support.createSequelizeInstance({ dialectOptions: { clientMinMessages: 'IGNORE' } });
      const result = await sequelize.query('SHOW client_min_messages');
      // `notice` is Postgres's default
      expect(result[0].client_min_messages).to.equal('notice');
    });

    it('should time out the query request when the query runs beyond the configured query_timeout', async () => {
      const sequelize = Support.createSequelizeInstance({
        dialectOptions: { query_timeout: 100 }
      });
      const error = await sequelize.query('select pg_sleep(2)').catch(e => e);
      expect(error.message).to.equal('Query read timeout');
    });

    it('should allow overriding session variables through the `options` param', async () => {
      const sequelize = Support.createSequelizeInstance({ dialectOptions: { options: '-csearch_path=abc' } });
      const result = await sequelize.query('SHOW search_path');
      expect(result[0].search_path).to.equal('abc');
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

    it('should fetch regular dynamic oids and create parsers', async () => {
      const sequelize = Support.sequelize;
      await reloadDynamicOIDs(sequelize);
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

    it('should fetch enum dynamic oids and create parsers', async () => {
      const sequelize = Support.sequelize;
      await reloadDynamicOIDs(sequelize);
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

    it('should fetch range dynamic oids and create parsers', async () => {
      const sequelize = Support.sequelize;
      await reloadDynamicOIDs(sequelize);
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
}
