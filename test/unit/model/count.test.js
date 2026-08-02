import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';
import DataTypes from '../../../lib/data-types.js';

const expect = chai.expect;

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method count', () => {
    before(function () {
      this.oldFindAll = current.Model.findAll;
      this.oldAggregate = current.Model.aggregate;

      current.Model.findAll = sinon.stub().returns(Promise.resolve());

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

    after(function () {
      current.Model.findAll = this.oldFindAll;
      current.Model.aggregate = this.oldAggregate;
    });

    beforeEach(function () {
      this.stub = current.Model.aggregate = sinon.stub().returns(Promise.resolve());
    });

    describe('should pass the same options to model.aggregate as findAndCount', () => {
      it('with includes', function () {
        const queryObject = {
          include: [this.Project]
        };
        return this.User.count(queryObject)
          .then(() => this.User.findAndCount(queryObject))
          .then(() => {
            const count = this.stub.getCall(0).args;
            const findAndCount = this.stub.getCall(1).args;
            expect(count).to.eql(findAndCount);
          });
      });

      it('attributes should be stripped in case of findAndCount', function () {
        const queryObject = {
          attributes: ['username']
        };
        return this.User.count(queryObject)
          .then(() => this.User.findAndCount(queryObject))
          .then(() => {
            const count = this.stub.getCall(0).args;
            const findAndCount = this.stub.getCall(1).args;
            expect(count).not.to.eql(findAndCount);
            count[2].attributes = undefined;
            expect(count).to.eql(findAndCount);
          });
      });
    });
  });
});
