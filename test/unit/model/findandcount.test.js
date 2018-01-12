'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  current = Support.sequelize,
  sinon = require('sinon'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Promise = require('bluebird').getNewLibraryCopy();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findAndCount', () => {
    describe('should handle promise rejection in findAndCount', () => {
      before(() => {
        this.oldFindAll = current.Model.findAll;
        this.oldCount = current.Model.count;

        current.Model.count = () => Promise.reject(new Error());
        current.Model.findAll = () => Promise.reject(new Error());

        this.stub = sinon.stub();

        Promise.onPossiblyUnhandledRejection(() => {
          this.stub();
        });

        this.User = current.define('User', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        });
      });

      after(() => {
        current.Model.findAll = this.oldFindAll;
        current.Model.count = this.oldCount;
      });

      it('with errors in count and findAll both', () => {
        return this.User.findAndCount({})
          .catch(() => {
            expect(this.stub.callCount).to.eql(0);
          });
      });
    });
  });
});
