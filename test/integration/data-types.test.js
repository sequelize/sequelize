'use strict';

const chai = require('chai'),
  Sequelize = require('../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  sinon = require('sinon'),
  _ = require('lodash'),
  moment = require('moment'),
  current = Support.sequelize,
  uuid = require('uuid'),
  DataTypes = require('../../lib/data-types'),
  dialect = Support.getTestDialect(),
  BigInt = require('big-integer'),
  semver = require('semver');

describe(Support.getTestDialectTeaser('DataTypes'), () => {
  afterEach(function() {
    // Restore some sanity by resetting all parsers
    this.sequelize.connectionManager._clearTypeParser();
    this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
  });

  it('allows me to return values from a custom parse function', () => {
    const parse = Sequelize.DATE.parse = sinon.spy(value => {
      return moment(value, 'YYYY-MM-DD HH:mm:ss');
    });

    const stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function(value, options) {
      if (!moment.isMoment(value)) {
        value = this._applyTimezone(value, options);
      }
      return value.format('YYYY-MM-DD HH:mm:ss');
    });

    current.refreshTypes();

    const User = current.define('user', {
      dateField: Sequelize.DATE
    }, {
      timestamps: false
    });

    return current.sync({ force: true }).then(() => {
      return User.create({
        dateField: moment('2011 10 31', 'YYYY MM DD')
      });
    }).then(() => {
      return User.findAll().get(0);
    }).then(user => {
      expect(parse).to.have.been.called;
      expect(stringify).to.have.been.called;

      expect(moment.isMoment(user.dateField)).to.be.ok;

      delete Sequelize.DATE.parse;
    });
  });

  const testSuccess = function(Type, value) {
    const parse = Type.constructor.parse = sinon.spy(value => {
      return value;
    });

    const stringify = Type.constructor.prototype.stringify = sinon.spy(function() {
      return Sequelize.ABSTRACT.prototype.stringify.apply(this, arguments);
    });

    const User = current.define('user', {
      field: Type
    }, {
      timestamps: false
    });

    return current.sync({ force: true }).then(() => {

      current.refreshTypes();

      return User.create({
        field: value
      });
    }).then(() => {
      return User.findAll().get(0);
    }).then(() => {
      expect(parse).to.have.been.called;
      expect(stringify).to.have.been.called;

      delete Type.constructor.parse;
      delete Type.constructor.prototype.stringify;
    });
  };

  const testFailure = function(Type) {
    Type.constructor.parse = _.noop();

    expect(() => {
      current.refreshTypes();
    }).to.throw('Parse function not supported for type ' + Type.key + ' in dialect ' + dialect);

    delete Type.constructor.parse;
  };

  if (current.dialect.supports.JSON) {
    it('calls parse and stringify for JSON', () => {
      const Type = new Sequelize.JSON();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });
  }

  if (current.dialect.supports.JSONB) {
    it('calls parse and stringify for JSONB', () => {
      const Type = new Sequelize.JSONB();

      return testSuccess(Type, { test: 42, nested: { foo: 'bar' }});
    });
  }

  if (current.dialect.supports.HSTORE) {
    it('calls parse and stringify for HSTORE', () => {
      const Type = new Sequelize.HSTORE();

      return testSuccess(Type, { test: 42, nested: false });
    });
  }

  if (current.dialect.supports.RANGE) {
    it('calls parse and stringify for RANGE', () => {
      const Type = new Sequelize.RANGE(new Sequelize.INTEGER());

      return testSuccess(Type, [1, 2]);
    });
  }

  it('calls parse and stringify for DATE', () => {
    const Type = new Sequelize.DATE();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for DATEONLY', () => {
    const Type = new Sequelize.DATEONLY();

    return testSuccess(Type, moment(new Date()).format('YYYY-MM-DD'));
  });

  it('calls parse and stringify for TIME', () => {
    const Type = new Sequelize.TIME();

    return testSuccess(Type, new Date());
  });

  it('calls parse and stringify for BLOB', () => {
    const Type = new Sequelize.BLOB();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for CHAR', () => {
    const Type = new Sequelize.CHAR();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for STRING', () => {
    const Type = new Sequelize.STRING();

    return testSuccess(Type, 'foobar');
  });

  it('calls parse and stringify for TEXT', () => {
    const Type = new Sequelize.TEXT();

    if (dialect === 'mssql') {
      // Text uses nvarchar, same type as string
      testFailure(Type);
    } else {
      return testSuccess(Type, 'foobar');
    }
  });

  it('calls parse and stringify for BOOLEAN', () => {
    const Type = new Sequelize.BOOLEAN();

    return testSuccess(Type, true);
  });

  it('calls parse and stringify for INTEGER', () => {
    const Type = new Sequelize.INTEGER();

    return testSuccess(Type, 1);
  });

  it('calls parse and stringify for DECIMAL', () => {
    const Type = new Sequelize.DECIMAL();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for BIGINT', () => {
    const Type = new Sequelize.BIGINT();

    if (dialect === 'mssql') {
      // Same type as integer
      testFailure(Type);
    } else {
      return testSuccess(Type, 1);
    }
  });

  it('should handle JS BigInt type', function() {
    const User = this.sequelize.define('user', {
      age: Sequelize.BIGINT
    });

    const age = BigInt(Number.MAX_SAFE_INTEGER).add(Number.MAX_SAFE_INTEGER);

    return User.sync({ force: true }).then(() => {
      return User.create({ age });
    }).then(user => {
      expect(BigInt(user.age).toString()).to.equal(age.toString());
      return User.findAll({
        where: { age }
      });
    }).then(users => {
      expect(users).to.have.lengthOf(1);
      expect(BigInt(users[0].age).toString()).to.equal(age.toString());
    });
  });

  if (dialect === 'mysql') {
    it('should handle TINYINT booleans', function() {
      const User = this.sequelize.define('user', {
        id: { type: Sequelize.TINYINT, primaryKey: true },
        isRegistered: Sequelize.TINYINT
      });

      return User.sync({ force: true }).then(() => {
        return User.create({ id: 1, isRegistered: true });
      }).then(registeredUser => {
        expect(registeredUser.isRegistered).to.equal(true);
        return User.findOne({
          where: {
            id: 1,
            isRegistered: true
          }
        });
      }).then(registeredUser => {
        expect(registeredUser).to.be.ok;
        expect(registeredUser.isRegistered).to.equal(1);

        return User.create({ id: 2, isRegistered: false });
      }).then(unregisteredUser => {
        expect(unregisteredUser.isRegistered).to.equal(false);
        return User.findOne({
          where: {
            id: 2,
            isRegistered: false
          }
        });
      }).then(unregisteredUser => {
        expect(unregisteredUser).to.be.ok;
        expect(unregisteredUser.isRegistered).to.equal(0);
      });
    });
  }

  it('calls parse and stringify for DOUBLE', () => {
    const Type = new Sequelize.DOUBLE();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for FLOAT', () => {
    const Type = new Sequelize.FLOAT();

    if (dialect === 'postgres') {
      // Postgres doesn't have float, maps to either decimal or double
      testFailure(Type);
    } else {
      return testSuccess(Type, 1.5);
    }
  });

  it('calls parse and stringify for REAL', () => {
    const Type = new Sequelize.REAL();

    return testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for UUID', () => {
    const Type = new Sequelize.UUID();

    // there is no dialect.supports.UUID yet
    if (['postgres', 'sqlite'].indexOf(dialect) !== -1) {
      return testSuccess(Type, uuid.v4());
    } else {
      // No native uuid type
      testFailure(Type);
    }
  });

  it('calls parse and stringify for CIDR', () => {
    const Type = new Sequelize.CIDR();

    if (['postgres'].indexOf(dialect) !== -1) {
      return testSuccess(Type, '10.1.2.3/32');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for INET', () => {
    const Type = new Sequelize.INET();

    if (['postgres'].indexOf(dialect) !== -1) {
      return testSuccess(Type, '127.0.0.1');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for MACADDR', () => {
    const Type = new Sequelize.MACADDR();

    if (['postgres'].indexOf(dialect) !== -1) {
      return testSuccess(Type, '01:23:45:67:89:ab');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for ENUM', () => {
    const Type = new Sequelize.ENUM('hat', 'cat');

    if (['postgres'].indexOf(dialect) !== -1) {
      return testSuccess(Type, 'hat');
    } else {
      testFailure(Type);
    }
  });

  if (current.dialect.supports.GEOMETRY) {
    it('calls parse and stringify for GEOMETRY', () => {
      const Type = new Sequelize.GEOMETRY();

      return testSuccess(Type, { type: 'Point', coordinates: [125.6, 10.1] });
    });

    it('should parse an empty GEOMETRY field', () => {
      const Type = new Sequelize.GEOMETRY();

      // MySQL 5.7 or above doesn't support POINT EMPTY
      if (dialect === 'mysql' && semver.gte(current.options.databaseVersion, '5.7.0')) {
        return;
      }

      return new Sequelize.Promise((resolve, reject) => {
        if (/^postgres/.test(dialect)) {
          current.query('SELECT PostGIS_Lib_Version();')
            .then(result => {
              if (result[0][0] && semver.lte(result[0][0].postgis_lib_version, '2.1.7')) {
                resolve(true);
              } else {
                resolve();
              }
            }).catch(reject);
        } else {
          resolve(true);
        }
      }).then(runTests => {
        if (current.dialect.supports.GEOMETRY && runTests) {
          current.refreshTypes();

          const User = current.define('user', { field: Type }, { timestamps: false });
          const point = { type: 'Point', coordinates: [] };

          return current.sync({ force: true }).then(() => {
            return User.create({
              //insert a empty GEOMETRY type
              field: point
            });
          }).then(() => {
            //This case throw unhandled exception
            return User.findAll();
          }).then(users =>{
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
    });

    it('should parse null GEOMETRY field', () => {
      const Type = new Sequelize.GEOMETRY();

      current.refreshTypes();

      const User = current.define('user', { field: Type }, { timestamps: false });
      const point = null;

      return current.sync({ force: true }).then(() => {
        return User.create({
          // insert a null GEOMETRY type
          field: point
        });
      }).then(() => {
        //This case throw unhandled exception
        return User.findAll();
      }).then(users =>{
        expect(users[0].field).to.be.eql(null);
      });
    });
  }

  if (dialect === 'postgres' || dialect === 'sqlite') {
    // postgres actively supports IEEE floating point literals, and sqlite doesn't care what we throw at it
    it('should store and parse IEEE floating point literals (NaN and Infinity)', function() {
      const Model = this.sequelize.define('model', {
        float: Sequelize.FLOAT,
        double: Sequelize.DOUBLE,
        real: Sequelize.REAL
      });

      return Model.sync({ force: true }).then(() => {
        return Model.create({
          id: 1,
          float: NaN,
          double: Infinity,
          real: -Infinity
        });
      }).then(() => {
        return Model.find({ where: { id: 1 } });
      }).then(user => {
        expect(user.get('float')).to.be.NaN;
        expect(user.get('double')).to.eq(Infinity);
        expect(user.get('real')).to.eq(-Infinity);
      });
    });
  }

  if (dialect === 'postgres' || dialect === 'mysql') {
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

      return Model.sync({ force: true }).then(() => {
        return Model.create(sampleData);
      }).then(() => {
        return Model.findById(1);
      }).then(user => {
        /**
         * MYSQL default precision is 10 and scale is 0
         * Thus test case below will return number without any fraction values
        */
        if (dialect === 'mysql') {
          expect(user.get('decimal')).to.be.eql('12345678');
        } else {
          expect(user.get('decimal')).to.be.eql('12345678.12345678');
        }

        expect(user.get('decimalPre')).to.be.eql('123456.1234');
        expect(user.get('decimalWithParser')).to.be.eql('12345678123456781.123456781234567');
        expect(user.get('decimalWithIntParser')).to.be.eql('1.2340');
        expect(user.get('decimalWithFloatParser')).to.be.eql('0.12345678');
      });
    });

    it('should parse BIGINT as string', function() {
      const Model = this.sequelize.define('model', {
        jewelPurity: Sequelize.BIGINT
      });

      const sampleData = {
        id: 1,
        jewelPurity: '9223372036854775807'
      };

      return Model.sync({ force: true }).then(() => {
        return Model.create(sampleData);
      }).then(() => {
        return Model.findById(1);
      }).then(user => {
        expect(user.get('jewelPurity')).to.be.eql(sampleData.jewelPurity);
        expect(user.get('jewelPurity')).to.be.string;
      });
    });
  }

  if (dialect === 'postgres') {
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
        .spread(m => {
          expect(m.interval[0]).to.be.eql(1);
          expect(m.interval[1]).to.be.eql(4);
        });
    });
  }

  it('should allow spaces in ENUM', function() {
    const Model = this.sequelize.define('user', {
      name: Sequelize.STRING,
      type: Sequelize.ENUM(['action', 'mecha', 'canon', 'class s'])
    });

    return Model.sync({ force: true }).then(() => {
      return Model.create({ name: 'sakura', type: 'class s' });
    }).then(record => {
      expect(record.type).to.be.eql('class s');
    });
  });

  it('should return YYYY-MM-DD format string for DATEONLY', function() {
    const Model = this.sequelize.define('user', {
      stamp: Sequelize.DATEONLY
    });
    const testDate = moment().format('YYYY-MM-DD');
    const newDate = new Date();

    return Model.sync({ force: true})
      .then(() => Model.create({ stamp: testDate }))
      .then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(record.stamp).to.be.eql(testDate);

        return Model.findById(record.id);
      }).then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(record.stamp).to.be.eql(testDate);

        return record.update({
          stamp: testDate
        });
      }).then(record => {
        return record.reload();
      }).then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(record.stamp).to.be.eql(testDate);

        return record.update({
          stamp: newDate
        });
      }).then(record => {
        return record.reload();
      }).then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(new Date(record.stamp)).to.equalDate(newDate);
      });
  });

  it('should return set DATEONLY field to NULL correctly', function() {
    const Model = this.sequelize.define('user', {
      stamp: Sequelize.DATEONLY
    });
    const testDate = moment().format('YYYY-MM-DD');

    return Model.sync({ force: true})
      .then(() => Model.create({ stamp: testDate }))
      .then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(record.stamp).to.be.eql(testDate);

        return Model.findById(record.id);
      }).then(record => {
        expect(typeof record.stamp).to.be.eql('string');
        expect(record.stamp).to.be.eql(testDate);

        return record.update({
          stamp: null
        });
      }).then(record => {
        return record.reload();
      }).then(record => {
        expect(record.stamp).to.be.eql(null);
      });
  });

  it('should be able to cast buffer as boolean', function() {
    const ByteModel = this.sequelize.define('Model', {
      byteToBool: this.sequelize.Sequelize.BLOB
    }, {
      timestamps: false
    });

    const BoolModel = this.sequelize.define('Model', {
      byteToBool: this.sequelize.Sequelize.BOOLEAN
    }, {
      timestamps: false
    });

    return ByteModel.sync({
      force: true
    }).then(() => {
      return ByteModel.create({
        byteToBool: new Buffer([true])
      });
    }).then(byte => {
      expect(byte.byteToBool).to.be.ok;

      return BoolModel.findById(byte.id);
    }).then(bool => {
      expect(bool.byteToBool).to.be.true;
    });
  });
});
