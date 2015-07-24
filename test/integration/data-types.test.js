'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , sinon = require('sinon')
  , _ = require('lodash')
  , moment = require('moment')
  , current = Support.sequelize
  , uuid = require('node-uuid')
  , DataTypes = require('../../lib/data-types')
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('DataTypes'), function() {
  afterEach(function () {
    // Restore some sanity by resetting all parsers
    switch (dialect) {
      case 'postgres':
        var types = require('../../node_modules/pg/node_modules/pg-types');

        _.each(DataTypes, function (dataType) {
          if (dataType.types && dataType.types.postgres) {
            dataType.types.postgres.oids.forEach(function (oid) {
              types.setTypeParser(oid, _.identity);
            });
          }
        });
        require('../../node_modules/pg/node_modules/pg-types/lib/binaryParsers').init(function (oid, converter) {
          types.setTypeParser(oid, 'binary', converter);
        });
        require('../../node_modules/pg/node_modules/pg-types/lib/textParsers').init(function (oid, converter) {
          types.setTypeParser(oid, 'text', converter);
        });
        break;
      default:
        this.sequelize.connectionManager.$clearTypeParser();
    }
  });

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

      delete Sequelize.DATE.parse;
    });
  });

  var testSuccess = function (Type, value) {
    var parse = Type.constructor.parse = sinon.spy(function (value) {
      return value;
    });

    var stringify = Type.constructor.prototype.stringify = sinon.spy(function (value) {
      return Sequelize.ABSTRACT.prototype.stringify.apply(this, arguments);
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

      delete Type.constructor.parse;
      delete Type.constructor.prototype.stringify;
    });
  };

  var testFailure = function (Type, value) {
    Type.constructor.parse = _.noop();

    expect(function ()  {
      current.refreshTypes();
    }).to.throw('Parse function not supported for type ' + Type.key + ' in dialect ' + dialect);

    delete Type.constructor.parse;
  };

  if (dialect === 'postgres') {
    it('calls parse and stringify for JSON', function () {
      var Type = new Sequelize.JSON();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });

    it('calls parse and stringify for JSONB', function () {
      var Type = new Sequelize.JSONB();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });

    it('calls parse and stringify for HSTORE', function () {
      var Type = new Sequelize.HSTORE();

      return testSuccess(Type, { test: 42, nested: false });
    });

    it('calls parse and stringify for RANGE', function () {
      var Type = new Sequelize.RANGE(new Sequelize.INTEGER());

      return testSuccess(Type, [1, 2]);
    });
  }

  it('calls parse and stringify for DATE', function () {
    var Type = new Sequelize.DATE();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for DATEONLY', function () {
    var Type = new Sequelize.DATEONLY();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for TIME', function () {
    var Type = new Sequelize.TIME();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for BLOB', function () {
    var Type = new Sequelize.BLOB();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for CHAR', function () {
    var Type = new Sequelize.CHAR();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for STRING', function () {
    var Type = new Sequelize.STRING();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for TEXT', function () {
    var Type = new Sequelize.TEXT();

    if (dialect === 'mssql') {
      // Text uses nvarchar, same type as string
      testFailure(Type);
    } else {
      return testSuccess(Type, 'foobar');
    }
  });

   it('calls parse and stringify for BOOLEAN', function () {
    var Type = new Sequelize.BOOLEAN();

    return testSuccess(Type, true);
  });

   it('calls parse and stringify for INTEGER', function () {
    var Type = new Sequelize.INTEGER();

    return testSuccess(Type, 1);
  });

  it('calls parse and stringify for DECIMAL', function () {
    var Type = new Sequelize.DECIMAL();

    return testSuccess(Type, 1.5);
  });

   it('calls parse and stringify for BIGINT', function () {
    var Type = new Sequelize.BIGINT();

    if (dialect === 'mssql') {
      // Same type as integer
      testFailure(Type);
    } else {
      return testSuccess(Type, 1);
    }
  });

  it('calls parse and stringify for DOUBLE', function () {
    var Type = new Sequelize.DOUBLE();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for FLOAT', function () {
    var Type = new Sequelize.FLOAT();

    if (dialect === 'postgres') {
      // Postgres doesn't have float, maps to either decimal or double
      testFailure(Type);
    } else {
      return testSuccess(Type, 1.5);
    }
  });

  it('calls parse and stringify for REAL', function () {
    var Type = new Sequelize.REAL();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for GEOMETRY', function () {
    var Type = new Sequelize.GEOMETRY();

    if (['postgres', 'mysql'].indexOf(dialect) !== -1) {
      return testSuccess(Type, { type: "Point", coordinates: [125.6, 10.1] });
    } else {
      // Not implemented yet
      testFailure(Type);
    }
  });

  it('calls parse and stringify for UUID', function () {
    var Type = new Sequelize.UUID();

    if (['postgres', 'sqlite'].indexOf(dialect) !== -1) {
      return testSuccess(Type, uuid.v4());
    } else {
      // No native uuid type
      testFailure(Type);
    }
  });

  it('calls parse and stringify for ENUM', function () {
    var Type = new Sequelize.ENUM('hat', 'cat');

     // No dialects actually allow us to identify that we get an enum back..
    testFailure(Type);
  });
});
