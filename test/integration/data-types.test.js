'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const sinon = require('sinon');
const _ = require('lodash');
const moment = require('moment');

const current = Support.sequelize;
const uuid = require('uuid');
const { DataTypes, Sequelize, Op } = require('@sequelize/core');

const dialect = Support.getTestDialect();
const semver = require('semver');

describe(Support.getTestDialectTeaser('DataTypes'), () => {
  afterEach(function () {
    // Restore some sanity by resetting all parsers
    this.sequelize.connectionManager._clearTypeParser();
    this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
  });

  it('allows me to return values from a custom parse function', async () => {
    const parse = DataTypes.DATE.parse = sinon.spy(value => {
      return moment(value, 'YYYY-MM-DD HH:mm:ss');
    });

    const stringify = DataTypes.DATE.prototype.stringify = sinon.spy(function (value, options) {
      if (!moment.isMoment(value)) {
        value = this._applyTimezone(value, options);
      }

      return value.format('YYYY-MM-DD HH:mm:ss');
    });

    current.refreshTypes();

    const User = current.define('user', {
      dateField: DataTypes.DATE,
    }, {
      timestamps: false,
    });

    await current.sync({ force: true });

    await User.create({
      dateField: moment('2011 10 31', 'YYYY MM DD'),
    });

    const obj = await User.findAll();
    const user = obj[0];
    expect(parse).to.have.been.called;
    expect(stringify).to.have.been.called;

    expect(moment.isMoment(user.dateField)).to.be.ok;

    delete DataTypes.DATE.parse;
  });

  const testSuccess = async function (Type, value, options) {
    const parse = Type.constructor.parse = sinon.spy(value => {
      return value;
    });

    const stringify = Type.constructor.prototype.stringify = sinon.spy(function () {
      return Reflect.apply(DataTypes.ABSTRACT.prototype.stringify, this, arguments);
    });
    let bindParam;
    if (options && options.useBindParam) {
      bindParam = Type.constructor.prototype.bindParam = sinon.spy(function () {
        return Reflect.apply(DataTypes.ABSTRACT.prototype.bindParam, this, arguments);
      });
    }

    const User = current.define('user', {
      field: Type,
    }, {
      timestamps: false,
    });

    await current.sync({ force: true });

    current.refreshTypes();

    await User.create({
      field: value,
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

  const testFailure = function (Type) {
    Type.constructor.parse = _.noop();

    expect(() => {
      current.refreshTypes();
    }).to.throw(`Parse function not supported for type ${Type.key} in dialect ${dialect}`);

    delete Type.constructor.parse;
  };

  it('should handle JS BigInt type', async function () {
    const User = this.sequelize.define('user', {
      age: DataTypes.BIGINT,
    });

    const age = BigInt(Number.MAX_SAFE_INTEGER) * 2n;

    await User.sync({ force: true });
    const user = await User.create({ age });
    expect(BigInt(user.age).toString()).to.equal(age.toString());

    const users = await User.findAll({
      where: { age },
    });

    expect(users).to.have.lengthOf(1);
    expect(BigInt(users[0].age).toString()).to.equal(age.toString());
  });

  if (dialect === 'mysql') {
    it('should handle TINYINT booleans', async function () {
      const User = this.sequelize.define('user', {
        id: { type: DataTypes.TINYINT, primaryKey: true },
        isRegistered: DataTypes.TINYINT,
      });

      await User.sync({ force: true });
      const registeredUser0 = await User.create({ id: 1, isRegistered: true });
      expect(registeredUser0.isRegistered).to.equal(true);

      const registeredUser = await User.findOne({
        where: {
          id: 1,
          isRegistered: true,
        },
      });

      expect(registeredUser).to.be.ok;
      expect(registeredUser.isRegistered).to.equal(1);

      const unregisteredUser0 = await User.create({ id: 2, isRegistered: false });
      expect(unregisteredUser0.isRegistered).to.equal(false);

      const unregisteredUser = await User.findOne({
        where: {
          id: 2,
          isRegistered: false,
        },
      });

      expect(unregisteredUser).to.be.ok;
      expect(unregisteredUser.isRegistered).to.equal(0);
    });
  }

  it('calls parse and bindParam for DOUBLE', async () => {
    const Type = new DataTypes.DOUBLE();

    await testSuccess(Type, 1.5, { useBindParam: true });
  });

  it('calls parse and bindParam for FLOAT', async () => {
    const Type = new DataTypes.FLOAT();

    if (dialect === 'postgres') {
      // Postgres doesn't have float, maps to either decimal or double
      testFailure(Type);
    } else {
      await testSuccess(Type, 1.5, { useBindParam: true });
    }
  });

  it('calls parse and bindParam for REAL', async () => {
    const Type = new DataTypes.REAL();

    await testSuccess(Type, 1.5, { useBindParam: true });
  });

  it('calls parse and stringify for UUID', async () => {
    const Type = new DataTypes.UUID();

    // there is no dialect.supports.UUID yet
    if (['postgres', 'sqlite', 'db2', 'ibmi'].includes(dialect)) {
      await testSuccess(Type, uuid.v4());
    } else {
      // No native uuid type
      testFailure(Type);
    }
  });

  if (current.dialect.supports.GEOMETRY) {
    it('calls parse and bindParam for GEOMETRY', async () => {
      const Type = new DataTypes.GEOMETRY();

      await testSuccess(Type, { type: 'Point', coordinates: [125.6, 10.1] }, { useBindParam: true });
    });

    it('should parse an empty GEOMETRY field', async () => {
      const Type = new DataTypes.GEOMETRY();

      // MySQL 5.7 or above doesn't support POINT EMPTY
      if (dialect === 'mysql' && semver.gte(current.options.databaseVersion, '5.7.0')) {
        return;
      }

      const runTests = await new Promise((resolve, reject) => {
        if (dialect.startsWith('postgres')) {
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
          // insert a empty GEOMETRY type
          field: point,
        });

        // This case throw unhandled exception
        const users = await User.findAll();
        if (['mysql', 'mariadb'].includes(dialect)) {
          // MySQL will return NULL, because they lack EMPTY geometry data support.
          expect(users[0].field).to.be.eql(null);
        } else if (['postgres', 'postgres-native'].includes(dialect)) {
          // Empty Geometry data [0,0] as per https://trac.osgeo.org/postgis/ticket/1996
          expect(users[0].field).to.be.deep.eql({ type: 'Point', coordinates: [0, 0] });
        } else {
          expect(users[0].field).to.be.deep.eql(point);
        }
      }
    });

    it('should parse null GEOMETRY field', async () => {
      const Type = new DataTypes.GEOMETRY();

      current.refreshTypes();

      const User = current.define('user', { field: Type }, { timestamps: false });
      const point = null;

      await current.sync({ force: true });

      await User.create({
        // insert a null GEOMETRY type
        field: point,
      });

      // This case throw unhandled exception
      const users = await User.findAll();
      expect(users[0].field).to.be.eql(null);
    });
  }

  if (['postgres', 'sqlite'].includes(dialect)) {
    // postgres actively supports IEEE floating point literals, and sqlite doesn't care what we throw at it
    it('should store and parse IEEE floating point literals (NaN and Infinity)', async function () {
      const Model = this.sequelize.define('model', {
        float: DataTypes.FLOAT,
        double: DataTypes.DOUBLE,
        real: DataTypes.REAL,
      });

      await Model.sync({ force: true });

      await Model.create({
        id: 1,
        float: Number.NaN,
        double: Number.POSITIVE_INFINITY,
        real: Number.NEGATIVE_INFINITY,
      });

      const user = await Model.findOne({ where: { id: 1 } });
      expect(user.get('float')).to.be.NaN;
      expect(user.get('double')).to.eq(Number.POSITIVE_INFINITY);
      expect(user.get('real')).to.eq(Number.NEGATIVE_INFINITY);
    });
  }

  if (['postgres', 'mysql'].includes(dialect)) {
    it('should parse DECIMAL as string', async function () {
      const Model = this.sequelize.define('model', {
        decimal: DataTypes.DECIMAL,
        decimalPre: DataTypes.DECIMAL(10, 4),
        decimalWithParser: DataTypes.DECIMAL(32, 15),
        decimalWithIntParser: DataTypes.DECIMAL(10, 4),
        decimalWithFloatParser: DataTypes.DECIMAL(10, 8),
      });

      const sampleData = {
        id: 1,
        decimal: 12_345_678.123_456_78,
        decimalPre: 123_456.1234,
        decimalWithParser: '12345678123456781.123456781234567',
        decimalWithIntParser: 1.234,
        decimalWithFloatParser: 0.123_456_78,
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
    it('should parse BIGINT as string', async function () {
      const Model = this.sequelize.define('model', {
        jewelPurity: DataTypes.BIGINT,
      });

      const sampleData = {
        id: 1,
        jewelPurity: '9223372036854775807',
      };

      await Model.sync({ force: true });
      await Model.create(sampleData);
      const user = await Model.findByPk(1);
      expect(user.get('jewelPurity')).to.be.eql(sampleData.jewelPurity);
      expect(user.get('jewelPurity')).to.be.string;
    });
  }

  if (dialect === 'postgres') {
    it('should return Int4 range properly #5747', async function () {
      const Model = this.sequelize.define('M', {
        interval: {
          type: DataTypes.RANGE(DataTypes.INTEGER),
          allowNull: false,
          unique: true,
        },
      });

      await Model.sync({ force: true });
      await Model.create({ interval: [1, 4] });
      const [m] = await Model.findAll();
      expect(m.interval[0].value).to.be.eql(1);
      expect(m.interval[1].value).to.be.eql(4);
    });
  }

  if (current.dialect.supports.RANGE) {

    it('should allow date ranges to be generated with default bounds inclusion #8176', async function () {
      const Model = this.sequelize.define('M', {
        interval: {
          type: DataTypes.RANGE(DataTypes.DATE),
          allowNull: false,
          unique: true,
        },
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10_000);
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

    it('should allow date ranges to be generated using a single range expression to define bounds inclusion #8176', async function () {
      const Model = this.sequelize.define('M', {
        interval: {
          type: DataTypes.RANGE(DataTypes.DATE),
          allowNull: false,
          unique: true,
        },
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10_000);
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

    it('should allow date ranges to be generated using a composite range expression #8176', async function () {
      const Model = this.sequelize.define('M', {
        interval: {
          type: DataTypes.RANGE(DataTypes.DATE),
          allowNull: false,
          unique: true,
        },
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10_000);
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

    it('should correctly return ranges when using predicates that define bounds inclusion #8176', async function () {
      const Model = this.sequelize.define('M', {
        interval: {
          type: DataTypes.RANGE(DataTypes.DATE),
          allowNull: false,
          unique: true,
        },
      });
      const testDate1 = new Date();
      const testDate2 = new Date(testDate1.getTime() + 10_000);
      const testDateRange = [testDate1, testDate2];
      const dateRangePredicate = [{ value: testDate1, inclusive: true }, { value: testDate1, inclusive: true }];

      await Model.sync({ force: true });
      await Model.create({ interval: testDateRange });

      const m = await Model.findOne({
        where: {
          interval: { [Op.overlap]: dateRangePredicate },
        },
      });

      expect(m).to.exist;
    });
  }

  it('should allow spaces in ENUM', async function () {
    const Model = this.sequelize.define('user', {
      name: DataTypes.STRING,
      type: DataTypes.ENUM(['action', 'mecha', 'canon', 'class s']),
    });

    await Model.sync({ force: true });
    const record = await Model.create({ name: 'sakura', type: 'class s' });
    expect(record.type).to.be.eql('class s');
  });

  it('should return YYYY-MM-DD format string for DATEONLY', async function () {
    const Model = this.sequelize.define('user', {
      stamp: DataTypes.DATEONLY,
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
      stamp: testDate,
    });

    const record1 = await record2.reload();
    expect(typeof record1.stamp).to.be.eql('string');
    expect(record1.stamp).to.be.eql(testDate);

    const record0 = await record1.update({
      stamp: newDate,
    });

    const record = await record0.reload();
    expect(typeof record.stamp).to.be.eql('string');
    const recordDate = new Date(record.stamp);
    expect(recordDate.getUTCFullYear()).to.equal(newDate.getUTCFullYear());
    expect(recordDate.getUTCDate()).to.equal(newDate.getUTCDate());
    expect(recordDate.getUTCMonth()).to.equal(newDate.getUTCMonth());
  });

  it('should return set DATEONLY field to NULL correctly', async function () {
    const Model = this.sequelize.define('user', {
      stamp: DataTypes.DATEONLY,
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
      stamp: null,
    });

    const record = await record0.reload();
    expect(record.stamp).to.be.eql(null);
  });

  it('should be able to cast buffer as boolean', async function () {
    const ByteModel = this.sequelize.define('Model', {
      byteToBool: DataTypes.BLOB,
    }, {
      timestamps: false,
    });

    const BoolModel = this.sequelize.define('Model', {
      byteToBool: DataTypes.BOOLEAN,
    }, {
      timestamps: false,
    });

    await ByteModel.sync({
      force: true,
    });

    const byte = await ByteModel.create({
      byteToBool: Buffer.from([true]),
    });

    expect(byte.byteToBool).to.be.ok;

    const bool = await BoolModel.findByPk(byte.id);
    expect(bool.byteToBool).to.be.true;
  });
});
