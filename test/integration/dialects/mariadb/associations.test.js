'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect !== 'mariadb') return;

describe('[MariaDB Specific] Associations', () => {
  describe('many-to-many', () => {
    describe('where tables have the same prefix', () => {
      it('should create a table wp_table1wp_table2s', function() {
        const Table2 = this.sequelize.define('wp_table2', { foo: DataTypes.STRING }),
          Table1 = this.sequelize.define('wp_table1',
            { foo: DataTypes.STRING }),
          self = this;

        Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
        Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });
        return Table1.sync({ force: true }).then(() => {
          return Table2.sync({ force: true }).then(() => {
            expect(self.sequelize.modelManager.getModel(
              'wp_table1swp_table2s')).to.exist;
          });
        });
      });
    });

    describe('when join table name is specified', () => {
      beforeEach(function() {
        const Table2 = this.sequelize.define('ms_table1', { foo: DataTypes.STRING }),
          Table1 = this.sequelize.define('ms_table2',
            { foo: DataTypes.STRING });

        Table1.belongsToMany(Table2, { through: 'table1_to_table2' });
        Table2.belongsToMany(Table1, { through: 'table1_to_table2' });
        return Table1.sync({ force: true }).then(() => {
          return Table2.sync({ force: true });
        });
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
    beforeEach(function() {
      //prevent periods from occurring in the table name since they are used to delimit (table.column)
      this.User = this.sequelize.define(`User${Math.ceil(Math.random() * 10000000)}`, { name: DataTypes.STRING });
      this.Task = this.sequelize.define(`Task${Math.ceil(Math.random() * 10000000)}`, { name: DataTypes.STRING });
      this.users = null;
      this.tasks = null;

      this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { as: 'Users', through: 'UserTasks' });

      const self = this,
        users = [],
        tasks = [];

      for (let i = 0; i < 5; ++i) {
        users[users.length] = { name: `User${Math.random()}` };
      }

      for (let x = 0; x < 5; ++x) {
        tasks[tasks.length] = { name: `Task${Math.random()}` };
      }

      return this.sequelize.sync({ force: true })
        .then(() => self.User.bulkCreate(users))
        .then(() => self.Task.bulkCreate(tasks));

    });

  });
});
