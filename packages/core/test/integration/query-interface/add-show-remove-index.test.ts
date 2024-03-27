import { DataTypes, sql } from '@sequelize/core';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { assert, expect } from 'chai';
import { getTestDialect, getTestDialectTeaser, sequelize } from '../support';

const dialect = getTestDialect();
const queryInterface = sequelize.queryInterface;

describe(getTestDialectTeaser('QueryInterface#{add,show,removeIndex}'), () => {
  describe('Standard Indexes', () => {
    beforeEach(async () => {
      await queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        username: DataTypes.STRING,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      });
    });

    it('should add, show and remove a index', async () => {
      await queryInterface.addIndex('users', {
        name: 'unique_names',
        fields: ['username'],
        unique: false,
      });

      const indexes = await sequelize.queryInterface.showIndexes('users');
      const indexCheck = indexes.find(index => index.name === 'unique_names');

      assert(indexCheck);
      expect(indexCheck).to.deep.equal({
        ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
          schema: sequelize.dialect.getDefaultSchema(),
        }),
        tableName: 'users',
        name: 'unique_names',
        fields: [
          {
            collate: undefined,
            length: undefined,
            name: 'username',
            order: 'ASC',
          },
        ],
        primary: false,
        unique: false,
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
        ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
      });

      await queryInterface.removeIndex('users', 'unique_names');
      const indexesAfterRemoval = await sequelize.queryInterface.showIndexes('users');
      const indexCheckAfterRemoval = indexesAfterRemoval.find(
        index => index.name === 'unique_names',
      );

      expect(indexCheckAfterRemoval).to.be.undefined;
    });

    it('should add and remove an index if name not supplied', async () => {
      await queryInterface.addIndex('users', { fields: ['first_name', 'last_name'] });
      const indexName = generateIndexName('users', { fields: ['first_name', 'last_name'] });

      const indexes = await sequelize.queryInterface.showIndexes('users');
      const indexCheck = indexes.find(index => index.name === indexName);

      assert(indexCheck);
      expect(indexCheck).to.deep.equal({
        ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
          schema: sequelize.dialect.getDefaultSchema(),
        }),
        tableName: 'users',
        name: indexName,
        fields: [
          {
            collate: undefined,
            length: undefined,
            name: 'first_name',
            order: 'ASC',
          },
          {
            collate: undefined,
            length: undefined,
            name: 'last_name',
            order: 'ASC',
          },
        ],
        primary: false,
        unique: false,
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
        ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
      });

      await queryInterface.removeIndex('users', ['first_name', 'last_name']);
      const indexesAfterRemoval = await sequelize.queryInterface.showIndexes('users');
      const indexCheckAfterRemoval = indexesAfterRemoval.find(index => index.name === indexName);

      expect(indexCheckAfterRemoval).to.be.undefined;
    });

    it('should add a unique index', async () => {
      await queryInterface.addIndex('users', {
        name: 'unique_names',
        fields: ['first_name', 'last_name'],
        unique: true,
      });

      const indexes = await sequelize.queryInterface.showIndexes('users');
      const indexCheck = indexes.find(index => index.name === 'unique_names');

      assert(indexCheck);
      expect(indexCheck).to.deep.equal({
        ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
          schema: sequelize.dialect.getDefaultSchema(),
        }),
        tableName: 'users',
        name: 'unique_names',
        fields: [
          {
            collate: undefined,
            length: undefined,
            name: 'first_name',
            order: 'ASC',
          },
          {
            collate: undefined,
            length: undefined,
            name: 'last_name',
            order: 'ASC',
          },
        ],
        primary: false,
        unique: true,
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
        ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
      });
    });

    if (sequelize.dialect.supports.addIndex.include) {
      it('should add, show and remove a index with include columns', async () => {
        const promise = queryInterface.addIndex('users', {
          name: 'user_username',
          fields: ['username'],
          include: ['first_name', 'last_name'],
          unique: false,
        });

        if (dialect === 'db2') {
          await expect(promise).to.be.rejectedWith(
            'DB2 does not support non-unique indexes with INCLUDE syntax.',
          );
        } else {
          await promise;
          const indexes = await sequelize.queryInterface.showIndexes('users');
          const indexCheck = indexes.find(index => index.name === 'user_username');

          assert(indexCheck);
          expect(indexCheck).to.deep.equal({
            ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
              schema: sequelize.dialect.getDefaultSchema(),
            }),
            tableName: 'users',
            name: 'user_username',
            fields: [
              {
                collate: undefined,
                length: undefined,
                name: 'username',
                order: 'ASC',
              },
            ],
            primary: false,
            unique: false,
            includes: ['first_name', 'last_name'],
            ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
          });

          await queryInterface.removeIndex('users', 'user_username');
          const indexesAfterRemoval = await sequelize.queryInterface.showIndexes('users');
          const indexCheckAfterRemoval = indexesAfterRemoval.find(
            index => index.name === 'user_username',
          );

          expect(indexCheckAfterRemoval).to.be.undefined;
        }
      });

      it('should add a unique index with include columns', async () => {
        await queryInterface.addIndex('users', {
          name: 'user_username',
          fields: ['username'],
          include: ['first_name', 'last_name'],
          unique: true,
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'user_username');

        assert(indexCheck);
        expect(indexCheck).to.deep.equal({
          ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
            schema: sequelize.dialect.getDefaultSchema(),
          }),
          tableName: 'users',
          name: 'user_username',
          fields: [
            {
              collate: undefined,
              length: undefined,
              name: 'username',
              order: 'ASC',
            },
          ],
          primary: false,
          unique: true,
          includes: ['first_name', 'last_name'],
          ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
        });
      });
    }

    if (sequelize.dialect.supports.addIndex.expression) {
      it('should add a function based index', async () => {
        await queryInterface.addIndex('users', {
          name: 'fn_index',
          fields: [sql.fn('lower', sql.attribute('first_name'))],
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'fn_index');

        assert(indexCheck);
        if (dialect === 'db2') {
          expect(indexCheck).to.deep.equal({
            schema: sequelize.dialect.getDefaultSchema(),
            tableName: 'users',
            name: 'fn_index',
            fields: [
              {
                collate: undefined,
                length: undefined,
                name: 'LOWER("first_name")',
                order: 'ASC',
              },
            ],
            primary: false,
            unique: false,
            includes: [],
          });
        } else {
          expect(indexCheck).to.deep.equal({
            ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
              schema: sequelize.dialect.getDefaultSchema(),
            }),
            tableName: 'users',
            name: 'fn_index',
            fields: [],
            primary: false,
            unique: false,
            ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
            ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
          });
        }
      });

      it('should add a function based index with newlines', async () => {
        await queryInterface.addIndex('users', {
          name: 'fn_index_newlines',
          fields: [
            sql.literal(`(
            CASE
              WHEN "first_name" IS NULL THEN 'foo'
              ELSE "first_name"
            END
          )`),
          ],
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'fn_index_newlines');

        assert(indexCheck);
        if (dialect === 'db2') {
          expect(indexCheck).to.deep.equal({
            schema: sequelize.dialect.getDefaultSchema(),
            tableName: 'users',
            name: 'fn_index_newlines',
            fields: [
              {
                collate: undefined,
                length: undefined,
                name: `(
            CASE
              WHEN "first_name" IS NULL THEN 'foo'
              ELSE "first_name"
            END
          )`.replaceAll('\n', ' '),
                order: 'ASC',
              },
            ],
            primary: false,
            unique: false,
            includes: [],
          });
        } else {
          expect(indexCheck).to.deep.equal({
            ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && {
              schema: sequelize.dialect.getDefaultSchema(),
            }),
            tableName: 'users',
            name: 'fn_index_newlines',
            fields: [],
            primary: false,
            unique: false,
            ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
            ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
          });
        }
      });
    }
  });

  if (sequelize.dialect.supports.schemas) {
    describe('Standard Indexes with Schema', () => {
      const schema = 'test_schema';
      beforeEach(async () => {
        await sequelize.createSchema('test_schema');
        await queryInterface.createTable(
          {
            tableName: 'users',
            schema,
          },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            username: DataTypes.STRING,
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
        );
      });

      it('should add, show and remove an index', async () => {
        await queryInterface.addIndex(
          { tableName: 'users', schema },
          { name: 'unique_names', fields: ['username'], unique: false },
        );

        const indexes = await sequelize.queryInterface.showIndexes({ tableName: 'users', schema });
        const indexCheck = indexes.find(index => index.name === 'unique_names');

        assert(indexCheck);
        expect(indexCheck).to.deep.equal({
          ...(!['mariadb', 'mysql', 'sqlite3'].includes(dialect) && { schema }),
          tableName: 'users',
          name: 'unique_names',
          fields: [
            {
              collate: undefined,
              length: undefined,
              name: 'username',
              order: 'ASC',
            },
          ],
          primary: false,
          unique: false,
          ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
          ...(sequelize.dialect.supports.addIndex.using && { using: 'BTREE' }),
        });

        await queryInterface.removeIndex({ tableName: 'users', schema }, 'unique_names');
        const indexesAfterRemoval = await sequelize.queryInterface.showIndexes({
          tableName: 'users',
          schema,
        });
        const indexCheckAfterRemoval = indexesAfterRemoval.find(
          index => index.name === 'unique_names',
        );

        expect(indexCheckAfterRemoval).to.be.undefined;
      });
    });
  }
});
