'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes, Sequelize } = require('@sequelize/core');

if (dialect === 'mssql') {
  describe('[MSSQL Specific] Errors', () => {
    describe('DatabaseError', () => {
      describe('Indexes with include', () => {
        it('duplicate column names', function () {
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

        it('missing column names', function () {
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

        it('invalid column type', function () {
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
  });
}
