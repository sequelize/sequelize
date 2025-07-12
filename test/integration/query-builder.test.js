const { DataTypes, Op } = require('../../src');
const { expect } = require('chai');
const QueryBuilder = require('../../src/query-builder');
const Support = require('../support');

const expectsql = Support.expectsql;

describe(Support.getTestDialectTeaser('QueryBuilder'), () => {
  /** @type {typeof import('../../src/model').Model} */
  let User;
  /** @type {import('../../src/sequelize').Sequelize} */
  let sequelize;
  before(async function() {
    sequelize = this.sequelize;
    User = this.sequelize.define('User', {
      name: DataTypes.STRING,
      age: DataTypes.INTEGER,
      active: DataTypes.BOOLEAN
    });
    await User.sync({ force: true });
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
          oracle: 'SELECT "name" "username", "email" FROM "Users" "User";'
        });
      });
      
      it('should generate SELECT query with literal attributes', () => {
        expectsql(User.select().attributes([sequelize.literal('"User"."email" AS "personalEmail"')]).getQuery(), {
          default: 'SELECT "User"."email" AS "personalEmail" FROM [Users] AS [User];', // literal
          oracle: 'SELECT "User"."email" AS "personalEmail" FROM "Users" AS "User";'
        });
  
        expectsql(User.select().attributes([[sequelize.literal('"User"."email"'), 'personalEmail']]).getQuery(), {
          default: 'SELECT "User"."email" AS [personalEmail] FROM [Users] AS [User];',
          oracle: 'SELECT "User"."email" "personalEmail" FROM "Users" "User";'
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
          oracle: 'SELECT "name", MAX("age") "maxAge" FROM "Users" "User" GROUP BY "name" ORDER BY 2 DESC;'
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
          oracle: 'SELECT "name", MAX("age") "maxAge" FROM "Users" "User" GROUP BY "name" HAVING (MAX("age") > 30);'
        });

        expectsql(User
          .select()
          .attributes(['name', [sequelize.literal('MAX("age")'), 'maxAge']])
          .groupBy('name')
          .having(sequelize.literal('MAX("age") > 30'))
          .andHaving(sequelize.literal('COUNT(*) > 1'))
          .getQuery(), {
          default: 'SELECT [name], MAX("age") AS [maxAge] FROM [Users] AS [User] GROUP BY [name] HAVING (MAX("age") > 30 AND COUNT(*) > 1);',
          oracle: 'SELECT "name", MAX("age") "maxAge" FROM "Users" "User" GROUP BY "name" HAVING (MAX("age") > 30 AND COUNT(*) > 1);'
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
        oracle: 'SELECT * FROM [Users] [User];'
      });

      // Other builders should have their modifications
      expectsql(builderWithAttributes.getQuery(), {
        default: 'SELECT [name] FROM [Users] AS [User];',
        oracle: 'SELECT [name] FROM [Users] [User];'
      });

      expectsql(builderWithWhere.getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = true;',
        sqlite: 'SELECT * FROM `Users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT * FROM [Users] AS [User] WHERE [User].[active] = 1;',
        oracle: 'SELECT * FROM [Users] [User] WHERE [User].[active] = 1;'
      });
    });

    it('should allow building different queries from same base', () => {
      const baseBuilder = User.select().attributes(['name', 'email']);

      expectsql(baseBuilder.where({ active: true }).getQuery(), {
        default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = true;',
        sqlite: 'SELECT `name`, `email` FROM `Users` AS `User` WHERE `User`.`active` = 1;',
        mssql: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[active] = 1;',
        oracle: 'SELECT [name], [email] FROM [Users] [User] WHERE [User].[active] = 1;'
      });

      expectsql(baseBuilder.where({ age: { [Op.lt]: 30 } }).getQuery(), {
        default: 'SELECT [name], [email] FROM [Users] AS [User] WHERE [User].[age] < 30;',
        oracle: 'SELECT [name], [email] FROM [Users] [User] WHERE [User].[age] < 30;'
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
          oracle: 'SELECT * FROM [Users] [User] WHERE ([User].[active] = 1 OR ([User].[age] >= 18 AND [User].[name] LIKE N\'%admin%\'));'
        }
      );
    });

    it('should handle IS NULL conditions', () => {
      expectsql(User.select().where({ age: null }).getQuery(), {
        default: 'SELECT * FROM [Users] AS [User] WHERE [User].[age] IS NULL;',
        oracle: 'SELECT * FROM [Users] [User] WHERE [User].[age] IS NULL;'
      });
    });

    it('should handle NOT NULL conditions', () => {
      expectsql(
        User.select()
          .where({ age: { [Op.ne]: null } })
          .getQuery(),
        {
          default: 'SELECT * FROM [Users] AS [User] WHERE [User].[age] IS NOT NULL;',
          oracle: 'SELECT * FROM [Users] [User] WHERE [User].[age] IS NOT NULL;'
        }
      );
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
  });
});