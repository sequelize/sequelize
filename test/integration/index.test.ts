'use strict';

import { expect } from 'chai';
import { DataTypes, DatabaseError } from '@sequelize/core';
import { sequelize, getTestDialect, getTestDialectTeaser } from './support';

const dialect = getTestDialect();

describe(getTestDialectTeaser('Indexes'), () => {
  describe('Indexes with include', () => {
    if (!sequelize.dialect.supports.index.include) {
      return;
    }

    it('creates non-unique index with include columns', async () => {
      const User = sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name'], unique: false }],
      });

      if (dialect === 'db2') {
        try {
          await sequelize.sync({ force: true });
          expect.fail('This should have failed');
        } catch (error: any) {
          expect(error.message).to.equal('DB2 does not support non-unique indexes with INCLUDE syntax.');
        }
      } else {
        await sequelize.sync({ force: true });
        const indexes = await sequelize.queryInterface.showIndex(User.getTableName());
        const indexCheck = indexes.filter(index => index.name === 'user_username');

        expect(indexCheck).to.have.length(1);
        expect(indexCheck[0].name).to.equal('user_username');
        expect(indexCheck[0].fields).to.have.length(1);
        expect(indexCheck[0].fields[0].attribute).to.equal('username');
      }
    });

    it('creates unique index with include columns', async () => {
      const User = sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name'], unique: true }],
      });

      await sequelize.sync({ force: true });
      const indexes = await sequelize.queryInterface.showIndex(User.getTableName());
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

    it('throws an error with duplicate column names', async () => {
      sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['username', 'first_name', 'last_name'], unique: true }],
      });

      try {
        await sequelize.sync({ force: true });
        if (dialect !== 'postgres') {
          expect.fail('This should have failed');
        }
      } catch (error: any) {
        expect(error).to.be.instanceOf(DatabaseError);
        expect(error.message).to.match(/\s|^Cannot use duplicate column names in index. Column name 'username' listed more than once.$/);
      }
    });

    it('throws an error with missing column names', async () => {
      const User = sequelize.define('user', {
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'], unique: true }],
      });

      await expect(User.sync({ force: true }))
        .to.be.rejectedWith(DatabaseError, /\s|^Column name 'email' does not exist in the target table or view.$/);
    });

    it('throws an error with invalid column type', async () => {
      sequelize.define('user', {
        username: DataTypes.TEXT,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        indexes: [{ name: 'user_username', fields: ['username'], include: ['first_name', 'last_name', 'email'], unique: true }],
      });

      try {
        await sequelize.sync({ force: true });
        expect.fail('This should have failed');
      } catch (error: any) {
        expect(error).to.be.instanceOf(DatabaseError);
        expect(error.message).to.match(/\s|^Column 'username' in table 'users' is of a type that is invalid for use as a key column in an index.$/);
      }
    });
  });
});
