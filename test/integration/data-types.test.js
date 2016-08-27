'use strict';

/* jshint -W030 */
/* jshint -W110 */
let chai = require('chai')
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
  afterEach(function() {
    // Restore some sanity by resetting all parsers
    switch (dialect) {
      case 'postgres':
        var types = require('pg-types');

        _.each(DataTypes, function(dataType) {
          if (dataType.types && dataType.types.postgres) {
            dataType.types.postgres.oids.forEach(function(oid) {
              types.setTypeParser(oid, _.identity);
            });
          }
        });
        require('pg-types/lib/binaryParsers').init(function(oid, converter) {
          types.setTypeParser(oid, 'binary', converter);
        });
        require('pg-types/lib/textParsers').init(function(oid, converter) {
          types.setTypeParser(oid, 'text', converter);
        });
        break;
      default:
        this.sequelize.connectionManager._clearTypeParser();
    }

    this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
  });

  it('allows me to return values from a custom parse function', function() {
    const parse = Sequelize.DATE.parse = sinon.spy(function(value) {
      return moment(value, 'YYYY-MM-DD HH:mm:ss Z');
    });

    const stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function(value, options) {
      if (!moment.isMoment(value)) {
        value = this._applyTimezone(value, options);
      }
      return value.format('YYYY-MM-DD HH:mm:ss Z');
    });

    current.refreshTypes();

    const User = current.define('user', {
      dateField: Sequelize.DATE
    }, {
      timestamps: false
    });

    return current.sync({ force: true }).then(function() {
      return User.create({
        dateField: moment('2011 10 31', 'YYYY MM DD')
      });
    }).then(function() {
      return User.findAll().get(0);
    }).then(function(user) {
      expect(parse).to.have.been.called;
      expect(stringify).to.have.been.called;

      expect(moment.isMoment(user.dateField)).to.be.ok;

      delete Sequelize.DATE.parse;
    });
  });

  const testSuccess = function(Type, value) {
    const parse = Type.constructor.parse = sinon.spy(function(value) {
      return value;
    });

    const stringify = Type.constructor.prototype.stringify = sinon.spy(function(value) {
      return Sequelize.ABSTRACT.prototype.stringify.apply(this, arguments);
    });

    current.refreshTypes();

    const User = current.define('user', {
      field: Type
    }, {
      timestamps: false
    });

    return current.sync({ force: true }).then(function() {
      return User.create({
        field: value
      });
    }).then(function() {
      return User.findAll().get(0);
    }).then(function(user) {
      expect(parse).to.have.been.called;
      expect(stringify).to.have.been.called;

      delete Type.constructor.parse;
      delete Type.constructor.prototype.stringify;
    });
  };

  const testFailure = function(Type, value) {
    Type.constructor.parse = _.noop();

    expect(function()  {
      current.refreshTypes();
    }).to.throw('Parse function not supported for type ' + Type.key + ' in dialect ' + dialect);

    delete Type.constructor.parse;
  };

  if (dialect === 'postgres') {
    it('calls parse and stringify for JSON', function() {
      const Type = new Sequelize.JSON();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });

    it('calls parse and stringify for JSONB', function() {
      const Type = new Sequelize.JSONB();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });

    it('calls parse and stringify for HSTORE', function() {
      const Type = new Sequelize.HSTORE();

      return testSuccess(Type, { test: 42, nested: false });
    });

    it('calls parse and stringify for RANGE', function() {
      const Type = new Sequelize.RANGE(new Sequelize.INTEGER());

      return testSuccess(Type, [1, 2]);
    });
  }

  it('calls parse and stringify for DATE', function() {
    const Type = new Sequelize.DATE();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for DATEONLY', function() {
    const Type = new Sequelize.DATEONLY();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for TIME', function() {
    const Type = new Sequelize.TIME();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for BLOB', function() {
    const Type = new Sequelize.BLOB();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for CHAR', function() {
    const Type = new Sequelize.CHAR();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for STRING', function() {
    const Type = new Sequelize.STRING();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for TEXT', function() {
    const Type = new Sequelize.TEXT();

    if (dialect === 'mssql') {
      // Text uses nvarchar, same type as string
      testFailure(Type);
    } else {
      return testSuccess(Type, 'foobar');
    }
  });

  it('calls parse and stringify for BOOLEAN', function() {
    const Type = new Sequelize.BOOLEAN();

    return testSuccess(Type, true);
  });

  it('calls parse and stringify for INTEGER', function() {
    const Type = new Sequelize.INTEGER();

    return testSuccess(Type, 1);
  });

  it('calls parse and stringify for DECIMAL', function() {
    const Type = new Sequelize.DECIMAL();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for BIGINT', function() {
    const Type = new Sequelize.BIGINT();

    if (dialect === 'mssql') {
      // Same type as integer
      testFailure(Type);
    } else {
      return testSuccess(Type, 1);
    }
  });

  it('calls parse and stringify for DOUBLE', function() {
    const Type = new Sequelize.DOUBLE();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for FLOAT', function() {
    const Type = new Sequelize.FLOAT();

    if (dialect === 'postgres') {
      // Postgres doesn't have float, maps to either decimal or double
      testFailure(Type);
    } else {
      return testSuccess(Type, 1.5);
    }
  });

  it('calls parse and stringify for REAL', function() {
    const Type = new Sequelize.REAL();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for GEOMETRY', function() {
    const Type = new Sequelize.GEOMETRY();

    if (['postgres', 'mysql'].indexOf(dialect) !== -1) {
      return testSuccess(Type, { type: 'Point', coordinates: [125.6, 10.1] });
    } else {
      // Not implemented yet
      testFailure(Type);
    }
  });

  it('calls parse and stringify for UUID', function() {
    const Type = new Sequelize.UUID();

    if (['postgres', 'sqlite'].indexOf(dialect) !== -1) {
      return testSuccess(Type, uuid.v4());
    } else {
      // No native uuid type
      testFailure(Type);
    }
  });

  it('calls parse and stringify for ENUM', function() {
    const Type = new Sequelize.ENUM('hat', 'cat');

     // No dialects actually allow us to identify that we get an enum back..
    testFailure(Type);
  });

  it('should parse an empty GEOMETRY field', function() {
    const Type = new Sequelize.GEOMETRY();

    if (current.dialect.supports.GEOMETRY) {
      current.refreshTypes();

      const User = current.define('user', { field: Type }, { timestamps: false });
      const point = { type: 'Point', coordinates: [] };

      return current.sync({ force: true }).then(function() {
        return User.create({
          //insert a null GEOMETRY type
          field: point
        });
      }).then(function() {
        //This case throw unhandled exception
        return User.findAll();
      }).then(function(users){
        if (dialect === 'mysql') {
          // MySQL will return NULL, becuase they lack EMPTY geometry data support.
          expect(users[0].field).to.be.eql(null);
        } else if (dialect === 'postgres' || dialect === 'postgres-native') {
          //Empty Geometry data [0,0] as per https://trac.osgeo.org/postgis/ticket/1996
          expect(users[0].field).to.be.deep.eql({ type: 'Point', coordinates: [0, 0] });
        } else {
          expect(users[0].field).to.be.deep.eql(point);
        }
      });
    }
  });

  if (dialect === 'postgres' || dialect === 'sqlite') {
    // postgres actively supports IEEE floating point literals, and sqlite doesn't care what we throw at it
    it('should store and parse IEEE floating point literals (NaN and Infinity)', function() {
      const Model = this.sequelize.define('model', {
        float: Sequelize.FLOAT,
        double: Sequelize.DOUBLE,
        real: Sequelize.REAL
      });

      return Model.sync({ force: true }).then(function() {
        return Model.create({
          id: 1,
          float: NaN,
          double: Infinity,
          real: -Infinity
        });
      }).then(function() {
        return Model.find({ where:{ id: 1 } });
      }).then(function(user) {
        expect(user.get('float')).to.be.NaN;
        expect(user.get('double')).to.eq(Infinity);
        expect(user.get('real')).to.eq(-Infinity);
      });
    });
  }

  if (dialect === 'postgres') {
    it('should parse DECIMAL as string', function() {
      const Model = this.sequelize.define('model', {
        decimal: Sequelize.DECIMAL,
        decimalPre: Sequelize.DECIMAL(10, 4),
        decimalWithParser: Sequelize.DECIMAL(32, 15),
        decimalWithIntParser: Sequelize.DECIMAL(10, 4),
        decimalWithFloatParser: Sequelize.DECIMAL(10, 8)
      });

      const sampleData = {
        id: 1,
        decimal: 12345678.12345678,
        decimalPre: 123456.1234,
        decimalWithParser: '12345678123456781.123456781234567',
        decimalWithIntParser: 1.234,
        decimalWithFloatParser: 0.12345678
      };

      return Model.sync({ force: true }).then(function() {
        return Model.create(sampleData);
      }).then(function() {
        return Model.find({id: 1});
      }).then(function(user) {
        expect(user.get('decimal')).to.be.eql('12345678.12345678');
        expect(user.get('decimalPre')).to.be.eql('123456.1234');
        expect(user.get('decimalWithParser')).to.be.eql('12345678123456781.123456781234567');
        expect(user.get('decimalWithIntParser')).to.be.eql('1.2340');
        expect(user.get('decimalWithFloatParser')).to.be.eql('0.12345678');
      });
    });

    it('should return Int4 range properly #5747', function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.INTEGER),
          allowNull: false,
          unique: true
        }
      });

      return Model.sync({ force: true })
              .then(() => Model.create({ interval: [1, 4] }) )
              .then(() => Model.findAll() )
              .spread((m) => {
                expect(m.interval[0]).to.be.eql(1);
                expect(m.interval[1]).to.be.eql(4);
              });
    });
  }

  if (dialect === 'mysql') {
    it('should parse BIGINT as string', function() {
      const Model = this.sequelize.define('model', {
        jewelPurity: Sequelize.BIGINT
      });

      const sampleData = {
        id: 1,
        jewelPurity: '9223372036854775807'
      };

      return Model.sync({ force: true }).then(function() {
        return Model.create(sampleData);
      }).then(function() {
        return Model.findById(1);
      }).then(function(user) {
        expect(user.get('jewelPurity')).to.be.eql(sampleData.jewelPurity);
        expect(user.get('jewelPurity')).to.be.string;
      });
    });
  }

  it('should allow spaces in ENUM', function() {
    const Model = this.sequelize.define('user', {
      name: Sequelize.STRING,
      type: Sequelize.ENUM(['action', 'mecha', 'canon', 'class s'])
    });

    return Model.sync({ force: true}).then(function() {
      return Model.create({ name: 'sakura', type: 'class s' });
    }).then(function(record) {
      expect(record.type).to.be.eql('class s');
    });
  });

});
