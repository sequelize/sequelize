import { Op, literal, DataTypes, or } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('QueryInterface#select', () => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('replacements', () => {
    it('parses named replacements in literals', async () => {
      const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([]));

      await sequelize.getQueryInterface().select(User, User.tableName, {
        // @ts-expect-error -- we'll fix the typings when we migrate query-generator to TypeScript
        attributes: ['id'],
        where: {
          username: {
            [Op.eq]: literal(':data'),
          },
        },
        replacements: {
          data: 'this should be present',
        },
      });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expect(firstCall.args[0]).to.eq('SELECT "id" FROM "Users" AS "User" WHERE "User"."username" = \'this should be present\';');
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
