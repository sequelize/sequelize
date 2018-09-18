'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] sqlite_master raw queries', () => {
    beforeEach(function() {
      this.sequelize.define('SomeTable', {
        someColumn: DataTypes.INTEGER
      }, {
        freezeTableName: true,
        timestamps: false
      });

      return this.sequelize.sync({ force: true });
    });

    it('should be able to select with tbl_name filter', function() {
      return this.sequelize.query('SELECT * FROM sqlite_master WHERE tbl_name=\'SomeTable\'')
        .then(result => {
          const rows = result[0];
          expect(rows).to.have.length(1);
          const row = rows[0];
          expect(row).to.have.property('type', 'table');
          expect(row).to.have.property('name', 'SomeTable');
          expect(row).to.have.property('tbl_name', 'SomeTable');
          expect(row).to.have.property('sql');
        });
    });

    it('should be able to select *', function() {
      return this.sequelize.query('SELECT * FROM sqlite_master')
        .then(result => {
          const rows = result[0];
          expect(rows).to.have.length(2);
          rows.forEach(row => {
            expect(row).to.have.property('type');
            expect(row).to.have.property('name');
            expect(row).to.have.property('tbl_name');
            expect(row).to.have.property('rootpage');
            expect(row).to.have.property('sql');
          });
        });
    });

    it('should be able to select just "sql" column and get rows back', function() {
      return this.sequelize.query('SELECT sql FROM sqlite_master WHERE tbl_name=\'SomeTable\'')
        .then(result => {
          const rows = result[0];
          expect(rows).to.have.length(1);
          const row = rows[0];
          expect(row).to.have.property('sql',
            'CREATE TABLE `SomeTable` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `someColumn` INTEGER)');
        });
    });
  });
}
