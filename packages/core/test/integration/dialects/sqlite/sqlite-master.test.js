'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect === 'sqlite3') {
  describe('[SQLITE Specific] sqlite_master raw queries', () => {
    beforeEach(async function () {
      this.sequelize.define(
        'SomeTable',
        {
          someColumn: DataTypes.INTEGER,
        },
        {
          freezeTableName: true,
          timestamps: false,
        },
      );

      await this.sequelize.sync({ force: true });
    });

    it('should be able to select with tbl_name filter', async function () {
      const result = await this.sequelize.query(
        "SELECT * FROM sqlite_master WHERE tbl_name='SomeTable'",
      );
      const rows = result[0];
      expect(rows).to.have.length(1);
      const row = rows[0];
      expect(row).to.have.property('type', 'table');
      expect(row).to.have.property('name', 'SomeTable');
      expect(row).to.have.property('tbl_name', 'SomeTable');
      expect(row).to.have.property('sql');
    });

    it('should be able to select *', async function () {
      const result = await this.sequelize.query('SELECT * FROM sqlite_master');
      const rows = result[0];
      expect(rows).to.have.length(2);
      for (const row of rows) {
        expect(row).to.have.property('type');
        expect(row).to.have.property('name');
        expect(row).to.have.property('tbl_name');
        expect(row).to.have.property('rootpage');
        expect(row).to.have.property('sql');
      }
    });

    it('should be able to select just "sql" column and get rows back', async function () {
      const result = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE tbl_name='SomeTable'",
      );
      const rows = result[0];
      expect(rows).to.have.length(1);
      const row = rows[0];
      expect(row).to.have.property(
        'sql',
        'CREATE TABLE `SomeTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `someColumn` INTEGER)',
      );
    });
  });
}
