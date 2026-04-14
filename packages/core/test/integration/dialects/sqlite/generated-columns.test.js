'use strict';

const { DataTypes, sql } = require('@sequelize/core');
const { expect } = require('chai');
const Support = require('../../support');

if (Support.getTestDialect() === 'sqlite3') {
  describe('[SQLITE Specific] generated columns', () => {
    const tableName = 'generated_columns_test';

    afterEach(async function () {
      await this.sequelize.queryInterface.dropTable(tableName);
    });

    it('adds a STORED generated column to a populated table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        price: DataTypes.INTEGER,
        quantity: DataTypes.INTEGER,
      });
      await queryInterface.bulkInsert(tableName, [{ price: 6, quantity: 7 }]);

      await queryInterface.addColumn(tableName, 'total', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('`price` * `quantity`'),
        generatedColumn: 'STORED',
      });

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { price: 6, quantity: 7, total: 42 },
      ]);
    });

    it('preserves a generated column when rebuilding for an unrelated column', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        value: DataTypes.INTEGER,
        obsolete: DataTypes.STRING,
        doubled: {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('`value` * 2'),
          generatedColumn: 'STORED',
        },
      });
      await queryInterface.bulkInsert(tableName, [{ value: 8, obsolete: 'remove me' }]);

      await queryInterface.removeColumn(tableName, 'obsolete');

      const description = await queryInterface.describeTable(tableName);
      expect(description.doubled.generatedColumn).to.equal('STORED');
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 8, doubled: 16 },
      ]);
    });

    it('supports sync alter with an existing generated column', async function () {
      const GeneratedModel = this.sequelize.define(
        'SqliteGeneratedColumn',
        {
          value: DataTypes.INTEGER,
          doubled: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('`value` * 2'),
            generatedColumn: 'STORED',
          },
        },
        { freezeTableName: true, tableName, timestamps: false },
      );
      await GeneratedModel.sync({ force: true });
      await GeneratedModel.create({ value: 11 });

      await GeneratedModel.sync({ alter: true });

      expect((await GeneratedModel.findOne()).doubled).to.equal(22);
    });
  });
}
