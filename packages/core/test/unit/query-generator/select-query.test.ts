import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from '@sequelize/core';
import { DataTypes, IndexHints, Op, TableHints, or, sql as sqlTag } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expect } from 'chai';
import { beforeAll2, expectsql, getTestDialect, sequelize } from '../../support';

const { attribute, col, cast, where, fn, literal } = sqlTag;
const dialectName = getTestDialect();

describe('QueryGenerator#selectQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
      id: CreationOptional<number>;
      username: string;
    }

    const User = sequelize.define<TUser>(
      'User',
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        username: DataTypes.STRING,
      },
      { timestamps: true },
    );

    interface TProject extends Model<InferAttributes<TProject>, InferCreationAttributes<TProject>> {
      id: CreationOptional<number>;
      duration: bigint;
    }

    const Project = sequelize.define<TProject>(
      'Project',
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        duration: DataTypes.INTEGER,
      },
      { timestamps: false },
    );

    const ProjectContributor = sequelize.define('ProjectContributor', {}, { timestamps: false });

    // project owners
    User.hasMany(Project, { as: 'projects' });
    Project.belongsTo(User, { as: 'owner' });

    // project contributors
    Project.belongsToMany(User, {
      through: ProjectContributor,
      as: 'contributors',
      inverse: 'contributedProjects',
    });

    return { User, Project, ProjectContributor };
  });

  describe('limit/offset', () => {
    it('supports offset without limit', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          offset: 1,
        },
        User,
      );

      expectsql(sql, {
        sqlite3: 'SELECT `id` FROM `Users` AS `User` ORDER BY `User`.`id` LIMIT -1 OFFSET 1;',
        postgres: 'SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" OFFSET 1;',
        snowflake: 'SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" LIMIT NULL OFFSET 1;',
        'mariadb mysql':
          'SELECT `id` FROM `Users` AS `User` ORDER BY `User`.`id` LIMIT 18446744073709551615 OFFSET 1;',
        'db2 ibmi mssql': `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 1 ROWS;`,
      });
    });

    it('support limit without offset', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          limit: 10,
        },
        User,
      );

      expectsql(sql, {
        default: 'SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT 10;',
        mssql: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;`,
        'db2 ibmi': `SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" FETCH NEXT 10 ROWS ONLY;`,
      });
    });

    it('supports offset and limit', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          offset: 1,
          limit: 10,
        },
        User,
      );

      expectsql(sql, {
        default: 'SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT 10 OFFSET 1;',
        'db2 ibmi mssql': `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 1 ROWS FETCH NEXT 10 ROWS ONLY;`,
      });
    });

    it('ignores 0 as offset with a limit', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          offset: 0,
          limit: 10,
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT 10;`,
        mssql: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;`,
        'db2 ibmi': `SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" FETCH NEXT 10 ROWS ONLY;`,
      });
    });

    it('ignores 0 as offset without a limit', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          offset: 0,
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT [id] FROM [Users] AS [User];`,
      });
    });

    it('support 0 as limit', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              limit: 0,
            },
            User,
          ),
        {
          default: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT 0;`,
          mssql: new Error(`LIMIT 0 is not supported by ${dialectName} dialect.`),
          'db2 ibmi': `SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" FETCH NEXT 0 ROWS ONLY;`,
        },
      );
    });

    it('escapes limit', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          // @ts-expect-error -- testing invalid limit
          limit: `';DELETE FROM user`,
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT ''';DELETE FROM user';`,
        mssql: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 0 ROWS FETCH NEXT N''';DELETE FROM user' ROWS ONLY;`,
        'db2 ibmi': `SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" FETCH NEXT ''';DELETE FROM user' ROWS ONLY;`,
        'mariadb mysql':
          "SELECT `id` FROM `Users` AS `User` ORDER BY `User`.`id` LIMIT '\\';DELETE FROM user';",
      });
    });

    it('escapes offset', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          limit: 10,
          // @ts-expect-error -- testing invalid offset
          offset: `';DELETE FROM user`,
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] LIMIT 10 OFFSET ''';DELETE FROM user';`,
        mssql: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET N''';DELETE FROM user' ROWS FETCH NEXT 10 ROWS ONLY;`,
        'db2 ibmi': `SELECT "id" FROM "Users" AS "User" ORDER BY "User"."id" OFFSET ''';DELETE FROM user' ROWS FETCH NEXT 10 ROWS ONLY;`,
        'mariadb mysql':
          "SELECT `id` FROM `Users` AS `User` ORDER BY `User`.`id` LIMIT 10 OFFSET '\\';DELETE FROM user';",
      });
    });
  });

  it('supports querying for bigint values', () => {
    const { Project } = vars;

    const sql = queryGenerator.selectQuery(
      Project.table,
      {
        model: Project,
        attributes: ['id'],
        where: {
          duration: { [Op.eq]: 9_007_199_254_740_993n },
        },
      },
      Project,
    );

    expectsql(sql, {
      default: `SELECT [id] FROM [Projects] AS [Project] WHERE [Project].[duration] = 9007199254740993;`,
    });
  });

  it('supports cast in attributes', () => {
    const { User } = vars;

    const sql = queryGenerator.selectQuery(
      User.table,
      {
        model: User,
        attributes: ['id', [cast(col('createdAt'), 'varchar'), 'createdAt']],
      },
      User,
    );

    expectsql(sql, {
      default: `SELECT [id], CAST([createdAt] AS VARCHAR) AS [createdAt] FROM [Users] AS [User];`,
    });
  });

  it('supports empty where object', () => {
    const { User } = vars;

    const sql = queryGenerator.selectQuery(
      User.table,
      {
        model: User,
        attributes: ['id'],
        where: {},
      },
      User,
    );

    expectsql(sql, {
      default: `SELECT [id] FROM [Users] AS [User];`,
    });
  });

  it('escapes WHERE clause correctly', () => {
    const { User } = vars;

    const sql = queryGenerator.selectQuery(
      User.table,
      {
        model: User,
        attributes: ['id'],
        where: { username: "foo';DROP TABLE mySchema.myTable;" },
      },
      User,
    );

    expectsql(sql, {
      default: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'foo'';DROP TABLE mySchema.myTable;';`,
      'mysql mariadb': `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'foo\\';DROP TABLE mySchema.myTable;';`,
      mssql: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = N'foo'';DROP TABLE mySchema.myTable;';`,
    });
  });

  if (
    sequelize.dialect.supports.jsonOperations &&
    sequelize.dialect.supports.jsonExtraction.quoted
  ) {
    it('accepts json paths in attributes', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: [[attribute('data.email'), 'email']],
        },
        User,
      );

      expectsql(sql, {
        postgres: `SELECT "data"->'email' AS "email" FROM "Users" AS "User";`,
        mariadb: `SELECT json_compact(json_extract(\`data\`,'$.email')) AS \`email\` FROM \`Users\` AS \`User\`;`,
        'sqlite3 mysql': `SELECT json_extract([data],'$.email') AS [email] FROM [Users] AS [User];`,
      });
    });
  }

  describe('replacements', () => {
    it('parses named replacements in literals', () => {
      const { User } = vars;

      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: [[fn('uppercase', literal(':attr')), 'id'], literal(':attr2')],
          where: {
            username: or(
              { [Op.eq]: literal(':data') },
              where(fn('uppercase', cast(literal(':data'), 'string')), Op.eq, literal(':data')),
            ),
          },
          having: {
            username: {
              [Op.eq]: literal(':data'),
            },
          },
          order: literal(':order'),
          limit: literal(':limit'),
          offset: literal(':offset'),
          group: literal(':group'),
          replacements: {
            attr: 'id',
            attr2: 'id2',
            data: 'repl1',
            order: 'repl2',
            limit: 'repl3',
            offset: 'repl4',
            group: 'the group',
          },
        },
        User,
      );

      expectsql(sql, {
        default: `
          SELECT uppercase('id') AS [id], 'id2'
          FROM [Users] AS [User]
          WHERE [User].[username] = 'repl1' OR [User].[username] = (uppercase(CAST('repl1' AS STRING)) = 'repl1')
          GROUP BY 'the group'
          HAVING [User].[username] = 'repl1'
          ORDER BY 'repl2'
          LIMIT 'repl3'
          OFFSET 'repl4';
        `,
        mssql: `
          SELECT uppercase(N'id') AS [id], N'id2'
          FROM [Users] AS [User]
          WHERE [User].[username] = N'repl1' OR [User].[username] = (uppercase(CAST(N'repl1' AS STRING)) = N'repl1')
          GROUP BY N'the group'
          HAVING [User].[username] = N'repl1'
          ORDER BY N'repl2'
          OFFSET N'repl4' ROWS
          FETCH NEXT N'repl3' ROWS ONLY;
        `,
        'db2 ibmi': `
          SELECT uppercase('id') AS "id", 'id2'
          FROM "Users" AS "User"
          WHERE "User"."username" = 'repl1' OR "User"."username" = (uppercase(CAST('repl1' AS STRING)) = 'repl1')
          GROUP BY 'the group'
          HAVING "User"."username" = 'repl1'
          ORDER BY 'repl2'
          OFFSET 'repl4' ROWS
          FETCH NEXT 'repl3' ROWS ONLY;
        `,
      });
    });

    // see the unit tests of 'injectReplacements' for more
    it('does not parse replacements in strings in literals', () => {
      const { User } = vars;

      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: [literal('id')],
          where: literal(`id = ':id'`),
          replacements: {
            id: 1,
          },
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT id FROM [Users] AS [User] WHERE id = ':id';`,
      });
    });

    it('parses named replacements in literals in includes', () => {
      const { User, Project } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          include: _validateIncludedElements({
            model: User,
            include: [
              {
                association: User.associations.projects,
                attributes: [['id', 'id'], literal(':data'), [literal(':data'), 'id2']],
                on: literal(':on'),
                where: literal(':where'),
                include: [
                  {
                    association: Project.associations.owner,
                    attributes: [literal(':data2')],
                  },
                ],
              },
            ],
          }).include,
          replacements: {
            data: 'repl1',
            data2: 'repl2',
            on: 'on',
            where: 'where',
          },
        },
        User,
      );

      expectsql(sql, {
        default: `
          SELECT
            [User].[id],
            [projects].[id] AS [projects.id],
            'repl1',
            'repl1' AS [projects.id2],
            [projects->owner].[id] AS [projects.owner.id],
            'repl2'
          FROM [Users] AS [User]
          INNER JOIN [Projects] AS [projects]
            ON 'on' AND 'where'
          LEFT OUTER JOIN [Users] AS [projects->owner]
            ON [projects].[ownerId] = [projects->owner].[id];
        `,
        mssql: `
          SELECT
            [User].[id],
            [projects].[id] AS [projects.id],
            N'repl1',
            N'repl1' AS [projects.id2],
            [projects->owner].[id] AS [projects.owner.id],
            N'repl2'
          FROM [Users] AS [User]
          INNER JOIN [Projects] AS [projects]
            ON N'on' AND N'where'
          LEFT OUTER JOIN [Users] AS [projects->owner]
            ON [projects].[ownerId] = [projects->owner].[id];
        `,
        ibmi: `
          SELECT
            "User"."id",
            "projects"."id" AS "projects.id",
            'repl1',
            'repl1' AS "projects.id2",
            "projects->owner"."id" AS "projects.owner.id",
            'repl2'
          FROM "Users" AS "User"
          INNER JOIN "Projects" AS "projects"
            ON 'on' AND 'where'
          LEFT OUTER JOIN "Users" AS "projects->owner"
            ON "projects"."ownerId" = "projects->owner"."id"
        `,
      });
    });

    it(`parses named replacements in belongsToMany includes' through tables`, () => {
      const { Project } = vars;

      const sql = queryGenerator.selectQuery(
        Project.table,
        {
          model: Project,
          attributes: ['id'],
          include: _validateIncludedElements({
            model: Project,
            include: [
              {
                attributes: ['id'],
                association: Project.associations.contributors,
                through: {
                  where: literal(':where'),
                },
              },
            ],
          }).include,
          replacements: {
            where: 'where',
          },
        },
        Project,
      );

      expectsql(sql, {
        default: `
          SELECT
            [Project].[id],
            [contributors].[id] AS [contributors.id],
            [contributors->ProjectContributor].[userId] AS [contributors.ProjectContributor.userId],
            [contributors->ProjectContributor].[projectId] AS [contributors.ProjectContributor.projectId]
          FROM [Projects] AS [Project]
          LEFT OUTER JOIN (
            [ProjectContributors] AS [contributors->ProjectContributor]
            INNER JOIN [Users] AS [contributors]
            ON [contributors].[id] = [contributors->ProjectContributor].[userId]
            AND 'where'
          )
          ON [Project].[id] = [contributors->ProjectContributor].[projectId];
        `,
        mssql: `
          SELECT
            [Project].[id],
            [contributors].[id] AS [contributors.id],
            [contributors->ProjectContributor].[userId] AS [contributors.ProjectContributor.userId],
            [contributors->ProjectContributor].[projectId] AS [contributors.ProjectContributor.projectId]
          FROM [Projects] AS [Project]
          LEFT OUTER JOIN (
            [ProjectContributors] AS [contributors->ProjectContributor]
            INNER JOIN [Users] AS [contributors]
            ON [contributors].[id] = [contributors->ProjectContributor].[userId]
            AND N'where'
          )
          ON [Project].[id] = [contributors->ProjectContributor].[projectId];
        `,
      });
    });

    it('parses named replacements in literals in includes (subQuery)', () => {
      const { User, Project } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: ['id'],
          include: _validateIncludedElements({
            model: User,
            include: [
              {
                association: User.associations.projects,
                attributes: [['id', 'id'], literal(':data'), [literal(':data'), 'id2']],
                on: literal(':on'),
                where: literal(':where'),
                include: [
                  {
                    association: Project.associations.owner,
                    attributes: [literal(':data2')],
                  },
                ],
              },
            ],
          }).include,
          limit: literal(':limit'),
          offset: literal(':offset'),
          order: literal(':order'),
          subQuery: true,
          replacements: {
            data: 'repl1',
            data2: 'repl2',
            on: 'on',
            where: 'where',
            limit: 'limit',
            offset: 'offset',
            order: 'order',
          },
        },
        User,
      );

      expectsql(sql, {
        default: `
          SELECT
            [User].*,
            [projects].[id] AS [projects.id],
            'repl1',
            'repl1' AS [projects.id2],
            [projects->owner].[id] AS [projects.owner.id],
            'repl2'
          FROM (
            SELECT [User].[id]
            FROM [Users] AS [User]
            ORDER BY 'order'
            LIMIT 'limit'
            OFFSET 'offset'
          ) AS [User]
          INNER JOIN [Projects] AS [projects]
            ON 'on' AND 'where'
          LEFT OUTER JOIN [Users] AS [projects->owner]
            ON [projects].[ownerId] = [projects->owner].[id]
          ORDER BY 'order';
        `,
        mssql: `
          SELECT
            [User].*,
            [projects].[id] AS [projects.id],
            N'repl1',
            N'repl1' AS [projects.id2],
            [projects->owner].[id] AS [projects.owner.id],
            N'repl2'
          FROM (
            SELECT [User].[id]
            FROM [Users] AS [User]
            ORDER BY N'order'
            OFFSET N'offset' ROWS
            FETCH NEXT N'limit' ROWS ONLY
          ) AS [User]
          INNER JOIN [Projects] AS [projects]
            ON N'on' AND N'where'
          LEFT OUTER JOIN [Users] AS [projects->owner]
            ON [projects].[ownerId] = [projects->owner].[id]
          ORDER BY N'order';
        `,
        db2: `
          SELECT
            "User".*,
            "projects"."id" AS "projects.id",
            'repl1',
            'repl1' AS "projects.id2",
            "projects->owner"."id" AS "projects.owner.id",
            'repl2' FROM (
              SELECT "User"."id"
              FROM "Users" AS "User"
              ORDER BY 'order'
              OFFSET 'offset' ROWS
              FETCH NEXT 'limit' ROWS ONLY
            ) AS "User"
            INNER JOIN "Projects" AS "projects"
              ON 'on' AND 'where'
            LEFT OUTER JOIN "Users" AS "projects->owner"
              ON "projects"."ownerId" = "projects->owner"."id"
            ORDER BY 'order';
        `,
        ibmi: `
          SELECT
            "User".*,
            "projects"."id" AS "projects.id",
            'repl1',
            'repl1' AS "projects.id2",
            "projects->owner"."id" AS "projects.owner.id",
            'repl2' FROM (
              SELECT "User"."id"
              FROM "Users" AS "User"
              ORDER BY 'order'
              OFFSET 'offset' ROWS
              FETCH NEXT 'limit' ROWS ONLY
            ) AS "User"
            INNER JOIN "Projects" AS "projects"
              ON 'on' AND 'where'
            LEFT OUTER JOIN "Users" AS "projects->owner"
              ON "projects"."ownerId" = "projects->owner"."id"
            ORDER BY 'order'
        `,
      });
    });

    it('rejects positional replacements, because their execution order is hard to determine', () => {
      const { User } = vars;

      expect(() =>
        queryGenerator.selectQuery(
          User.table,
          {
            model: User,
            where: {
              username: {
                [Op.eq]: literal('?'),
              },
            },
            replacements: ['repl1', 'repl2', 'repl3'],
          },
          User,
        ),
      ).to.throwWithCause(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);
    });

    it(`always escapes the attribute if it's provided as a string`, () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: [
            // these used to have special escaping logic, now they're always escaped like any other strings. col, fn, and literal can be used for advanced logic.
            ['count(*)', 'count'],
            // @ts-expect-error -- test against a vulnerability CVE-2023-22578
            '.*',
            // @ts-expect-error -- test against a vulnerability CVE-2023-22578
            '*',
            [literal('count(*)'), 'literal_count'],
            [fn('count', '*'), 'fn_count_str'],
            [fn('count', col('*')), 'fn_count_col'],
            [fn('count', literal('*')), 'fn_count_lit'],
            [col('a.b'), 'col_a_b'],
            [col('a.*'), 'col_a_all'],
            [col('*'), 'col_all'],
          ],
        },
        User,
      );

      expectsql(sql, {
        default: `
          SELECT
            [count(*)] AS [count],
            [.*],
            [*],
            count(*) AS [literal_count],
            count('*') AS [fn_count_str],
            count(*) AS [fn_count_col],
            count(*) AS [fn_count_lit],
            [a].[b] AS [col_a_b],
            [a].* AS [col_a_all],
            * AS [col_all]
          FROM [Users] AS [User];`,
        mssql: `
          SELECT
            [count(*)] AS [count],
            [.*],
            [*],
            count(*) AS [literal_count],
            count(N'*') AS [fn_count_str],
            count(*) AS [fn_count_col],
            count(*) AS [fn_count_lit],
            [a].[b] AS [col_a_b],
            [a].* AS [col_a_all],
            * AS [col_all]
          FROM [Users] AS [User];`,
      });
    });

    it('supports a "having" option', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          model: User,
          attributes: [literal('*'), [fn('YEAR', col('createdAt')), 'creationYear']],
          group: ['creationYear', 'title'],
          having: { creationYear: { [Op.gt]: 2002 } },
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT *, YEAR([createdAt]) AS [creationYear] FROM [Users] AS [User] GROUP BY [creationYear], [title] HAVING [User].[creationYear] > 2002;`,
      });
    });
  });

  describe('previously supported values', () => {
    it('raw replacements for where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: ['name IN (?)', [1, 'test', 3, 'derp']],
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`,
      );
    });

    it('raw replacements for nested where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: [['name IN (?)', [1, 'test', 3, 'derp']]],
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`,
      );
    });

    it('raw replacements for having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          having: ['name IN (?)', [1, 'test', 3, 'derp']],
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`,
      );
    });

    it('raw replacements for nested having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          having: [['name IN (?)', [1, 'test', 3, 'derp']]],
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`,
      );
    });

    it('raw string from where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: `name = 'something'`,
        });
      }).to.throwWithCause(Error, "Support for `{ where: 'raw query' }` has been removed.");
    });

    it('raw string from having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          having: `name = 'something'`,
        });
      }).to.throwWithCause(Error, "Support for `{ where: 'raw query' }` has been removed.");
    });

    it('rejects where: null', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: null,
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got null`,
      );
    });

    it('rejects where: primitive', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: 1,
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 1`,
      );
    });

    it('rejects where: array of primitives', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: [[col('*'), 'col_all']],
          // @ts-expect-error -- this is not a valid value anymore
          where: [''],
        });
      }).to.throwWithCause(
        Error,
        `Invalid Query: expected a plain object, an array or a sequelize SQL method but got ''`,
      );
    });
  });

  describe('minifyAliases', () => {
    it('minifies custom attributes', () => {
      const { User } = vars;

      const sql = queryGenerator.selectQuery(
        User.table,
        {
          minifyAliases: true,
          model: User,
          attributes: [[literal('1'), 'customAttr']],
          order: ['customAttr'],
          group: ['customAttr'],
        },
        User,
      );

      expectsql(sql, {
        default: `SELECT 1 AS [_0] FROM [Users] AS [User] GROUP BY [_0] ORDER BY [_0];`,
      });
    });
  });

  describe('optimizer hints', () => {
    it('max execution time hint', () => {
      const { User } = vars;

      const notSupportedError = new Error(
        `The maxExecutionTimeMs option is not supported by ${dialectName}`,
      );

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.tableName,
            {
              model: User,
              attributes: ['id'],
              maxExecutionTimeHintMs: 1000,
            },
            User,
          ),
        {
          default: notSupportedError,
          mysql: 'SELECT /*+ MAX_EXECUTION_TIME(1000) */ `id` FROM `Users` AS `User`;',
        },
      );
    });
  });

  describe('index hints', () => {
    it('should add an index hint', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              indexHints: [{ type: IndexHints.FORCE, values: ['index_project_on_name'] }],
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'indexHints',
          ]),
          'mariadb mysql snowflake':
            'SELECT [id] FROM [Users] AS [User] FORCE INDEX ([index_project_on_name]);',
        },
      );
    });

    it('should add an index hint with multiple values', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              indexHints: [
                {
                  type: IndexHints.IGNORE,
                  values: ['index_project_on_name', 'index_project_on_name_and_foo'],
                },
              ],
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'indexHints',
          ]),
          'mariadb mysql snowflake':
            'SELECT [id] FROM [Users] AS [User] IGNORE INDEX ([index_project_on_name],[index_project_on_name_and_foo]);',
        },
      );
    });

    it('should support index hints on queries with associations', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              indexHints: [{ type: IndexHints.FORCE, values: ['index_project_on_name'] }],
              include: _validateIncludedElements({
                model: User,
                include: [
                  {
                    association: User.associations.projects,
                    attributes: ['id'],
                  },
                ],
              }).include,
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'indexHints',
          ]),
          'mariadb mysql snowflake':
            'SELECT [User].[id], [projects].[id] AS [projects.id] FROM [Users] AS [User] FORCE INDEX ([index_project_on_name]) LEFT OUTER JOIN [Projects] AS [projects] ON [User].[id] = [projects].[userId];',
        },
      );
    });

    it('should throw an error if an index hint if the type is not valid', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              // @ts-expect-error -- we are testing invalid values
              indexHints: [{ type: 'INVALID', values: ['index_project_on_name'] }],
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'indexHints',
          ]),
          'mariadb mysql snowflake': new Error(
            `The index hint type "INVALID" is invalid or not supported by dialect "${sequelize.dialect.name}".`,
          ),
        },
      );
    });
  });

  describe('table hints', () => {
    it('support an array of table hints', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              tableHints: [TableHints.UPDLOCK, TableHints.PAGLOCK],
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'tableHints',
          ]),
          mssql: `SELECT [id] FROM [Users] AS [User] WITH (UPDLOCK, PAGLOCK);`,
        },
      );
    });

    it('should be able to use table hints on joins', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              tableHints: [TableHints.NOLOCK],
              include: _validateIncludedElements({
                model: User,
                include: [
                  {
                    association: User.associations.projects,
                    attributes: ['id'],
                  },
                ],
              }).include,
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'tableHints',
          ]),
          mssql: `SELECT [User].[id], [projects].[id] AS [projects.id] FROM [Users] AS [User] WITH (NOLOCK) LEFT OUTER JOIN [Projects] AS [projects] WITH (NOLOCK) ON [User].[id] = [projects].[userId];`,
        },
      );
    });

    it('should be able to use separate table hints on joins', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              tableHints: [TableHints.NOLOCK],
              include: _validateIncludedElements({
                model: User,
                include: [
                  {
                    association: User.associations.projects,
                    attributes: ['id'],
                    tableHints: [TableHints.READPAST],
                  },
                ],
              }).include,
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'tableHints',
          ]),
          mssql: `SELECT [User].[id], [projects].[id] AS [projects.id] FROM [Users] AS [User] WITH (NOLOCK) LEFT OUTER JOIN [Projects] AS [projects] WITH (READPAST) ON [User].[id] = [projects].[userId];`,
        },
      );
    });

    it('should throw an error if a table hint if the type is not valid', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            User.table,
            {
              model: User,
              attributes: ['id'],
              // @ts-expect-error -- we are testing invalid values
              tableHints: ['INVALID'],
            },
            User,
          ),
        {
          default: buildInvalidOptionReceivedError('quoteTable', sequelize.dialect.name, [
            'tableHints',
          ]),
          mssql: new Error(
            `The table hint "INVALID" is invalid or not supported by dialect "${sequelize.dialect.name}".`,
          ),
        },
      );
    });
  });
});
