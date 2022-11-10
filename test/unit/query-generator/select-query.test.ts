import type { InferAttributes, Model } from '@sequelize/core';
import { Op, literal, DataTypes, or, fn, where, cast, col } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

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
    const sql = queryGenerator.selectQuery(User.tableName, {
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
    const sql = queryGenerator.selectQuery(Project.tableName, {
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
    const sql = queryGenerator.selectQuery(User.tableName, {
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

  describe('replacements', () => {
    it('parses named replacements in literals', async () => {
      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(User.tableName, {
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
      }, User);

      expectsql(sql, {
        default: `
          SELECT uppercase('id') AS [id], 'id2'
          FROM [Users] AS [User]
          WHERE ([User].[username] = 'repl1' OR uppercase(CAST('repl1' AS STRING)) = 'repl1')
          GROUP BY 'the group'
          HAVING [username] = 'repl1'
          ORDER BY 'repl2'
          LIMIT 'repl3'
          OFFSET 'repl4';
        `,
        mssql: `
          SELECT uppercase(N'id') AS [id], N'id2'
          FROM [Users] AS [User]
          WHERE ([User].[username] = N'repl1' OR uppercase(CAST(N'repl1' AS STRING)) = N'repl1')
          GROUP BY N'the group'
          HAVING [username] = N'repl1'
          ORDER BY N'repl2'
          OFFSET N'repl4' ROWS
          FETCH NEXT N'repl3' ROWS ONLY;
        `,
        db2: `
          SELECT uppercase('id') AS "id", 'id2'
          FROM "Users" AS "User"
          WHERE ("User"."username" = 'repl1' OR uppercase(CAST('repl1' AS STRING)) = 'repl1')
          GROUP BY 'the group'
          HAVING "username" = 'repl1'
          ORDER BY 'repl2'
          OFFSET 'repl4' ROWS
          FETCH NEXT 'repl3' ROWS ONLY;
        `,
        ibmi: `
          SELECT uppercase('id') AS "id", 'id2'
          FROM "Users" AS "User"
          WHERE ("User"."username" = 'repl1' OR uppercase(CAST('repl1' AS STRING)) = 'repl1')
          GROUP BY 'the group'
          HAVING "username" = 'repl1'
          ORDER BY 'repl2'
          OFFSET 'repl4' ROWS
          FETCH NEXT 'repl3' ROWS ONLY
        `,
      });
    });

    // see the unit tests of 'injectReplacements' for more
    it('does not parse replacements in strings in literals', async () => {
      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      const sql = queryGenerator.selectQuery(User.tableName, {
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

    it('parses named replacements in literals in includes', async () => {
      const sql = queryGenerator.selectQuery(User.tableName, {
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

    it(`parses named replacements in belongsToMany includes' through tables`, async () => {
      const sql = queryGenerator.selectQuery(Project.tableName, {
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

    it('parses named replacements in literals in includes (subQuery)', async () => {
      const sql = queryGenerator.selectQuery(User.tableName, {
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

    it('rejects positional replacements, because their execution order is hard to determine', async () => {
      await expect(
        () => queryGenerator.selectQuery(User.tableName, {
          model: User,
          where: {
            username: {
              [Op.eq]: literal('?'),
            },
          },
          replacements: ['repl1', 'repl2', 'repl3'],
        }, User),
      ).to.throw(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);
    });
  });
});
