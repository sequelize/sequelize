'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , current = Support.sequelize
  , sinon = require('sinon')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Model'), function () {
  describe('method count', function () {
    before(function () {
      this.oldFindAll = current.Model.prototype.findAll;
      this.oldAggregate = current.Model.prototype.aggregate;

      current.Model.prototype.findAll = sinon.stub().returns(Promise.resolve());

      this.User = current.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      });
      this.Project = current.define('Project', {
        name: DataTypes.STRING
      });

      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);
    });

    beforeEach(function () {
      this.stub = current.Model.prototype.aggregate = sinon.stub().returns(Promise.resolve());
    });

    after(function () {
      current.Model.prototype.findAll = this.oldFindAll;
      current.Model.prototype.aggregate = this.oldAggregate;
    });

    describe('should pass the same options to model.aggregate as findAndCount', function () {
      it('with includes', function () {
        var self = this;
        var queryObject = {
          include: [self.Project]
        };
        return self.User.count(queryObject).then(function () {
          return self.User.findAndCount(queryObject);
        }).then(function () {
          var count = self.stub.getCall(0).args;
          var findAndCount = self.stub.getCall(1).args;
          expect(count).to.eql(findAndCount);
        });
      });

      it('attributes should be stripped in case of findAndCount', function () {
        var self = this;
        var queryObject = {
          attributes: ['username']
        };
        return self.User.count(queryObject).then(function () {
          return self.User.findAndCount(queryObject);
        }).then(function () {
          var count = self.stub.getCall(0).args;
          var findAndCount = self.stub.getCall(1).args;
          expect(count[2].attributes).to.eql(['username']);
          expect(count).not.to.eql(findAndCount);
          count[2].attributes = undefined;
          expect(count).to.eql(findAndCount);
        });
      });
    });

  });
});