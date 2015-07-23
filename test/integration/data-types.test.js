'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , sinon = require('sinon')
  , dataTypes = require('../../lib/data-types')
  , moment = require('moment')
  , current = Support.sequelize
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('DataTypes'), function() {
  it('allows me to return values from a custom parse function', function () {
    var parse = Sequelize.DATE.parse = sinon.spy(function (value) {
      return moment(value, 'YYYY-MM-DD HH:mm:ss Z');
    });

    var stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function (value, options) {
      if (!moment.isMoment(value)) {
        value = this.$applyTimezone(value, options);
      }
      return value.format('YYYY-MM-DD HH:mm:ss Z');
    });

    current.refreshTypes();

    var User = current.define('user', {
      dateField: Sequelize.DATE
    }, {
      timestamps: false
    });

    return current.sync({ force: true }).then(function () {
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

  var testType = function (Type, value, options) {
    options = options || {};
    it('calls parse and stringify for ' + Type.toSql(), function () {
      var parse = Type.constructor.parse = sinon.spy(options.parse || function (value) {
        return value;
      });

      var stringify = Type.constructor.prototype.stringify = sinon.spy(options.$stringify || function (value) {
        return value;
      });

      current.refreshTypes();

      var User = current.define('user', {
        field: Type
      }, {
        timestamps: false
      });

      return current.sync({ force: true }).then(function () {
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

  // [new Sequelize.TEXT(), new Sequelize.STRING(), new Sequelize.CHAR(), new Sequelize.CHAR().BINARY].forEach(function (Type) {
  //  testType(Type, 'foobar');
  // });

  // [new Sequelize.BOOLEAN(), new Sequelize.DOUBLE(), new Sequelize.REAL(), new Sequelize.INTEGER(), new Sequelize.DECIMAL()].forEach(function (Type) {
  //  testType(Type, 1);
  // });

  // [new Sequelize.REAL(), new Sequelize.FLOAT()].forEach(function (Type) {
  //   testType(Type, 1);
  // });

  var blobStringify = ('BLOB' in dataTypes[dialect]) ? dataTypes[dialect].BLOB : dataTypes.BLOB;
  blobStringify = blobStringify.prototype.$stringify;
  // testType(new Sequelize.BLOB(), new Buffer('hej'), { $stringify: blobStringify });
  testType(new Sequelize.STRING().BINARY, 'foo');

  var stringBinary = new Sequelize.STRING().BINARY;
  testType(stringBinary, new Buffer('foo'), { $stringify: blobStringify.bind(stringBinary)});
});
