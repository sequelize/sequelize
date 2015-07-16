'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , sinon = require('sinon')
  , _ = require('lodash')
  , moment = require('moment')
  , current = Support.sequelize;

describe.only(Support.getTestDialectTeaser('DataTypes'), function() {
  it('allows me to use a custom parse function', function () {
    // var parseStub = sinon.stub(this.sequelize.DATE, 'parse', function (value) {
    //   new moment(value);
    // });
    var parse = Sequelize.DATE.parse = sinon.spy(function (value) {
      return moment(value, 'YYYY-MM-DD HH:mm:ss Z');
    });

    var stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function (value, options) {
      if (!moment.isMoment(value)) {
        value = this.$applyTimezone(value, options);
      }
      return value.format('YYYY-MM-DD HH:mm:ss Z');
    });

    this.sequelize.refreshTypes();

    var User = this.sequelize.define('user', {
      dateField: Sequelize.DATE
    }, {
      timestamps: false
    });

    return this.sequelize.sync({ force: true }).then(function () {
      return User.create({
        dateField: moment("2011 10 31", 'YYYY MM DD')
      });
    }).then(function () {
      return User.findAll().get(0);
    }).then(function (user) {
      expect(parse).to.have.been.called;
      expect(stringify).to.have.been.called;

      expect(moment.isMoment(user.dateField)).to.be.ok;
    });
  });

  var testType = function (Type, value) {
    it((new Type()).toSql(), function () {
      var parse = Type.parse = sinon.spy(function (value) {
        return value;
      });

      var stringify = Type.prototype.stringify = sinon.spy(function (value) {
        return value;
      });

      this.sequelize.refreshTypes();

      var User = this.sequelize.define('user', {
        field: new Type()
      }, {
        timestamps: false
      });

      return this.sequelize.sync({ force: true }).then(function () {
        return User.create({
          field: value
        });
      }).then(function () {
        return User.findAll().get(0);
      }).then(function (user) {
        expect(parse).to.have.been.called;
        expect(stringify).to.have.been.called;
      });
    });
  };

  [Sequelize.TEXT, Sequelize.STRING, Sequelize.CHAR].forEach(function (Type) {
   testType(Type, 'foobar');
  });

  [Sequelize.BOOLEAN, Sequelize.DOUBLE, Sequelize.REAL, Sequelize.INTEGER].forEach(function (Type) {
   testType(Type, 1);
  });
});
