'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../index'),
  Support = require('../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.upserts) {
    describe('method upsert', () => {
      before(function() {
        this.User = current.define('User', {
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
          },
          createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
          }
        });

        this.UserNoTime = current.define('UserNoTime', {
          name: DataTypes.STRING
        }, {
          timestamps: false
        });
      });

      beforeEach(function() {
        this.query = sinon.stub(current, 'query').resolves();
        this.stub = sinon.stub(current.getQueryInterface(), 'upsert').resolves([true, undefined]);
      });

      afterEach(function() {
        this.query.restore();
        this.stub.restore();
      });

      it('skip validations for missing fields', function() {
        return expect(this.User.upsert({
          name: 'Grumpy Cat'
        })).not.to.be.rejectedWith(Sequelize.ValidationError);
      });

      it('creates new record with correct field names', function() {
        return this.User
          .upsert({
            name: 'Young Cat',
            virtualValue: 999
          })
          .then(() => {
            expect(Object.keys(this.stub.getCall(0).args[1])).to.deep.equal([
              'name', 'value', 'created_at', 'updatedAt'
            ]);
          });
      });

      it('creates new record with timestamps disabled', function() {
        return this.UserNoTime
          .upsert({
            name: 'Young Cat'
          })
          .then(() => {
            expect(Object.keys(this.stub.getCall(0).args[1])).to.deep.equal([
              'name'
            ]);
          });
      });

      it('updates all changed fields by default', function() {
        return this.User
          .upsert({
            name: 'Old Cat',
            virtualValue: 111
          })
          .then(() => {
            expect(Object.keys(this.stub.getCall(0).args[2])).to.deep.equal([
              'name', 'value', 'updatedAt'
            ]);
          });
      });
    });
  }
});
