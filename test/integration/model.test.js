'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const { DataTypes, Sequelize, Op, AggregateError, col } = require('@sequelize/core');

const dialectName = Support.getTestDialect();
const dialect = Support.sequelize.dialect;
const sinon = require('sinon');
const _ = require('lodash');
const dayjs = require('dayjs');

const current = Support.sequelize;
const semver = require('semver');
const pMap = require('p-map');
const { expectsql } = require('../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  let isMySQL8;

  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  beforeEach(async function () {
    isMySQL8 = dialectName === 'mysql' && semver.satisfies(current.options.databaseVersion, '>=8.0.0');

    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN,
    });

    await this.User.sync({ force: true });
  });

  describe('constructor', () => {
    it('uses the passed dao name as tablename if freezeTableName', function () {
      const User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true });
      expect(User.tableName).to.equal('FrozenUser');
    });

    it('uses the pluralized dao name as tablename unless freezeTableName', function () {
      const User = this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      expect(User.tableName).to.equal('SuperUsers');
    });

    it('uses checks to make sure dao factory is not leaking on multiple define', function () {
      this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      const factorySize = this.sequelize.modelManager.all.length;

      this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      const factorySize2 = this.sequelize.modelManager.all.length;

      expect(factorySize).to.equal(factorySize2);
    });

    it('allows us to predefine the ID column with our own specs', async function () {
      const User = this.sequelize.define('UserCol', {
        id: {
          type: DataTypes.STRING,
          defaultValue: 'User',
          primaryKey: true,
        },
      });

      await User.sync({ force: true });
      expect(await User.create({ id: 'My own ID!' })).to.have.property('id', 'My own ID!');
    });

    it('throws an error if a custom model-wide validation is not a function', function () {
      expect(() => {
        this.sequelize.define('Foo', {
          field: DataTypes.INTEGER,
        }, {
          validate: {
            notFunction: 33,
          },
        });
      }).to.throw(Error, 'Members of the validate option must be functions. Model: Foo, error with validate member notFunction');
    });

    it('should allow me to set a default value for createdAt and updatedAt', async function () {
      const UserTable = this.sequelize.define('UserCol', {
        aNumber: DataTypes.INTEGER,
        createdAt: {
          defaultValue: dayjs('2012-01-01').toDate(),
        },
        updatedAt: {
          defaultValue: dayjs('2012-01-02').toDate(),
        },
      }, { timestamps: true });

      await UserTable.sync({ force: true });
      const user = await UserTable.create({ aNumber: 5 });
      await UserTable.bulkCreate([{ aNumber: 10 }, { aNumber: 12 }]);
      const users = await UserTable.findAll({ where: { aNumber: { [Op.gte]: 10 } } });
      expect(dayjs(user.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
      expect(dayjs(user.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
      for (const u of users) {
        expect(dayjs(u.createdAt).format('YYYY-MM-DD')).to.equal('2012-01-01');
        expect(dayjs(u.updatedAt).format('YYYY-MM-DD')).to.equal('2012-01-02');
      }
    });

    it('should allow me to set a function as default value', async function () {
      const defaultFunction = sinon.stub().returns(5);
      const UserTable = this.sequelize.define('UserCol', {
        aNumber: {
          type: DataTypes.INTEGER,
          defaultValue: defaultFunction,
        },
      }, { timestamps: true });

      await UserTable.sync({ force: true });
      const user = await UserTable.create();
      const user2 = await UserTable.create();
      expect(user.aNumber).to.equal(5);
      expect(user2.aNumber).to.equal(5);
      expect(defaultFunction.callCount).to.equal(2);
    });

    it('should throw `TypeError` when value for updatedAt, createdAt, or deletedAt is neither string nor boolean', async function () {
      const modelName = 'UserCol';
      const attributes = { aNumber: DataTypes.INTEGER };

      expect(() => {
        this.sequelize.define(modelName, attributes, { timestamps: true, updatedAt: {} });
      }).to.throw(Error, 'Value for "updatedAt" option must be a string or a boolean, got object');
      expect(() => {
        this.sequelize.define(modelName, attributes, { timestamps: true, createdAt: 100 });
      }).to.throw(Error, 'Value for "createdAt" option must be a string or a boolean, got number');
      expect(() => {
        this.sequelize.define(modelName, attributes, { timestamps: true, deletedAt: () => {} });
      }).to.throw(Error, 'Value for "deletedAt" option must be a string or a boolean, got function');
    });

    it('should allow me to use `true` as a value for updatedAt, createdAt, and deletedAt fields', async function () {
      const UserTable = this.sequelize.define(
        'UserCol',
        {
          aNumber: DataTypes.INTEGER,
        },
        {
          timestamps: true,
          updatedAt: true,
          createdAt: true,
          deletedAt: true,
          paranoid: true,
        },
      );

      await UserTable.sync({ force: true });
      const user = await UserTable.create({ aNumber: 4 });
      expect(user.true).to.not.exist;
      expect(user.updatedAt).to.exist;
      expect(user.createdAt).to.exist;
      await user.destroy();
      await user.reload({ paranoid: false });
      expect(user.deletedAt).to.exist;
    });

    it('should allow me to override updatedAt, createdAt, and deletedAt fields', async function () {
      const UserTable = this.sequelize.define('UserCol', {
        aNumber: DataTypes.INTEGER,
      }, {
        timestamps: true,
        updatedAt: 'updatedOn',
        createdAt: 'dateCreated',
        deletedAt: 'deletedAtThisTime',
        paranoid: true,
      });

      await UserTable.sync({ force: true });
      const user = await UserTable.create({ aNumber: 4 });
      expect(user.updatedOn).to.exist;
      expect(user.dateCreated).to.exist;
      await user.destroy();
      await user.reload({ paranoid: false });
      expect(user.deletedAtThisTime).to.exist;
    });

    it('should allow me to disable some of the timestamp fields', async function () {
      const UpdatingUser = this.sequelize.define('UpdatingUser', {
        name: DataTypes.STRING,
      }, {
        timestamps: true,
        updatedAt: false,
        createdAt: false,
        deletedAt: 'deletedAtThisTime',
        paranoid: true,
      });

      await UpdatingUser.sync({ force: true });
      let user = await UpdatingUser.create({ name: 'heyo' });
      expect(user.createdAt).not.to.exist;
      expect(user.false).not.to.exist; // because, you know we might accidentally add a field named 'false'
      user.name = 'heho';
      user = await user.save();
      expect(user.updatedAt).not.to.exist;
      await user.destroy();
      await user.reload({ paranoid: false });
      expect(user.deletedAtThisTime).to.exist;
    });

    it('should work with both paranoid and underscored being true', async function () {
      const UserTable = this.sequelize.define('UserCol', {
        aNumber: DataTypes.INTEGER,
      }, {
        paranoid: true,
        underscored: true,
      });

      await UserTable.sync({ force: true });
      await UserTable.create({ aNumber: 30 });
      expect(await UserTable.count()).to.equal(1);
    });

    it('allows unique on column with field aliases', async function () {
      const User = this.sequelize.define('UserWithUniqueFieldAlias', {
        userName: { type: DataTypes.STRING, unique: 'user_name_unique', field: 'user_name' },
      });

      await User.sync({ force: true });
      const indexes = (await this.sequelize.queryInterface.showIndex(User.getTableName()))
        .filter(index => !index.primary);

      expect(indexes).to.have.length(1);
      const index = indexes[0];
      expect(index.primary).to.equal(false);
      expect(index.unique).to.equal(true);
      expect(index.name).to.equal('user_name_unique');

      switch (dialectName) {
        case 'mariadb':
        case 'mysql': {
          expect(index.fields).to.deep.equal([{ attribute: 'user_name', length: undefined, order: 'ASC' }]);
          expect(index.type).to.equal('BTREE');

          break;
        }

        case 'postgres': {
          expect(index.fields).to.deep.equal([{ attribute: 'user_name', collate: undefined, order: undefined, length: undefined }]);

          break;
        }

        case 'db2':
        case 'mssql': {
          expect(index.fields).to.deep.equal([{ attribute: 'user_name', collate: undefined, length: undefined, order: 'ASC' }]);

          break;
        }

        case 'sqlite':
        default: {
          expect(index.fields).to.deep.equal([{ attribute: 'user_name', length: undefined, order: undefined }]);

          break;
        }
      }
    });

    if (dialectName !== 'ibmi') {
      it('allows us to customize the error message for unique constraint', async function () {
        const User = this.sequelize.define('UserWithUniqueUsername', {
          username: { type: DataTypes.STRING, unique: { name: 'user_and_email', msg: 'User and email must be unique' } },
          email: { type: DataTypes.STRING, unique: 'user_and_email' },
        });

        await User.sync({ force: true });

        try {
          await Promise.all([
            User.create({ username: 'tobi', email: 'tobi@tobi.me' }),
            User.create({ username: 'tobi', email: 'tobi@tobi.me' }),
          ]);
        } catch (error) {
          if (!(error instanceof Sequelize.UniqueConstraintError)) {
            throw error;
          }

          expect(error.message).to.equal('User and email must be unique');
        }
      });

      // If you use migrations to create unique indexes that have explicit names and/or contain fields
      // that have underscore in their name. Then sequelize must use the index name to map the custom message to the error thrown from db.
      it('allows us to map the customized error message with unique constraint name', async function () {
        // Fake migration style index creation with explicit index definition
        let User = this.sequelize.define('UserWithUniqueUsername', {
          user_id: { type: DataTypes.INTEGER },
          email: { type: DataTypes.STRING },
        }, {
          indexes: [
            {
              name: 'user_and_email_index',
              msg: 'User and email must be unique',
              unique: true,
              method: 'BTREE',
              fields: ['user_id', { attribute: 'email', collate: dialectName === 'sqlite' ? 'RTRIM' : 'en_US', order: 'DESC', length: 5 }],
            }],
        });

        await User.sync({ force: true });

        // Redefine the model to use the index in database and override error message
        User = this.sequelize.define('UserWithUniqueUsername', {
          user_id: { type: DataTypes.INTEGER, unique: { name: 'user_and_email_index', msg: 'User and email must be unique' } },
          email: { type: DataTypes.STRING, unique: 'user_and_email_index' },
        });

        try {
          await Promise.all([
            User.create({ user_id: 1, email: 'tobi@tobi.me' }),
            User.create({ user_id: 1, email: 'tobi@tobi.me' }),
          ]);
        } catch (error) {
          if (!(error instanceof Sequelize.UniqueConstraintError)) {
            throw error;
          }

          expect(error.message).to.equal('User and email must be unique');
        }
      });
    }

    describe('descending indices (MySQL 8 specific)', () => {
      it('complains about missing support for descending indexes', async function () {
        if (!isMySQL8) {
          return;
        }

        const indices = [{
          name: 'a_b_uniq',
          unique: true,
          method: 'BTREE',
          fields: [
            'fieldB',
            {
              attribute: 'fieldA',
              collate: 'en_US',
              order: 'DESC',
              length: 5,
            },
          ],
        }];

        this.sequelize.define('model', {
          fieldA: DataTypes.STRING,
          fieldB: DataTypes.INTEGER,
          fieldC: DataTypes.STRING,
          fieldD: DataTypes.STRING,
        }, {
          indexes: indices,
          engine: 'MyISAM',
        });

        try {
          await this.sequelize.sync();
          expect.fail();
        } catch (error) {
          expect(error.message).to.include('The storage engine for the table doesn\'t support descending indexes');
        }
      });

      it('works fine with InnoDB', async function () {
        if (!isMySQL8) {
          return;
        }

        const indices = [{
          name: 'a_b_uniq',
          unique: true,
          method: 'BTREE',
          fields: [
            'fieldB',
            {
              attribute: 'fieldA',
              collate: 'en_US',
              order: 'DESC',
              length: 5,
            },
          ],
        }];

        this.sequelize.define('model', {
          fieldA: DataTypes.STRING,
          fieldB: DataTypes.INTEGER,
          fieldC: DataTypes.STRING,
          fieldD: DataTypes.STRING,
        }, {
          indexes: indices,
          engine: 'InnoDB',
        });

        await this.sequelize.sync();
      });
    });

    it('should allow the user to specify indexes in options', async function () {
      const indices = [{
        name: 'a_b_uniq',
        unique: true,
        method: 'BTREE',
        fields: [
          'fieldB',
          {
            attribute: 'fieldA',
            collate: dialectName === 'sqlite' ? 'RTRIM' : 'en_US',
            order: dialectName === 'ibmi' ? ''
              // MySQL doesn't support DESC indexes (will throw)
              // MariaDB doesn't support DESC indexes (will silently replace it with ASC)
              : (dialectName === 'mysql' || dialectName === 'mariadb') ? 'ASC'
              : `DESC`,
            length: 5,
          },
        ],
      }];

      if (!['mssql', 'db2', 'ibmi'].includes(dialectName)) {
        indices.push({
          type: 'FULLTEXT',
          fields: ['fieldC'],
          concurrently: true,
        }, {
          type: 'FULLTEXT',
          fields: ['fieldD'],
        });
      }

      const Model = this.sequelize.define('model', {
        fieldA: DataTypes.STRING,
        fieldB: DataTypes.INTEGER,
        fieldC: DataTypes.STRING,
        fieldD: DataTypes.STRING,
      }, {
        indexes: indices,
        engine: 'MyISAM',
      });

      await this.sequelize.sync();
      await this.sequelize.sync(); // The second call should not try to create the indices again
      const args = await this.sequelize.queryInterface.showIndex(Model.tableName);
      let primary;
      let idx1;
      let idx2;
      let idx3;

      switch (dialectName) {
        case 'sqlite': {
          // PRAGMA index_info does not return the primary index
          idx1 = args[0];
          idx2 = args[1];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined },
            { attribute: 'fieldA', length: undefined, order: undefined },
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined },
          ]);

          break;
        }

        case 'db2': {
          idx1 = args[1];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC', collate: undefined },
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: undefined },
          ]);

          break;
        }

        case 'ibmi': {
          idx1 = args[0];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldA', length: undefined, order: undefined, collate: undefined },
            { attribute: 'fieldB', length: undefined, order: undefined, collate: undefined },
          ]);

          break;
        }

        case 'mssql': {
          idx1 = args[0];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC', collate: undefined },
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: undefined },
          ]);

          break;
        }

        case 'postgres': {
          // Postgres returns indexes in alphabetical order
          primary = args[2];
          idx1 = args[0];
          idx2 = args[1];
          idx3 = args[2];

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: undefined, collate: undefined },
            { attribute: 'fieldA', length: undefined, order: 'DESC', collate: 'en_US' },
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: undefined, collate: undefined },
          ]);

          expect(idx3.fields).to.deep.equal([
            { attribute: 'fieldD', length: undefined, order: undefined, collate: undefined },
          ]);

          break;
        }

        default: {
          // And finally mysql returns the primary first, and then the rest in the order they were defined
          primary = args[0];
          idx1 = args[1];
          idx2 = args[2];

          expect(primary.primary).to.be.ok;

          expect(idx1.type).to.equal('BTREE');
          expect(idx2.type).to.equal('FULLTEXT');

          expect(idx1.fields).to.deep.equal([
            { attribute: 'fieldB', length: undefined, order: 'ASC' },
            // length is a bigint, which is why it's returned as a string
            {
              attribute: 'fieldA',
              length: '5',
              // mysql & mariadb don't support DESC indexes
              order: 'ASC',
            },
          ]);

          expect(idx2.fields).to.deep.equal([
            { attribute: 'fieldC', length: undefined, order: null },
          ]);
        }
      }

      expect(idx1.name).to.equal('a_b_uniq');
      expect(idx1.unique).to.be.ok;

      if (!['mssql', 'db2', 'ibmi'].includes(dialectName)) {
        expect(idx2.name).to.equal('models_field_c');
        expect(idx2.unique).not.to.be.ok;
      }
    });
  });

  describe('build', () => {
    it('doesn\'t create database entries', async function () {
      this.User.build({ username: 'John Wayne' });
      expect(await this.User.findAll()).to.have.length(0);
    });

    it('fills the objects with default values', function () {
      const Task = this.sequelize.define('TaskBuild', {
        title: { type: DataTypes.STRING, defaultValue: 'a task!' },
        foo: { type: DataTypes.INTEGER, defaultValue: 2 },
        bar: { type: DataTypes.DATE },
        foobar: { type: DataTypes.TEXT, defaultValue: 'asd' },
        flag: { type: DataTypes.BOOLEAN, defaultValue: false },
      });

      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('fills the objects with default values', function () {
      const Task = this.sequelize.define('TaskBuild', {
        title: { type: DataTypes.STRING, defaultValue: 'a task!' },
        foo: { type: DataTypes.INTEGER, defaultValue: 2 },
        bar: { type: DataTypes.DATE },
        foobar: { type: DataTypes.TEXT, defaultValue: 'asd' },
        flag: { type: DataTypes.BOOLEAN, defaultValue: false },
      }, { timestamps: false });
      expect(Task.build().title).to.equal('a task!');
      expect(Task.build().foo).to.equal(2);
      expect(Task.build().bar).to.not.be.ok;
      expect(Task.build().foobar).to.equal('asd');
      expect(Task.build().flag).to.be.false;
    });

    it('attaches getter and setter methods from attribute definition', function () {
      const Product = this.sequelize.define('ProductWithSettersAndGetters1', {
        price: {
          type: DataTypes.INTEGER,
          get() {
            return `answer = ${this.getDataValue('price')}`;
          },
          set(v) {
            return this.setDataValue('price', v + 42);
          },
        },
      });

      expect(Product.build({ price: 42 }).price).to.equal('answer = 84');

      const p = Product.build({ price: 1 });
      expect(p.price).to.equal('answer = 43');

      p.price = 0;
      expect(p.price).to.equal('answer = 42');
    });

    describe('include', () => {
      it('should support basic includes', function () {
        const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
        });
        const Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING,
        });
        const User = this.sequelize.define('User', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING,
        });

        Product.hasMany(Tag);
        Product.belongsTo(User);

        const product = Product.build({
          id: 1,
          title: 'Chair',
          Tags: [
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'Beta' },
          ],
          User: {
            id: 1,
            first_name: 'Mick',
            last_name: 'Hansen',
          },
        }, {
          include: [
            User,
            Tag,
          ],
        });

        expect(product.Tags).to.be.ok;
        expect(product.Tags.length).to.equal(2);
        expect(product.Tags[0]).to.be.instanceof(Tag);
        expect(product.User).to.be.ok;
        expect(product.User).to.be.instanceof(User);
      });

      it('should support includes with aliases', function () {
        const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
        });
        const Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING,
        });
        const User = this.sequelize.define('User', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING,
        });

        Product.hasMany(Tag, { as: 'categories' });
        Product.belongsToMany(User, { as: 'followers', through: 'product_followers' });
        User.belongsToMany(Product, { as: 'following', through: 'product_followers' });

        const product = Product.build({
          id: 1,
          title: 'Chair',
          categories: [
            { id: 1, name: 'Alpha' },
            { id: 2, name: 'Beta' },
            { id: 3, name: 'Charlie' },
            { id: 4, name: 'Delta' },
          ],
          followers: [
            {
              id: 1,
              first_name: 'Mick',
              last_name: 'Hansen',
            },
            {
              id: 2,
              first_name: 'Jan',
              last_name: 'Meier',
            },
          ],
        }, {
          include: [
            { model: User, as: 'followers' },
            { model: Tag, as: 'categories' },
          ],
        });

        expect(product.categories).to.be.ok;
        expect(product.categories.length).to.equal(4);
        expect(product.categories[0]).to.be.instanceof(Tag);
        expect(product.followers).to.be.ok;
        expect(product.followers.length).to.equal(2);
        expect(product.followers[0]).to.be.instanceof(User);
      });
    });
  });

  describe('findOne', () => {
    if (current.dialect.supports.transactions) {
      it('supports the transaction option in the first parameter', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', {
          username: DataTypes.STRING,
          foo: DataTypes.STRING,
        });
        await User.sync({ force: true });
        const t = await sequelize.startUnmanagedTransaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const user = await User.findOne({ where: { username: 'foo' }, transaction: t });
        expect(user).to.not.be.null;
        await t.rollback();
      });
    }

    it('should not fail if model is paranoid and where is an empty array', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }, { paranoid: true });

      await User.sync({ force: true });
      await User.create({ username: 'A fancy name' });
      expect((await User.findOne({ where: [] })).username).to.equal('A fancy name');
    });

    it('should work if model is paranoid and only operator in where clause is a Symbol (#8406)', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }, { paranoid: true });

      await User.sync({ force: true });
      await User.create({ username: 'foo' });
      expect(await User.findOne({
        where: {
          [Op.or]: [
            { username: 'bar' },
            { username: 'baz' },
          ],
        },
      })).to.not.be.ok;
    });
  });

  describe('findOrBuild', () => {

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: DataTypes.STRING, foo: DataTypes.STRING });

        await User.sync({ force: true });
        const t = await sequelize.startUnmanagedTransaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const [user1] = await User.findOrBuild({
          where: { username: 'foo' },
        });
        const [user2] = await User.findOrBuild({
          where: { username: 'foo' },
          transaction: t,
        });
        const [user3] = await User.findOrBuild({
          where: { username: 'foo' },
          defaults: { foo: 'asd' },
          transaction: t,
        });
        expect(user1.isNewRecord).to.be.true;
        expect(user2.isNewRecord).to.be.false;
        expect(user3.isNewRecord).to.be.false;
        await t.commit();
      });
    }

    describe('returns an instance if it already exists', () => {
      it('with a single find field', async function () {
        const user = await this.User.create({ username: 'Username' });
        const [_user, initialized] = await this.User.findOrBuild({
          where: { username: user.username },
        });
        expect(_user.id).to.equal(user.id);
        expect(_user.username).to.equal('Username');
        expect(initialized).to.be.false;
      });

      it('with multiple find fields', async function () {
        const user = await this.User.create({ username: 'Username', data: 'data' });
        const [_user, initialized] = await this.User.findOrBuild({
          where: {
            username: user.username,
            data: user.data,
          },
        });
        expect(_user.id).to.equal(user.id);
        expect(_user.username).to.equal('Username');
        expect(_user.data).to.equal('data');
        expect(initialized).to.be.false;
      });

      it('builds a new instance with default value.', async function () {
        const [user, initialized] = await this.User.findOrBuild({
          where: { username: 'Username' },
          defaults: { data: 'ThisIsData' },
        });
        expect(user.id).to.be.null;
        expect(user.username).to.equal('Username');
        expect(user.data).to.equal('ThisIsData');
        expect(initialized).to.be.true;
        expect(user.isNewRecord).to.be.true;
      });
    });
  });

  describe('save', () => {
    it('should map the correct fields when saving instance (#10589)', async function () {
      const User = this.sequelize.define('User', {
        id3: {
          field: 'id',
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        id: {
          field: 'id2',
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        id2: {
          field: 'id3',
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });

      await this.sequelize.sync({ force: true });
      await User.create({ id3: 94, id: 87, id2: 943 });
      const user = await User.findByPk(94);
      await user.set('id2', 8877);
      await user.save({ id2: 8877 });
      expect((await User.findByPk(94)).id2).to.equal(8877);
    });
  });

  describe('update', () => {
    it('throws an error if no where clause is given', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      await this.sequelize.sync({ force: true });
      try {
        await User.update();
        throw new Error('Update should throw an error if no where clause is given.');
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect(error.message).to.equal('Missing where attribute in the options parameter');
      }
    });

    it('should map the correct fields when updating instance (#10589)', async function () {
      const User = this.sequelize.define('User', {
        id3: {
          field: 'id',
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
        id: {
          field: 'id2',
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        id2: {
          field: 'id3',
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });

      await this.sequelize.sync({ force: true });
      await User.create({ id3: 94, id: 87, id2: 943 });
      const user = await User.findByPk(94);
      await user.update({ id2: 8877 });
      expect((await User.findByPk(94)).id2).to.equal(8877);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: DataTypes.STRING });

        await User.sync({ force: true });
        await User.create({ username: 'foo' });

        const t = await sequelize.startUnmanagedTransaction();
        await User.update({ username: 'bar' }, {
          where: { username: 'foo' },
          transaction: t,
        });
        const users1 = await User.findAll();
        const users2 = await User.findAll({ transaction: t });
        expect(users1[0].username).to.equal('foo');
        expect(users2[0].username).to.equal('bar');
        await t.rollback();
      });
    }

    it('updates the attributes that we select only without updating createdAt', async function () {
      const User = this.sequelize.define('User1', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
      }, {
        paranoid: true,
        tableName: 'users1',
      });

      let test = false;
      await User.sync({ force: true });
      const user = await User.create({ username: 'Peter', secretValue: '42' });
      await user.update({ secretValue: '43' }, {
        fields: ['secretValue'],
        logging(sql) {
          test = true;

          expect(sql).to.match(/^Executing \(default\): /);
          sql = sql.slice(21);

          expectsql(sql, {
            default: `UPDATE [users1] SET [secretValue]=$sequelize_1,[updatedAt]=$sequelize_2 WHERE [id] = $sequelize_3`,
            postgres: `UPDATE "users1" SET "secretValue"=$1,"updatedAt"=$2 WHERE "id" = $3 RETURNING *`,
            mysql: 'UPDATE `users1` SET `secretValue`=?,`updatedAt`=? WHERE `id` = ?',
            mariadb: 'UPDATE `users1` SET `secretValue`=?,`updatedAt`=? WHERE `id` = ?',
            mssql: `UPDATE [users1] SET [secretValue]=@sequelize_1,[updatedAt]=@sequelize_2 OUTPUT INSERTED.* WHERE [id] = @sequelize_3`,
            db2: `SELECT * FROM FINAL TABLE (UPDATE "users1" SET "secretValue"=?,"updatedAt"=? WHERE "id" = ?);`,
            ibmi: `UPDATE "users1" SET "secretValue"=?,"updatedAt"=? WHERE "id" = ?;`,
          });
        },
        returning: [col('*')],
      });
      expect(test).to.be.true;
    });

    it('allows sql logging of updated statements', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
      }, {
        paranoid: true,
      });
      let test = false;
      await User.sync({ force: true });
      const u = await User.create({ name: 'meg', bio: 'none' });
      expect(u).to.exist;
      await u.update({ name: 'brian' }, {
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase()).to.include('UPDATE');
        },
      });
      expect(test).to.be.true;
    });

    it('updates only values that match filter', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      await this.User.update({ username: 'Bill' }, { where: { secretValue: '42' } });
      const users = await this.User.findAll({ order: ['id'] });
      expect(users).to.have.lengthOf(3);

      for (const user of users) {
        if (user.secretValue === '42') {
          expect(user.username).to.equal('Bill');
        } else {
          expect(user.username).to.equal('Bob');
        }
      }
    });

    it('throws an error if where has a key with undefined value', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      try {
        await this.User.update({ username: 'Bill' }, {
          where: {
            secretValue: '42',
            username: undefined,
          },
        });
        throw new Error('Update should throw an error if where has a key with undefined value');
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect(error.message).to.equal('WHERE parameter "username" has invalid "undefined" value');
      }
    });

    it('updates only values that match the allowed fields', async function () {
      const data = [{ username: 'Peter', secretValue: '42' }];

      await this.User.bulkCreate(data);
      await this.User.update({ username: 'Bill', secretValue: '43' }, { where: { secretValue: '42' }, fields: ['username'] });
      const users = await this.User.findAll({ order: ['id'] });
      expect(users).to.have.lengthOf(1);
      expect(users[0].username).to.equal('Bill');
      expect(users[0].secretValue).to.equal('42');
    });

    it('updates with casting', async function () {
      await this.User.create({ username: 'John' });
      await this.User.update({
        username: this.sequelize.cast('1', dialectName === 'mssql' ? 'nvarchar' : 'char'),
      }, {
        where: { username: 'John' },
      });
      expect((await this.User.findOne()).username).to.equal('1');
    });

    it('updates with function and column value', async function () {
      await this.User.create({ username: 'John' });
      await this.User.update({
        username: this.sequelize.fn('upper', this.sequelize.col('username')),
      }, {
        where: { username: 'John' },
      });
      expect((await this.User.findOne()).username).to.equal('JOHN');
    });

    it('does not update virtual attributes', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        virtual: DataTypes.VIRTUAL,
      });

      await User.create({ username: 'jan' });
      await User.update({
        username: 'kurt',
        virtual: 'test',
      }, {
        where: {
          username: 'jan',
        },
      });
      const user = await User.findOne();
      expect(user.username).to.equal('kurt');
      expect(user.virtual).to.not.equal('test');
    });

    it('doesn\'t update attributes that are altered by virtual setters when option is enabled', async function () {
      const User = this.sequelize.define('UserWithVirtualSetters', {
        username: DataTypes.STRING,
        illness_name: DataTypes.STRING,
        illness_pain: DataTypes.INTEGER,
        illness: {
          type: DataTypes.VIRTUAL,
          set(value) {
            this.set('illness_name', value.name);
            this.set('illness_pain', value.pain);
          },
        },
      });

      await User.sync({ force: true });
      await User.create({
        username: 'Jan',
        illness_name: 'Headache',
        illness_pain: 5,
      });
      await User.update({
        illness: { pain: 10, name: 'Backache' },
      }, {
        where: {
          username: 'Jan',
        },
        sideEffects: false,
      });
      expect((await User.findOne()).illness_pain).to.be.equal(5);
    });

    it('updates attributes that are altered by virtual setters', async function () {
      const User = this.sequelize.define('UserWithVirtualSetters', {
        username: DataTypes.STRING,
        illness_name: DataTypes.STRING,
        illness_pain: DataTypes.INTEGER,
        illness: {
          type: DataTypes.VIRTUAL,
          set(value) {
            this.set('illness_name', value.name);
            this.set('illness_pain', value.pain);
          },
        },
      });

      await User.sync({ force: true });
      await User.create({
        username: 'Jan',
        illness_name: 'Headache',
        illness_pain: 5,
      });
      await User.update({
        illness: { pain: 10, name: 'Backache' },
      }, {
        where: {
          username: 'Jan',
        },
      });
      expect((await User.findOne()).illness_pain).to.be.equal(10);
    });

    it('should properly set data when individualHooks are true', async function () {
      this.User.beforeUpdate(instance => {
        instance.set('intVal', 1);
      });

      const user = await this.User.create({ username: 'Peter' });
      await this.User.update({ data: 'test' }, {
        where: { id: user.id },
        individualHooks: true,
      });
      expect((await this.User.findByPk(user.id)).intVal).to.be.equal(1);
    });

    it('sets updatedAt to the current timestamp', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      let users = await this.User.findAll({ order: ['id'] });
      this.updatedAt = users[0].updatedAt;

      expect(this.updatedAt).to.be.ok;
      expect(this.updatedAt).to.equalTime(users[2].updatedAt); // All users should have the same updatedAt

      // Pass the time so we can actually see a change
      this.clock.tick(1000);
      await this.User.update({ username: 'Bill' }, { where: { secretValue: '42' } });

      users = await this.User.findAll({ order: ['id'] });
      expect(users[0].username).to.equal('Bill');
      expect(users[1].username).to.equal('Bill');
      expect(users[2].username).to.equal('Bob');

      expect(users[0].updatedAt).to.be.afterTime(this.updatedAt);
      expect(users[2].updatedAt).to.equalTime(this.updatedAt);
    });

    it('returns the number of affected rows', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      let [affectedRows] = await this.User.update({ username: 'Bill' }, { where: { secretValue: '42' } });
      expect(affectedRows).to.equal(2);
      [affectedRows] = await this.User.update({ username: 'Bill' }, { where: { secretValue: '44' } });
      expect(affectedRows).to.equal(0);
    });

    it('does not update soft deleted records when model is paranoid', async function () {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
      }, { paranoid: true });

      await this.sequelize.sync({ force: true });
      await ParanoidUser.bulkCreate([
        { username: 'user1' },
        { username: 'user2' },
      ]);
      await ParanoidUser.destroy({
        where: { username: 'user1' },
      });
      await ParanoidUser.update({ username: 'foo' }, { where: {} });
      const users = await ParanoidUser.findAll({
        paranoid: false,
        where: {
          username: 'foo',
        },
      });
      expect(users).to.have.lengthOf(1, 'should not update soft-deleted record');
    });

    it('updates soft deleted records when paranoid is overridden', async function () {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
      }, { paranoid: true });

      await this.sequelize.sync({ force: true });
      await ParanoidUser.bulkCreate([
        { username: 'user1' },
        { username: 'user2' },
      ]);
      await ParanoidUser.destroy({ where: { username: 'user1' } });
      await ParanoidUser.update({ username: 'foo' }, {
        where: {},
        paranoid: false,
      });
      const users = await ParanoidUser.findAll({
        paranoid: false,
        where: {
          username: 'foo',
        },
      });
      expect(users).to.have.lengthOf(2);
    });

    it('calls update hook for soft deleted objects', async function () {
      const hookSpy = sinon.spy();
      const User = this.sequelize.define('User',
        { username: DataTypes.STRING },
        { paranoid: true, hooks: { beforeUpdate: hookSpy } });

      await this.sequelize.sync({ force: true });
      await User.bulkCreate([{ username: 'user1' }]);
      await User.destroy({
        where: {
          username: 'user1',
        },
      });
      await User.update({ username: 'updUser1' }, {
        paranoid: false,
        where: { username: 'user1' },
        individualHooks: true,
      });
      const user = await User.findOne({ where: { username: 'updUser1' }, paranoid: false });
      expect(user).to.not.be.null;
      expect(user.username).to.eq('updUser1');
      expect(hookSpy).to.have.been.called;
    });

    if (dialectName === 'postgres') {
      it('returns the affected rows if `options.returning` is true', async function () {
        const data = [
          { username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' },
        ];

        await this.User.bulkCreate(data);
        let [count, rows] = await this.User.update({ username: 'Bill' }, {
          where: { secretValue: '42' },
          returning: true,
        });
        expect(count).to.equal(2);
        expect(rows).to.have.length(2);
        [count, rows] = await this.User.update({ username: 'Bill' }, {
          where: { secretValue: '44' },
          returning: true,
        });
        expect(count).to.equal(0);
        expect(rows).to.have.length(0);
      });
    }

    if (dialectName === 'mysql') {
      it('supports limit clause', async function () {
        const data = [
          { username: 'Peter', secretValue: '42' },
          { username: 'Peter', secretValue: '42' },
          { username: 'Peter', secretValue: '42' },
        ];

        await this.User.bulkCreate(data);
        const [affectedRows] = await this.User.update({ secretValue: '43' }, {
          where: { username: 'Peter' },
          limit: 1,
        });
        expect(affectedRows).to.equal(1);
      });
    }

  });

  describe('destroy', () => {
    it('`truncate` method should clear the table', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await this.sequelize.sync({ force: true });
      await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      await User.truncate();
      expect(await User.findAll()).to.have.lengthOf(0);
    });

    it('`truncate` option should clear the table', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await this.sequelize.sync({ force: true });
      await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      await User.destroy({ truncate: true });
      expect(await User.findAll()).to.have.lengthOf(0);
    });

    it('`truncate` option returns a number', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await this.sequelize.sync({ force: true });
      await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      const affectedRows = await User.destroy({ truncate: true });
      expect(await User.findAll()).to.have.lengthOf(0);
      expect(affectedRows).to.be.a('number');
    });

    it('throws an error if no where clause is given', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await this.sequelize.sync({ force: true });
      try {
        await User.destroy();
        throw new Error('Destroy should throw an error if no where clause is given.');
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect(error.message).to.equal('Missing where or truncate attribute in the options parameter of model.destroy.');
      }
    });

    it('deletes all instances when given an empty where object', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      await this.sequelize.sync({ force: true });
      await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      const affectedRows = await User.destroy({ where: {} });
      expect(affectedRows).to.equal(2);
      expect(await User.findAll()).to.have.lengthOf(0);
    });

    it('throws an error if where has a key with undefined value', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      await this.sequelize.sync({ force: true });
      try {
        await User.destroy({ where: { username: undefined } });
        throw new Error('Destroy should throw an error if where has a key with undefined value');
      } catch (error) {
        expect(error).to.be.an.instanceof(Error);
        expect(error.message).to.equal('WHERE parameter "username" has invalid "undefined" value');
      }
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: DataTypes.STRING });

        await User.sync({ force: true });
        await User.create({ username: 'foo' });
        const t = await sequelize.startUnmanagedTransaction();
        await User.destroy({
          where: {},
          transaction: t,
        });
        const count1 = await User.count();
        const count2 = await User.count({ transaction: t });
        expect(count1).to.equal(1);
        expect(count2).to.equal(0);
        await t.rollback();
      });
    }

    it('deletes values that match filter', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      await this.User.destroy({ where: { secretValue: '42' } });
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('Bob');
    });

    it('works without a primary key', async function () {
      const Log = this.sequelize.define('Log', {
        client_id: DataTypes.INTEGER,
        content: DataTypes.TEXT,
        timestamp: DataTypes.DATE,
      });
      Log.removeAttribute('id');

      await Log.sync({ force: true });
      await Log.create({
        client_id: 13,
        content: 'Error!',
        timestamp: new Date(),
      });
      await Log.destroy({
        where: {
          client_id: 13,
        },
      });
      expect(await Log.findAll()).to.have.lengthOf(0);
    });

    it('supports .field', async function () {
      const UserProject = this.sequelize.define('UserProject', {
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id',
        },
      });

      await UserProject.sync({ force: true });
      await UserProject.create({ userId: 10 });
      await UserProject.destroy({ where: { userId: 10 } });
      expect(await UserProject.findAll()).to.have.lengthOf(0);
    });

    it('sets deletedAt to the current timestamp if paranoid is true', async function () {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
        data: DataTypes.STRING,
        intVal: { type: DataTypes.INTEGER, defaultValue: 1 },
      }, { paranoid: true });
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await ParanoidUser.sync({ force: true });
      await ParanoidUser.bulkCreate(data);

      // since we save in UTC, let's format to UTC time
      const date = dayjs().utc().format('YYYY-MM-DD h:mm');
      await ParanoidUser.destroy({ where: { secretValue: '42' } });

      let users = await ParanoidUser.findAll({ order: ['id'] });
      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('Bob');

      const queryGenerator = this.sequelize.queryInterface.queryGenerator;
      const qi = queryGenerator.quoteIdentifier.bind(queryGenerator);
      const query = `SELECT * FROM ${qi('ParanoidUsers')} WHERE ${qi('deletedAt')} IS NOT NULL ORDER BY ${qi('id')}`;
      [users] = await this.sequelize.query(query);

      expect(users[0].username).to.equal('Peter');
      expect(users[1].username).to.equal('Paul');

      const formatDate = val => dayjs(val).utc().format('YYYY-MM-DD h:mm');

      expect(formatDate(users[0].deletedAt)).to.equal(date);
      expect(formatDate(users[1].deletedAt)).to.equal(date);
    });

    it('does not set deletedAt for previously destroyed instances if paranoid is true', async function () {
      const User = this.sequelize.define('UserCol', {
        secretValue: DataTypes.STRING,
        username: DataTypes.STRING,
      }, { paranoid: true });

      await User.sync({ force: true });
      await User.bulkCreate([
        { username: 'Toni', secretValue: '42' },
        { username: 'Tobi', secretValue: '42' },
        { username: 'Max', secretValue: '42' },
      ]);
      const user = await User.findByPk(1);
      await user.destroy();
      await user.reload({ paranoid: false });
      const deletedAt = user.deletedAt;
      await User.destroy({ where: { secretValue: '42' } });
      await user.reload({ paranoid: false });
      expect(user.deletedAt).to.eql(deletedAt);
    });

    describe('can\'t find records marked as deleted with paranoid being true', () => {
      it('with the DAOFactory', async function () {
        const User = this.sequelize.define('UserCol', {
          username: DataTypes.STRING,
        }, { paranoid: true });

        await User.sync({ force: true });
        await User.bulkCreate([
          { username: 'Toni' },
          { username: 'Tobi' },
          { username: 'Max' },
        ]);
        const user = await User.findByPk(1);
        await user.destroy();
        expect(await User.findByPk(1)).to.be.null;
        expect(await User.count()).to.equal(2);
        expect(await User.findAll()).to.have.length(2);
      });
    });

    describe('can find paranoid records if paranoid is marked as false in query', () => {
      it('with the DAOFactory', async function () {
        const User = this.sequelize.define('UserCol', {
          username: DataTypes.STRING,
        }, { paranoid: true });

        await User.sync({ force: true });
        await User.bulkCreate([
          { username: 'Toni' },
          { username: 'Tobi' },
          { username: 'Max' },
        ]);
        const user = await User.findByPk(1);
        await user.destroy();
        expect(await User.findOne({ where: 1, paranoid: false })).to.exist;
        expect(await User.findByPk(1)).to.be.null;
        expect(await User.count()).to.equal(2);
        expect(await User.count({ paranoid: false })).to.equal(3);
      });
    });

    it('should include deleted associated records if include has paranoid marked as false', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      }, { paranoid: true });
      const Pet = this.sequelize.define('Pet', {
        name: DataTypes.STRING,
        UserId: DataTypes.INTEGER,
      }, { paranoid: true });

      User.hasMany(Pet);
      Pet.belongsTo(User);

      await User.sync({ force: true });
      await Pet.sync({ force: true });
      const userId = (await User.create({ username: 'Joe' })).id;
      await Pet.bulkCreate([
        { name: 'Fido', UserId: userId },
        { name: 'Fifi', UserId: userId },
      ]);
      const pet = await Pet.findByPk(1);
      await pet.destroy();
      const user = await User.findOne({
        where: { id: userId },
        include: Pet,
      });
      const userWithDeletedPets = await User.findOne({
        where: { id: userId },
        include: { model: Pet, paranoid: false },
      });
      expect(user).to.exist;
      expect(user.Pets).to.have.length(1);
      expect(userWithDeletedPets).to.exist;
      expect(userWithDeletedPets.Pets).to.have.length(2);
    });

    it('should delete a paranoid record if I set force to true', async function () {
      const User = this.sequelize.define('paranoiduser', {
        username: DataTypes.STRING,
      }, { paranoid: true });

      await User.sync({ force: true });
      await User.bulkCreate([
        { username: 'Bob' },
        { username: 'Tobi' },
        { username: 'Max' },
        { username: 'Tony' },
      ]);
      const user = await User.findOne({ where: { username: 'Bob' } });
      await user.destroy({ force: true });
      expect(await User.findOne({ where: { username: 'Bob' } })).to.be.null;
      const tobi = await User.findOne({ where: { username: 'Tobi' } });
      await tobi.destroy();
      let sql = ['db2', 'ibmi'].includes(dialectName) ? 'SELECT * FROM "paranoidusers" WHERE "username"=\'Tobi\'' : 'SELECT * FROM paranoidusers WHERE username=\'Tobi\'';
      let result = await this.sequelize.query(sql, { plain: true });
      expect(result.username).to.equal('Tobi');
      await User.destroy({ where: { username: 'Tony' } });
      sql = ['db2', 'ibmi'].includes(dialectName) ? 'SELECT * FROM "paranoidusers" WHERE "username"=\'Tony\'' : 'SELECT * FROM paranoidusers WHERE username=\'Tony\'';
      result = await this.sequelize.query(sql, { plain: true });
      expect(result.username).to.equal('Tony');
      await User.destroy({ where: { username: ['Tony', 'Max'] }, force: true });
      sql = ['db2', 'ibmi'].includes(dialectName) ? 'SELECT * FROM "paranoidusers"' : 'SELECT * FROM paranoidusers';
      const [users] = await this.sequelize.query(sql, { raw: true });
      expect(users).to.have.length(1);
      expect(users[0].username).to.equal('Tobi');
    });

    it('returns the number of affected rows', async function () {
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '42' },
        { username: 'Bob', secretValue: '43' },
      ];

      await this.User.bulkCreate(data);
      let affectedRows = await this.User.destroy({ where: { secretValue: '42' } });
      expect(affectedRows).to.equal(2);
      affectedRows = await this.User.destroy({ where: { secretValue: '44' } });
      expect(affectedRows).to.equal(0);
    });

    if (dialect.supports.schemas) {
      it('supports table schema/prefix', async function () {
        const data = [
          { username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '42' },
          { username: 'Bob', secretValue: '43' },
        ];
        const prefixUser = this.User.schema('prefix');

        await Support.dropTestSchemas(this.sequelize);
        await this.sequelize.queryInterface.createSchema('prefix');
        await prefixUser.sync({ force: true });
        await prefixUser.bulkCreate(data);
        await prefixUser.destroy({ where: { secretValue: '42' } });
        const users = await prefixUser.findAll({ order: ['id'] });
        expect(users.length).to.equal(1);
        expect(users[0].username).to.equal('Bob');
        await this.sequelize.queryInterface.dropSchema('prefix');
      });
    }

    it('should work if model is paranoid and only operator in where clause is a Symbol', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      }, { paranoid: true });

      await User.sync({ force: true });
      await User.bulkCreate([{ username: 'foo' }, { username: 'bar' }]);
      await User.destroy({
        where: {
          [Op.or]: [
            { username: 'bar' },
            { username: 'baz' },
          ],
        },
      });
      const users = await User.findAll();
      expect(users).to.have.length(1);
      expect(users[0].username).to.equal('foo');
    });
  });

  describe('restore', () => {
    it('rejects with an error if the model is not paranoid', async function () {
      await expect(this.User.restore({ where: { secretValue: '42' } })).to.be.rejectedWith(Error, 'Model is not paranoid');
    });

    it('restores a previously deleted model', async function () {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
        data: DataTypes.STRING,
        intVal: { type: DataTypes.INTEGER, defaultValue: 1 },
      }, {
        paranoid: true,
      });
      const data = [
        { username: 'Peter', secretValue: '42' },
        { username: 'Paul', secretValue: '43' },
        { username: 'Bob', secretValue: '44' },
      ];

      await ParanoidUser.sync({ force: true });
      await ParanoidUser.bulkCreate(data);
      await ParanoidUser.destroy({ where: { secretValue: '42' } });
      await ParanoidUser.restore({ where: { secretValue: '42' } });
      const user = await ParanoidUser.findOne({ where: { secretValue: '42' } });
      expect(user).to.be.ok;
      expect(user.username).to.equal('Peter');
    });
  });

  describe('equals', () => {
    it('correctly determines equality of objects', async function () {
      const user = await this.User.create({ username: 'hallo', data: 'welt' });
      expect(user.equals(user)).to.be.ok;
    });

    // sqlite can't handle multiple primary keys
    if (dialectName !== 'sqlite') {
      it('correctly determines equality with multiple primary keys', async function () {
        const userKeys = this.sequelize.define('userkeys', {
          foo: { type: DataTypes.STRING, primaryKey: true },
          bar: { type: DataTypes.STRING, primaryKey: true },
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
        });

        await userKeys.sync({ force: true });
        const user = await userKeys.create({ foo: '1', bar: '2', name: 'hallo', bio: 'welt' });
        expect(user.equals(user)).to.be.ok;
      });
    }
  });

  // sqlite can't handle multiple primary keys
  if (dialectName !== 'sqlite') {
    describe('equalsOneOf', () => {
      beforeEach(async function () {
        this.userKey = this.sequelize.define('userKeys', {
          foo: { type: DataTypes.STRING, primaryKey: true },
          bar: { type: DataTypes.STRING, primaryKey: true },
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
        });

        await this.userKey.sync({ force: true });
      });

      it('determines equality if one is matching', async function () {
        const u = await this.userKey.create({ foo: '1', bar: '2', name: 'hallo', bio: 'welt' });
        expect(u.equalsOneOf([u, { a: 1 }])).to.be.ok;
      });

      it('doesn\'t determine equality if none is matching', async function () {
        const u = await this.userKey.create({ foo: '1', bar: '2', name: 'hallo', bio: 'welt' });
        expect(u.equalsOneOf([{ b: 2 }, { a: 1 }])).to.not.be.ok;
      });
    });
  }

  describe('count', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: DataTypes.STRING });

        await User.sync({ force: true });
        const t = await sequelize.startUnmanagedTransaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const count1 = await User.count();
        const count2 = await User.count({ transaction: t });
        expect(count1).to.equal(0);
        expect(count2).to.equal(1);
        await t.rollback();
      });
    }

    it('counts all created objects', async function () {
      await this.User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      expect(await this.User.count()).to.equal(2);
    });

    it('returns multiple rows when using group', async function () {
      await this.User.bulkCreate([
        { username: 'user1', data: 'A' },
        { username: 'user2', data: 'A' },
        { username: 'user3', data: 'B' },
      ]);
      const count = await this.User.count({
        attributes: ['data'],
        group: ['data'],
      });
      expect(count).to.have.lengthOf(2);

      // The order of count varies across dialects; Hence find element by identified first.
      expect(count.find(i => i.data === 'A')).to.deep.equal({ data: 'A', count: 2 });
      expect(count.find(i => i.data === 'B')).to.deep.equal({ data: 'B', count: 1 });
    });

    if (dialectName !== 'mssql' && dialectName !== 'db2' && dialectName !== 'ibmi') {
      describe('aggregate', () => {
        it('allows grouping by aliased attribute', async function () {
          await this.User.aggregate('id', 'count', {
            attributes: [['id', 'id2']],
            group: ['id2'],
          });
        });
      });
    }

    describe('options sent to aggregate', () => {
      let options;
      let aggregateSpy;

      beforeEach(function () {
        options = { where: { username: 'user1' } };

        aggregateSpy = sinon.spy(this.User, 'aggregate');
      });

      afterEach(() => {
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any, sinon.match.any,
          sinon.match.object.and(sinon.match.has('where', { username: 'user1' })),
        );

        aggregateSpy.restore();
      });

      it('modifies option "limit" by setting it to null', async function () {
        options.limit = 5;

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any, sinon.match.any,
          sinon.match.object.and(sinon.match.has('limit', null)),
        );
      });

      it('modifies option "offset" by setting it to null', async function () {
        options.offset = 10;

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any, sinon.match.any,
          sinon.match.object.and(sinon.match.has('offset', null)),
        );
      });

      it('modifies option "order" by setting it to null', async function () {
        options.order = 'username';

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any, sinon.match.any,
          sinon.match.object.and(sinon.match.has('order', null)),
        );
      });
    });

    it('allows sql logging', async function () {
      let test = false;
      await this.User.count({
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase()).to.include('SELECT');
        },
      });
      expect(test).to.be.true;
    });

    it('filters object', async function () {
      await this.User.create({ username: 'user1' });
      await this.User.create({ username: 'foo' });
      const count = await this.User.count({ where: { username: { [Op.like]: '%us%' } } });
      expect(count).to.equal(1);
    });

    it('supports distinct option', async function () {
      const Post = this.sequelize.define('Post', {});
      const PostComment = this.sequelize.define('PostComment', {});
      Post.hasMany(PostComment);
      await Post.sync({ force: true });
      await PostComment.sync({ force: true });
      const post = await Post.create({});
      await PostComment.bulkCreate([{ PostId: post.id }, { PostId: post.id }]);
      const count1 = await Post.count({ distinct: false, include: { model: PostComment, required: false } });
      const count2 = await Post.count({ distinct: true, include: { model: PostComment, required: false } });
      expect(count1).to.equal(2);
      expect(count2).to.equal(1);
    });

  });

  for (const methodName of ['min', 'max']) {
    describe(methodName, () => {
      beforeEach(async function () {
        this.UserWithAge = this.sequelize.define('UserWithAge', {
          age: DataTypes.INTEGER,
          order: DataTypes.INTEGER,
        });

        await this.UserWithAge.sync({ force: true });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', async function () {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const User = sequelize.define('User', { age: DataTypes.INTEGER });

          await User.sync({ force: true });
          const t = await sequelize.startUnmanagedTransaction();
          await User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t });
          const val1 = await User[methodName]('age');
          const val2 = await User[methodName]('age', { transaction: t });
          expect(val1).to.be.not.ok;
          expect(val2).to.equal(methodName === 'min' ? 2 : 5);
          await t.rollback();
        });
      }

      it('returns the correct value', async function () {
        await this.UserWithAge.bulkCreate([{ age: 3 }, { age: 2 }]);
        expect(await this.UserWithAge[methodName]('age')).to.equal(methodName === 'min' ? 2 : 3);
      });

      it('allows sql logging', async function () {
        let test = false;
        await this.UserWithAge[methodName]('age', {
          logging(sql) {
            test = true;
            expect(sql).to.exist;
            expect(sql.toUpperCase()).to.include('SELECT');
          },
        });
        expect(test).to.be.true;
      });

      if (dialect.supports.dataTypes.DECIMAL) {
        it('should allow decimals', async function () {
          const UserWithDec = this.sequelize.define('UserWithDec', {
            value: DataTypes.DECIMAL(10, 3),
          });

          await UserWithDec.sync({ force: true });

          await UserWithDec.bulkCreate([{ value: 5.5 }, { value: 3.5 }]);
          expect(await UserWithDec[methodName]('value')).to.equal(methodName === 'min' ? 3.5 : 5.5);
        });
      }

      it('should allow strings', async function () {
        await this.User.bulkCreate([{ username: 'bbb' }, { username: 'yyy' }]);
        expect(await this.User[methodName]('username')).to.equal(methodName === 'min' ? 'bbb' : 'yyy');
      });

      it('should allow dates', async function () {
        const date1 = new Date(2000, 1, 1);
        const date2 = new Date(1990, 1, 1);
        await this.User.bulkCreate([{ theDate: date1 }, { theDate: date2 }]);
        expect(await this.User[methodName]('theDate')).to.equalDate(methodName === 'min' ? date2 : date1);
      });

      it('should work with fields named as an SQL reserved keyword', async function () {
        await this.UserWithAge.bulkCreate([
          { age: 2, order: 3 },
          { age: 3, order: 5 },
        ]);
        expect(await this.UserWithAge[methodName]('order')).to.equal(methodName === 'min' ? 3 : 5);
      });
    });
  }

  describe('sum', () => {
    beforeEach(async function () {
      this.UserWithAge = this.sequelize.define('UserWithAge', {
        age: DataTypes.INTEGER,
        order: DataTypes.INTEGER,
        gender: DataTypes.ENUM('male', 'female'),
      });

      this.UserWithFields = this.sequelize.define('UserWithFields', {
        age: {
          type: DataTypes.INTEGER,
          field: 'user_age',
        },
        order: DataTypes.INTEGER,
        gender: {
          type: DataTypes.ENUM('male', 'female'),
          field: 'male_female',
        },
      });

      await Promise.all([
        this.UserWithAge.sync({ force: true }),
        this.UserWithFields.sync({ force: true }),
      ]);
    });

    it('should work in the simplest case', async function () {
      await this.UserWithAge.bulkCreate([{ age: 2 }, { age: 3 }]);
      expect(await this.UserWithAge.sum('age')).to.equal(5);
    });

    it('should work with fields named as an SQL reserved keyword', async function () {
      await this.UserWithAge.bulkCreate([{ age: 2, order: 3 }, { age: 3, order: 5 }]);
      expect(await this.UserWithAge.sum('order')).to.equal(8);
    });

    if (dialect.supports.dataTypes.DECIMAL) {
      it('should allow decimals in sum', async function () {
        const UserWithDec = this.sequelize.define('UserWithDec', {
          value: DataTypes.DECIMAL(10, 3),
        });

        await UserWithDec.sync({ force: true });

        await UserWithDec.bulkCreate([{ value: 3.5 }, { value: 5.25 }]);
        expect(await UserWithDec.sum('value')).to.equal(8.75);
      });
    }

    it('should accept a where clause', async function () {
      const options = { where: { gender: 'male' } };
      await this.UserWithAge.bulkCreate([
        { age: 2, gender: 'male' },
        { age: 3, gender: 'female' },
      ]);
      expect(await this.UserWithAge.sum('age', options)).to.equal(2);
    });

    it('should accept a where clause with custom fields', async function () {
      const options = { where: { gender: 'male' } };
      await this.UserWithFields.bulkCreate([
        { age: 2, gender: 'male' },
        { age: 3, gender: 'female' },
      ]);
      expect(await this.UserWithFields.sum('age', options)).to.equal(2);
    });

    it('allows sql logging', async function () {
      let test = false;
      await this.UserWithAge.sum('age', {
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase()).to.include('SELECT');
        },
      });
      expect(test).to.true;
    });
  });

  if (dialect.supports.schemas) {
    describe('schematic support', () => {
      beforeEach(async function () {
        this.UserPublic = this.sequelize.define('UserPublic', {
          age: DataTypes.INTEGER,
        });

        this.UserSpecial = this.sequelize.define('UserSpecial', {
          age: DataTypes.INTEGER,
        });

        await Support.dropTestSchemas(this.sequelize);
        await this.sequelize.createSchema('schema_test');
        await this.sequelize.createSchema('special');
        this.UserSpecialSync = await this.UserSpecial.schema('special').sync({ force: true });
      });

      afterEach(async function () {
        try {
          await this.sequelize.dropSchema('schema_test');
        } finally {
          await this.sequelize.dropSchema('special');
          await this.sequelize.dropSchema('prefix');
        }
      });

      it('should be able to drop with schemas', async function () {
        await this.UserSpecial.drop();
      });

      it('should be able to list schemas', async function () {
        const schemas = await this.sequelize.showAllSchemas();

        const expectedSchemas = {
          // "sequelize_test" is the default schema, which some dialects will not delete
          mysql: ['sequelize_test', 'schema_test', 'special'],
          mariadb: ['sequelize_test', 'schema_test', 'special'],
          ibmi: ['sequelize_test', 'schema_test', 'special'],
          mssql: ['schema_test', 'special'],
          postgres: ['schema_test', 'special'],
          db2: ['schema_test', 'special '],
        };

        expect(schemas.sort()).to.deep.equal(expectedSchemas[dialectName].sort());
      });

      it('should describeTable using the default schema settings', async function () {
        const UserPublic = this.sequelize.define('Public', {
          username: DataTypes.STRING,
        });

        let test = 0;

        await UserPublic.sync({ force: true });
        await UserPublic.schema('special').sync({ force: true });

        let table = await this.sequelize.queryInterface.describeTable('Publics', {
          logging(sql) {
            if (dialectName === 'sqlite' && sql.includes('TABLE_INFO')) {
              test++;
              expect(sql).to.not.contain('special');
            } else if (['mysql', 'mssql', 'mariadb', 'db2', 'ibmi'].includes(dialectName)) {
              test++;
              expect(sql).to.not.contain('special');
            }
          },
        });

        if (dialectName === 'postgres') {
          test++;
          expect(table.id.defaultValue).to.not.contain('special');
        }

        table = await this.sequelize.queryInterface.describeTable('Publics', {
          schema: 'special',
          logging(sql) {
            if (dialectName === 'sqlite' && sql.includes('TABLE_INFO')) {
              test++;
              expect(sql).to.contain('special');
            } else if (['mysql', 'mssql', 'mariadb', 'db2', 'ibmi'].includes(dialectName)) {
              test++;
              expect(sql).to.contain('special');
            }
          },
        });

        if (dialectName === 'postgres') {
          test++;
          expect(table.id.defaultValue).to.contain('special');
        }

        expect(test).to.equal(2);
      });

      it('should be able to reference a table with a schema set', async function () {
        const UserPub = this.sequelize.define('UserPub', {
          username: DataTypes.STRING,
        }, { schema: 'prefix' });

        const ItemPub = this.sequelize.define('ItemPub', {
          name: DataTypes.STRING,
        }, { schema: 'prefix' });

        UserPub.hasMany(ItemPub, { foreignKeyConstraints: true });

        await Support.dropTestSchemas(this.sequelize);
        await this.sequelize.queryInterface.createSchema('prefix');

        let test = false;

        await UserPub.sync({ force: true });
        await ItemPub.sync({
          force: true,
          logging: _.after(2, _.once(sql => {
            test = true;
            switch (dialectName) {
              case 'postgres':
              case 'db2':
              case 'ibmi': {
                expect(sql).to.match(/REFERENCES\s+"prefix"\."UserPubs" \("id"\)/);

                break;
              }

              case 'mssql': {
                expect(sql).to.match(/REFERENCES\s+\[prefix]\.\[UserPubs] \(\[id]\)/);

                break;
              }

              case 'mysql':
              case 'mariadb': {
                expect(sql).to.match(/REFERENCES\s+`prefix`\.`UserPubs` \(`id`\)/);

                break;
              }

              default: {
                expect(sql).to.match(/REFERENCES\s+`prefix\.UserPubs` \(`id`\)/);
              }
            }
          })),
        });

        expect(test).to.be.true;
      });

      it('should be able to create and update records under any valid schematic', async function () {
        let logged = 0;
        const UserPublicSync = await this.UserPublic.sync({ force: true });

        await UserPublicSync.create({ age: 3 }, {
          logging: UserPublic => {
            logged++;
            switch (dialectName) {
              case 'postgres':
              case 'db2':
              case 'ibmi': {
                expect(this.UserSpecialSync.getTableName().toString()).to.equal('"special"."UserSpecials"');
                expect(UserPublic).to.include('INSERT INTO "UserPublics"');

                break;
              }

              case 'sqlite': {
                expect(this.UserSpecialSync.getTableName().toString()).to.equal('`special.UserSpecials`');
                expect(UserPublic).to.include('INSERT INTO `UserPublics`');

                break;
              }

              case 'mssql': {
                expect(this.UserSpecialSync.getTableName().toString()).to.equal('[special].[UserSpecials]');
                expect(UserPublic).to.include('INSERT INTO [UserPublics]');

                break;
              }

              case 'mysql':
              case 'mariadb':
              default: {
                expect(this.UserSpecialSync.getTableName().toString()).to.equal('`special`.`UserSpecials`');
                expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);

                break;
              }
            }
          },
        });

        const UserSpecial = await this.UserSpecialSync.schema('special').create({ age: 3 }, {
          logging(UserSpecial) {
            logged++;
            switch (dialectName) {
              case 'postgres':
              case 'db2':
              case 'ibmi': {
                expect(UserSpecial).to.include('INSERT INTO "special"."UserSpecials"');

                break;
              }

              case 'sqlite': {
                expect(UserSpecial).to.include('INSERT INTO `special.UserSpecials`');

                break;
              }

              case 'mssql': {
                expect(UserSpecial).to.include('INSERT INTO [special].[UserSpecials]');

                break;
              }

              case 'mysql':
              case 'mariadb':
              default: {
                expect(UserSpecial).to.include('INSERT INTO `special`.`UserSpecials`');

                break;
              }
            }
          },
        });

        await UserSpecial.update({ age: 5 }, {
          logging(user) {
            logged++;
            switch (dialectName) {
              case 'postgres':
              case 'db2':
              case 'ibmi': {
                expect(user).to.include('UPDATE "special"."UserSpecials"');

                break;
              }

              case 'mssql': {
                expect(user).to.include('UPDATE [special].[UserSpecials]');

                break;
              }

              case 'mysql':
              case 'mariadb':
              default: {
                expect(user).to.include('UPDATE `special`.`UserSpecials`');

                break;
              }
            }
          },
        });

        expect(logged).to.equal(3);
      });
    });
  } else {
    describe('fake schematic support', () => {
      it('should take schemaDelimiter into account if applicable', async function () {
        let test = 0;
        const UserSpecialUnderscore = this.sequelize.define('UserSpecialUnderscore', {
          age: DataTypes.INTEGER,
        }, { schema: 'hello', schemaDelimiter: '_' });
        const UserSpecialDblUnderscore = this.sequelize.define('UserSpecialDblUnderscore', {
          age: DataTypes.INTEGER,
        });
        const User = await UserSpecialUnderscore.sync({ force: true });
        const DblUser = await UserSpecialDblUnderscore.schema('hello', '__').sync({ force: true });
        await DblUser.create({ age: 3 }, {
          logging(sql) {
            test++;
            expect(sql).to.exist;
            expect(sql).to.include('INSERT INTO `hello__UserSpecialDblUnderscores`');
          },
        });
        await User.create({ age: 3 }, {
          logging(sql) {
            test++;
            expect(sql).to.exist;
            expect(sql).to.include('INSERT INTO `hello_UserSpecialUnderscores`');
          },
        });
        expect(test).to.equal(2);
      });
    });
  }

  describe('references', () => {
    beforeEach(async function () {
      this.Author = this.sequelize.define('author', { firstName: DataTypes.STRING });

      await this.sequelize.getQueryInterface().dropTable('posts', { force: true });
      await this.sequelize.getQueryInterface().dropTable('authors', { force: true });

      await this.Author.sync();
    });

    it('uses an existing dao factory and references the author table', async function () {
      const authorIdColumn = { type: DataTypes.INTEGER, references: { model: this.Author, key: 'id' } };

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING,
        authorId: authorIdColumn,
      });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      await Post.sync();

      const foreignKeys = await this.sequelize.queryInterface.getForeignKeyReferencesForTable(Post.getTableName());

      expect(foreignKeys.length).to.eq(1);
      expect(foreignKeys[0].columnName).to.eq('authorId');
      expect(foreignKeys[0].referencedTableName).to.eq('authors');
      expect(foreignKeys[0].referencedColumnName).to.eq('id');
    });

    it('uses a table name as a string and references the author table', async function () {
      const authorIdColumn = { type: DataTypes.INTEGER, references: { table: 'authors', key: 'id' } };

      const Post = this.sequelize.define('post', { title: DataTypes.STRING, authorId: authorIdColumn });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      await Post.sync();

      const foreignKeys = await this.sequelize.queryInterface.getForeignKeyReferencesForTable(Post.getTableName());

      expect(foreignKeys.length).to.eq(1);
      expect(foreignKeys[0].columnName).to.eq('authorId');
      expect(foreignKeys[0].referencedTableName).to.eq('authors');
      expect(foreignKeys[0].referencedColumnName).to.eq('id');
    });

    it('throws an error if the referenced table name is invalid', async function () {
      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING,
        authorId: DataTypes.INTEGER,
      });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // force Post.authorId to reference a table that does not exist
      Post.modelDefinition.rawAttributes.authorId.references.table = '4uth0r5';
      Post.modelDefinition.refreshAttributes();

      try {
        // The posts table gets dropped in the before filter.
        await Post.sync();
        if (dialectName === 'sqlite') {
          // sorry ... but sqlite is too stupid to understand whats going on ...
          expect(1).to.equal(1);
        } else {
          // the parser should not end up here ...
          expect(2).to.equal(1);
        }
      } catch (error) {
        switch (dialectName) {
          case 'mysql': {
            if (isMySQL8) {
              expect(error.message).to.match(/Failed to open the referenced table '4uth0r5'/);
            } else {
              expect(error.message).to.match(/Cannot add foreign key constraint/);
            }

            break;
          }

          case 'sqlite': {
            // the parser should not end up here ... see above
            expect(1).to.equal(2);

            break;
          }

          case 'mariadb': {
            expect(error.message).to.match(/Foreign key constraint is incorrectly formed/);

            break;
          }

          case 'postgres': {
            expect(error.message).to.match(/relation "4uth0r5" does not exist/);

            break;
          }

          case 'mssql': {
            expect(error.message).to.match(/Could not create constraint/);

            break;
          }

          case 'db2': {
            expect(error.message).to.match(/ is an undefined name/);

            break;
          }

          case 'ibmi': {
            expect(error.message).to.match(/[a-zA-Z0-9[\] /-]+?"4uth0r5" in SEQUELIZE type \*FILE not found\./);

            break;
          }

          default: {
            throw new Error('Undefined dialect!');
          }
        }
      }
    });

    it('works with comments', async function () {
      // Test for a case where the comment was being moved to the end of the table when there was also a reference on the column, see #1521
      const Member = this.sequelize.define('Member', {});
      const idColumn = {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: false,
        comment: 'asdf',
      };

      idColumn.references = { model: Member, key: 'id' };

      this.sequelize.define('Profile', { id: idColumn });

      await this.sequelize.sync({ force: true });
    });
  });

  describe('blob', () => {
    beforeEach(async function () {
      this.BlobUser = this.sequelize.define('blobUser', {
        data: DataTypes.BLOB,
      });

      await this.BlobUser.sync({ force: true });
    });

    describe('buffers', () => {
      it('should be able to take a buffer as parameter to a BLOB field', async function () {
        const user = await this.BlobUser.create({
          data: Buffer.from('Sequelize'),
        });

        expect(user).to.be.ok;
      });

      it('should return a buffer when fetching a blob', async function () {
        const user = await this.BlobUser.create({
          data: Buffer.from('Sequelize'),
        });

        const user0 = await this.BlobUser.findByPk(user.id);
        expect(user0.data).to.be.an.instanceOf(Buffer);
        expect(user0.data.toString()).to.have.string('Sequelize');
      });

      it('should work when the database returns null', async function () {
        const user = await this.BlobUser.create({
          // create a null column
        });

        const user0 = await this.BlobUser.findByPk(user.id);
        expect(user0.data).to.be.null;
      });
    });

    if (dialectName !== 'mssql') {
      // NOTE: someone remember to inform me about the intent of these tests. Are
      //       you saying that data passed in as a string is automatically converted
      //       to binary? i.e. "Sequelize" is CAST as binary, OR that actual binary
      //       data is passed in, in string form? Very unclear, and very different.

      describe('strings', () => {
        it('should be able to take a string as parameter to a BLOB field', async function () {
          const user = await this.BlobUser.create({
            data: 'Sequelize',
          });

          expect(user).to.be.ok;
        });

        it('should return a buffer when fetching a BLOB, even when the BLOB was inserted as a string', async function () {
          const user = await this.BlobUser.create({
            data: 'Sequelize',
          });

          const user0 = await this.BlobUser.findByPk(user.id);
          expect(user0.data).to.be.an.instanceOf(Buffer);
          expect(user0.data.toString()).to.have.string('Sequelize');
        });
      });
    }

  });

  describe('paranoid is true and where is an array', () => {

    beforeEach(async function () {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING }, { paranoid: true });
      this.Project = this.sequelize.define('Project', { title: DataTypes.STRING }, { paranoid: true });

      this.Project.belongsToMany(this.User, { through: 'project_user' });
      this.User.belongsToMany(this.Project, { through: 'project_user' });

      await this.sequelize.sync({ force: true });

      await this.User.bulkCreate([{
        username: 'leia',
      }, {
        username: 'luke',
      }, {
        username: 'vader',
      }]);

      await this.Project.bulkCreate([{
        title: 'republic',
      }, {
        title: 'empire',
      }]);

      const users = await this.User.findAll();
      const projects = await this.Project.findAll();
      const leia = users[0];
      const luke = users[1];
      const vader = users[2];
      const republic = projects[0];
      const empire = projects[1];
      await leia.setProjects([republic]);
      await luke.setProjects([republic]);
      await vader.setProjects([empire]);

      await leia.destroy();
    });

    it('should not fail when array contains Sequelize.or / and', async function () {
      const res = await this.User.findAll({
        where: [
          this.sequelize.or({ username: 'vader' }, { username: 'luke' }),
          this.sequelize.and({ id: [1, 2, 3] }),
        ],
      });

      expect(res).to.have.length(2);
    });

    it('should fail when array contains strings', async function () {
      await expect(this.User.findAll({
        where: ['this is a mistake', ['dont do it!']],
      })).to.eventually.be.rejectedWith(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('should not fail with an include', async function () {
      const users = await this.User.findAll({
        where: this.sequelize.literal(`${this.sequelize.queryInterface.queryGenerator.quoteIdentifiers('Projects.title')} = ${this.sequelize.queryInterface.queryGenerator.escape('republic')}`),
        include: [
          { model: this.Project },
        ],
      });

      expect(users.length).to.be.equal(1);
      expect(users[0].username).to.be.equal('luke');
    });

    it('should not overwrite a specified deletedAt by setting paranoid: false', async function () {
      let tableName = '';
      if (this.User.name) {
        tableName = `${this.sequelize.queryInterface.queryGenerator.quoteIdentifier(this.User.name)}.`;
      }

      const users = await this.User.findAll({
        paranoid: false,
        where: this.sequelize.literal(`${tableName + this.sequelize.queryInterface.queryGenerator.quoteIdentifier('deletedAt')} IS NOT NULL `),
        include: [
          { model: this.Project },
        ],
      });

      expect(users.length).to.be.equal(1);
      expect(users[0].username).to.be.equal('leia');
    });

    it('should not overwrite a specified deletedAt (complex query) by setting paranoid: false', async function () {
      const res = await this.User.findAll({
        paranoid: false,
        where: [
          this.sequelize.or({ username: 'leia' }, { username: 'luke' }),
          this.sequelize.and(
            { id: [1, 2, 3] },
            this.sequelize.or({ deletedAt: null }, { deletedAt: { [Op.gt]: new Date(0) } }),
          ),
        ],
      });

      expect(res).to.have.length(2);
    });

  });

  if (dialectName !== 'sqlite' && current.dialect.supports.transactions) {
    it('supports multiple async transactions', async function () {
      this.timeout(90_000);
      const sequelize = await Support.prepareTransactionTest(this.sequelize);
      const User = sequelize.define('User', { username: DataTypes.STRING });
      const testAsync = async function () {
        const t0 = await sequelize.startUnmanagedTransaction();

        await User.create({
          username: 'foo',
        }, {
          transaction: t0,
        });

        const users0 = await User.findAll({
          where: {
            username: 'foo',
          },
        });

        expect(users0).to.have.length(0);

        const users = await User.findAll({
          where: {
            username: 'foo',
          },
          transaction: t0,
        });

        expect(users).to.have.length(1);
        const t = t0;

        return t.rollback();
      };

      await User.sync({ force: true });
      const tasks = [];
      for (let i = 0; i < 1000; i++) {
        tasks.push(testAsync);
      }

      await pMap(tasks, entry => {
        return entry();
      }, {
        // Needs to be one less than ??? else the non transaction query won't ever get a connection
        concurrency: (sequelize.config.pool && sequelize.config.pool.max || 5) - 1,
      });
    });
  }

  it('should be possible to use a key named UUID as foreign key', async function () {
    this.sequelize.define('project', {
      UserId: {
        type: DataTypes.STRING,
        references: {
          tableName: 'Users',
          key: 'UUID',
        },
      },
    });

    this.sequelize.define('Users', {
      UUID: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true,
        allowNull: false,
        validate: {
          notNull: true,
          notEmpty: true,
        },
      },
    });

    await this.sequelize.sync({ force: true });
  });

  describe('bulkCreate', () => {
    it('errors - should return array of errors if validate and individualHooks are true', async function () {
      const data = [{ username: null },
        { username: null },
        { username: null }];

      const user = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            notNull: true,
            notEmpty: true,
          },
        },
      });

      await this.sequelize.sync({ force: true });
      expect(user.bulkCreate(data, {
        validate: true,
        individualHooks: true,
      })).to.be.rejectedWith(AggregateError);
    });

    it('should not use setter when renaming fields in dataValues', async function () {
      const user = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          field: 'data',
          get() {
            const val = this.getDataValue('username');

            return val.slice(0, Math.max(0, val.length - 1));
          },
          set(val) {
            if (val.includes('!')) {
              throw new Error('val should not include a "!"');
            }

            this.setDataValue('username', `${val}!`);
          },
        },
      });

      const data = [{ username: 'jon' }];
      await this.sequelize.sync({ force: true });
      await user.bulkCreate(data);
      const users1 = await user.findAll();
      expect(users1[0].username).to.equal('jon');
    });

    it('should correctly set identifiers in a column with autoIncrement with bigint values', async function () {
      // sqlite returns bigints as numbers https://github.com/sequelize/sequelize/issues/11400
      if (dialectName === 'sqlite') {
        return;
      }

      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        username: DataTypes.STRING,
      });

      await this.sequelize.sync({ force: true });
      await User.create({ id: '3415718944570971483', username: 'u1' });
      const createdUsers = await User.bulkCreate([{ username: 'u2', id: '3415718944570971484' }]);
      expect(createdUsers[0].id.toString()).to.equal('3415718944570971484');
      const users1 = await User.findAll({ order: [['id', 'ASC']] });
      expect(users1[0].username).to.equal('u1');
      expect(users1[1].username).to.equal('u2');
      expect(users1[1].id.toString()).to.equal('3415718944570971484');
    });
  });
});
