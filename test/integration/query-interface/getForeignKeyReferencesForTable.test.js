'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('getForeignKeyReferencesForTable', () => {
    it('should be able to provide existing foreign keys', async function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });

      const expectedObject = {
        columnName: 'UserId',
        referencedColumnName: 'id',
        referencedTableName: 'Users'
      };

      let refs = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Tasks' });
      expect(refs.length).to.equal(1);
      expect(refs[0]).deep.include.all(expectedObject);

      refs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
      expect(refs.length).to.equal(1);
      expect(refs[0]).deep.include.all(expectedObject);

    });

    describe('with schemas', () => {
      if (Support.sequelize.dialect.supports.schemas) {
        beforeEach(async function() {
          this.schema = 'test_schema';
          await this.queryInterface.createSchema(this.schema);

          const TaskTest = this.sequelize.define('TaskTest', { title: DataTypes.STRING }, { tableName: 'Tasks', schema: this.schema });
          const UserTest = this.sequelize.define('UserTest', { username: DataTypes.STRING }, { tableName: 'Users', schema: this.schema });

          UserTest.hasOne(TaskTest, { foreignKey: 'UserId' });

          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }, { tableName: 'Tasks' });
          const User = this.sequelize.define('User', { username: DataTypes.STRING }, { tableName: 'Users' });

          User.hasOne(Task, { foreignKey: 'UserId' });        

          await UserTest.sync({ force: true });
          await TaskTest.sync({ force: true });
          await User.sync({ force: true });
          await Task.sync({ force: true });
        });

        it('should return only references to the tables on the right schema', async function() {
          const tasksTestRefs = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Tasks', schema: this.schema });
          expect(tasksTestRefs).to.have.lengthOf(1);
          expect(tasksTestRefs[0]).deep.include.all({
            columnName: 'UserId',
            referencedColumnName: 'id',
            referencedTableName: 'Users',
            tableSchema: this.schema
          });
        });

        it('should only return references to the tables on the default schema', async function() {        
          const taskRefs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
          expect(taskRefs).to.have.lengthOf(1);
          expect(taskRefs[0]).deep.equal({
            columnName: 'UserId',
            referencedColumnName: 'id',
            referencedTableName: 'Users'
          });
        });
      }
    });    
  });
});
