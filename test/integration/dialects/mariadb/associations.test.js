'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect !== 'mariadb') return;

describe('[MariaDB Specific] Associations', () => {
  describe('many-to-many', () => {
    describe('where tables have the same prefix', () => {
      it('should create a table wp_table1wp_table2s', async function() {
        const Table2 = this.sequelize.define('wp_table2', { foo: DataTypes.STRING }),
          Table1 = this.sequelize.define('wp_table1',
            { foo: DataTypes.STRING });

        Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
        Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });
        await Table1.sync({ force: true });
        await Table2.sync({ force: true });
        expect(this.sequelize.modelManager.getModel(
          'wp_table1swp_table2s')).to.exist;
      });
    });

    describe('when join table name is specified', () => {
      beforeEach(async function() {
        const Table2 = this.sequelize.define('ms_table1', { foo: DataTypes.STRING }),
          Table1 = this.sequelize.define('ms_table2',
            { foo: DataTypes.STRING });

        Table1.belongsToMany(Table2, { through: 'table1_to_table2' });
        Table2.belongsToMany(Table1, { through: 'table1_to_table2' });
        await Table1.sync({ force: true });
        await Table2.sync({ force: true });
      });

      it('should not use only a specified name', function() {
        expect(this.sequelize.modelManager.getModel(
          'ms_table1sms_table2s')).not.to.exist;
        expect(
          this.sequelize.modelManager.getModel('table1_to_table2')).to.exist;
      });
    });
  });

  describe('HasMany', () => {
    beforeEach(async function() {
      //prevent periods from occurring in the table name since they are used to delimit (table.column)
      this.User = this.sequelize.define(`User${Math.ceil(Math.random() * 10000000)}`, { name: DataTypes.STRING });
      this.Task = this.sequelize.define(`Task${Math.ceil(Math.random() * 10000000)}`, { name: DataTypes.STRING });
      this.users = null;
      this.tasks = null;

      this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { as: 'Users', through: 'UserTasks' });

      const users = [];
      const tasks = [];

      for (let i = 0; i < 5; ++i) {
        users[i] = { name: `User${Math.random()}` };
        tasks[i] = { name: `Task${Math.random()}` };
      }

      await this.sequelize.sync({ force: true });
      await this.User.bulkCreate(users);
      await this.Task.bulkCreate(tasks);
    });

  });
});
