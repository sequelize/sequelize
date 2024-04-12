'use strict';

const cloneDeep = require('lodash/cloneDeep');
const { assert, expect } = require('chai');
const { ConnectionError, DataTypes, literal, Transaction } = require('@sequelize/core');
const {
  allowDeprecationsInSuite,
  beforeAll2,
  beforeEach2,
  createMultiTransactionalTestSequelizeInstance,
  createSequelizeInstance,
  createSingleTestSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser,
  rand,
  sequelize: current,
} = require('./support');
const sinon = require('sinon');
const { CONFIG } = require('../config/config');

const dialect = getTestDialect();

const qq = str => {
  if (['postgres', 'mssql', 'db2', 'ibmi'].includes(dialect)) {
    return `"${str}"`;
  }

  if (['mysql', 'mariadb', 'sqlite3'].includes(dialect)) {
    return `\`${str}\``;
  }

  return str;
};

const badUsernameConfig = {
  postgres: {
    user: 'bad_user',
  },
  db2: {
    username: 'bad_user',
  },
  ibmi: {
    username: 'bad_user',
  },
  mariadb: {
    user: 'bad_user',
  },
  mysql: {
    user: 'bad_user',
  },
  mssql: {
    authentication: {
      ...CONFIG.mssql.authentication,
      type: 'default',
      options: {
        ...CONFIG.mssql.authentication.options,
        userName: 'bad_user',
      },
    },
  },
  snowflake: {
    account: 'bad_account',
  },
};

const noPasswordConfig = {
  postgres: {
    password: null,
  },
  db2: {
    password: null,
  },
  ibmi: {
    password: null,
  },
  mariadb: {
    password: null,
  },
  mysql: {
    password: null,
  },
  mssql: {
    authentication: {
      ...CONFIG.mssql.authentication,
      type: 'default',
      options: {
        ...CONFIG.mssql.authentication.options,
        password: '',
      },
    },
  },
  snowflake: {
    password: null,
  },
};

const badAddressConfig = {
  postgres: {
    port: 9999,
  },
  mysql: {
    port: 9999,
  },
  mssql: {
    port: 9999,
  },
  mariadb: {
    port: 9999,
  },
  sqlite3: {},
  snowflake: {
    accessUrl: 'https://bad-address',
  },
  db2: {
    port: 9999,
  },
  ibmi: {
    system: 'bad-address',
  },
};

