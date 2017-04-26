'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  Promise = current.Promise,
  DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {

  if (current.dialect.supports.upserts) {
    describe('method upsert', () => {
      const self = this;
      const User = current.define('User', {
        name: DataTypes.STRING,
        virtualValue: {
          type: DataTypes.VIRTUAL,
          set(val) {
            return this.value = val;
          },
          get() {
            return this.value;
          }
        },
        value: DataTypes.STRING,
        secretValue: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      });

      before(function() {
        this.query = current.query;
        current.query = sinon.stub().returns(Promise.resolve());

        self.stub = sinon.stub(current.getQueryInterface(), 'upsert', () => {
          return User.build({});
        });
      });

      beforeEach(() => {
        self.stub.reset();
      });

      after(function() {
        current.query = this.query;
        self.stub.restore();
      });


      it('skip validations for missing fields', () => {
        return expect(User.upsert({
          name: 'Grumpy Cat'
        })).not.to.be.rejectedWith(current.ValidationError);
      });

      it('updates all changed fields by default', () => {
        return User
          .upsert({
            name: 'Old Cat',
            virtualValue: 111
          })
          .then(() => {
            expect(Object.keys(self.stub.getCall(0).args[2])).to.deep.equal([
              'name', 'value', 'updatedAt'
            ]);
          });
      });
    });
  }
});
