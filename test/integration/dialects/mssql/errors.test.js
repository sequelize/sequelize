'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const { DataTypes, Sequelize } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Indexes'), () => {
  describe('Indexes with include', () => {
    if (!current.dialect.supports.index.include) {
      return;
    }

    it('creates index with include columns', function () {
      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name'] }],
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return this.sequelize.queryInterface.showIndex(this.User.tableName);
      }).then(indexes => {
        expect(indexes).to.have.length(2);
        expect(indexes[1].name).to.equal('user_username');
        expect(indexes[1].fields).to.have.length(1);
        expect(indexes[1].fields[0].attribute).to.equal('username');
      });
    });

    it('throws an error with duplicate column names', function () {
      const DatabaseError = Sequelize.DatabaseError;

      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['username', 'first_name', 'last_name'] }],
      });

      return this.sequelize.sync({ force: true }).catch(error => {
        expect(error).to.be.instanceOf(DatabaseError);
        expect(error.message).to.match(/\s|^Cannot use duplicate column names in index. Column name 'username' listed more than once.$/);
      });
    });

    it('throws an error with missing column names', function () {
      const DatabaseError = Sequelize.DatabaseError;

      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'] }],
      });

      return this.sequelize.sync({ force: true }).catch(error => {
        expect(error).to.be.instanceOf(DatabaseError);
        expect(error.message).to.match(/\s|^Column name 'email' does not exist in the target table or view.$/);
      });
    });

    it('throws an error with invalid column type', function () {
      const DatabaseError = Sequelize.DatabaseError;

      this.User = this.sequelize.define('user', {
        username: DataTypes.TEXT,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'] }],
      });

      return this.sequelize.sync({ force: true }).catch(error => {
        expect(error).to.be.instanceOf(DatabaseError);
        expect(error.message).to.match(/\s|^Column 'username' in table 'users' is of a type that is invalid for use as a key column in an index.$/);
      });
    });
  });
});
