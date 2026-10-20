import { DataTypes, ValidationError } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize as current, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.upserts) {
    describe('method upsert', () => {
      const vars = beforeAll2(() => {
        const User = current.define('User', {
          name: DataTypes.STRING,
          virtualValue: {
            type: DataTypes.VIRTUAL,
            set(val) {
              this.set('value', val);
            },
            get() {
              return this.get('value');
            },
          },
          value: DataTypes.STRING,
          secretValue: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          createdAt: {
            type: DataTypes.DATE,
            field: 'created_at',
          },
        });

        const UserNoTime = current.define(
          'UserNoTime',
          {
            name: DataTypes.STRING,
          },
          {
            timestamps: false,
          },
        );

        return { User, UserNoTime };
      });

      let query: SinonStub;
      let stub: SinonStub;
      beforeEach(() => {
        query = sinon.stub(current, 'queryRaw').resolves();
        stub = sinon.stub(current.queryInterface, 'upsert').resolves([vars.User.build(), true]);
      });

      afterEach(() => {
        query.restore();
        stub.restore();
      });

      it('skip validations for missing fields', async () => {
        await expect(
          vars.User.upsert({
            name: 'Grumpy Cat',
          }),
        ).not.to.be.rejectedWith(ValidationError);
      });

      it('creates new record with correct field names', async () => {
        await vars.User.upsert({
          name: 'Young Cat',
          virtualValue: '999',
        });

        expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal([
          'name',
          'value',
          'created_at',
          'updatedAt',
        ]);
      });

      it('creates new record with timestamps disabled', async () => {
        await vars.UserNoTime.upsert({
          name: 'Young Cat',
        });

        expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal(['name']);
      });

      it('updates all changed fields by default', async () => {
        await vars.User.upsert({
          name: 'Old Cat',
          virtualValue: '111',
        });

        expect(Object.keys(stub.getCall(0).args[2])).to.deep.equal(['name', 'value', 'updatedAt']);
      });
    });
  }
});
