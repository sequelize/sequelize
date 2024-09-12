'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('./support'),
  sinon = require('sinon'),
  _ = require('lodash'),
  moment = require('moment'),
  current = Support.sequelize,
  Op = Sequelize.Op,
  uuid = require('uuid'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  semver = require('semver');

describe(Support.getTestDialectTeaser('DataTypes'), () => {
  afterEach(function() {
    // Restore some sanity by resetting all parsers
    this.sequelize.connectionManager._clearTypeParser();
    this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
  });

  it('allows me to return values from a custom parse function', async () => {
    const parse = Sequelize.DATE.parse = sinon.spy(value => {
      return moment(value, 'YYYY-MM-DD HH:mm:ss');
    });

    const stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function(value, options) {
      if (!moment.isMoment(value)) {
        value = this._applyTimezone(value, options);
      }
      return value.format('YYYY-MM-DD HH:mm:ss');
    });

    // oracle has a _bindParam function that checks if DATE was created with
    // the boolean param (if so it outputs a Buffer bind param). This override
    // isn't needed for other dialects
    let bindParam;
    if (dialect === 'oracle') {
      bindParam = Sequelize.DATE.prototype.bindParam = sinon.spy(function(value, options) {
        if (!moment.isMoment(value)) {
          value = this._applyTimezone(value, options);
        }
        // For the Oracle dialect, use TO_DATE()
        const formatedDate = value.format('YYYY-MM-DD HH:mm:ss');
        const format = 'YYYY-MM-DD HH24:mi:ss';
        return `TO_DATE('${formatedDate}', '${format}')`;
      });
    }

    current.refreshTypes();

    const User = current.define('user', {
      dateField: Sequelize.DATE
    }, {
      timestamps: false
    });

    await current.sync({ force: true });

    await User.create({
      dateField: moment('2011 10 31', 'YYYY MM DD')
    });

    const obj = await User.findAll();
    const user = obj[0];
    expect(parse).to.have.been.called;
    // For the Oracle dialect we check if bindParam was called
    // for other dalects we check if stringify was called
    dialect === 'oracle' ? expect(bindParam).to.have.been.called : expect(stringify).to.have.been.called;

    expect(moment.isMoment(user.dateField)).to.be.ok;

    delete Sequelize.DATE.parse;
  });

  const testSuccess = async function(Type, value, options) {
    const parse = Type.constructor.parse = sinon.spy(value => {
      return value;
    });

    const stringify = Type.constructor.prototype.stringify = sinon.spy(function() {
      return Sequelize.ABSTRACT.prototype.stringify.apply(this, arguments);
    });
    let bindParam;
    if (options && options.useBindParam) {
      bindParam = Type.constructor.prototype.bindParam = sinon.spy(function() {
        return Sequelize.ABSTRACT.prototype.bindParam.apply(this, arguments);
      });
    }

    const User = current.define('user', {
      field: Type
    }, {
      timestamps: false
    });

    await current.sync({ force: true });

    current.refreshTypes();

    await User.create({
      field: value
    });

    await User.findAll();
    expect(parse).to.have.been.called;
    if (options && options.useBindParam) {
      expect(bindParam).to.have.been.called;
    } else {
      expect(stringify).to.have.been.called;
    }

    delete Type.constructor.parse;
    delete Type.constructor.prototype.stringify;
    if (options && options.useBindParam) {
      delete Type.constructor.prototype.bindParam;
    }
  };

  const testFailure = function(Type) {
    Type.constructor.parse = _.noop();

    expect(() => {
      current.refreshTypes();
    }).to.throw(`Parse function not supported for type ${Type.key} in dialect ${dialect}`);

    delete Type.constructor.parse;
  };

  if (current.dialect.supports.JSON) {
    it('calls parse and stringify for JSON', async () => {
      const Type = new Sequelize.JSON();

      // oracle has a _bindParam function that checks if JSON was created with
      // the boolean param (if so it outputs a Buffer bind param). This override
      // isn't needed for other dialects
      if (dialect === 'oracle') {
        await testSuccess(Type, { test: 42, nested: { foo: 'bar' } }, { useBindParam: true });
      } else {
        await testSuccess(Type, { test: 42, nested: { foo: 'bar' } });
      }
    });
  }

  if (current.dialect.supports.JSONB) {
    it('calls parse and stringify for JSONB', async () => {
      const Type = new Sequelize.JSONB();

      await testSuccess(Type, { test: 42, nested: { foo: 'bar' } });
    });
  }

  if (current.dialect.supports.HSTORE) {
    it('calls parse and bindParam for HSTORE', async () => {
      const Type = new Sequelize.HSTORE();

      await testSuccess(Type, { test: 42, nested: false }, { useBindParam: true });
    });
  }

  if (current.dialect.supports.RANGE) {
    it('calls parse and bindParam for RANGE', async () => {
      const Type = new Sequelize.RANGE(new Sequelize.INTEGER());

      await testSuccess(Type, [1, 2], { useBindParam: true });
    });
  }

  it('calls parse and stringify for DATE', async () => {
    const Type = new Sequelize.DATE();

    // oracle has a _bindParam function that checks if DATE was created with
    // the boolean param (if so it outputs a Buffer bind param). This override
    // isn't needed for other dialects
    if (dialect === 'oracle') {
      await testSuccess(Type, new Date(), { useBindParam: true });
    } else {
      await testSuccess(Type, new Date());
    }
  });

  it('calls parse and stringify for DATEONLY', async () => {
    const Type = new Sequelize.DATEONLY();

    // oracle has a _bindParam function that checks if DATEONLY was created with
    // the boolean param (if so it outputs a Buffer bind param). This override
    // isn't needed for other dialects
    if (dialect === 'oracle') {
      await testSuccess(Type, moment(new Date()).format('YYYY-MM-DD'), { useBindParam: true });
    } else {
      await testSuccess(Type, moment(new Date()).format('YYYY-MM-DD'));
    }
  });

  it('calls parse and stringify for TIME', async () => {
    const Type = new Sequelize.TIME();

    // TIME Datatype isn't supported by the oracle dialect
    if (dialect === 'oracle') {
      testFailure(Type);
    } else {
      await testSuccess(Type, moment(new Date()).format('HH:mm:ss'));
    }
  });

  it('calls parse and stringify for BLOB', async () => {
    const Type = new Sequelize.BLOB();

    await testSuccess(Type, 'foobar', { useBindParam: true });
  });

  it('calls parse and stringify for CHAR', async () => {
    const Type = new Sequelize.CHAR();

    // oracle has a _bindParam function that checks if STRING was created with
    // the boolean param (if so it outputs a Buffer bind param). This override
    // isn't needed for other dialects
    if (dialect === 'oracle') {
      await testSuccess(Type, 'foobar',  { useBindParam: true });
    } else {
      await testSuccess(Type, 'foobar');
    }
  });

  it('calls parse and stringify/bindParam for STRING', async () => {
    const Type = new Sequelize.STRING();

    // mssql/oracle has a _bindParam function that checks if STRING was created with
    // the boolean param (if so it outputs a Buffer bind param). This override
    // isn't needed for other dialects
    if (['mssql', 'db2', 'oracle'].includes(dialect)) {
      await testSuccess(Type, 'foobar',  { useBindParam: true });
    } else {
      await testSuccess(Type, 'foobar');
    }
  });

  it('calls parse and stringify for TEXT', async () => {
    const Type = new Sequelize.TEXT();

    if (dialect === 'mssql') {
      // Text uses nvarchar, same type as string
      testFailure(Type);
    } else {
      await testSuccess(Type, 'foobar');
    }
  });

  it('calls parse and stringify for BOOLEAN', async () => {
    const Type = new Sequelize.BOOLEAN();

    await testSuccess(Type, true);
  });

  it('calls parse and stringify for INTEGER', async () => {
    const Type = new Sequelize.INTEGER();

    await testSuccess(Type, 1);
  });

  it('calls parse and stringify for DECIMAL', async () => {
    const Type = new Sequelize.DECIMAL();

    await testSuccess(Type, 1.5);
  });

  it('calls parse and stringify for BIGINT', async () => {
    const Type = new Sequelize.BIGINT();

    if (dialect === 'mssql') {
      // Same type as integer
      testFailure(Type);
    } else {
      await testSuccess(Type, 1);
    }
  });

  it('should handle JS BigInt type', async function() {
    const User = this.sequelize.define('user', {
      age: Sequelize.BIGINT
    });

    const age = BigInt(Number.MAX_SAFE_INTEGER) * 2n;

    await User.sync({ force: true });
    const user = await User.create({ age });
    expect(BigInt(user.age).toString()).to.equal(age.toString());

    // cover also bulkCreate
    // adds two records
    await User.bulkCreate([{ age }, { age }]);

    const users = await User.findAll({
      where: { age }
    });

    expect(users).to.have.lengthOf(3);
    for (const usr of users) {
      expect(BigInt(usr.age).toString()).to.equal(age.toString());
    }

  });

  if (dialect === 'mysql') {
    it('should handle TINYINT booleans', async function() {
      const User = this.sequelize.define('user', {
        id: { type: Sequelize.TINYINT, primaryKey: true },
        isRegistered: Sequelize.TINYINT
      });

      await User.sync({ force: true });
      const registeredUser0 = await User.create({ id: 1, isRegistered: true });
      expect(registeredUser0.isRegistered).to.equal(true);

      const registeredUser = await User.findOne({
        where: {
          id: 1,
          isRegistered: true
        }
      });

      expect(registeredUser).to.be.ok;
      expect(registeredUser.isRegistered).to.equal(1);

      const unregisteredUser0 = await User.create({ id: 2, isRegistered: false });
      expect(unregisteredUser0.isRegistered).to.equal(false);

      const unregisteredUser = await User.findOne({
        where: {
          id: 2,
          isRegistered: false
        }
      });

      expect(unregisteredUser).to.be.ok;
      expect(unregisteredUser.isRegistered).to.equal(0);
    });
  }

  it('calls parse and bindParam for DOUBLE', async () => {
    const Type = new Sequelize.DOUBLE();

    await testSuccess(Type, 1.5, { useBindParam: true });
  });

  it('calls parse and bindParam for FLOAT', async () => {
    const Type = new Sequelize.FLOAT();

    if (dialect === 'postgres') {
      // Postgres doesn't have float, maps to either decimal or double
      testFailure(Type);
    } else {
      await testSuccess(Type, 1.5, { useBindParam: true });
    }
  });

  it('calls parse and bindParam for REAL', async () => {
    const Type = new Sequelize.REAL();

    await testSuccess(Type, 1.5, { useBindParam: true });
  });

  it('calls parse and stringify for UUID', async () => {
    const Type = new Sequelize.UUID();

    // there is no dialect.supports.UUID yet
    if (['postgres', 'sqlite', 'oracle', 'db2'].includes(dialect)) {
      await testSuccess(Type, uuid.v4());
    } else {
      // No native uuid type
      testFailure(Type);
    }
  });

  it('calls parse and stringify for CIDR', async () => {
    const Type = new Sequelize.CIDR();

    if (['postgres'].includes(dialect)) {
      await testSuccess(Type, '10.1.2.3/32');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for INET', async () => {
    const Type = new Sequelize.INET();

    if (['postgres'].includes(dialect)) {
      await testSuccess(Type, '127.0.0.1');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for CITEXT', async () => {
    const Type = new Sequelize.CITEXT();

    if (dialect === 'sqlite') {
      // The "field type" sqlite returns is TEXT so is covered under TEXT test above
      return;
    }

    if (dialect === 'postgres') {
      await testSuccess(Type, 'foobar');
    } else {
      testFailure(Type);
    }
  });

  it('calls parse and stringify for MACADDR', async () => {
    const Type = new Sequelize.MACADDR();

    if (['postgres'].includes(dialect)) {
      await testSuccess(Type, '01:23:45:67:89:ab');
    } else {
      testFailure(Type);
    }

  });

  if (current.dialect.supports.TSVECTOR) {
    it('calls parse and stringify for TSVECTOR', async () => {
      const Type = new Sequelize.TSVECTOR();

      if (['postgres'].includes(dialect)) {
        await testSuccess(Type, 'swagger');
      } else {
        testFailure(Type);
      }
    });
  }

  it('calls parse and stringify for ENUM', async () => {
    const Type = new Sequelize.ENUM('hat', 'cat');

    if (['postgres', 'oracle', 'db2'].includes(dialect)) {
      await testSuccess(Type, 'hat');
    } else {
      testFailure(Type);
    }
  });

  if (current.dialect.supports.GEOMETRY) {
    it('calls parse and bindParam for GEOMETRY', async () => {
      const Type = new Sequelize.GEOMETRY();

      await testSuccess(Type, { type: 'Point', coordinates: [125.6, 10.1] }, { useBindParam: true });
    });

    it('should parse an empty GEOMETRY field', async () => {
      const Type = new Sequelize.GEOMETRY();

      // MySQL 5.7 or above doesn't support POINT EMPTY
      if (dialect === 'mysql' && semver.gte(current.options.databaseVersion, '5.7.0')) {
        return;
      }

      const runTests = await new Promise((resolve, reject) => {
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
      });

      if (current.dialect.supports.GEOMETRY && runTests) {
        current.refreshTypes();

        const User = current.define('user', { field: Type }, { timestamps: false });
        const point = { type: 'Point', coordinates: [] };

        await current.sync({ force: true });

        await User.create({
          //insert a empty GEOMETRY type
          field: point
        });

        //This case throw unhandled exception
        const users = await User.findAll();
        if (['mysql', 'mariadb'].includes(dialect)) {
          // MySQL will return NULL, because they lack EMPTY geometry data support.
          expect(users[0].field).to.be.eql(null);
        } else if (['postgres', 'postgres-native'].includes(dialect)) {
          //Empty Geometry data [0,0] as per https://trac.osgeo.org/postgis/ticket/1996
          expect(users[0].field).to.be.deep.eql({ type: 'Point', coordinates: [0, 0] });
        } else {
          expect(users[0].field).to.be.deep.eql(point);
        }
      }
    });

    it('should parse null GEOMETRY field', async () => {
      const Type = new Sequelize.GEOMETRY();

      current.refreshTypes();

      const User = current.define('user', { field: Type }, { timestamps: false });
      const point = null;

      await current.sync({ force: true });

      await User.create({
        // insert a null GEOMETRY type
        field: point
      });

      //This case throw unhandled exception
      const users = await User.findAll();
      expect(users[0].field).to.be.eql(null);
    });
  }

  if (['postgres', 'sqlite', 'oracle'].includes(dialect)) {
    // postgres actively supports IEEE floating point literals, and sqlite doesn't care what we throw at it
    it('should store and parse IEEE floating point literals (NaN and Infinity)', async function() {
      const Model = this.sequelize.define('model', {
        float: Sequelize.FLOAT,
        double: Sequelize.DOUBLE,
        real: Sequelize.REAL
      });

      await Model.sync({ force: true });

      await Model.create({
        id: 1,
        float: NaN,
        double: Infinity,
        real: -Infinity
      });

      const user = await Model.findOne({ where: { id: 1 } });
      expect(user.get('float')).to.be.NaN;
      expect(user.get('double')).to.eq(Infinity);
      expect(user.get('real')).to.eq(-Infinity);
    });
  }

  if (['postgres', 'mysql'].includes(dialect)) {
    it('should parse DECIMAL as string', async function() {
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

      await Model.sync({ force: true });
      await Model.create(sampleData);
      const user = await Model.findByPk(1);
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
  }

  if (['postgres', 'mysql', 'mssql'].includes(dialect)) {
    it('should parse BIGINT as string', async function() {
      const Model = this.sequelize.define('model', {
        jewelPurity: Sequelize.BIGINT
      });

      const sampleData = {
        id: 1,
        jewelPurity: '9223372036854775807'
      };

      await Model.sync({ force: true });
      await Model.create(sampleData);
      const user = await Model.findByPk(1);
      expect(user.get('jewelPurity')).to.be.eql(sampleData.jewelPurity);
      expect(user.get('jewelPurity')).to.be.string;
    });
  }

  if (dialect === 'postgres') {
    it('should return Int4 range properly #5747', async function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.INTEGER),
          allowNull: false,
          unique: true
        }
      });

      await Model.sync({ force: true });
      await Model.create({ interval: [1, 4] });
      const [m] = await Model.findAll();
      expect(m.interval[0].value).to.be.eql(1);
      expect(m.interval[1].value).to.be.eql(4);
    });
  }

  if (current.dialect.supports.RANGE) {

    it('should allow date ranges to be generated with default bounds inclusion #8176', async function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.DATE),
          allowNull: false,
          unique: true
        }
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10000);
      const testDateRange = [testDate1, testDate2];

      await Model.sync({ force: true });
      await Model.create({ interval: testDateRange });
      const m = await Model.findOne();
      expect(m).to.exist;
      expect(m.interval[0].value).to.be.eql(testDate1);
      expect(m.interval[1].value).to.be.eql(testDate2);
      expect(m.interval[0].inclusive).to.be.eql(true);
      expect(m.interval[1].inclusive).to.be.eql(false);
    });

    it('should allow date ranges to be generated using a single range expression to define bounds inclusion #8176', async function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.DATE),
          allowNull: false,
          unique: true
        }
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10000);
      const testDateRange = [{ value: testDate1, inclusive: false }, { value: testDate2, inclusive: true }];

      await Model.sync({ force: true });
      await Model.create({ interval: testDateRange });
      const m = await Model.findOne();
      expect(m).to.exist;
      expect(m.interval[0].value).to.be.eql(testDate1);
      expect(m.interval[1].value).to.be.eql(testDate2);
      expect(m.interval[0].inclusive).to.be.eql(false);
      expect(m.interval[1].inclusive).to.be.eql(true);
    });

    it('should allow date ranges to be generated using a composite range expression #8176', async function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.DATE),
          allowNull: false,
          unique: true
        }
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10000);
      const testDateRange = [testDate1, { value: testDate2, inclusive: true }];

      await Model.sync({ force: true });
      await Model.create({ interval: testDateRange });
      const m = await Model.findOne();
      expect(m).to.exist;
      expect(m.interval[0].value).to.be.eql(testDate1);
      expect(m.interval[1].value).to.be.eql(testDate2);
      expect(m.interval[0].inclusive).to.be.eql(true);
      expect(m.interval[1].inclusive).to.be.eql(true);
    });

    it('should correctly return ranges when using predicates that define bounds inclusion #8176', async function() {
      const Model = this.sequelize.define('M', {
        interval: {
          type: Sequelize.RANGE(Sequelize.DATE),
          allowNull: false,
          unique: true
        }
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10000);
      const testDateRange = [testDate1, testDate2];
      const dateRangePredicate = [{ value: testDate1, inclusive: true }, { value: testDate1, inclusive: true }];

      await Model.sync({ force: true });
      await Model.create({ interval: testDateRange });

      const m = await Model.findOne({
        where: {
          interval: { [Op.overlap]: dateRangePredicate }
        }
      });

      expect(m).to.exist;
    });
  }

  it('should allow spaces in ENUM', async function() {
    const Model = this.sequelize.define('user', {
      name: Sequelize.STRING,
      type: Sequelize.ENUM(['action', 'mecha', 'canon', 'class s'])
    });

    await Model.sync({ force: true });
    const record = await Model.create({ name: 'sakura', type: 'class s' });
    expect(record.type).to.be.eql('class s');
  });

  it('should return YYYY-MM-DD format string for DATEONLY', async function() {
    const Model = this.sequelize.define('user', {
      stamp: Sequelize.DATEONLY
    });
    const testDate = moment().format('YYYY-MM-DD');
    const newDate = new Date();

    await Model.sync({ force: true });
    const record4 = await Model.create({ stamp: testDate });
    expect(typeof record4.stamp).to.be.eql('string');
    expect(record4.stamp).to.be.eql(testDate);

    const record3 = await Model.findByPk(record4.id);
    expect(typeof record3.stamp).to.be.eql('string');
    expect(record3.stamp).to.be.eql(testDate);

    const record2 = await record3.update({
      stamp: testDate
    });

    const record1 = await record2.reload();
    expect(typeof record1.stamp).to.be.eql('string');
    expect(record1.stamp).to.be.eql(testDate);

    const record0 = await record1.update({
      stamp: newDate
    });

    const record = await record0.reload();
    expect(typeof record.stamp).to.be.eql('string');
    const recordDate = new Date(record.stamp);
    expect(recordDate.getUTCFullYear()).to.equal(newDate.getUTCFullYear());
    expect(recordDate.getUTCDate()).to.equal(newDate.getUTCDate());
    expect(recordDate.getUTCMonth()).to.equal(newDate.getUTCMonth());
  });

  it('should return set DATEONLY field to NULL correctly', async function() {
    const Model = this.sequelize.define('user', {
      stamp: Sequelize.DATEONLY
    });
    const testDate = moment().format('YYYY-MM-DD');

    await Model.sync({ force: true });
    const record2 = await Model.create({ stamp: testDate });
    expect(typeof record2.stamp).to.be.eql('string');
    expect(record2.stamp).to.be.eql(testDate);

    const record1 = await Model.findByPk(record2.id);
    expect(typeof record1.stamp).to.be.eql('string');
    expect(record1.stamp).to.be.eql(testDate);

    const record0 = await record1.update({
      stamp: null
    });

    const record = await record0.reload();
    expect(record.stamp).to.be.eql(null);
  });

  it('should be able to cast buffer as boolean', async function() {
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

    await ByteModel.sync({
      force: true
    });

    const byte = await ByteModel.create({
      byteToBool: Buffer.from([true])
    });

    expect(byte.byteToBool).to.be.ok;

    const bool = await BoolModel.findByPk(byte.id);
    expect(bool.byteToBool).to.be.true;
  });
});
