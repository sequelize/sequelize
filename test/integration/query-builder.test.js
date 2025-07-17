const { DataTypes, Op } = require('../../src');
const { expect } = require('chai');
const QueryBuilder = require('../../src/query-builder');
const Support = require('../support');

const expectsql = Support.expectsql;

describe(Support.getTestDialectTeaser('QueryBuilder'), () => {
  /** @type {typeof import('../../src/model').Model} */
  let User;
  /** @type {typeof import('../../src/model').Model} */
  let Post;
  /** @type {import('../../src/sequelize').Sequelize} */
  let sequelize;
  before(async function() {
    sequelize = this.sequelize;
    User = this.sequelize.define('User', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
      active: DataTypes.BOOLEAN
    });
    Post = this.sequelize.define('Post', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      userId: DataTypes.INTEGER,
      title: DataTypes.STRING,
      content: DataTypes.STRING
    });
    await User.sync({ force: true });
    await Post.sync({ force: true });
    this.sequelize.options.quoteIdentifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  after(async () => {
    if (this.sequelize) {
      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.close();
    }
  });

  describe('Basic QueryBuilder functionality', () => {
    it('should generate basic SELECT query', () => {
      expectsql(User.select().getQuery(), {
        default: 'SELECT * FROM [Users] AS [User];',
        oracle: 'SELECT * FROM "Users" "User";'
      });
    });

    it('should generate SELECT query with specific attributes', () => {
      expectsql(User.select().attributes(['name', 'email']).getQuery(), {
        default: 'SELECT [name], [email] FROM [Users] AS [User];',
        oracle: 'SELECT "name", "email" FROM "Users" "User";'
      });
    });

    // Won't work with minified aliases
    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should generate SELECT query with aliased attributes', () => {
        expectsql(User.select().attributes([['name', 'username'], 'email']).getQuery(), {
          default: 'SELECT [name] AS [username], [email] FROM [Users] AS [User];',
          oracle: 'SELECT "name" AS "username", "email" FROM "Users" "User";'
        });
      });

      it('should generate SELECT query with literal attributes', () => {
        expectsql(User.select().attributes([sequelize.literal('"User"."email" AS "personalEmail"')]).getQuery(), {
          default: 'SELECT "User"."email" AS "personalEmail" FROM [Users] AS [User];', // literal
          oracle: 'SELECT "User"."email" AS "personalEmail" FROM "Users" "User";'
        });

        expectsql(User.select().attributes([[sequelize.literal('"User"."email"'), 'personalEmail']]).getQuery(), {
          default: 'SELECT "User"."email" AS [personalEmail] FROM [Users] AS [User];',
          oracle: 'SELECT "User"."email" AS "personalEmail" FROM "Users" "User";'
        });
      });
    }

    it('should generate SELECT query with WHERE clause', () => {
      expectsql(User.select().where({ active: true }).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = true;',
        sqlite: 'SELECT * FROM `Users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = 1;',
        oracle: 'SELECT * FROM "Users" "User" WHERE "User"."active" = \'1\';'
      });
    });

    it('should generate SELECT query with multiple WHERE conditions', () => {
      expectsql(User.select().where({ active: true, age: 25 }).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = true AND [User].[age] = 25;',
        sqlite: 'SELECT * FROM `Users` AS `User` WHERE `User`.`active` = 1 AND `User`.`age` = 25;',
        mssql: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = 1 AND [User].[age] = 25;',
        oracle: 'SELECT * FROM "Users" "User" WHERE "User"."active" = \'1\' AND "User"."age" = 25;'
      });
    });

    it('should generate complete SELECT query with attributes and WHERE', () => {
      expectsql(
        User.select().attributes(['name', 'email']).where({ active: true }).getQuery(),
        {
          default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = true;',
          sqlite: 'SELECT `name`, `email` FROM `Users` AS `User` WHERE `User`.`active` = 1;',
          mssql: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = 1;',
          oracle: 'SELECT "name", "email" FROM "Users" "User" WHERE "User"."active" = \'1\';'
        }
      );
    });

    it('should generate SELECT query with LIMIT', () => {
      expectsql(User.select().limit(10).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] LIMIT 10;',
        mssql: 'SELECT * FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY "User"."id" OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;'
      });
    });

    it('should generate SELECT query with LIMIT and OFFSET', () => {
      expectsql(User.select().limit(10).offset(5).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] LIMIT 10 OFFSET 5;',
        'mysql mariadb sqlite': 'SELECT * FROM `Users` AS `User` LIMIT 5, 10;',
        mssql: 'SELECT * FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY "User"."id" OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY;'
      });
    });

    it('should generate SELECT query with ORDER BY', () => {
      expectsql(User.select().orderBy(['name']).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] ORDER BY [User].[name];',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY "User"."name";'
      });

      expectsql(User.select().orderBy([['age', 'DESC']]).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] ORDER BY [User].[age] DESC;',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY "User"."age" DESC;'
      });
    });

    it('should support ORDER BY with position notation', () => {
      expectsql(User.select().orderBy([2]).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] ORDER BY 2;',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY 2;'
      });

      expectsql(User.select().orderBy([[3, 'DESC']]).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] ORDER BY 3 DESC;',
        oracle: 'SELECT * FROM "Users" "User" ORDER BY 3 DESC;'
      });
    });

    // Won't work with minified aliases
    if (!process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should generate SELECT query with GROUP BY', () => {
        expectsql(User
          .select()
          .attributes(['name', [sequelize.literal('MAX("age")'), 'maxAge']])
          .groupBy('name')
          .orderBy([[2, 'DESC']])
          .getQuery(), {
          default: 'SELECT [name], MAX("age") AS [maxAge] FROM [Users] AS [User] GROUP BY [name] ORDER BY 2 DESC;',
          oracle: 'SELECT "name", MAX("age") AS "maxAge" FROM "Users" "User" GROUP BY "name" ORDER BY 2 DESC;'
        });
      });

      it('should generate SELECT query with GROUP BY and HAVING', () => {
        expectsql(User
          .select()
          .attributes(['name', [sequelize.literal('MAX("age")'), 'maxAge']])
          .groupBy('name')
          .having(sequelize.literal('MAX("age") > 30'))
          .getQuery(), {
          default: 'SELECT [name], MAX("age") AS [maxAge] FROM [Users] AS [User] GROUP BY [name] HAVING (MAX("age") > 30);',
          oracle: 'SELECT "name", MAX("age") AS "maxAge" FROM "Users" "User" GROUP BY "name" HAVING (MAX("age") > 30);'
        });

        expectsql(User
          .select()
          .attributes(['name', [sequelize.literal('MAX("age")'), 'maxAge']])
          .groupBy('name')
          .having(sequelize.literal('MAX("age") > 30'))
          .andHaving(sequelize.literal('COUNT(*) > 1'))
          .getQuery(), {
          default: 'SELECT [name], MAX("age") AS [maxAge] FROM [Users] AS [User] GROUP BY [name] HAVING (MAX("age") > 30 AND COUNT(*) > 1);',
          oracle: 'SELECT "name", MAX("age") AS "maxAge" FROM "Users" "User" GROUP BY "name" HAVING (MAX("age") > 30 AND COUNT(*) > 1);'
        });
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
        default: 'SELECT * FROM [Users] AS [User];',
        oracle: 'SELECT * FROM "Users" "User";'
      });

      // Other builders should have their modifications
      expectsql(builderWithAttributes.getQuery(), {
        default: 'SELECT [name] FROM [Users] AS [User];',
        oracle: 'SELECT "name" FROM "Users" "User";'
      });

      expectsql(builderWithWhere.getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = true;',
        sqlite: 'SELECT * FROM `Users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = 1;',
        oracle: 'SELECT * FROM "Users" "User" WHERE "User"."active" = \'1\';'
      });
    });

    it('should allow building different queries from same base', () => {
      const baseBuilder = User.select().attributes(['name', 'email']);

      expectsql(baseBuilder.where({ active: true }).getQuery(), {
        default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = true;',
        sqlite: 'SELECT `name`, `email` FROM `Users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = 1;',
        oracle: 'SELECT "name", "email" FROM "Users" "User" WHERE "User"."active" = \'1\';'
      });

      expectsql(baseBuilder.where({ age: { [Op.lt]: 30 } }).getQuery(), {
        default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[age] < 30;',
        oracle: 'SELECT "name", "email" FROM "Users" "User" WHERE "User"."age" < 30;'
      });
    });
  });

  if (Support.getTestDialect() === 'postgres') {
    describe('PostgreSQL-specific features', () => {
      it('should handle PostgreSQL operators correctly', () => {
        expectsql(
          User.select()
            .where({
              name: { [Op.iLike]: '%john%' },
              age: { [Op.between]: [18, 65] }
            })
            .getQuery(),
          {
            default: 'SELECT * FROM [Users] AS [User] WHERE [User].[name] ILIKE \'%john%\' AND [User].[age] BETWEEN 18 AND 65;'
          }
        );
      });

      it('should handle array operations', () => {
        expectsql(
          User.select()
            .where({
              name: { [Op.in]: ['John', 'Jane', 'Bob'] }
            })
            .getQuery(),
          {
            default: 'SELECT * FROM [Users] AS [User] WHERE [User].[name] IN (\'John\', \'Jane\', \'Bob\');'
          }
        );
      });

      it('should quote identifiers properly for PostgreSQL', () => {
        expectsql(
          User.select().attributes(['name', 'email']).where({ active: true }).getQuery(),
          {
            default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = true;'
          }
        );
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
                [Op.and]: [{ age: { [Op.gte]: 18 } }, { name: { [Op.like]: '%admin%' } }]
              }
            ]
          })
          .getQuery(),
        {
          default: 'SELECT * FROM [Users] AS [User] WHERE ([User].[active] = true OR ([User].[age] >= 18 AND [User].[name] LIKE \'%admin%\'));',
          sqlite: 'SELECT * FROM `Users` AS `User` WHERE (`User`.`active` = 1 OR (`User`.`age` >= 18 AND `User`.`name` LIKE \'%admin%\'));',
          mssql: 'SELECT * FROM [Users] AS [User] WHERE ([User].[active] = 1 OR ([User].[age] >= 18 AND [User].[name] LIKE N\'%admin%\'));',
          oracle: 'SELECT * FROM "Users" "User" WHERE ("User"."active" = \'1\' OR ("User"."age" >= 18 AND "User"."name" LIKE \'%admin%\'));'
        }
      );
    });

    it('should handle IS NULL conditions', () => {
      expectsql(User.select().where({ age: null }).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[age] IS NULL;',
        oracle: 'SELECT * FROM "Users" "User" WHERE "User"."age" IS NULL;'
      });
    });

    it('should handle NOT NULL conditions', () => {
      expectsql(
        User.select()
          .where({ age: { [Op.ne]: null } })
          .getQuery(),
        {
          default: 'SELECT * FROM [Users] AS [User] WHERE [User].[age] IS NOT NULL;',
          oracle: 'SELECT * FROM "Users" "User" WHERE "User"."age" IS NOT NULL;'
        }
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
            'FROM [Users] AS [User]',
            'WHERE [User].[age] > 30;'
          ].join('\n'),
          oracle: [
            'SELECT "name", "email"',
            'FROM "Users" "User"',
            'WHERE "User"."age" > 30;'
          ].join('\n')
        }
      );
    });

    if (Support.getTestDialect() === 'postgres' && !process.env.SEQ_PG_MINIFY_ALIASES) {
      it('should handle complex conditions with multiple joins', async () => {
        const Comments = sequelize.define('Comments', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          userId: DataTypes.INTEGER,
          content: DataTypes.STRING,
          likes: DataTypes.INTEGER
        });
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
            on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('p.userId')),
            attributes: ['title'],
            where: { title: { [Op.iLike]: '%cr%' } },
            required: true
          })
          .includes({
            model: Comments,
            as: 'c',
            on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('c.userId')),
            attributes: [[sequelize.literal('SUM("c"."likes")'), 'likeCount']],
            joinType: 'LEFT'
          })
          .where({
            [Op.or]: [
              { active: true },
              {
                [Op.and]: [{ age: { [Op.gte]: 18 } }, { name: { [Op.iLike]: '%admin%' } }]
              }
            ]
          })
          .groupBy([sequelize.col('User.id'), sequelize.col('p.id')])
          .having(sequelize.literal('SUM("c"."likes") > 10'))
          .andHaving(sequelize.literal('SUM("c"."likes") < 300'))
          .orderBy([['name', 'DESC'], [sequelize.col('p.title'), 'ASC']]);
        const query = qb.getQuery({ multiline: true });
        expectsql(query, {
          default: [
            'SELECT "User"."name", "User"."age" AS "userAge", "p"."title" AS "p.title", SUM("c"."likes") AS "c.likeCount"',
            'FROM "Users" AS "User"',
            'INNER JOIN "Posts" AS "p" ON "User"."id" = "p"."userId" AND "p"."title" ILIKE \'%cr%\'',
            'LEFT OUTER JOIN "Comments" AS "c" ON "User"."id" = "c"."userId"',
            'WHERE ("User"."active" = true OR ("User"."age" >= 18 AND "User"."name" ILIKE \'%admin%\'))',
            'GROUP BY "User"."id", "p"."id"',
            'HAVING (SUM("c"."likes") > 10 AND SUM("c"."likes") < 300)',
            'ORDER BY "User"."name" DESC, "p"."title" ASC;'
          ].join('\n')
        });
        const [result] = await qb.execute();
        expect(result).to.have.lengthOf(3);
        expect(result).to.deep.equal([
          {
            name: 'Bob',
            userAge: 25,
            'p.title': 'Crocodiles',
            'c.likeCount': '50'
          },
          {
            name: 'Bob',
            userAge: 25,
            'p.title': 'Cronos',
            'c.likeCount': '50'
          },
          {
            name: 'Alice',
            userAge: 20,
            'p.title': 'Creed',
            'c.likeCount': '30'
          }
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
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
            })
            .getQuery(),
          {
            default: 'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[userId] AS [Posts.userId], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [Users] AS [User] LEFT OUTER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
            oracle: 'SELECT "User".*, "Posts"."id" AS "Posts.id", "Posts"."userId" AS "Posts.userId", "Posts"."title" AS "Posts.title", "Posts"."content" AS "Posts.content", "Posts"."createdAt" AS "Posts.createdAt", "Posts"."updatedAt" AS "Posts.updatedAt" FROM "Users" "User" LEFT OUTER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId";'
          }
        );
      });

      it('should generate INNER JOIN when required is true', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              required: true,
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
            })
            .getQuery(),
          {
            default: 'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[userId] AS [Posts.userId], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [Users] AS [User] INNER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
            oracle: 'SELECT "User".*, "Posts"."id" AS "Posts.id", "Posts"."userId" AS "Posts.userId", "Posts"."title" AS "Posts.title", "Posts"."content" AS "Posts.content", "Posts"."createdAt" AS "Posts.createdAt", "Posts"."updatedAt" AS "Posts.updatedAt" FROM "Users" "User" INNER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId";'
          }
        );
      });

      it('should generate INNER JOIN when joinType is INNER', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              joinType: 'INNER',
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
            })
            .getQuery(),
          {
            default: 'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[userId] AS [Posts.userId], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [Users] AS [User] INNER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
            oracle: 'SELECT "User".*, "Posts"."id" AS "Posts.id", "Posts"."userId" AS "Posts.userId", "Posts"."title" AS "Posts.title", "Posts"."content" AS "Posts.content", "Posts"."createdAt" AS "Posts.createdAt", "Posts"."updatedAt" AS "Posts.updatedAt" FROM "Users" "User" INNER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId";'
          }
        );
      });

      it('should handle custom WHERE conditions on joined table', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId')),
              where: {
                title: 'Hello World'
              }
            })
            .getQuery(),
          {
            default: 'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[userId] AS [Posts.userId], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [Users] AS [User] LEFT OUTER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId] AND [Posts].[title] = \'Hello World\';',
            mssql: 'SELECT [User].*, [Posts].[id] AS [Posts.id], [Posts].[userId] AS [Posts.userId], [Posts].[title] AS [Posts.title], [Posts].[content] AS [Posts.content], [Posts].[createdAt] AS [Posts.createdAt], [Posts].[updatedAt] AS [Posts.updatedAt] FROM [Users] AS [User] LEFT OUTER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId] AND [Posts].[title] = N\'Hello World\';',
            oracle: 'SELECT "User".*, "Posts"."id" AS "Posts.id", "Posts"."userId" AS "Posts.userId", "Posts"."title" AS "Posts.title", "Posts"."content" AS "Posts.content", "Posts"."createdAt" AS "Posts.createdAt", "Posts"."updatedAt" AS "Posts.updatedAt" FROM "Users" "User" LEFT OUTER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId" AND "Posts"."title" = \'Hello World\';'
          }
        );
      });

      it('should support custom attributes from joined table', () => {
        expectsql(
          User.select()
            .includes({
              model: Post,
              as: 'Posts',
              attributes: ['title'],
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
            })
            .getQuery(),
          {
            default: 'SELECT [User].*, [Posts].[title] AS [Posts.title] FROM [Users] AS [User] LEFT OUTER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId];',
            oracle: 'SELECT "User".*, "Posts"."title" AS "Posts.title" FROM "Users" "User" LEFT OUTER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId";'
          }
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
              on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
            })
            .where({ age: { [Op.gt]: 30 } })
            .getQuery({ multiline: true }),
          {
            default: [
              'SELECT [User].[name], [Posts].[title] AS [Posts.title]',
              'FROM [Users] AS [User]',
              'LEFT OUTER JOIN [Posts] AS [Posts] ON [User].[id] = [Posts].[userId]',
              'WHERE [User].[age] > 30;'
            ].join('\n'),
            oracle: [
              'SELECT "User"."name", "Posts"."title" AS "Posts.title"',
              'FROM "Users" "User"',
              'LEFT OUTER JOIN "Posts" "Posts" ON "User"."id" = "Posts"."userId"',
              'WHERE "User"."age" > 30;'
            ].join('\n')
          }
        );
      });
    }

    it('should throw error when model is not provided', () => {
      expect(() => {
        User.select().includes({
          on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
        });
      }).to.throw(Error, 'Model is required for includes');
    });

    it('should throw error when on condition is not provided', () => {
      expect(() => {
        User.select()
          .includes({
            model: Post,
            as: 'Posts'
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
            on: sequelize.where(sequelize.col('User.id'), '=', sequelize.col('Posts.userId'))
          })
          .where({ id: user.id })
          .execute();
        expect(result).to.have.lengthOf(2);
        expect(result[0].id).to.equal(user.id);
        expect(result[0].name).to.equal(user.name);
        expect(result[1].id).to.equal(user.id);
        expect(result[1].name).to.equal(user.name);
        expect(result[0]['Posts.title']).to.equal('Post 1');
        expect(result[1]['Posts.title']).to.equal('Post 2');
      });
    }
  });
});