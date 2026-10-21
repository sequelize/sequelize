'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

async function getEnumNames(sequelize, table) {
  const enums = await sequelize.queryInterface.pgListEnums(table);

  return enums.map(enumType => enumType.enum_name).sort();
}

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

    it('drops the enum types of a model along with its table', async function () {
      const Media = this.sequelize.define(
        'Media',
        {
          type: DataTypes.ENUM(['image', 'video']),
          tags: DataTypes.ARRAY(DataTypes.ENUM(['new', 'old'])),
        },
        { tableName: 'regression_drop_enum_media' },
      );

      await Media.sync({ force: true });
      expect(await getEnumNames(this.sequelize, Media.table)).to.deep.equal([
        'enum_regression_drop_enum_media_tags',
        'enum_regression_drop_enum_media_type',
      ]);

      await Media.drop();
      expect(await getEnumNames(this.sequelize, Media.table)).to.deep.equal([]);
    });

    it('drops the enum types of a model in a schema with renamed columns', async function () {
      const schema = 'regression_drop_enum_schema';
      await this.sequelize.createSchema(schema);

      const Media = this.sequelize.define(
        'Media',
        {
          mediaType: { type: DataTypes.ENUM(['image', 'video']), columnName: 'media_type' },
          mediaTags: {
            type: DataTypes.ARRAY(DataTypes.ENUM(['new', 'old'])),
            columnName: 'media_tags',
          },
        },
        { tableName: 'regression_drop_enum_media', schema },
      );

      await Media.sync({ force: true });
      expect(await getEnumNames(this.sequelize, Media.table)).to.deep.equal([
        'enum_regression_drop_enum_media_media_tags',
        'enum_regression_drop_enum_media_media_type',
      ]);

      await Media.drop();
      expect(await getEnumNames(this.sequelize, Media.table)).to.deep.equal([]);
    });

    it('recreates the enum types of a model on a forced sync', async function () {
      const tableName = 'regression_force_enum_media';
      const MediaV1 = this.sequelize.define(
        'MediaV1',
        { type: DataTypes.ENUM(['image', 'video']) },
        { tableName },
      );
      const MediaV2 = this.sequelize.define(
        'MediaV2',
        { type: DataTypes.ENUM(['audio']) },
        { tableName },
      );

      await MediaV1.sync({ force: true });
      await MediaV2.sync({ force: true });

      const enums = await this.sequelize.queryInterface.pgListEnums(MediaV2.table);
      expect(enums).to.have.lengthOf(1);
      expect(enums[0].enum_value).to.deep.equal(['audio']);
    });

    it('drops the enum types of the dropped model when another model uses the same table', async function () {
      const tableName = 'regression_shared_enum_media';
      this.sequelize.define('MediaV1', { type: DataTypes.ENUM(['image', 'video']) }, { tableName });
      const MediaV2 = this.sequelize.define(
        'MediaV2',
        { kind: DataTypes.ENUM(['audio']) },
        { tableName },
      );

      await MediaV2.sync({ force: true });
      expect(await getEnumNames(this.sequelize, MediaV2.table)).to.deep.equal([
        'enum_regression_shared_enum_media_kind',
      ]);

      await MediaV2.drop();
      expect(await getEnumNames(this.sequelize, MediaV2.table)).to.deep.equal([]);
    });
  });
}
