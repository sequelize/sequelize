'use strict';

/* jshint -W030, -W110 */
var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Support   = require(__dirname + '/../support')
  , DataTypes = require('../../../lib/data-types')
  , current   = Support.sequelize
  , Promise = current.Promise;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('sync', function () {

    before(function () {
      this.oldQuery = current.query;
    });

    beforeEach(function () {
      this.stub = current.query = sinon.stub().returns(Promise.resolve());
    });

    after(function () {
      current.query = this.oldQuery;
    });

    describe('unique index', function () {
      it('should only create a single index', function () {
        var Model = current.define('model', {
          email: {
            type: DataTypes.STRING(),
            field: 'email',
            allowNull: true,
            defaultValue: null,
            unique: true
          }
        }, { timestamps: false });
        return Model.sync().bind(this).then(function () {
          var sql = this.stub.getCall(0).args[0];
          var unique = sql.indexOf('UNIQUE');
          expect(unique).to.be.eql(sql.lastIndexOf('UNIQUE'));
          expect(unique).not.to.be.eql(-1);
        });
      });

      it('should create a named index', function () {
        var Model = current.define('model', {
          email: {
            type: DataTypes.STRING(),
            field: 'email',
            allowNull: true,
            defaultValue: null,
            unique: 'foobar'
          }
        }, { timestamps: false });
        return Model.sync().bind(this).then(function () {
          var sql = this.stub.getCall(0).args[0];
          var unique = sql.indexOf('UNIQUE');
          expect(unique).to.be.eql(sql.lastIndexOf('UNIQUE'));
          expect(unique).not.to.be.eql(-1);
        });
      });

      it('should create a composite index', function () {
        var Model = current.define('model', {
          email: {
            type: DataTypes.STRING(),
            field: 'email',
            allowNull: true,
            defaultValue: null,
            unique: 'foobar'
          },
          password: {
            type: DataTypes.STRING(),
            unique: 'foobar'
          }
        }, { timestamps: false });
        return Model.sync().bind(this).then(function () {
          var sql = this.stub.getCall(0).args[0];
          var unique = sql.indexOf('UNIQUE');
          expect(unique).to.be.eql(sql.lastIndexOf('UNIQUE'));
          expect(unique).not.to.be.eql(-1);
        });
      });

      it('should create a composite index with name', function () {
        var Model = current.define('model', {
          email: {
            type: DataTypes.STRING(),
            field: 'email',
            allowNull: true,
            defaultValue: null,
            unique: {
              name: 'foobar'
            }
          },
          password: {
            type: DataTypes.STRING(),
            unique: {
              name: 'foobar'
            }
          }
        }, { timestamps: false });
        return Model.sync().bind(this).then(function () {
          var sql = this.stub.getCall(0).args[0];
          var unique = sql.indexOf('UNIQUE');
          expect(unique).to.be.eql(sql.lastIndexOf('UNIQUE'));
          expect(unique).not.to.be.eql(-1);
        });
      });
    });
  });
});
