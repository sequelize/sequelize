import { DataTypes, Op, sql } from '@sequelize/core';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { assert, expect } from 'chai';
import { getTestDialect, getTestDialectTeaser, sequelize } from '../support';

const dialect = getTestDialect();
const queryInterface = sequelize.queryInterface;
const leftTick = sequelize.dialect.identifierDelimiter.start;
const rightTick = sequelize.dialect.identifierDelimiter.end;

const supportsSchema = (schema?: string) => {
  if (['mariadb', 'mysql', 'sqlite3'].includes(dialect)) {
    return {};
  }

  return { schema: schema ?? sequelize.dialect.getDefaultSchema() };
};

const supportsType = () => {
  let type = undefined;
  if (dialect === 'db2') {
    type = 'REG';
  }

  if (dialect === 'mssql') {
    type = 'NONCLUSTERED';
  }

  return type || sequelize.dialect.supports.addIndex.type ? { type } : {};
};

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
        tableName: 'users',
        ...supportsSchema(),
        name: 'unique_names',
        ...supportsType(),
        ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
        unique: false,
        primary: false,
        fields: [
          {
            name: 'username',
            order: 'ASC',
            ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
            ...(sequelize.dialect.supports.addIndex.collate && {
              collate: dialect === 'postgres' ? 'default' : undefined,
            }),
            ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
            ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
          },
        ],
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
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
        tableName: 'users',
        ...supportsSchema(),
        name: indexName,
        ...supportsType(),
        ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
        unique: false,
        primary: false,
        fields: [
          {
            name: 'first_name',
            order: 'ASC',
            ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
            ...(sequelize.dialect.supports.addIndex.collate && {
              collate: dialect === 'postgres' ? 'default' : undefined,
            }),
            ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
            ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
          },
          {
            name: 'last_name',
            order: 'ASC',
            ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
            ...(sequelize.dialect.supports.addIndex.collate && {
              collate: dialect === 'postgres' ? 'default' : undefined,
            }),
            ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
            ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
          },
        ],
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
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
        tableName: 'users',
        ...supportsSchema(),
        name: 'unique_names',
        ...supportsType(),
        ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
        unique: true,
        primary: false,
        fields: [
          {
            name: 'first_name',
            order: 'ASC',
            ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
            ...(sequelize.dialect.supports.addIndex.collate && {
              collate: dialect === 'postgres' ? 'default' : undefined,
            }),
            ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
            ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
          },
          {
            name: 'last_name',
            order: 'ASC',
            ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
            ...(sequelize.dialect.supports.addIndex.collate && {
              collate: dialect === 'postgres' ? 'default' : undefined,
            }),
            ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
            ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
          },
        ],
        ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
      });
    });

    if (sequelize.dialect.supports.addIndex.where) {
      it('should add a partial index', async () => {
        await queryInterface.addIndex('users', {
          name: 'partial_index',
          fields: ['first_name', 'last_name'],
          where: { username: { [Op.ne]: null } },
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'partial_index');

        assert(indexCheck);
        expect(indexCheck).to.deep.equal({
          tableName: 'users',
          ...supportsSchema(),
          name: 'partial_index',
          ...supportsType(),
          ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
          unique: false,
          primary: false,
          fields: [
            {
              name: 'first_name',
              order: 'ASC',
              ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
              ...(sequelize.dialect.supports.addIndex.collate && {
                collate: dialect === 'postgres' ? 'default' : undefined,
              }),
              ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
              ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
            },
            {
              name: 'last_name',
              order: 'ASC',
              ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
              ...(sequelize.dialect.supports.addIndex.collate && {
                collate: dialect === 'postgres' ? 'default' : undefined,
              }),
              ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
              ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
            },
          ],
          ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
          where:
            dialect === 'mssql'
              ? `([username] IS NOT NULL)`
              : dialect === 'postgres'
                ? 'username IS NOT NULL'
                : `${leftTick}username${rightTick} IS NOT NULL`,
        });
      });
    }

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
            tableName: 'users',
            ...supportsSchema(),
            name: 'user_username',
            ...supportsType(),
            ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
            unique: false,
            primary: false,
            fields: [
              {
                name: 'username',
                order: 'ASC',
                ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
                ...(sequelize.dialect.supports.addIndex.collate && {
                  collate: dialect === 'postgres' ? 'default' : undefined,
                }),
                ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
                ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
              },
            ],
            includes: ['first_name', 'last_name'],
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
          tableName: 'users',
          ...supportsSchema(),
          name: 'user_username',
          ...supportsType(),
          ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
          unique: true,
          primary: false,
          fields: [
            {
              name: 'username',
              order: 'ASC',
              ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
              ...(sequelize.dialect.supports.addIndex.collate && {
                collate: dialect === 'postgres' ? 'default' : undefined,
              }),
              ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
              ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
            },
          ],
          includes: ['first_name', 'last_name'],
        });
      });
    }

    if (sequelize.dialect.supports.addIndex.expression) {
      it('should add a function based index', async () => {
        await queryInterface.addIndex('users', {
          name: 'fn_index',
          fields: [
            sql.fn('lower', sql.attribute('first_name')),
            'username',
            sql`CASE WHEN ${sql.attribute('first_name')} IS NULL THEN 'foo' ELSE ${sql.attribute('first_name')} END`,
          ],
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'fn_index');

        assert(indexCheck);
        if (dialect === 'db2') {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            ...supportsSchema(),
            name: 'fn_index',
            ...supportsType(),
            unique: false,
            primary: false,
            fields: [
              'LOWER("first_name")',
              { name: 'username', order: 'ASC' },
              'CASE WHEN "first_name" IS NULL THEN \'foo\' ELSE "first_name" END',
            ],
            includes: [],
          });
        } else if (dialect === 'postgres') {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            schema: sequelize.dialect.getDefaultSchema(),
            name: 'fn_index',
            method: 'BTREE',
            unique: false,
            primary: false,
            fields: [
              {
                name: 'username',
                order: 'ASC',
                nullOrder: 'LAST',
                collate: 'default',
                operator: 'text_ops',
              },
              'lower(first_name::text)',
              `CASE
    WHEN first_name IS NULL THEN 'foo'::character varying
    ELSE first_name
END`,
            ],
            includes: [],
          });
        } else {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            ...supportsSchema(),
            name: 'fn_index',
            ...supportsType(),
            ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
            unique: false,
            primary: false,
            fields: [
              'lower(`first_name`)',
              {
                name: 'username',
                order: 'ASC',
                ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
                ...(sequelize.dialect.supports.addIndex.collate && { collate: undefined }),
                ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
                ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
              },
              "CASE WHEN `first_name` IS NULL THEN 'foo' ELSE `first_name` END",
            ],
            ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
          });
        }
      });

      it('should add a function based index with newlines', async () => {
        await queryInterface.addIndex('users', {
          name: 'fn_index_newlines',
          fields: [
            sql`
CASE
  WHEN ${sql.attribute('first_name')} IS NULL THEN 'foo'
  ELSE ${sql.attribute('first_name')}
END
`,
          ],
        });

        const indexes = await sequelize.queryInterface.showIndexes('users');
        const indexCheck = indexes.find(index => index.name === 'fn_index_newlines');

        assert(indexCheck);
        if (dialect === 'db2') {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            ...supportsSchema(),
            name: 'fn_index_newlines',
            ...supportsType(),
            unique: false,
            primary: false,
            fields: [`CASE   WHEN "first_name" IS NULL THEN 'foo'   ELSE "first_name" END`],
            includes: [],
          });
        } else if (dialect === 'postgres') {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            ...supportsSchema(),
            name: 'fn_index_newlines',
            method: 'BTREE',
            unique: false,
            primary: false,
            fields: [
              `
CASE
    WHEN first_name IS NULL THEN 'foo'::character varying
    ELSE first_name
END`,
            ],
            includes: [],
          });
        } else {
          expect(indexCheck).to.deep.equal({
            tableName: 'users',
            ...supportsSchema(),
            name: 'fn_index_newlines',
            ...supportsType(),
            ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
            unique: false,
            primary: false,
            fields: [
              `CASE
  WHEN ${leftTick}first_name${rightTick} IS NULL THEN 'foo'
  ELSE ${leftTick}first_name${rightTick}
END`,
            ],
            ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
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
          tableName: 'users',
          ...supportsSchema(schema),
          name: 'unique_names',
          ...supportsType(),
          ...(sequelize.dialect.supports.addIndex.method && { method: 'BTREE' }),
          unique: false,
          primary: false,
          fields: [
            {
              name: 'username',
              order: 'ASC',
              ...(sequelize.dialect.supports.addIndex.nullOrder && { nullOrder: 'LAST' }),
              ...(sequelize.dialect.supports.addIndex.collate && {
                collate: dialect === 'postgres' ? 'default' : undefined,
              }),
              ...(sequelize.dialect.supports.addIndex.length && { length: undefined }),
              ...(sequelize.dialect.supports.addIndex.operator && { operator: 'text_ops' }),
            },
          ],
          ...(sequelize.dialect.supports.addIndex.include && { includes: [] }),
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
