import { Op, literal, DataTypes, or, fn, where, cast, Model } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, sequelize } from '../../support';

// TODO: most of these tests can be moved to test queryGenerator directly.
// TODO: test 'insert', 'upsert', 'bulkInsert', 'update', 'bulkUpdate', 'delete', 'bulkDelete', 'increment', 'decrement', 'rawSelect'

describe('QueryInterface#select', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
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

  afterEach(() => {
    sinon.restore();
  });

  describe('replacements', () => {
    it('parses named replacements in literals', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([]));

      // The goal of this test is to test that :replacements are parsed in literals in as many places as possible

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
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
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);

      expectsql(firstCall.args[0] as string, {
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

      expect(firstCall.args[1].bind).to.be.undefined;
    });

    // TODO: test subQuery.
    // TODO: test many-to-many join

    it('parses named replacements in literals in includes', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([]));

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
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
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);

      expectsql(firstCall.args[0] as string, {
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

      expect(firstCall.args[1].bind).to.be.undefined;
    });

    it('parses named replacements in sub-queries through tables', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([]));

      await sequelize.getQueryInterface().select(Project, Project.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
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
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);

      expectsql(firstCall.args[0] as string, {
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

      expect(firstCall.args[1].bind).to.be.undefined;
    });

    it('rejects positional replacements, because their execution order is hard to determine', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await expect(
        sequelize.getQueryInterface().select(User, User.tableName, {
          where: {
            username: {
              [Op.eq]: literal('?'),
            },
          },
          replacements: ['repl1', 'repl2', 'repl3'],
        }),
      ).to.be.rejectedWith(`The following literal includes positional replacements (?). Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal("?")`);

      expect(stub).not.to.have.been.called;
    });

    it('does not parse replacements from literals twice', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
        attributes: ['id'],
        where: {
          username: {
            [Op.eq]: literal(':data'),
          },
        },
        replacements: {
          data: ':data2',
          data2: 'sql injection',
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \':data2\';');
      expect(firstCall.args[1].bind).to.be.undefined;
    });

    it('does not parse user-provided data as replacements', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
        attributes: ['id'],
        where: {
          username: 'some :data',
        },
        replacements: {
          data: 'OR \' = ',
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \'some :data\';');
      expect(firstCall.args[1].bind).to.be.undefined;
    });
  });

  describe('bind', () => {
    it('parses named bind in literals', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
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
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE ("User"."username" = $1 OR "User"."username" = $2 OR "User"."username" = $2);');
      expect(firstCall.args[1].bind).to.deep.eq(['this should be present', 'other data']);
    });

    it('parses positional bind in literals', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
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
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE ("User"."username" = $2 OR "User"."username" = $1);');
      expect(firstCall.args[1].bind).to.deep.eq(['bind param 1', 'bind param 2']);
    });

    it('does not parse user-provided data as bind', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw');

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
        attributes: ['id'],
        where: {
          username: 'some $data',
        },
        bind: {
          data: 'fail',
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \'some $data\';');
      expect(firstCall.args[1].bind).to.be.undefined;
    });
  });
});
