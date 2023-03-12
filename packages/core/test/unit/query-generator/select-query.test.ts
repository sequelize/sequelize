import { expect } from 'chai';
import type { InferAttributes, Model } from '@sequelize/core';
import { Op, DataTypes, or, sql as sqlTag } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import { expectsql, sequelize } from '../../support';

const { attribute, col, cast, where, fn, literal } = sqlTag;

describe('QueryGenerator#selectQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  interface TUser extends Model<InferAttributes<TUser>> {
    username: string;
  }

  const User = sequelize.define<TUser>('User', {
    username: DataTypes.STRING,
  }, { timestamps: true });

  interface TProject extends Model<InferAttributes<TProject>> {
    duration: bigint;
  }

  const Project = sequelize.define<TProject>('Project', {
    duration: DataTypes.BIGINT,
  }, { timestamps: false });

  const ProjectContributor = sequelize.define('ProjectContributor', {}, { timestamps: false });

  // project owners
  User.hasMany(Project, { as: 'projects' });
  Project.belongsTo(User, { as: 'owner' });

  // project contributors
  Project.belongsToMany(User, {
    through: ProjectContributor,
    as: 'contributors',
  });

  it('supports offset without limit', () => {
    const sql = queryGenerator.selectQuery(User.table, {
      model: User,
      attributes: ['id'],
      offset: 1,
    }, User);

    expectsql(sql, {
      postgres: `SELECT "id" FROM "Users" AS "User" OFFSET 1;`,
      mysql: 'SELECT `id` FROM `Users` AS `User` LIMIT 18446744073709551615 OFFSET 1;',
      mariadb: 'SELECT `id` FROM `Users` AS `User` LIMIT 18446744073709551615 OFFSET 1;',
      sqlite: 'SELECT `id` FROM `Users` AS `User` LIMIT -1 OFFSET 1;',
      snowflake: 'SELECT "id" FROM "Users" AS "User" LIMIT NULL OFFSET 1;',
      db2: `SELECT "id" FROM "Users" AS "User" OFFSET 1 ROWS;`,
      ibmi: 'SELECT "id" FROM "Users" AS "User" OFFSET 1 ROWS',
      mssql: `SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 1 ROWS;`,
    });
  });

  it('supports querying for bigint values', () => {
    const sql = queryGenerator.selectQuery(Project.table, {
      model: Project,
      attributes: ['id'],
      where: {
        duration: { [Op.eq]: 9_007_199_254_740_993n },
      },
    }, Project);

    expectsql(sql, {
      postgres: `SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;`,
      mysql: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
      mariadb: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
      sqlite: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
      snowflake: 'SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;',
      db2: `SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;`,
      ibmi: `SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993`,
      mssql: `SELECT [id] FROM [Projects] AS [Project] WHERE [Project].[duration] = 9007199254740993;`,
    });
  });

  it('supports cast in attributes', () => {
    const sql = queryGenerator.selectQuery(User.table, {
      model: User,
      attributes: [
        'id',
        [cast(col('createdAt'), 'varchar'), 'createdAt'],
      ],
    }, User);

    expectsql(sql, {
      default: `SELECT [id], CAST([createdAt] AS VARCHAR) AS [createdAt] FROM [Users] AS [User];`,
    });
  });

  it('supports empty where object', () => {
    const sql = queryGenerator.selectQuery(User.table, {
      model: User,
      attributes: [
        'id',
      ],
      where: {},
    }, User);

    expectsql(sql, {
      default: `SELECT [id] FROM [Users] AS [User];`,
    });
  });

  it('escapes WHERE clause correctly', () => {
    const sql = queryGenerator.selectQuery(User.table, {
      model: User,
      attributes: [
        'id',
      ],
      where: { username: 'foo\';DROP TABLE mySchema.myTable;' },
    }, User);

    expectsql(sql, {
      default: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'foo'';DROP TABLE mySchema.myTable;';`,
      'mysql mariadb': `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = 'foo\\';DROP TABLE mySchema.myTable;';`,
      mssql: `SELECT [id] FROM [Users] AS [User] WHERE [User].[username] = N'foo'';DROP TABLE mySchema.myTable;';`,
    });
  });

  if (sequelize.dialect.supports.jsonOperations) {
    it('accepts json paths in attributes', () => {
      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: [
          [attribute('data.email'), 'email'],
        ],
      }, User);

      expectsql(sql, {
        postgres: `SELECT "data"->'email' AS "email" FROM "Users" AS "User";`,
        mariadb: `SELECT json_compact(json_extract(\`data\`,'$.email')) AS \`email\` FROM \`Users\` AS \`User\`;`,
        'sqlite mysql': `SELECT json_extract([data],'$.email') AS [email] FROM [Users] AS [User];`,
      });

    });
  }

  describe('replacements', () => {
    it('parses named replacements in literals', () => {
      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: [
          [fn('uppercase', literal(':attr')), 'id'],
          literal(':attr2'),
        ],
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
      }, User);

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
      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: [literal('id')],
        where: literal(`id = ':id'`),
        replacements: {
          id: 1,
        },
      }, User);

      expectsql(sql, {
        default: `SELECT id FROM [Users] AS [User] WHERE id = ':id';`,
      });
    });

    it('parses named replacements in literals in includes', () => {
      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: ['id'],
        include: _validateIncludedElements({
          model: User,
          include: [{
            association: User.associations.projects,
            attributes: [['id', 'id'], literal(':data'), [literal(':data'), 'id2']],
            on: literal(':on'),
            where: literal(':where'),
            include: [{
              association: Project.associations.owner,
              attributes: [literal(':data2')],
            }],
          }],
        }).include,
        replacements: {
          data: 'repl1',
          data2: 'repl2',
          on: 'on',
          where: 'where',
        },
      }, User);

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
      const sql = queryGenerator.selectQuery(Project.table, {
        model: Project,
        attributes: ['id'],
        include: _validateIncludedElements({
          model: Project,
          include: [{
            attributes: ['id'],
            association: Project.associations.contributors,
            through: {
              where: literal(':where'),
            },
          }],
        }).include,
        replacements: {
          where: 'where',
        },
      }, Project);

      expectsql(sql, {
        default: `
          SELECT
            [Project].[id],
            [contributors].[id] AS [contributors.id],
            [contributors->ProjectContributor].[UserId] AS [contributors.ProjectContributor.UserId],
            [contributors->ProjectContributor].[ProjectId] AS [contributors.ProjectContributor.ProjectId]
          FROM [Projects] AS [Project]
          LEFT OUTER JOIN (
            [ProjectContributors] AS [contributors->ProjectContributor]
            INNER JOIN [Users] AS [contributors]
            ON [contributors].[id] = [contributors->ProjectContributor].[UserId]
            AND 'where'
          )
          ON [Project].[id] = [contributors->ProjectContributor].[ProjectId];
        `,
        mssql: `
          SELECT
            [Project].[id],
            [contributors].[id] AS [contributors.id],
            [contributors->ProjectContributor].[UserId] AS [contributors.ProjectContributor.UserId],
            [contributors->ProjectContributor].[ProjectId] AS [contributors.ProjectContributor.ProjectId]
          FROM [Projects] AS [Project]
          LEFT OUTER JOIN (
            [ProjectContributors] AS [contributors->ProjectContributor]
            INNER JOIN [Users] AS [contributors]
            ON [contributors].[id] = [contributors->ProjectContributor].[UserId]
            AND N'where'
          )
          ON [Project].[id] = [contributors->ProjectContributor].[ProjectId];
        `,
      });
    });

    it('parses named replacements in literals in includes (subQuery)', () => {
      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: ['id'],
        include: _validateIncludedElements({
          model: User,
          include: [{
            association: User.associations.projects,
            attributes: [['id', 'id'], literal(':data'), [literal(':data'), 'id2']],
            on: literal(':on'),
            where: literal(':where'),
            include: [{
              association: Project.associations.owner,
              attributes: [literal(':data2')],
            }],
          }],
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
      }, User);

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
      expect(
        () => queryGenerator.selectQuery(User.table, {
          model: User,
          where: {
            username: {
              [Op.eq]: literal('?'),
            },
          },
          replacements: ['repl1', 'repl2', 'repl3'],
        }, User),
      ).to.throwWithCause(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);
    });

    it(`always escapes the attribute if it's provided as a string`, () => {
      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: [
          // these used to have special escaping logic, now they're always escaped like any other strings. col, fn, and literal can be used for advanced logic.
          ['count(*)', 'count'],
          '.*',
          '*',
          [literal('count(*)'), 'literal_count'],
          [fn('count', '*'), 'fn_count_str'],
          [fn('count', col('*')), 'fn_count_col'],
          [fn('count', literal('*')), 'fn_count_lit'],
          [col('a.b'), 'col_a_b'],
          [col('a.*'), 'col_a_all'],
          [col('*'), 'col_all'],
        ],
      }, User);

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
      const sql = queryGenerator.selectQuery(User.table, {
        model: User,
        attributes: [
          literal('*'),
          [fn('YEAR', col('createdAt')), 'creationYear'],
        ],
        group: ['creationYear', 'title'],
        having: { creationYear: { [Op.gt]: 2002 } },
      }, User);

      expectsql(sql, {
        default: `SELECT *, YEAR([createdAt]) AS [creationYear] FROM [Users] AS [User] GROUP BY [creationYear], [title] HAVING [User].[creationYear] > 2002;`,
      });
    });
  });

  describe('previously supported values', () => {
    it('raw replacements for where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: ['name IN (?)', [1, 'test', 3, 'derp']],
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`);
    });

    it('raw replacements for nested where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: [['name IN (?)', [1, 'test', 3, 'derp']]],
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`);
    });

    it('raw replacements for having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          having: ['name IN (?)', [1, 'test', 3, 'derp']],
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`);
    });

    it('raw replacements for nested having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          having: [['name IN (?)', [1, 'test', 3, 'derp']]],
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 'name IN (?)'`);
    });

    it('raw string from where', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: `name = 'something'`,
        });
      }).to.throwWithCause(Error, 'Support for `{ where: \'raw query\' }` has been removed.');
    });

    it('raw string from having', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          having: `name = 'something'`,
        });
      }).to.throwWithCause(Error, 'Support for `{ where: \'raw query\' }` has been removed.');
    });

    it('rejects where: null', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: null,
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got null`);
    });

    it('rejects where: primitive', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: 1,
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got 1`);
    });

    it('rejects where: array of primitives', () => {
      expect(() => {
        queryGenerator.selectQuery('User', {
          attributes: ['*'],
          // @ts-expect-error -- this is not a valid value anymore
          where: [''],
        });
      }).to.throwWithCause(Error, `Invalid Query: expected a plain object, an array or a sequelize SQL method but got ''`);
    });
  });

  describe('minifyAliases', () => {
    it('minifies custom attributes', () => {
      const sql = queryGenerator.selectQuery(User.table, {
        minifyAliases: true,
        model: User,
        attributes: [
          [literal('1'), 'customAttr'],
        ],
        order: ['customAttr'],
        group: ['customAttr'],
      }, User);

      expectsql(sql, {
        default: `SELECT 1 AS [_0] FROM [Users] AS [User] GROUP BY [_0] ORDER BY [_0];`,
      });
    });
  });
});
