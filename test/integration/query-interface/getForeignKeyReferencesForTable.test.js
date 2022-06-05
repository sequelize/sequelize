'use strict';

const { DataTypes } = require('@sequelize/core');
const Support = require('../support');

const _ = require('lodash');

const chai = require('chai');

const expect = chai.expect;

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdentifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function () {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('getForeignKeyReferencesForTable', () => {
    it('should be able to provide existing foreign keys when one association exists', async function () {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });

      const expectedObject = {
        tableColumnNames: ['UserId'],
        referencedTableColumnNames: ['id'],
        referencedTableName: 'Users',
      };

      let refs = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Tasks' });
      expect(refs.length).to.equal(1);
      expect(refs[0]).deep.include.all(expectedObject);

      refs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
      expect(refs.length).to.equal(1);
      expect(refs[0]).deep.include.all(expectedObject);

    });

    it('should be able to provide existing foreign keys when multiple associations exist', async function () {
      const Author    = this.sequelize.define('Author',    { name: DataTypes.STRING });
      const Book      = this.sequelize.define('Book',      { title: DataTypes.STRING });
      const Publisher = this.sequelize.define('Publisher', { name: DataTypes.STRING });
      const Critic    = this.sequelize.define('Critic',    { name: DataTypes.STRING });

      Author.hasMany(Book);
      Publisher.hasMany(Book);
      Book.belongsTo(Publisher);
      Book.belongsTo(Author);
      Book.belongsToMany(Critic, { through: 'Reviews' });
      Critic.belongsToMany(Book, { through: 'Reviews' });

      const options = { force: true };

      await Author.sync(options);
      await Publisher.sync(options);
      await Book.sync(options);
      await Critic.sync(options);

      // searches all objects for the all expected key/value pair matches (subset in data)
      function dataContainsSubset(data, subset) {
        return data.some(tuple => {
          const keys = Object.keys(tuple);

          // First test that all keeys exist
          const hasAllKeys = Object.keys(subset).every(key => keys.includes(key));
          const hasMatchingValues = hasAllKeys && Object.entries(subset).every(([key, value]) => {
            return _.isEqual(tuple[key], value);
          });

          return hasAllKeys && hasMatchingValues;
        });
      }

      // --------------------------------------------------------
      // -- Books
      // --------------------------------------------------------
      let bookRefs = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Books' });
      expect(bookRefs.length).to.equal(2);

      // using custom function as opposed to `deep.include`
      //   because `bookRefs[0]` expects an order that isn't guaranteed
      expect(dataContainsSubset(bookRefs, {
        tableColumnNames: ['AuthorId'],
        referencedTableColumnNames: ['id'],
        referencedTableName: 'Authors',
      })).to.be.true;
      expect(dataContainsSubset(bookRefs, {
        tableColumnNames: ['PublisherId'],
        referencedTableColumnNames: ['id'],
        referencedTableName: 'Publishers',
      })).to.be.true;

      // same query called with different argument format
      bookRefs = await this.queryInterface.getForeignKeyReferencesForTable('Books');
      expect(bookRefs.length).to.equal(2);
      expect(dataContainsSubset(bookRefs, {
        tableColumnNames: ['AuthorId'],
        referencedTableColumnNames: ['id'],
        referencedTableName: 'Authors',
      })).to.be.true;
      expect(dataContainsSubset(bookRefs, {
        tableColumnNames: ['PublisherId'],
        referencedTableColumnNames: ['id'],
        referencedTableName: 'Publishers',
      })).to.be.true;

      // --------------------------------------------------------
      // -- Other objects
      // --------------------------------------------------------
      // Some due-diligence testing on other created tables
      const authors    = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Authors' });
      const publishers = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Publishers' });
      const reviews    = await this.queryInterface.getForeignKeyReferencesForTable({ tableName: 'Reviews' });
      expect(authors).to.have.length(0);
      expect(publishers).to.have.length(0);
      expect(reviews).to.have.length(0);

    });
  });
});
