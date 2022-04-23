import type { InferAttributes } from '@sequelize/core';
import { Op, literal, DataTypes, or, fn, where, cast, Model } from '@sequelize/core';
import type { BindContext } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
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

      const bindContext: BindContext = {};
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
      }, User, bindContext);

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
      });

      expect(bindContext.normalizedBind).to.be.undefined;
    });

    it('parses named replacements in literals in includes', async () => {
      const bindContext: BindContext = {};
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
      }, User, bindContext);

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
      });

      expect(bindContext.normalizedBind).to.be.undefined;
    });

    it('parses named replacements in sub-queries through tables', async () => {
      const bindContext: BindContext = {};
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
      }, Project, bindContext);

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
      });

      expect(bindContext.normalizedBind).to.be.undefined;
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
        }, User, {}),
      ).to.throw(`The following literal includes positional replacements (?). Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);
    });
  });

  describe('bind', () => {
    it('parses named bind in literals', async () => {
      const bindContext: BindContext = {};
      const sql = queryGenerator.selectQuery(User.tableName, {
        model: User,
        attributes: ['id'],
        where: or({
          username: {
            [Op.eq]: literal('$data'),
          },
        }, {
          username: {
            [Op.eq]: literal('$otherData'),
          },
        }, {
          username: {
            [Op.eq]: literal('$otherData'),
          },
        }),
        bind: {
          data: 'this should be present',
          otherData: 'other data',
        },
      }, User, bindContext);

      // postgres supports reusing the same parameters
      if (sequelize.dialect.name === 'postgres') {
        expect(sql).to.eq('SELECT "id" FROM "Users" AS "User" WHERE ("User"."username" = $1 OR "User"."username" = $2 OR "User"."username" = $2);');
        expect(bindContext.normalizedBind).to.deep.eq(['this should be present', 'other data']);
      } else {
        expectsql(sql, {
          mariadb: 'SELECT `id` FROM `Users` AS `User` WHERE (`User`.`username` = ? OR `User`.`username` = ? OR `User`.`username` = ?);',
          mysql: 'SELECT `id` FROM `Users` AS `User` WHERE (`User`.`username` = ? OR `User`.`username` = ? OR `User`.`username` = ?);',
        });

        expect(bindContext.normalizedBind).to.deep.eq(['this should be present', 'other data', 'other data']);
      }
    });

    it('parses positional bind in literals', async () => {
      const bindContext: BindContext = {};
      const sql = queryGenerator.selectQuery(User.tableName, {
        model: User,
        attributes: ['id'],
        where: or({
          username: {
            [Op.eq]: literal('$2'),
          },
        }, {
          username: {
            [Op.eq]: literal('$1'),
          },
        }),
        bind: ['bind param 1', 'bind param 2'],
      }, User, bindContext);

      expectsql(sql, {
        postgres: 'SELECT "id" FROM "Users" AS "User" WHERE ("User"."username" = $1 OR "User"."username" = $2);',
        mariadb: 'SELECT `id` FROM `Users` AS `User` WHERE (`User`.`username` = ? OR `User`.`username` = ?);',
        mysql: 'SELECT `id` FROM `Users` AS `User` WHERE (`User`.`username` = ? OR `User`.`username` = ?);',
      });
      expect(bindContext.normalizedBind).to.deep.eq(['bind param 2', 'bind param 1']);
    });
  });
});
