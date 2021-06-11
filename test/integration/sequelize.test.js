'use strict';

const { expect, assert } = require('chai');
const Support = require('./support');
const DataTypes = require('../../lib/data-types');
const dialect = Support.getTestDialect();
const _ = require('lodash');
const Sequelize = require('../../index');
const config = require('../config/config');
const Transaction = require('../../lib/transaction');
const sinon = require('sinon');
const current = Support.sequelize;

const qq = str => {
  if (dialect === 'postgres' || dialect === 'mssql') {
    return `"${str}"`;
  }
  if (dialect === 'mysql' || dialect === 'mariadb' || dialect === 'sqlite') {
    return `\`${str}\``;
  }
  return str;
};

describe(Support.getTestDialectTeaser('Sequelize'), () => {
  describe('constructor', () => {
    it('should pass the global options correctly', () => {
      const sequelize = Support.createSequelizeInstance({ logging: false, define: { underscored: true } }),
        DAO = sequelize.define('dao', { name: DataTypes.STRING });

      expect(DAO.options.underscored).to.be.ok;
    });

    it('should correctly set the host and the port', () => {
      const sequelize = Support.createSequelizeInstance({ host: '127.0.0.1', port: 1234 });
      expect(sequelize.config.port).to.equal(1234);
      expect(sequelize.config.host).to.equal('127.0.0.1');
    });

    it('should set operators aliases on dialect queryGenerator', () => {
      const operatorsAliases = { fake: true };
      const sequelize = Support.createSequelizeInstance({ operatorsAliases });

      expect(sequelize).to.have.property('dialect');
      expect(sequelize.dialect).to.have.property('queryGenerator');
      expect(sequelize.dialect.queryGenerator).to.have.property('OperatorsAliasMap');
      expect(sequelize.dialect.queryGenerator.OperatorsAliasMap).to.be.eql(operatorsAliases);
    });

    if (dialect === 'sqlite') {
      it('should work with connection strings (1)', () => {
        new Sequelize('sqlite://test.sqlite');
      });
      it('should work with connection strings (2)', () => {
        new Sequelize('sqlite://test.sqlite/');
      });
      it('should work with connection strings (3)', () => {
        new Sequelize('sqlite://test.sqlite/lol?reconnect=true');
      });
    }

    if (dialect === 'postgres') {
      const getConnectionUri = o => `${o.protocol}://${o.username}:${o.password}@${o.host}${o.port ? `:${o.port}` : ''}/${o.database}`;
      it('should work with connection strings (postgres protocol)', () => {
        const connectionUri = getConnectionUri({ ...config[dialect], protocol: 'postgres' });
        // postgres://...
        new Sequelize(connectionUri);
      });
      it('should work with connection strings (postgresql protocol)', () => {
        const connectionUri = getConnectionUri({ ...config[dialect], protocol: 'postgresql' });
        // postgresql://...
        new Sequelize(connectionUri);
      });
    }
  });

  if (dialect !== 'sqlite') {
    describe('authenticate', () => {
      describe('with valid credentials', () => {
        it('triggers the success event', async function() {
          await this.sequelize.authenticate();
        });
      });

      describe('with an invalid connection', () => {
        beforeEach(function() {
          const options = { ...this.sequelize.options, port: '99999' };
          this.sequelizeWithInvalidConnection = new Sequelize('wat', 'trololo', 'wow', options);
        });

        it('triggers the error event', async function() {
          try {
            await this
              .sequelizeWithInvalidConnection
              .authenticate();
          } catch (err) {
            expect(err).to.not.be.null;
          }
        });

        it('triggers an actual RangeError or ConnectionError', async function() {
          try {
            await this
              .sequelizeWithInvalidConnection
              .authenticate();
          } catch (err) {
            expect(
              err instanceof RangeError ||
              err instanceof Sequelize.ConnectionError
            ).to.be.ok;
          }
        });

        it('triggers the actual adapter error', async function() {
          try {
            await this
              .sequelizeWithInvalidConnection
              .authenticate();
          } catch (err) {
            console.log(err);
            expect(
              err.message.includes('connect ECONNREFUSED') ||
              err.message.includes('invalid port number') ||
              err.message.match(/should be >=? 0 and < 65536/) ||
              err.message.includes('Login failed for user') ||
              err.message.includes('must be > 0 and < 65536')
            ).to.be.ok;
          }
        });
      });

      describe('with invalid credentials', () => {
        beforeEach(function() {
          this.sequelizeWithInvalidCredentials = new Sequelize('localhost', 'wtf', 'lol', this.sequelize.options);
        });

        it('triggers the error event', async function() {
          try {
            await this
              .sequelizeWithInvalidCredentials
              .authenticate();
          } catch (err) {
            expect(err).to.not.be.null;
          }
        });

        it('triggers an actual sequlize error', async function() {
          try {
            await this
              .sequelizeWithInvalidCredentials
              .authenticate();
          } catch (err) {
            expect(err).to.be.instanceof(Sequelize.Error);
          }
        });

        it('triggers the error event when using replication', async () => {
          try {
            await new Sequelize('sequelize', null, null, {
              dialect,
              replication: {
                read: {
                  host: 'localhost',
                  username: 'omg',
                  password: 'lol'
                }
              }
            }).authenticate();
          } catch (err) {
            expect(err).to.not.be.null;
          }
        });
      });
    });

    describe('validate', () => {
      it('is an alias for .authenticate()', function() {
        expect(this.sequelize.validate).to.equal(this.sequelize.authenticate);
      });
    });
  }

  describe('getDialect', () => {
    it('returns the defined dialect', function() {
      expect(this.sequelize.getDialect()).to.equal(dialect);
    });
  });

  describe('getDatabaseName', () => {
    it('returns the database name', function() {
      expect(this.sequelize.getDatabaseName()).to.equal(this.sequelize.config.database);
    });
  });

  describe('isDefined', () => {
    it('returns false if the dao wasn\'t defined before', function() {
      expect(this.sequelize.isDefined('Project')).to.be.false;
    });

    it('returns true if the dao was defined before', function() {
      this.sequelize.define('Project', {
        name: DataTypes.STRING
      });
      expect(this.sequelize.isDefined('Project')).to.be.true;
    });
  });

  describe('model', () => {
    it('throws an error if the dao being accessed is undefined', function() {
      expect(() => {
        this.sequelize.model('Project');
      }).to.throw(/project has not been defined/i);
    });

    it('returns the dao factory defined by daoName', function() {
      const project = this.sequelize.define('Project', {
        name: DataTypes.STRING
      });

      expect(this.sequelize.model('Project')).to.equal(project);
    });
  });

  describe('set', () => {
    it('should be configurable with global functions', function() {
      const defaultSetterMethod = sinon.spy(),
        overrideSetterMethod = sinon.spy(),
        defaultGetterMethod = sinon.spy(),
        overrideGetterMethod = sinon.spy(),
        customSetterMethod = sinon.spy(),
        customOverrideSetterMethod = sinon.spy(),
        customGetterMethod = sinon.spy(),
        customOverrideGetterMethod = sinon.spy();

      this.sequelize.options.define = {
        'setterMethods': {
          'default': defaultSetterMethod,
          'override': overrideSetterMethod
        },
        'getterMethods': {
          'default': defaultGetterMethod,
          'override': overrideGetterMethod
        }
      };
      const testEntity = this.sequelize.define('TestEntity', {}, {
        'setterMethods': {
          'custom': customSetterMethod,
          'override': customOverrideSetterMethod
        },
        'getterMethods': {
          'custom': customGetterMethod,
          'override': customOverrideGetterMethod
        }
      });

      // Create Instance to test
      const instance = testEntity.build();

      // Call Getters
      instance.default;
      instance.custom;
      instance.override;

      expect(defaultGetterMethod).to.have.been.calledOnce;
      expect(customGetterMethod).to.have.been.calledOnce;
      expect(overrideGetterMethod.callCount).to.be.eql(0);
      expect(customOverrideGetterMethod).to.have.been.calledOnce;

      // Call Setters
      instance.default = 'test';
      instance.custom = 'test';
      instance.override = 'test';

      expect(defaultSetterMethod).to.have.been.calledOnce;
      expect(customSetterMethod).to.have.been.calledOnce;
      expect(overrideSetterMethod.callCount).to.be.eql(0);
      expect(customOverrideSetterMethod).to.have.been.calledOnce;
    });
  });

  if (dialect === 'mysql') {
    describe('set', () => {
      it("should return an promised error if transaction isn't defined", async function() {
        await expect(this.sequelize.set({ foo: 'bar' }))
          .to.be.rejectedWith(TypeError, 'options.transaction is required');
      });

      it('one value', async function() {
        const t = await this.sequelize.transaction();
        this.t = t;
        await this.sequelize.set({ foo: 'bar' }, { transaction: t });
        const data = await this.sequelize.query('SELECT @foo as `foo`', { plain: true, transaction: this.t });
        expect(data).to.be.ok;
        expect(data.foo).to.be.equal('bar');
        await this.t.commit();
      });

      it('multiple values', async function() {
        const t = await this.sequelize.transaction();
        this.t = t;

        await this.sequelize.set({
          foo: 'bar',
          foos: 'bars'
        }, { transaction: t });

        const data = await this.sequelize.query('SELECT @foo as `foo`, @foos as `foos`', { plain: true, transaction: this.t });
        expect(data).to.be.ok;
        expect(data.foo).to.be.equal('bar');
        expect(data.foos).to.be.equal('bars');
        await this.t.commit();
      });
    });
  }

  describe('define', () => {
    it('adds a new dao to the dao manager', function() {
      const count = this.sequelize.modelManager.all.length;
      this.sequelize.define('foo', { title: DataTypes.STRING });
      expect(this.sequelize.modelManager.all.length).to.equal(count + 1);
    });

    it('adds a new dao to sequelize.models', function() {
      expect(this.sequelize.models.bar).to.equal(undefined);
      const Bar = this.sequelize.define('bar', { title: DataTypes.STRING });
      expect(this.sequelize.models.bar).to.equal(Bar);
    });

    it('overwrites global options', () => {
      const sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING }, { collate: 'utf8_bin' });
      expect(DAO.options.collate).to.equal('utf8_bin');
    });

    it('overwrites global rowFormat options', () => {
      const sequelize = Support.createSequelizeInstance({ define: { rowFormat: 'compact' } });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING }, { rowFormat: 'default' });
      expect(DAO.options.rowFormat).to.equal('default');
    });

    it('inherits global collate option', () => {
      const sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING });
      expect(DAO.options.collate).to.equal('utf8_general_ci');
    });

    it('inherits global rowFormat option', () => {
      const sequelize = Support.createSequelizeInstance({ define: { rowFormat: 'default' } });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING });
      expect(DAO.options.rowFormat).to.equal('default');
    });

    it('uses the passed tableName', async function() {
      const Photo = this.sequelize.define('Foto', { name: DataTypes.STRING }, { tableName: 'photos' });
      await Photo.sync({ force: true });
      let tableNames = await this.sequelize.getQueryInterface().showAllTables();
      if (dialect === 'mssql' || dialect === 'mariadb') {
        tableNames = tableNames.map(v => v.tableName);
      }
      expect(tableNames).to.include('photos');
    });
  });

  describe('truncate', () => {
    it('truncates all models', async function() {
      const Project = this.sequelize.define(`project${Support.rand()}`, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        title: DataTypes.STRING
      });

      await this.sequelize.sync({ force: true });
      const project = await Project.create({ title: 'bla' });
      expect(project).to.exist;
      expect(project.title).to.equal('bla');
      expect(project.id).to.equal(1);
      await this.sequelize.truncate();
      const projects = await Project.findAll({});
      expect(projects).to.exist;
      expect(projects).to.have.length(0);
    });
  });

  describe('sync', () => {
    it('synchronizes all models', async function() {
      const Project = this.sequelize.define(`project${Support.rand()}`, { title: DataTypes.STRING });
      const Task = this.sequelize.define(`task${Support.rand()}`, { title: DataTypes.STRING });

      await Project.sync({ force: true });
      await Task.sync({ force: true });
      await Project.create({ title: 'bla' });
      const task = await Task.create({ title: 'bla' });
      expect(task).to.exist;
      expect(task.title).to.equal('bla');
    });

    it('works with correct database credentials', async function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await User.sync();
      expect(true).to.be.true;
    });

    it('fails with incorrect match condition', async function() {
      const sequelize = new Sequelize('cyber_bird', 'user', 'pass', {
        dialect: this.sequelize.options.dialect
      });

      sequelize.define('Project', { title: Sequelize.STRING });
      sequelize.define('Task', { title: Sequelize.STRING });

      await expect(sequelize.sync({ force: true, match: /$phoenix/ }))
        .to.be.rejectedWith('Database "cyber_bird" does not match sync match parameter "/$phoenix/"');
    });

    if (dialect !== 'sqlite') {
      it('fails for incorrect connection even when no models are defined', async function() {
        const sequelize = new Sequelize('cyber_bird', 'user', 'pass', {
          dialect: this.sequelize.options.dialect
        });

        await expect(sequelize.sync({ force: true })).to.be.rejected;
      });

      it('fails with incorrect database credentials (1)', async function() {
        this.sequelizeWithInvalidCredentials = new Sequelize('omg', 'bar', null, _.omit(this.sequelize.options, ['host']));

        const User2 = this.sequelizeWithInvalidCredentials.define('User', { name: DataTypes.STRING, bio: DataTypes.TEXT });

        try {
          await User2.sync();
          expect.fail();
        } catch (err) {
          if (dialect === 'postgres' || dialect === 'postgres-native') {
            assert([
              'fe_sendauth: no password supplied',
              'role "bar" does not exist',
              'FATAL:  role "bar" does not exist',
              'password authentication failed for user "bar"'
            ].includes(err.message.trim()));
          } else if (dialect === 'mssql') {
            expect(err.message).to.equal('Login failed for user \'bar\'.');
          } else {
            expect(err.message.toString()).to.match(/.*Access denied.*/);
          }
        }
      });

      it('fails with incorrect database credentials (2)', async function() {
        const sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect
        });

        sequelize.define('Project', { title: Sequelize.STRING });
        sequelize.define('Task', { title: Sequelize.STRING });

        await expect(sequelize.sync({ force: true })).to.be.rejected;
      });

      it('fails with incorrect database credentials (3)', async function() {
        const sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect,
          port: 99999
        });

        sequelize.define('Project', { title: Sequelize.STRING });
        sequelize.define('Task', { title: Sequelize.STRING });

        await expect(sequelize.sync({ force: true })).to.be.rejected;
      });

      it('fails with incorrect database credentials (4)', async function() {
        const sequelize = new Sequelize('db', 'user', 'pass', {
          dialect: this.sequelize.options.dialect,
          port: 99999,
          pool: {}
        });

        sequelize.define('Project', { title: Sequelize.STRING });
        sequelize.define('Task', { title: Sequelize.STRING });

        await expect(sequelize.sync({ force: true })).to.be.rejected;
      });

      it('returns an error correctly if unable to sync a foreign key referenced model', async function() {
        this.sequelize.define('Application', {
          authorID: {
            type: Sequelize.BIGINT,
            allowNull: false,
            references: {
              model: 'User',
              key: 'id'
            }
          }
        });

        await expect(this.sequelize.sync()).to.be.rejected;
      });

      it('handles this dependant foreign key constraints', async function() {
        const block = this.sequelize.define('block', {
          id: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING
        }, {
          tableName: 'block',
          timestamps: false,
          paranoid: false
        });

        block.hasMany(block, {
          as: 'childBlocks',
          foreignKey: 'parent',
          joinTableName: 'link_block_block',
          useJunctionTable: true,
          foreignKeyConstraint: true
        });
        block.belongsTo(block, {
          as: 'parentBlocks',
          foreignKey: 'child',
          joinTableName: 'link_block_block',
          useJunctionTable: true,
          foreignKeyConstraint: true
        });

        await this.sequelize.sync();
      });
    }

    it('return the sequelize instance after syncing', async function() {
      const sequelize = await this.sequelize.sync();
      expect(sequelize).to.deep.equal(this.sequelize);
    });

    it('return the single dao after syncing', async function() {
      const block = this.sequelize.define('block', {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        name: DataTypes.STRING
      }, {
        tableName: 'block',
        timestamps: false,
        paranoid: false
      });

      const result = await block.sync();
      expect(result).to.deep.equal(block);
    });

    it('handles alter: true with underscore correctly', async function() {
      this.sequelize.define('access_metric', {
        user_id: {
          type: DataTypes.INTEGER
        }
      }, {
        underscored: true
      });

      await this.sequelize.sync({
        alter: true
      });
    });

    describe("doesn't emit logging when explicitly saying not to", () => {
      afterEach(function() {
        this.sequelize.options.logging = false;
      });

      beforeEach(function() {
        this.spy = sinon.spy();
        this.sequelize.options.logging = () => { this.spy(); };
        this.User = this.sequelize.define('UserTest', { username: DataTypes.STRING });
      });

      it('through Sequelize.sync()', async function() {
        this.spy.resetHistory();
        await this.sequelize.sync({ force: true, logging: false });
        expect(this.spy.notCalled).to.be.true;
      });

      it('through DAOFactory.sync()', async function() {
        this.spy.resetHistory();
        await this.User.sync({ force: true, logging: false });
        expect(this.spy.notCalled).to.be.true;
      });
    });

    describe('match', () => {
      it('will return an error not matching', function() {
        expect(
          this.sequelize.sync({
            force: true,
            match: /alibabaizshaek/
          })
        ).to.be.rejected;
      });
    });
  });

  describe('drop should work', () => {
    it('correctly succeeds', async function() {
      const User = this.sequelize.define('Users', { username: DataTypes.STRING });
      await User.sync({ force: true });
      await User.drop();
    });
  });

  describe('define', () => {
    it('raises an error if no values are defined', function() {
      expect(() => {
        this.sequelize.define('omnomnom', {
          bla: { type: DataTypes.ARRAY }
        });
      }).to.throw(Error, 'ARRAY is missing type definition for its values.');
    });
  });

  describe('define', () => {
    [
      { type: DataTypes.ENUM, values: ['scheduled', 'active', 'finished'] },
      DataTypes.ENUM('scheduled', 'active', 'finished')
    ].forEach(status => {
      describe('enum', () => {
        beforeEach(async function() {
          this.sequelize = Support.createSequelizeInstance({
            typeValidation: true
          });

          this.Review = this.sequelize.define('review', { status });
          await this.Review.sync({ force: true });
        });

        it('raises an error if no values are defined', function() {
          expect(() => {
            this.sequelize.define('omnomnom', {
              bla: { type: DataTypes.ENUM }
            });
          }).to.throw(Error, 'Values for ENUM have not been defined.');
        });

        it('correctly stores values', async function() {
          const review = await this.Review.create({ status: 'active' });
          expect(review.status).to.equal('active');
        });

        it('correctly loads values', async function() {
          await this.Review.create({ status: 'active' });
          const reviews = await this.Review.findAll();
          expect(reviews[0].status).to.equal('active');
        });

        it("doesn't save an instance if value is not in the range of enums", async function() {
          try {
            await this.Review.create({ status: 'fnord' });
          } catch (err) {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.equal('"fnord" is not a valid choice in ["scheduled","active","finished"]');
          }
        });
      });
    });

    describe('table', () => {
      [
        { id: { type: DataTypes.BIGINT, primaryKey: true } },
        { id: { type: DataTypes.STRING, allowNull: true, primaryKey: true } },
        { id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true } }
      ].forEach(customAttributes => {

        it('should be able to override options on the default attributes', async function() {
          const Picture = this.sequelize.define('picture', _.cloneDeep(customAttributes));
          await Picture.sync({ force: true });
          Object.keys(customAttributes).forEach(attribute => {
            Object.keys(customAttributes[attribute]).forEach(option => {
              const optionValue = customAttributes[attribute][option];
              if (typeof optionValue === 'function' && optionValue() instanceof DataTypes.ABSTRACT) {
                expect(Picture.rawAttributes[attribute][option] instanceof optionValue).to.be.ok;
              } else {
                expect(Picture.rawAttributes[attribute][option]).to.be.equal(optionValue);
              }
            });
          });
        });

      });
    });

    if (current.dialect.supports.transactions) {
      describe('transaction', () => {
        beforeEach(async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          this.sequelizeWithTransaction = sequelize;
        });

        it('is a transaction method available', () => {
          expect(Support.Sequelize).to.respondTo('transaction');
        });

        it('passes a transaction object to the callback', async function() {
          const t = await this.sequelizeWithTransaction.transaction();
          expect(t).to.be.instanceOf(Transaction);
        });

        it('allows me to define a callback on the result', async function() {
          const t = await this.sequelizeWithTransaction.transaction();
          await t.commit();
        });

        if (dialect === 'sqlite') {
          it('correctly scopes transaction from other connections', async function() {
            const TransactionTest = this.sequelizeWithTransaction.define('TransactionTest', { name: DataTypes.STRING }, { timestamps: false });

            const count = async transaction => {
              const sql = this.sequelizeWithTransaction.getQueryInterface().queryGenerator.selectQuery('TransactionTests', { attributes: [['count(*)', 'cnt']] });

              const result = await this.sequelizeWithTransaction.query(sql, { plain: true, transaction });

              return result.cnt;
            };

            await TransactionTest.sync({ force: true });
            const t1 = await this.sequelizeWithTransaction.transaction();
            this.t1 = t1;
            await this.sequelizeWithTransaction.query(`INSERT INTO ${qq('TransactionTests')} (${qq('name')}) VALUES ('foo');`, { transaction: t1 });
            await expect(count()).to.eventually.equal(0);
            await expect(count(this.t1)).to.eventually.equal(1);
            await this.t1.commit();

            await expect(count()).to.eventually.equal(1);
          });
        } else {
          it('correctly handles multiple transactions', async function() {
            const TransactionTest = this.sequelizeWithTransaction.define('TransactionTest', { name: DataTypes.STRING }, { timestamps: false });
            const aliasesMapping = new Map([['_0', 'cnt']]);

            const count = async transaction => {
              const sql = this.sequelizeWithTransaction.getQueryInterface().queryGenerator.selectQuery('TransactionTests', { attributes: [['count(*)', 'cnt']] });

              const result = await this.sequelizeWithTransaction.query(sql, { plain: true, transaction, aliasesMapping  });

              return parseInt(result.cnt, 10);
            };

            await TransactionTest.sync({ force: true });
            const t1 = await this.sequelizeWithTransaction.transaction();
            this.t1 = t1;
            await this.sequelizeWithTransaction.query(`INSERT INTO ${qq('TransactionTests')} (${qq('name')}) VALUES ('foo');`, { transaction: t1 });
            const t2 = await this.sequelizeWithTransaction.transaction();
            this.t2 = t2;
            await this.sequelizeWithTransaction.query(`INSERT INTO ${qq('TransactionTests')} (${qq('name')}) VALUES ('bar');`, { transaction: t2 });
            await expect(count()).to.eventually.equal(0);
            await expect(count(this.t1)).to.eventually.equal(1);
            await expect(count(this.t2)).to.eventually.equal(1);
            await this.t2.rollback();
            await expect(count()).to.eventually.equal(0);
            await this.t1.commit();

            await expect(count()).to.eventually.equal(1);
          });
        }

        it('supports nested transactions using savepoints', async function() {
          const User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          await User.sync({ force: true });
          const t1 = await this.sequelizeWithTransaction.transaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await this.sequelizeWithTransaction.transaction({ transaction: t1 });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t2.commit();
          const newUser = await user.reload({ transaction: t1 });
          expect(newUser.username).to.equal('bar');

          await t1.commit();
        });

        describe('supports rolling back to savepoints', () => {
          beforeEach(async function() {
            this.User = this.sequelizeWithTransaction.define('user', {});
            await this.sequelizeWithTransaction.sync({ force: true });
          });

          it('rolls back to the first savepoint, undoing everything', async function() {
            const transaction = await this.sequelizeWithTransaction.transaction();
            this.transaction = transaction;

            const sp1 = await this.sequelizeWithTransaction.transaction({ transaction });
            this.sp1 = sp1;
            await this.User.create({}, { transaction: this.transaction });
            const sp2 = await this.sequelizeWithTransaction.transaction({ transaction: this.transaction });
            this.sp2 = sp2;
            await this.User.create({}, { transaction: this.transaction });
            const users0 = await this.User.findAll({ transaction: this.transaction });
            expect(users0).to.have.length(2);

            await this.sp1.rollback();
            const users = await this.User.findAll({ transaction: this.transaction });
            expect(users).to.have.length(0);

            await this.transaction.rollback();
          });

          it('rolls back to the most recent savepoint, only undoing recent changes', async function() {
            const transaction = await this.sequelizeWithTransaction.transaction();
            this.transaction = transaction;

            const sp1 = await this.sequelizeWithTransaction.transaction({ transaction });
            this.sp1 = sp1;
            await this.User.create({}, { transaction: this.transaction });
            const sp2 = await this.sequelizeWithTransaction.transaction({ transaction: this.transaction });
            this.sp2 = sp2;
            await this.User.create({}, { transaction: this.transaction });
            const users0 = await this.User.findAll({ transaction: this.transaction });
            expect(users0).to.have.length(2);

            await this.sp2.rollback();
            const users = await this.User.findAll({ transaction: this.transaction });
            expect(users).to.have.length(1);

            await this.transaction.rollback();
          });
        });

        it('supports rolling back a nested transaction', async function() {
          const User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          await User.sync({ force: true });
          const t1 = await this.sequelizeWithTransaction.transaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await this.sequelizeWithTransaction.transaction({ transaction: t1 });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t2.rollback();
          const newUser = await user.reload({ transaction: t1 });
          expect(newUser.username).to.equal('foo');

          await t1.commit();
        });

        it('supports rolling back outermost transaction', async function() {
          const User = this.sequelizeWithTransaction.define('Users', { username: DataTypes.STRING });

          await User.sync({ force: true });
          const t1 = await this.sequelizeWithTransaction.transaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await this.sequelizeWithTransaction.transaction({ transaction: t1 });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t1.rollback();
          const users = await User.findAll();
          expect(users.length).to.equal(0);
        });
      });
    }
  });

  describe('databaseVersion', () => {
    it('should database/dialect version', async function() {
      const version = await this.sequelize.databaseVersion();
      expect(typeof version).to.equal('string');
      expect(version).to.be.ok;
    });
  });

  describe('paranoid deletedAt non-null default value', () => {
    it('should use defaultValue of deletedAt in paranoid clause and restore', async function() {
      const epochObj = new Date(0),
        epoch = Number(epochObj);
      const User = this.sequelize.define('user', {
        username: DataTypes.STRING,
        deletedAt: {
          type: DataTypes.DATE,
          defaultValue: epochObj
        }
      }, {
        paranoid: true
      });

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'user1' });
      expect(Number(user.deletedAt)).to.equal(epoch);

      const user0 = await User.findOne({
        where: {
          username: 'user1'
        }
      });

      expect(user0).to.exist;
      expect(Number(user0.deletedAt)).to.equal(epoch);
      const destroyedUser = await user0.destroy();
      expect(destroyedUser.deletedAt).to.exist;
      expect(Number(destroyedUser.deletedAt)).not.to.equal(epoch);
      const fetchedDestroyedUser = await User.findByPk(destroyedUser.id, { paranoid: false });
      expect(fetchedDestroyedUser.deletedAt).to.exist;
      expect(Number(fetchedDestroyedUser.deletedAt)).not.to.equal(epoch);
      const restoredUser = await fetchedDestroyedUser.restore();
      expect(Number(restoredUser.deletedAt)).to.equal(epoch);

      await User.destroy({ where: {
        username: 'user1'
      } });

      const count = await User.count();
      expect(count).to.equal(0);
      await User.restore();
      const nonDeletedUsers = await User.findAll();
      expect(nonDeletedUsers.length).to.equal(1);
      nonDeletedUsers.forEach(u => {
        expect(Number(u.deletedAt)).to.equal(epoch);
      });
    });
  });
});
