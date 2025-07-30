import type {
  InferAttributes,
  InferCreationAttributes,
  Model,
  ModelStatic,
  Sequelize,
} from '@sequelize/core';
import { DataTypes, Op, sql, where } from '@sequelize/core';
import { expect } from 'chai';
import { QueryBuilder } from '../../../lib/expression-builders/query-builder';
import {
  createSequelizeInstance,
  expectsql,
  getTestDialect,
  getTestDialectTeaser,
} from '../../support';

interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
  id: number;
  name: string;
  active: boolean;
  age?: number;
}

interface TPost extends Model<InferAttributes<TPost>, InferCreationAttributes<TPost>> {
  id: number;
  title: string;
  content?: string;
  userId?: number;
}

describe(getTestDialectTeaser('QueryBuilder'), () => {
  let sequelize: Sequelize;
  let User: ModelStatic<any>;
  let Post: ModelStatic<any>;

  beforeEach(async () => {
    sequelize = createSequelizeInstance();

    User = sequelize.define<TUser>(
      'User',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false },
        active: { type: DataTypes.BOOLEAN, defaultValue: true },
        age: { type: DataTypes.INTEGER },
      },
      {
        tableName: 'users',
      },
    );

    Post = sequelize.define<TPost>(
      'Post',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING, allowNull: false },
        content: { type: DataTypes.TEXT },
        userId: { type: DataTypes.INTEGER },
      },
      {
        tableName: 'posts',
      },
    );

    await Post.sync({ force: true });
    await Post.truncate();
    await User.sync({ force: true });
    await User.truncate();
  });

  afterEach(async () => {
    return sequelize?.close();
  });

  describe('Basic QueryBuilder functionality', () => {
    it('should generate basic SELECT query', () => {
      expectsql(User.select().getQuery(), {
        default: `SELECT [User].* FROM [users] AS [User];`,
      });
    });

    it('should generate SELECT query with specific attributes', () => {
      expectsql(User.select().attributes(['name', 'email']).getQuery(), {
        default: `SELECT [name], [email] FROM [users] AS [User];`,
      });
    });

    // Won't work with minified aliases
    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should generate SELECT query with aliased attributes', () => {
        expectsql(
          User.select()
            .attributes([['name', 'username'], 'email'])
            .getQuery(),
          {
            default: 'SELECT [name] AS [username], [email] FROM [users] AS [User];',
          },
        );
      });

      it('should generate SELECT query with literal attributes', () => {
        expectsql(
          User.select()
            .attributes([sql.literal('"User"."email" AS "personalEmail"')])
            .getQuery(),
          {
            default: 'SELECT "User"."email" AS "personalEmail" FROM [users] AS [User];', // literal
          },
        );

        expectsql(
          User.select()
            .attributes([[sql.literal('"User"."email"'), 'personalEmail']])
            .getQuery(),
          {
            default: 'SELECT "User"."email" AS [personalEmail] FROM [users] AS [User];',
          },
        );
      });
    }

    it('should generate SELECT query with WHERE clause', () => {
      expectsql(User.select().where({ active: true }).getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = true;',
        sqlite3: 'SELECT `User`.* FROM `users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = 1;',
      });
    });

    it('should generate SELECT query with multiple WHERE conditions', () => {
      expectsql(User.select().where({ active: true, age: 25 }).getQuery(), {
        default:
          'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = true AND [User].[age] = 25;',
        sqlite3:
          'SELECT `User`.* FROM `users` AS `User` WHERE `User`.`active` = 1 AND `User`.`age` = 25;',
        mssql:
          'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = 1 AND [User].[age] = 25;',
      });
    });

    it('should generate complete SELECT query with attributes and WHERE', () => {
      expectsql(User.select().attributes(['name', 'email']).where({ active: true }).getQuery(), {
        default: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[active] = true;',
        sqlite3: 'SELECT `name`, `email` FROM `users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[active] = 1;',
      });
    });

    it('should generate SELECT query with LIMIT', () => {
      expectsql(User.select().limit(10).getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[id] LIMIT 10;',
        mssql:
          'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;',
        db2: 'SELECT "User".* FROM "users" AS "User" ORDER BY "User"."id" FETCH NEXT 10 ROWS ONLY;',
      });
    });

    it('should generate SELECT query with LIMIT and OFFSET', () => {
      expectsql(User.select().limit(10).offset(5).getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[id] LIMIT 10 OFFSET 5;',
        'mysql mariadb sqlite3':
          'SELECT [User].* FROM `users` AS `User` ORDER BY `User`.`id` LIMIT 10 OFFSET 5;',
        'mssql db2':
          'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[id] OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;',
      });
    });

    it('should generate SELECT query with ORDER BY', () => {
      expectsql(User.select().orderBy(['name']).getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[name];',
      });

      expectsql(
        User.select()
          .orderBy([['age', 'DESC']])
          .getQuery(),
        {
          default: 'SELECT [User].* FROM [users] AS [User] ORDER BY [User].[age] DESC;',
        },
      );
    });

    // TODO: Figure out how to implement this
    // it('should support ORDER BY with position notation', () => {
    //   expectsql(User.select().orderBy([2]).getQuery(), {
    //     default: 'SELECT [User].* FROM [users] AS [User] ORDER BY 2;',
    //   });

    //   expectsql(User.select().orderBy([[3, 'DESC']]).getQuery(), {
    //     default: 'SELECT [User].* FROM [users] AS [User] ORDER BY 3 DESC;',
    //   });
    // });

    // Won't work with minified aliases
    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should generate SELECT query with GROUP BY', () => {
        expectsql(
          User.select()
            .attributes(['name', [sql.literal('MAX("age")'), 'maxAge']])
            .groupBy('name')
            .orderBy([[sql.literal('MAX("age")'), 'DESC']])
            .getQuery(),
          {
            default:
              'SELECT [name], MAX("age") AS [maxAge] FROM [users] AS [User] GROUP BY [name] ORDER BY MAX("age") DESC;',
          },
        );
      });

      it('should generate SELECT query with GROUP BY and HAVING', () => {
        expectsql(
          User.select()
            .attributes(['name', [sql.literal('MAX("age")'), 'maxAge']])
            .groupBy('name')
            .having(sql.literal('MAX("age") > 30'))
            .getQuery(),
          {
            default:
              'SELECT [name], MAX("age") AS [maxAge] FROM [users] AS [User] GROUP BY [name] HAVING MAX("age") > 30;',
          },
        );

        expectsql(
          User.select()
            .attributes(['name', [sql.literal('MAX("age")'), 'maxAge']])
            .groupBy('name')
            .having(sql.literal('MAX("age") > 30'))
            .andHaving(sql.literal('COUNT(*) > 1'))
            .getQuery(),
          {
            default:
              'SELECT [name], MAX("age") AS [maxAge] FROM [users] AS [User] GROUP BY [name] HAVING MAX("age") > 30 AND COUNT(*) > 1;',
          },
        );
      });
    }
  });

  describe('Functional/Immutable behavior', () => {
    it('should return new instances for each method call', () => {
      const builder1 = User.select();
      const builder2 = builder1.attributes(['name']);
      const builder3 = builder2.where({ active: true });

      expect(builder1).to.not.equal(builder2);
      expect(builder2).to.not.equal(builder3);
      expect(builder1).to.not.equal(builder3);
    });

    it('should not mutate original builder when chaining', () => {
      const baseBuilder = User.select();
      const builderWithAttributes = baseBuilder.attributes(['name']);
      const builderWithWhere = baseBuilder.where({ active: true });

      // Base builder should remain unchanged
      expectsql(baseBuilder.getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User];',
      });

      // Other builders should have their modifications
      expectsql(builderWithAttributes.getQuery(), {
        default: 'SELECT [name] FROM [users] AS [User];',
      });

      expectsql(builderWithWhere.getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = true;',
        sqlite3: 'SELECT `User`.* FROM `users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = 1;',
      });
    });

    it('should allow building different queries from same base', () => {
      const baseBuilder = User.select().attributes(['name', 'email']);

      expectsql(baseBuilder.where({ active: true }).getQuery(), {
        default: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[active] = true;',
        sqlite3: 'SELECT `name`, `email` FROM `users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[active] = 1;',
      });

      expectsql(baseBuilder.where({ age: { [Op.lt]: 30 } }).getQuery(), {
        default: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[age] < 30;',
      });
    });
  });

  if (getTestDialect() === 'postgres') {
    describe('PostgreSQL-specific features', () => {
      it('should handle PostgreSQL operators correctly', () => {
        expectsql(
          User.select()
            .where({
              name: { [Op.iLike]: '%john%' },
              age: { [Op.between]: [18, 65] },
            })
            .getQuery(),
          {
            default:
              "SELECT [User].* FROM [users] AS [User] WHERE [User].[name] ILIKE '%john%' AND ([User].[age] BETWEEN 18 AND 65);",
          },
        );
      });

      it('should handle array operations', () => {
        expectsql(
          User.select()
            .where({
              name: { [Op.in]: ['John', 'Jane', 'Bob'] },
            })
            .getQuery(),
          {
            default:
              "SELECT [User].* FROM [users] AS [User] WHERE [User].[name] IN ('John', 'Jane', 'Bob');",
          },
        );
      });

      it('should quote identifiers properly for PostgreSQL', () => {
        expectsql(User.select().attributes(['name', 'email']).where({ active: true }).getQuery(), {
          default: 'SELECT [name], [email] FROM [users] AS [User] WHERE [User].[active] = true;',
        });
      });
    });
  }

  describe('Error handling', () => {
    it('should throw error when getQuery is called on non-select builder', () => {
      expect(() => {
        const builder = new QueryBuilder(User);
        builder.getQuery();
      }).to.throw();
    });

    it('should handle empty attributes array', () => {
      expect(() => {
        User.select().attributes([]).getQuery();
      }).to.throw(/Attempted a SELECT query for model 'User' as .* without selecting any columns/);
    });
  });

  describe('Complex WHERE conditions', () => {
    it('should handle complex nested conditions', () => {
      expectsql(
        User.select()
          .where({
            [Op.or]: [
              { active: true },
              {
                [Op.and]: [{ age: { [Op.gte]: 18 } }, { name: { [Op.like]: '%admin%' } }],
              },
            ],
          })
          .getQuery(),
        {
          default:
            "SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = true OR ([User].[age] >= 18 AND [User].[name] LIKE '%admin%');",
          sqlite3:
            "SELECT `User`.* FROM `users` AS `User` WHERE `User`.`active` = 1 OR (`User`.`age` >= 18 AND `User`.`name` LIKE '%admin%');",
          mssql:
            "SELECT [User].* FROM [users] AS [User] WHERE [User].[active] = 1 OR ([User].[age] >= 18 AND [User].[name] LIKE N'%admin%');",
        },
      );
    });

    it('should handle IS NULL conditions', () => {
      expectsql(User.select().where({ age: null }).getQuery(), {
        default: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[age] IS NULL;',
      });
    });

    it('should handle NOT NULL conditions', () => {
      expectsql(
        User.select()
          .where({ age: { [Op.ne]: null } })
          .getQuery(),
        {
          default: 'SELECT [User].* FROM [users] AS [User] WHERE [User].[age] IS NOT NULL;',
        },
      );
    });

    it('should generate multiline query', () => {
      expectsql(
        User.select()
          .attributes(['name', 'email'])
          .where({ age: { [Op.gt]: 30 } })
          .getQuery({ multiline: true }),
        {
          default: [
            'SELECT [name], [email]',
            'FROM [users] AS [User]',
            'WHERE [User].[age] > 30;',
          ].join('\n'),
        },
      );
    });

    if (getTestDialect() === 'postgres' && !process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should handle complex conditions with multiple joins', async () => {
        const Comments = sequelize.define(
          'Comments',
          {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            userId: DataTypes.INTEGER,
            content: DataTypes.STRING,
            likes: DataTypes.INTEGER,
          },
          { tableName: 'comments' },
        );
        await Comments.sync({ force: true });
        await Post.sync({ force: true });
        await User.sync({ force: true });

        await User.create({ name: 'Alice', email: 'alice@example.com', active: true, age: 20 });
        await User.create({ name: 'Bob', email: 'bob@example.com', active: true, age: 25 });
        await Post.create({ title: 'Creed', userId: 1 });
        await Post.create({ title: 'Crocodiles', userId: 2 });
        await Post.create({ title: 'Cronos', userId: 2 });
        await Comments.create({ content: 'Comment 1', userId: 1, likes: 10 });
        await Comments.create({ content: 'Comment 2', userId: 1, likes: 20 });
        await Comments.create({ content: 'Comment 3', userId: 2, likes: 50 });

        const qb = User.select()
          .attributes(['name', ['age', 'userAge']])
          .includes({
            model: Post,
            as: 'p',
            on: where(sql.col('User.id'), Op.eq, sql.col('p.userId')),
            attributes: ['title'],
            where: { title: { [Op.iLike]: '%cr%' } },
            required: true,
          })
          .includes({
            model: Comments,
            as: 'c',
            on: where(sql.col('User.id'), Op.eq, sql.col('c.userId')),
            attributes: [[sql.literal('SUM("c"."likes")'), 'likeCount']],
            joinType: 'LEFT',
          })
          .where({
            [Op.or]: [
              { active: true },
              {
                [Op.and]: [{ age: { [Op.gte]: 18 } }, { name: { [Op.iLike]: '%admin%' } }],
              },
            ],
          })
          .groupBy([sql.col('User.id'), sql.col('p.id')])
          .having(sql.literal('SUM("c"."likes") > 10'))
          .andHaving(sql.literal('SUM("c"."likes") < 300'))
          .orderBy([
            ['name', 'DESC'],
            [sql.col('p.title'), 'ASC'],
          ]);
        const query = qb.getQuery({ multiline: true });
        expectsql(query, {
          default: [
            'SELECT "User"."name", "User"."age" AS "userAge", "p"."title" AS "p.title", SUM("c"."likes") AS "c.likeCount"',
            'FROM "users" AS "User"',
            'INNER JOIN "posts" AS "p" ON "User"."id" = "p"."userId" AND "p"."title" ILIKE \'%cr%\'',
            'LEFT OUTER JOIN "comments" AS "c" ON "User"."id" = "c"."userId"',
            'WHERE "User"."active" = true OR ("User"."age" >= 18 AND "User"."name" ILIKE \'%admin%\')',
            'GROUP BY "User"."id", "p"."id"',
            'HAVING SUM("c"."likes") > 10 AND SUM("c"."likes") < 300',
            'ORDER BY "User"."name" DESC, "p"."title" ASC;',
          ].join('\n'),
        });
        const [result] = await qb.execute();
        expect(result).to.have.lengthOf(3);
        expect(result).to.deep.equal([
          {
            name: 'Bob',
            userAge: 25,
            'p.title': 'Crocodiles',
            'c.likeCount': '50',
          },
          {
            name: 'Bob',
            userAge: 25,
            'p.title': 'Cronos',
            'c.likeCount': '50',
          },
          {
            name: 'Alice',
            userAge: 20,
            'p.title': 'Creed',
            'c.likeCount': '30',
          },
        ]);
      });
    }
  });

  describe('includes (custom joins)', () => {
    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should generate LEFT JOIN with custom condition', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
            })
            .getQuery(),
          {
            default:
              'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[userId] AS [Posts.userId], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [users] AS [User] LEFT OUTER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
          },
        );
      });

      it('should generate INNER JOIN when required is true', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              required: true,
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
            })
            .getQuery(),
          {
            default:
              'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[userId] AS [Posts.userId], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [users] AS [User] INNER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
          },
        );
      });

      it('should generate INNER JOIN when joinType is INNER', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              joinType: 'INNER',
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
            })
            .getQuery(),
          {
            default:
              'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[userId] AS [Posts.userId], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [users] AS [User] INNER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
          },
        );
      });

      it('should handle custom WHERE conditions on joined table', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
              where: {
                title: 'Hello World',
              },
            })
            .getQuery(),
          {
            default:
              "SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[userId] AS [Posts.userId], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [users] AS [User] LEFT OUTER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId] AND [Posts].[title] = 'Hello World';",
            mssql:
              "SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[userId] AS [Posts.userId], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [users] AS [User] LEFT OUTER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId] AND [Posts].[title] = N'Hello World';",
          },
        );
      });

      it('should support custom attributes from joined table', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              attributes: ['title'],
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
            })
            .getQuery(),
          {
            default:
              'SELECT [User].*, [Posts].[title] AS [Posts.title] FROM [users] AS [User] LEFT OUTER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
          },
        );
      });

      it('should generate multiline query', () => {
        expectsql(
          User.select()
            .attributes(['name'])
            .includes({
              model: Post,
              as: 'Posts',
              attributes: ['title'],
              on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
            })
            .where({ age: { [Op.gt]: 30 } })
            .getQuery({ multiline: true }),
          {
            default: [
              'SELECT [User].[name], [Posts].[title] AS [Posts.title]',
              'FROM [users] AS [User]',
              'LEFT OUTER JOIN [posts] AS [Posts] ON [User].[id] = [Posts].[userId]',
              'WHERE [User].[age] > 30;',
            ].join('\n'),
          },
        );
      });
    }

    it('should throw error when model is not provided', () => {
      expect(() => {
        User.select().includes({
          on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
        } as never);
      }).to.throw(Error, 'Model is required for includes');
    });

    it('should throw error when on condition is not provided', () => {
      expect(() => {
        User.select()
          .includes({
            model: Post,
            as: 'Posts',
          })
          .getQuery();
      }).to.throw(Error, 'Custom joins require an "on" condition to be specified');
    });
  });

  describe('execute', () => {
    it('should execute the query', async () => {
      await User.sync({ force: true });
      await User.create({ name: 'John', email: 'john@example.com', active: true });
      const result = await User.select()
        .attributes(['name'])
        .where({ active: true, name: 'John' })
        .execute();
      const [row] = result;
      expect(row).to.deep.equal([{ name: 'John' }]);
    });

    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should execute the query with custom join, returning multiple rows', async () => {
        await User.sync({ force: true });
        await Post.sync({ force: true });
        const user = await User.create({ name: 'John', email: 'john@example.com', active: true });
        await Post.create({ title: 'Post 1', userId: user.id });
        await Post.create({ title: 'Post 2', userId: user.id });
        const [result] = await User.select()
          .includes({
            model: Post,
            as: 'Posts',
            on: where(sql.col('User.id'), Op.eq, sql.col('Posts.userId')),
          })
          .where({ id: user.id })
          .execute();
        expect(result).to.have.lengthOf(2);
        expect((result[0] as any).id).to.equal(user.id);
        expect((result[0] as any).name).to.equal(user.name);
        expect((result[1] as any).id).to.equal(user.id);
        expect((result[1] as any).name).to.equal(user.name);
        expect((result[0] as any)['Posts.title']).to.equal('Post 1');
        expect((result[1] as any)['Posts.title']).to.equal('Post 2');
      });
    }
  });
});
