'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] Regressions', () => {
    it('properly fetch OIDs after sync, #8749', async function () {
      const User = this.sequelize.define('User', {
        active: DataTypes.BOOLEAN,
      });

      /**
       * This Model is important, sync will try to fetch OIDs after each ENUM model sync
       * Having ENUM in this model will force OIDs re-fetch
       * We are testing that OID refresh keep base type intact
       */
      const Media = this.sequelize.define('Media', {
        type: DataTypes.ENUM(['image', 'video', 'audio']),
      });

      User.hasMany(Media);
      Media.belongsTo(User);

      await this.sequelize.sync({ force: true });

      const user1 = await User.create({ active: true });
      expect(user1.active).to.be.true;
      expect(user1.get('active')).to.be.true;

      const user0 = await User.findOne();
      expect(user0.active).to.be.true;
      expect(user0.get('active')).to.be.true;

      const user = await User.findOne({ raw: true });
      expect(user.active).to.be.true;
    });

    it('backfills an enum type that already exists but has no values yet', async function () {
      const Media = this.sequelize.define(
        'Media',
        {
          type: DataTypes.ENUM(['image', 'video', 'audio']),
        },
        { tableName: 'regression_empty_enum_media' },
      );

      const enumTypeName = this.sequelize.dialect.queryGenerator.pgEnumName(Media.table, 'type', {
        noEscape: true,
      });

      await this.sequelize.queryInterface.dropTable(Media.table, { cascade: true });
      await this.sequelize.query(`DROP TYPE IF EXISTS "${enumTypeName}"`);
      await this.sequelize.query(`CREATE TYPE "${enumTypeName}" AS ENUM ()`);

      await Media.sync();

      const enums = await this.sequelize.queryInterface.pgListEnums(Media.table);
      const enumRow = enums.find(enumType => enumType.enum_name === enumTypeName);
      expect(enumRow.enum_value).to.deep.equal(['image', 'video', 'audio']);
    });
  });
}
