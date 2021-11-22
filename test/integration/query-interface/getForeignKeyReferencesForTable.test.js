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
  });
});
