import type { InferAttributes } from '@sequelize/core';
import { Op, literal, DataTypes, or, fn, where, cast, Model } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#selectQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  interface TUser extends Model<InferAttributes<TUser>> {
    username: string;
  }

  const User = sequelize.define<TUser>('User', {
    username: DataTypes.STRING,
  }, { timestamps: false });

  const Project = sequelize.define('Project', {}, { timestamps: false });

  const ProjectContributor = sequelize.define('ProjectContributor', {}, { timestamps: false });

  // project owners
  User.hasMany(Project, { as: 'projects' });
  Project.belongsTo(User, { as: 'owner' });

  // project contributors
  Project.belongsToMany(User, {
    through: ProjectContributor,
    as: 'contributors',
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
      });
    });

    it('parses named replacements in literals in includes', async () => {
      const sql = queryGenerator.selectQuery(User.tableName, {
        model: User,
        attributes: ['id'],
        // TODO: update after https://github.com/sequelize/sequelize/pull/14280 has been merged
        // @ts-expect-error
        include: Model._validateIncludedElements({
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
      });
    });

    it(`parses named replacements in belongsToMany includes' through tables`, async () => {
      const sql = queryGenerator.selectQuery(Project.tableName, {
        model: Project,
        attributes: ['id'],
        // TODO: update after https://github.com/sequelize/sequelize/pull/14280 has been merged
        // @ts-expect-error
        include: Model._validateIncludedElements({
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
            [contributors->ProjectContributor].[ProjectId] AS [contributors.ProjectContributor.ProjectId],
            [contributors->ProjectContributor].[UserId] AS [contributors.ProjectContributor.UserId]
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
            [contributors->ProjectContributor].[ProjectId] AS [contributors.ProjectContributor.ProjectId],
            [contributors->ProjectContributor].[UserId] AS [contributors.ProjectContributor.UserId]
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

    // TODO: test subQueries

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
      ).to.throw(`The following literal includes positional replacements (?). Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);
    });
  });
});
