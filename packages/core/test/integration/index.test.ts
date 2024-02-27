'use strict';

import { DataTypes, DatabaseError } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, getTestDialectTeaser, sequelize } from './support';

const dialect = getTestDialect();

describe(getTestDialectTeaser('Indexes'), () => {
  describe('Indexes with include', () => {
    it('creates unique index', async () => {
      const User = sequelize.define(
        'user',
        {
          username: { type: DataTypes.STRING, unique: true },
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING,
        },
        {
          indexes: [{ name: 'unique_names', fields: ['first_name', 'last_name'], unique: true }],
        },
      );

      await sequelize.sync({ force: true });
      const indexes = await sequelize.queryInterface.showIndex(User.table);
      const indexCheck = indexes.find(index => index.name === 'unique_names');

      expect(indexCheck?.name).to.equal('unique_names');
      expect(indexCheck?.unique).to.equal(true);
      expect(indexCheck?.fields).to.have.length(2);
      expect(indexCheck?.fields[0].attribute).to.equal('first_name');
      expect(indexCheck?.fields[1].attribute).to.equal('last_name');
    });

    if (sequelize.dialect.supports.schemas) {
      it('creates unique index with a custom schema', async () => {
        await sequelize.createSchema('test_schema');
        const User = sequelize.define(
          'user',
          {
            username: { type: DataTypes.STRING, unique: true },
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            schema: 'test_schema',
            indexes: [{ name: 'unique_names', fields: ['first_name', 'last_name'], unique: true }],
          },
        );

        await sequelize.sync({ force: true });
        const indexes = await sequelize.queryInterface.showIndex(User.table);
        const indexCheck = indexes.find(index => index.name === 'unique_names');

        expect(indexCheck?.name).to.equal('unique_names');
        expect(indexCheck?.unique).to.equal(true);
        expect(indexCheck?.fields).to.have.length(2);
        expect(indexCheck?.fields[0].attribute).to.equal('first_name');
        expect(indexCheck?.fields[1].attribute).to.equal('last_name');
      });
    }

    if (sequelize.dialect.supports.index.include) {
      it('creates non-unique index with include columns', async () => {
        const User = sequelize.define(
          'user',
          {
            username: DataTypes.STRING,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            indexes: [
              {
                name: 'user_username',
                fields: ['username'],
                include: ['first_name', 'last_name'],
                unique: false,
              },
            ],
          },
        );

        if (dialect === 'db2') {
          try {
            await sequelize.sync({ force: true });
            expect.fail('This should have failed');
          } catch (error: any) {
            expect(error.message).to.equal(
              'DB2 does not support non-unique indexes with INCLUDE syntax.',
            );
          }
        } else {
          await sequelize.sync({ force: true });
          const indexes = await sequelize.queryInterface.showIndex(User.table);
          const indexCheck = indexes.find(index => index.name === 'user_username');

          expect(indexCheck?.name).to.equal('user_username');
          expect(indexCheck?.fields).to.have.length(1);
          expect(indexCheck?.fields[0].attribute).to.equal('username');
          expect(indexCheck?.includes).to.have.length(2);
          expect(indexCheck?.includes).to.include('first_name');
          expect(indexCheck?.includes).to.include('last_name');
        }
      });

      it('creates unique index with include columns', async () => {
        const User = sequelize.define(
          'user',
          {
            username: DataTypes.STRING,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            indexes: [
              {
                name: 'user_username',
                fields: ['username'],
                include: ['first_name', 'last_name'],
                unique: true,
              },
            ],
          },
        );

        await sequelize.sync({ force: true });
        const indexes = await sequelize.queryInterface.showIndex(User.table);
        const indexCheck = indexes.find(index => index.name === 'user_username');

        expect(indexCheck?.name).to.equal('user_username');
        expect(indexCheck?.unique).to.equal(true);
        expect(indexCheck?.fields).to.have.length(1);
        expect(indexCheck?.fields[0].attribute).to.equal('username');
        expect(indexCheck?.includes).to.have.length(2);
        expect(indexCheck?.includes).to.include('first_name');
        expect(indexCheck?.includes).to.include('last_name');
      });

      it('throws an error with duplicate column names', async () => {
        const User = sequelize.define(
          'user',
          {
            username: DataTypes.STRING,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            indexes: [
              {
                name: 'user_username',
                fields: ['username'],
                include: ['username', 'first_name', 'last_name'],
                unique: true,
              },
            ],
          },
        );

        try {
          await sequelize.sync({ force: true });
          if (dialect === 'postgres') {
            const indexes = await sequelize.queryInterface.showIndex(User.table);
            const indexCheck = indexes.find(index => index.name === 'user_username');
            expect(indexCheck?.name).to.equal('user_username');
            expect(indexCheck?.unique).to.equal(true);
            expect(indexCheck?.fields).to.have.length(1);
            expect(indexCheck?.fields[0].attribute).to.equal('username');
            expect(indexCheck?.includes).to.have.length(3);
            expect(indexCheck?.includes).to.include('username');
            expect(indexCheck?.includes).to.include('first_name');
            expect(indexCheck?.includes).to.include('last_name');
          } else {
            expect.fail('This should have failed');
          }
        } catch (error: any) {
          expect(error).to.be.instanceOf(DatabaseError);
          expect(error.message).to.match(
            /\s|^Cannot use duplicate column names in index. Column name 'username' listed more than once.$/,
          );
        }
      });

      it('throws an error with missing column names', async () => {
        sequelize.define(
          'user',
          {
            username: DataTypes.STRING,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            indexes: [
              {
                name: 'user_username',
                fields: ['username'],
                include: ['first_name', 'last_name', 'email'],
                unique: true,
              },
            ],
          },
        );

        try {
          await sequelize.sync({ force: true });
          expect.fail('This should have failed');
        } catch (error: any) {
          expect(error).to.be.instanceOf(DatabaseError);
          expect(error.message).to.match(
            /\s|^Column name 'email' does not exist in the target table or view.$/,
          );
        }
      });

      it('throws an error with invalid column type', async () => {
        sequelize.define(
          'user',
          {
            username: DataTypes.TEXT,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            indexes: [
              {
                name: 'user_username',
                fields: ['username'],
                include: ['first_name', 'last_name', 'email'],
                unique: true,
              },
            ],
          },
        );

        try {
          await sequelize.sync({ force: true });
          expect.fail('This should have failed');
        } catch (error: any) {
          expect(error).to.be.instanceOf(DatabaseError);
          expect(error.message).to.match(
            /\s|^Column 'username' in table 'users' is of a type that is invalid for use as a key column in an index.$/,
          );
        }
      });
    }
  });
});
