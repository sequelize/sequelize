import { Op, literal, DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

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

  // you'll find more replacement tests in query-generator tests
  describe('replacements', () => {
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

  // you'll find more bind tests in query-generator tests
  describe('bind', () => {
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
