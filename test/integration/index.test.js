'use strict';

const chai = require('chai');
const semver = require('semver');

const expect = chai.expect;
const Support = require('./support');

const current = Support.sequelize;
const dialect = Support.getTestDialect();
const { DataTypes, Sequelize } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Indexes'), () => {
  describe('Indexes with include', () => {
    if (!current.dialect.supports.index.include) {
      return;
    }

    it('creates non-unique index with include columns', async function () {
      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name'], unique: false }],
      });

      // DB2 does not support non-unique indexes with include columns
      if (dialect === 'db2') {
        return this.User.sync({ force: true }).then(() => {
          expect.fail('This should have failed');
        }).catch(error => {
          expect(error.message).to.equal('DB2 does not support non-unique indexes with INCLUDE syntax.');
        });
      }

      await this.sequelize.sync({ force: true });
      const indexes = await this.sequelize.queryInterface.showIndex(this.User.tableName);
      const indexCheck = indexes.filter(index => index.name === 'user_username');

      expect(indexCheck).to.have.length(1);
      expect(indexCheck[0].name).to.equal('user_username');
      // DB2 lists the included columns in the fields array
      if (dialect !== 'db2') {
        expect(indexCheck[0].fields).to.have.length(1);
      } else {
        expect(indexCheck[0].fields).to.have.length(3);
      }

      expect(indexCheck[0].fields[0].attribute).to.equal('username');
    });

    it('creates unique index with include columns', async function () {
      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name'], unique: true }],
      });

      await this.sequelize.sync({ force: true });
      const indexes = await this.sequelize.queryInterface.showIndex(this.User.tableName);
      const indexCheck = indexes.filter(index => index.name === 'user_username');

      expect(indexCheck).to.have.length(1);
      expect(indexCheck[0].name).to.equal('user_username');
      // DB2 lists the included columns in the fields array
      if (dialect !== 'db2') {
        expect(indexCheck[0].fields).to.have.length(1);
      } else {
        expect(indexCheck[0].fields).to.have.length(3);
      }

      expect(indexCheck[0].fields[0].attribute).to.equal('username');
    });

    it('throws an error with duplicate column names', function () {
      const DatabaseError = Sequelize.DatabaseError;

      this.User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['username', 'first_name', 'last_name'], unique: true }],
      });

      return this.sequelize.sync({ force: true })
        .then(() => {
          if (dialect !== 'postgres') {
            expect.fail('This should have failed');
          }
        })
        .catch(error => {
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
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'], unique: true }],
      });

      return this.sequelize.sync({ force: true })
        .then(() => expect.fail('This should have failed'))
        .catch(error => {
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
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'], unique: true }],
      });

      return this.sequelize.sync({ force: true })
        .then(() => expect.fail('This should have failed'))
        .catch(error => {
          expect(error).to.be.instanceOf(DatabaseError);
          expect(error.message).to.match(/\s|^Column 'username' in table 'users' is of a type that is invalid for use as a key column in an index.$/);
        });
    });
  });
});