describe(getTestDialectTeaser('Sequelize'), () => {
  if (dialect !== 'sqlite3') {
    describe('authenticate', () => {
      describe('with valid credentials', () => {
        it('triggers the success event', async function () {
          await this.sequelize.authenticate();
        });
      });

      describe('with an invalid connection', () => {
        beforeEach(function () {
          this.sequelizeWithInvalidConnection = createSingleTestSequelizeInstance(
            badAddressConfig[dialect],
          );
        });

        it('rejects', async function () {
          await expect(this.sequelizeWithInvalidConnection.authenticate()).to.be.rejectedWith(
            ConnectionError,
          );
        });

        it('triggers the actual adapter error', async function () {
          const error = await expect(this.sequelizeWithInvalidConnection.authenticate()).to.be
            .rejected;

          console.log(error.message);

          expect(
            error.message.includes('connect ECONNREFUSED') ||
              error.message.includes('Connection refused') ||
              error.message.includes('Could not connect') ||
              error.message.includes('invalid port number') ||
              error.message.match(/should be >=? 0 and < 65536/) ||
              error.message.includes('Login failed for user') ||
              error.message.includes('A communication error has been detected') ||
              error.message.includes('must be > 0 and < 65536') ||
              error.message.includes('Error connecting to the database'),
          ).to.be.ok;
        });
      });

      describe('with invalid credentials', () => {
        beforeEach(function () {
          this.sequelizeWithInvalidCredentials = createSingleTestSequelizeInstance(
            badUsernameConfig[dialect],
          );
        });

        it('rejects', async function () {
          await expect(this.sequelizeWithInvalidCredentials.authenticate()).to.be.rejectedWith(
            ConnectionError,
          );
        });

        if (dialect !== 'db2') {
          it('triggers the error event when using replication', async () => {
            const sequelize = createSequelizeInstance({
              dialect,
              replication: {
                read: [badUsernameConfig[dialect]],
              },
            });

            await expect(sequelize.authenticate()).to.be.rejected;
            await sequelize.close();
          });
        }
      });
    });

    describe('validate', () => {
      it('is an alias for .authenticate()', function () {
        expect(this.sequelize.validate).to.equal(this.sequelize.authenticate);
      });
    });
  }

  describe('getDialect', () => {
    allowDeprecationsInSuite(['SEQUELIZE0031']);
    it('returns the defined dialect', function () {
      expect(this.sequelize.getDialect()).to.equal(dialect);
    });
  });

  describe('isDefined', () => {
    allowDeprecationsInSuite(['SEQUELIZE0029']);
    it("returns false if the dao wasn't defined before", function () {
      expect(this.sequelize.isDefined('Project')).to.be.false;
    });

    it('returns true if the dao was defined before', function () {
      this.sequelize.define('Project', {
        name: DataTypes.STRING,
      });
      expect(this.sequelize.isDefined('Project')).to.be.true;
    });
  });

  describe('model', () => {
    allowDeprecationsInSuite(['SEQUELIZE0028']);
    it('throws an error if the dao being accessed is undefined', function () {
      expect(() => {
        this.sequelize.model('Project');
      }).to.throw(`Model 'Project' was not added to this Sequelize instance`);
    });

    it('returns the dao factory defined by daoName', function () {
      const project = this.sequelize.define('Project', {
        name: DataTypes.STRING,
      });

      expect(this.sequelize.model('Project')).to.equal(project);
    });
  });

  describe('define', () => {
    it('adds a new dao to the dao manager', function () {
      const count = this.sequelize.models.size;
      this.sequelize.define('foo', { title: DataTypes.STRING });
      expect(this.sequelize.models.size).to.equal(count + 1);
    });

    it('adds a new dao to sequelize.models', function () {
      expect(this.sequelize.models.get('bar')).to.equal(undefined);
      const Bar = this.sequelize.define('bar', { title: DataTypes.STRING });
      expect(this.sequelize.models.get('bar')).to.equal(Bar);
    });

    it('overwrites global options', () => {
      const sequelize = createSingleTestSequelizeInstance({
        define: { collate: 'utf8_general_ci' },
      });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING }, { collate: 'utf8_bin' });
      expect(DAO.options.collate).to.equal('utf8_bin');
    });

    it('overwrites global rowFormat options', () => {
      const sequelize = createSingleTestSequelizeInstance({
        define: { rowFormat: 'compact' },
      });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING }, { rowFormat: 'default' });
      expect(DAO.options.rowFormat).to.equal('default');
    });

    it('inherits global collate option', () => {
      const sequelize = createSingleTestSequelizeInstance({
        define: { collate: 'utf8_general_ci' },
      });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING });
      expect(DAO.options.collate).to.equal('utf8_general_ci');
    });

    it('inherits global rowFormat option', () => {
      const sequelize = createSingleTestSequelizeInstance({
        define: { rowFormat: 'default' },
      });
      const DAO = sequelize.define('foo', { bar: DataTypes.STRING });
      expect(DAO.options.rowFormat).to.equal('default');
    });

    it('uses the passed tableName', async function () {
      const Photo = this.sequelize.define(
        'Foto',
        { name: DataTypes.STRING },
        { tableName: 'photos' },
      );
      await Photo.sync({ force: true });
      const result = await this.sequelize.queryInterface.listTables();
      const tableNames = result.map(v => v.tableName);

      expect(tableNames).to.include('photos');
    });
  });

  describe('truncate', () => {
    it('truncates all models', async function () {
      const Project = this.sequelize.define(`project${rand()}`, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: DataTypes.STRING,
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
    it('synchronizes all models', async function () {
      const Project = this.sequelize.define(`project${rand()}`, {
        title: DataTypes.STRING,
      });
      const Task = this.sequelize.define(`task${rand()}`, { title: DataTypes.STRING });

      await Project.sync({ force: true });
      await Task.sync({ force: true });
      await Project.create({ title: 'bla' });
      const task = await Task.create({ title: 'bla' });
      expect(task).to.exist;
      expect(task.title).to.equal('bla');
    });

    it('works with correct database credentials', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await User.sync();
      expect(true).to.be.true;
    });

    if (dialect !== 'sqlite3' && dialect !== 'db2') {
      it('fails for incorrect connection even when no models are defined', async () => {
        const sequelize = createSingleTestSequelizeInstance(badUsernameConfig[dialect]);

        await expect(sequelize.sync({ force: true })).to.be.rejected;
      });

      it('fails when no password is provided', async () => {
        const sequelizeWithInvalidCredentials = createSingleTestSequelizeInstance(
          noPasswordConfig[dialect],
        );

        const User2 = sequelizeWithInvalidCredentials.define('User', {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
        });

        try {
          await User2.sync();
          expect.fail();
        } catch (error) {
          switch (dialect) {
            case 'postgres': {
              assert(
                [
                  'fe_sendauth: no password supplied',
                  'password authentication failed for user "sequelize_test"',
                  'SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string',
                ].some(fragment => error.message.includes(fragment)),
              );

              break;
            }

            case 'mssql': {
              expect(error.message).to.include("Login failed for user 'SA'.");

              break;
            }

            case 'db2': {
              expect(error.message).to.include('A communication error has been detected');

              break;
            }

            case 'ibmi': {
              expect(error.message).to.equal('[odbc] Error connecting to the database');
              expect(error.cause.odbcErrors[0].message).to.include(
                'Data source name not found and no default driver specified',
              );

              break;
            }

            default: {
              expect(error.message.toString()).to.match(/.*Access denied.*/);
            }
          }
        }
      });

      it('returns an error correctly if unable to sync a foreign key referenced model', async function () {
        this.sequelize.define('Application', {
          authorID: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
              model: 'User',
              key: 'id',
            },
          },
        });

        await expect(this.sequelize.sync()).to.be.rejected;
      });
    }

    it('return the sequelize instance after syncing', async function () {
      const sequelize = await this.sequelize.sync();
      expect(sequelize).to.deep.equal(this.sequelize);
    });

    it('return the single dao after syncing', async function () {
      const block = this.sequelize.define(
        'block',
        {
          id: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING,
        },
        {
          tableName: 'block',
          timestamps: false,
          paranoid: false,
        },
      );

      const result = await block.sync();
      expect(result).to.deep.equal(block);
    });

    it('handles alter: true with underscore correctly', async function () {
      this.sequelize.define(
        'access_metric',
        {
          user_id: {
            type: DataTypes.INTEGER,
          },
        },
        {
          underscored: true,
        },
      );

      await this.sequelize.sync({
        alter: true,
      });
    });

    describe("doesn't emit logging when explicitly saying not to", () => {
      const vars = beforeEach2(() => {
        const spy = sinon.spy();
        const sequelize = createSequelizeInstance({
          logging: spy,
        });

        const User = sequelize.define('UserTest', { username: DataTypes.STRING });

        return { spy, sequelize, User };
      });

      afterEach(() => {
        return vars.sequelize.close();
      });

      it('through Sequelize.sync()', async () => {
        await vars.sequelize.sync({ force: true, logging: false });
        expect(vars.spy.notCalled).to.be.true;
      });

      it('through Model.sync()', async () => {
        vars.spy.resetHistory();
        await vars.User.sync({ force: true, logging: false });
        expect(vars.spy.notCalled).to.be.true;
      });
    });
  });

  describe('Model.drop', () => {
    it('drops the table corresponding to the model', async function () {
      const User = this.sequelize.define('Users', { username: DataTypes.STRING });
      await User.sync({ force: true });
      await User.drop();
    });
  });

  describe('define', () => {
    describe('table', () => {
      const attributeList = [
        { id: { type: DataTypes.INTEGER, primaryKey: true } },
        { id: { type: DataTypes.STRING, allowNull: true, primaryKey: true } },
        {
          id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        },
      ];

      if (current.dialect.supports.dataTypes.BIGINT) {
        attributeList.push(
          { id: { type: DataTypes.BIGINT, primaryKey: true } },
          {
            id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
          },
        );
      }

      for (const customAttributes of attributeList) {
        it('should be able to override options on the default attributes', async function () {
          const Picture = this.sequelize.define('picture', cloneDeep(customAttributes));
          await Picture.sync({ force: true });
          for (const attribute of Object.keys(customAttributes)) {
            for (const option of Object.keys(customAttributes[attribute])) {
              const optionValue = customAttributes[attribute][option];
              if (
                typeof optionValue === 'function' &&
                optionValue() instanceof DataTypes.ABSTRACT
              ) {
                expect(Picture.getAttributes()[attribute][option] instanceof optionValue).to.be.ok;
              } else {
                expect(Picture.getAttributes()[attribute][option]).to.equal(optionValue);
              }
            }
          }
        });
      }
    });

    if (current.dialect.supports.transactions) {
      describe('transaction', () => {
        const vars = beforeAll2(async () => {
          const sequelizeWithTransaction =
            await createMultiTransactionalTestSequelizeInstance(current);

          return { sequelizeWithTransaction };
        });

        after(() => {
          return vars.sequelizeWithTransaction.close();
        });

        it('returns a transaction object', async () => {
          const t = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
          expect(t).to.be.instanceOf(Transaction);
          await t.commit();
        });

        if (dialect === 'sqlite3') {
          it('correctly scopes transaction from other connections', async function () {
            const TransactionTest = vars.sequelizeWithTransaction.define(
              'TransactionTest',
              { name: DataTypes.STRING },
              { timestamps: false },
            );

            const count = async transaction => {
              const sql = vars.sequelizeWithTransaction.queryGenerator.selectQuery(
                'TransactionTests',
                { attributes: [[literal('count(*)'), 'cnt']] },
              );

              const result = await vars.sequelizeWithTransaction.query(sql, {
                plain: true,
                transaction,
              });

              return result.cnt;
            };

            await TransactionTest.sync({ force: true });
            const t1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
            this.t1 = t1;
            await vars.sequelizeWithTransaction.query(
              `INSERT INTO ${qq('TransactionTests')} (${qq('name')})
                                                       VALUES ('foo');`,
              { transaction: t1 },
            );
            await expect(count()).to.eventually.equal(0);
            await expect(count(this.t1)).to.eventually.equal(1);
            await this.t1.commit();

            await expect(count()).to.eventually.equal(1);
          });
        } else {
          it('correctly handles multiple transactions', async function () {
            const TransactionTest = vars.sequelizeWithTransaction.define(
              'TransactionTest',
              { name: DataTypes.STRING },
              { timestamps: false },
            );
            const aliasesMapping = new Map([['_0', 'cnt']]);

            const count = async transaction => {
              const sql = vars.sequelizeWithTransaction.queryGenerator.selectQuery(
                'TransactionTests',
                { attributes: [[literal('count(*)'), 'cnt']] },
              );

              const result = await vars.sequelizeWithTransaction.query(sql, {
                plain: true,
                transaction,
                aliasesMapping,
              });

              return Number.parseInt(result.cnt, 10);
            };

            await TransactionTest.sync({ force: true });
            const t1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
            this.t1 = t1;
            await vars.sequelizeWithTransaction.query(
              `INSERT INTO ${qq('TransactionTests')} (${qq('name')})
                                                       VALUES ('foo');`,
              { transaction: t1 },
            );
            const t2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
            this.t2 = t2;
            await vars.sequelizeWithTransaction.query(
              `INSERT INTO ${qq('TransactionTests')} (${qq('name')})
                                                       VALUES ('bar');`,
              { transaction: t2 },
            );
            await expect(count()).to.eventually.equal(0);
            await expect(count(this.t1)).to.eventually.equal(1);
            await expect(count(this.t2)).to.eventually.equal(1);
            await this.t2.rollback();
            await expect(count()).to.eventually.equal(0);
            await this.t1.commit();

            await expect(count()).to.eventually.equal(1);
          });
        }

        it('supports nested transactions using savepoints', async () => {
          const User = vars.sequelizeWithTransaction.define('Users', {
            username: DataTypes.STRING,
          });

          await User.sync({ force: true });
          const t1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
            transaction: t1,
          });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t2.commit();
          const newUser = await user.reload({ transaction: t1 });
          expect(newUser.username).to.equal('bar');

          await t1.commit();
        });

        describe('supports rolling back to savepoints', () => {
          beforeEach(async function () {
            this.User = vars.sequelizeWithTransaction.define('user', {});
            await vars.sequelizeWithTransaction.sync({ force: true });
          });

          it('rolls back to the first savepoint, undoing everything', async function () {
            const transaction = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
            this.transaction = transaction;

            const sp1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
              transaction,
            });
            this.sp1 = sp1;
            await this.User.create({}, { transaction: this.transaction });
            const sp2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
              transaction: this.transaction,
            });
            this.sp2 = sp2;
            await this.User.create({}, { transaction: this.transaction });
            const users0 = await this.User.findAll({ transaction: this.transaction });
            expect(users0).to.have.length(2);

            await this.sp1.rollback();
            const users = await this.User.findAll({ transaction: this.transaction });
            expect(users).to.have.length(0);

            await this.transaction.rollback();
          });

          it('rolls back to the most recent savepoint, only undoing recent changes', async function () {
            const transaction = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
            this.transaction = transaction;

            const sp1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
              transaction,
            });
            this.sp1 = sp1;
            await this.User.create({}, { transaction: this.transaction });
            const sp2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
              transaction: this.transaction,
            });
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

        it('supports rolling back a nested transaction', async () => {
          const User = vars.sequelizeWithTransaction.define('Users', {
            username: DataTypes.STRING,
          });

          await User.sync({ force: true });
          const t1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
            transaction: t1,
          });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t2.rollback();
          const newUser = await user.reload({ transaction: t1 });
          expect(newUser.username).to.equal('foo');

          await t1.commit();
        });

        it('supports rolling back outermost transaction', async () => {
          const User = vars.sequelizeWithTransaction.define('Users', {
            username: DataTypes.STRING,
          });

          await User.sync({ force: true });
          const t1 = await vars.sequelizeWithTransaction.startUnmanagedTransaction();
          const user = await User.create({ username: 'foo' }, { transaction: t1 });
          const t2 = await vars.sequelizeWithTransaction.startUnmanagedTransaction({
            transaction: t1,
          });
          await user.update({ username: 'bar' }, { transaction: t2 });
          await t1.rollback();
          const users = await User.findAll();
          expect(users.length).to.equal(0);
        });
      });
    }
  });

  describe('fetchDatabaseVersion', () => {
    it('should database/dialect version', async function () {
      const version = await this.sequelize.fetchDatabaseVersion();
      expect(typeof version).to.equal('string');
      expect(version).to.be.ok;
    });
  });

  describe('getDatabaseVersion', () => {
    it('throws if no database version is set internally', () => {
      expect(() => {
        // ensures the version hasn't been loaded by another test yet
        const sequelize = createSingleTestSequelizeInstance();
        sequelize.getDatabaseVersion();
      }).to.throw(
        'The current database version is unknown. Please call `sequelize.authenticate()` first to fetch it, or manually configure it through options.',
      );
    });

    it('returns the database version if loaded', async function () {
      await this.sequelize.authenticate();
      const version = this.sequelize.getDatabaseVersion();
      expect(typeof version).to.equal('string');
      expect(version).to.be.ok;
    });
  });

  describe('paranoid deletedAt non-null default value', () => {
    it('should use defaultValue of deletedAt in paranoid clause and restore', async function () {
      const epochObj = new Date(0);
      const epoch = Number(epochObj);
      const User = this.sequelize.define(
        'user',
        {
          username: DataTypes.STRING,
          deletedAt: {
            type: DataTypes.DATE,
            defaultValue: epochObj,
          },
        },
        {
          paranoid: true,
        },
      );

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'user1' });
      expect(Number(user.deletedAt)).to.equal(epoch);

      const user0 = await User.findOne({
        where: {
          username: 'user1',
        },
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

      await User.destroy({
        where: {
          username: 'user1',
        },
      });

      const count = await User.count();
      expect(count).to.equal(0);
      await User.restore();
      const nonDeletedUsers = await User.findAll();
      expect(nonDeletedUsers.length).to.equal(1);
      for (const u of nonDeletedUsers) {
        expect(Number(u.deletedAt)).to.equal(epoch);
      }
    });
  });
});
