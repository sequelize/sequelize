'use strict';

const afterLodash = require('lodash/after');
const once = require('lodash/once');

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const { AggregateError, DataTypes, Op, Sequelize, sql } = require('@sequelize/core');

const dialectName = Support.getTestDialect();
const dialect = Support.sequelize.dialect;
const sinon = require('sinon');
const dayjs = require('dayjs');

// ⚠️ Do not add tests to this file. Tests should be added to the new test suite in test/integration/model/<method-name>.ts

describe(Support.getTestDialectTeaser('Model'), () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  beforeEach(async function () {
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
      const factorySize = this.sequelize.models.size;

      this.sequelize.define('SuperUser', {}, { freezeTableName: false });
      const factorySize2 = this.sequelize.models.size;

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
        this.sequelize.define(
          'Foo',
          {
            columnName: DataTypes.INTEGER,
          },
          {
            validate: {
              notFunction: 33,
            },
          },
        );
      }).to.throw(
        Error,
        'Members of the validate option must be functions. Model: Foo, error with validate member notFunction',
      );
    });

    it('should allow me to set a default value for createdAt and updatedAt', async function () {
      const UserTable = this.sequelize.define(
        'UserCol',
        {
          aNumber: DataTypes.INTEGER,
          createdAt: {
            defaultValue: dayjs('2012-01-01').toDate(),
          },
          updatedAt: {
            defaultValue: dayjs('2012-01-02').toDate(),
          },
        },
        { timestamps: true },
      );

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
      const UserTable = this.sequelize.define(
        'UserCol',
        {
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: defaultFunction,
          },
        },
        { timestamps: true },
      );

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
      }).to.throw(
        Error,
        'Value for "deletedAt" option must be a string or a boolean, got function',
      );
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
      const UserTable = this.sequelize.define(
        'UserCol',
        {
          aNumber: DataTypes.INTEGER,
        },
        {
          timestamps: true,
          updatedAt: 'updatedOn',
          createdAt: 'dateCreated',
          deletedAt: 'deletedAtThisTime',
          paranoid: true,
        },
      );

      await UserTable.sync({ force: true });
      const user = await UserTable.create({ aNumber: 4 });
      expect(user.updatedOn).to.exist;
      expect(user.dateCreated).to.exist;
      await user.destroy();
      await user.reload({ paranoid: false });
      expect(user.deletedAtThisTime).to.exist;
    });

    it('should allow me to disable some of the timestamp fields', async function () {
      const UpdatingUser = this.sequelize.define(
        'UpdatingUser',
        {
          name: DataTypes.STRING,
        },
        {
          timestamps: true,
          updatedAt: false,
          createdAt: false,
          deletedAt: 'deletedAtThisTime',
          paranoid: true,
        },
      );

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
      const UserTable = this.sequelize.define(
        'UserCol',
        {
          aNumber: DataTypes.INTEGER,
        },
        {
          paranoid: true,
          underscored: true,
        },
      );

      await UserTable.sync({ force: true });
      await UserTable.create({ aNumber: 30 });
      expect(await UserTable.count()).to.equal(1);
    });

    it('allows unique on column with field aliases', async function () {
      const User = this.sequelize.define('UserWithUniqueFieldAlias', {
        userName: { type: DataTypes.STRING, unique: 'user_name_unique', columnName: 'user_name' },
      });

      await User.sync({ force: true });
      const indexes = (await this.sequelize.queryInterface.showIndex(User.table)).filter(
        index => !index.primary,
      );

      expect(indexes).to.have.length(1);
      const index = indexes[0];
      expect(index.primary).to.equal(false);
      expect(index.unique).to.equal(true);
      expect(index.name).to.equal('user_name_unique');

      switch (dialectName) {
        case 'mariadb':
        case 'mysql': {
          expect(index.fields).to.deep.equal([
            { attribute: 'user_name', length: undefined, order: 'ASC' },
          ]);
          expect(index.type).to.equal('BTREE');

          break;
        }

        case 'postgres': {
          expect(index.fields).to.deep.equal([
            { attribute: 'user_name', collate: undefined, order: undefined, length: undefined },
          ]);

          break;
        }

        case 'db2':
        case 'mssql': {
          expect(index.fields).to.deep.equal([
            { attribute: 'user_name', collate: undefined, length: undefined, order: 'ASC' },
          ]);

          break;
        }

        case 'sqlite3':
        default: {
          expect(index.fields).to.deep.equal([
            { attribute: 'user_name', length: undefined, order: undefined },
          ]);

          break;
        }
      }
    });

    if (dialectName !== 'ibmi') {
      it('allows us to customize the error message for unique constraint', async function () {
        const User = this.sequelize.define('UserWithUniqueUsername', {
          username: {
            type: DataTypes.STRING,
            unique: { name: 'user_and_email', msg: 'User and email must be unique' },
          },
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
        let User = this.sequelize.define(
          'UserWithUniqueUsername',
          {
            user_id: { type: DataTypes.INTEGER },
            email: { type: DataTypes.STRING },
          },
          {
            indexes: [
              {
                name: 'user_and_email_index',
                msg: 'User and email must be unique',
                unique: true,
                method: 'BTREE',
                fields: [
                  'user_id',
                  {
                    attribute: 'email',
                    collate: dialectName === 'sqlite3' ? 'RTRIM' : 'en_US',
                    order: 'DESC',
                    length: 5,
                  },
                ],
              },
            ],
          },
        );

        await User.sync({ force: true });

        // Redefine the model to use the index in database and override error message
        User = this.sequelize.define('UserWithUniqueUsername', {
          user_id: {
            type: DataTypes.INTEGER,
            unique: { name: 'user_and_email_index', msg: 'User and email must be unique' },
          },
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

    describe('descending indices (MySQL specific)', () => {
      if (dialectName !== 'mysql') {
        return;
      }

      it('complains about missing support for descending indexes', async function () {
        const indices = [
          {
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
          },
        ];

        this.sequelize.define(
          'model',
          {
            fieldA: DataTypes.STRING,
            fieldB: DataTypes.INTEGER,
            fieldC: DataTypes.STRING,
            fieldD: DataTypes.STRING,
          },
          {
            indexes: indices,
            engine: 'MyISAM',
          },
        );

        try {
          await this.sequelize.sync();
          expect.fail();
        } catch (error) {
          expect(error.message).to.include(
            "The storage engine for the table doesn't support descending indexes",
          );
        }
      });

      it('works fine with InnoDB', async function () {
        const indices = [
          {
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
          },
        ];

        this.sequelize.define(
          'model',
          {
            fieldA: DataTypes.STRING,
            fieldB: DataTypes.INTEGER,
            fieldC: DataTypes.STRING,
            fieldD: DataTypes.STRING,
          },
          {
            indexes: indices,
            engine: 'InnoDB',
          },
        );

        await this.sequelize.sync();
      });
    });

    it('should allow the user to specify indexes in options', async function () {
      const indices = [
        {
          name: 'a_b_uniq',
          unique: true,
          method: 'BTREE',
          fields: [
            'fieldB',
            {
              attribute: 'fieldA',
              collate: dialectName === 'sqlite3' ? 'RTRIM' : 'en_US',
              order:
                dialectName === 'ibmi'
                  ? ''
                  : // MySQL doesn't support DESC indexes (will throw)
                    // MariaDB doesn't support DESC indexes (will silently replace it with ASC)
                    dialectName === 'mysql' || dialectName === 'mariadb'
                    ? 'ASC'
                    : `DESC`,
              length: 5,
            },
          ],
        },
      ];

      if (!['mssql', 'db2', 'ibmi'].includes(dialectName)) {
        indices.push(
          {
            type: 'FULLTEXT',
            fields: ['fieldC'],
            concurrently: true,
          },
          {
            type: 'FULLTEXT',
            fields: ['fieldD'],
          },
        );
      }

      const modelOptions = ['mariadb', 'mysql'].includes(dialectName)
        ? { indexes: indices, engine: 'MyISAM' }
        : { indexes: indices };

      const Model = this.sequelize.define(
        'model',
        {
          fieldA: DataTypes.STRING,
          fieldB: DataTypes.INTEGER,
          fieldC: DataTypes.STRING,
          fieldD: DataTypes.STRING,
        },
        modelOptions,
      );

      await this.sequelize.sync();
      await this.sequelize.sync(); // The second call should not try to create the indices again
      const args = await this.sequelize.queryInterface.showIndex(Model.table);
      let primary;
      let idx1;
      let idx2;
      let idx3;

      switch (dialectName) {
        case 'sqlite3': {
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
    it("doesn't create database entries", async function () {
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
      const Task = this.sequelize.define(
        'TaskBuild',
        {
          title: { type: DataTypes.STRING, defaultValue: 'a task!' },
          foo: { type: DataTypes.INTEGER, defaultValue: 2 },
          bar: { type: DataTypes.DATE },
          foobar: { type: DataTypes.TEXT, defaultValue: 'asd' },
          flag: { type: DataTypes.BOOLEAN, defaultValue: false },
        },
        { timestamps: false },
      );
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

        const product = Product.build(
          {
            id: 1,
            title: 'Chair',
            tags: [
              { id: 1, name: 'Alpha' },
              { id: 2, name: 'Beta' },
            ],
            user: {
              id: 1,
              first_name: 'Mick',
              last_name: 'Hansen',
            },
          },
          {
            include: [User, Tag],
          },
        );

        expect(product.tags).to.be.ok;
        expect(product.tags.length).to.equal(2);
        expect(product.tags[0]).to.be.instanceof(Tag);
        expect(product.user).to.be.ok;
        expect(product.user).to.be.instanceof(User);
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

        const product = Product.build(
          {
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
          },
          {
            include: [
              { model: User, as: 'followers' },
              { model: Tag, as: 'categories' },
            ],
          },
        );

        expect(product.categories).to.be.ok;
        expect(product.categories.length).to.equal(4);
        expect(product.categories[0]).to.be.instanceof(Tag);
        expect(product.followers).to.be.ok;
        expect(product.followers.length).to.equal(2);
        expect(product.followers[0]).to.be.instanceof(User);
      });
    });
  });

  describe('restore', () => {
    it('rejects with an error if the model is not paranoid', async function () {
      await expect(this.User.restore({ where: { secretValue: '42' } })).to.be.rejectedWith(
        Error,
        'Model is not paranoid',
      );
    });

    it('restores a previously deleted model', async function () {
      const ParanoidUser = this.sequelize.define(
        'ParanoidUser',
        {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
          data: DataTypes.STRING,
          intVal: { type: DataTypes.INTEGER, defaultValue: 1 },
        },
        {
          paranoid: true,
        },
      );
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

    // sqlite3 can't handle multiple primary keys
    if (dialectName !== 'sqlite3') {
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
  if (dialectName !== 'sqlite3') {
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

      it("doesn't determine equality if none is matching", async function () {
        const u = await this.userKey.create({ foo: '1', bar: '2', name: 'hallo', bio: 'welt' });
        expect(u.equalsOneOf([{ b: 2 }, { a: 1 }])).to.not.be.ok;
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
          columnName: 'user_age',
        },
        order: DataTypes.INTEGER,
        gender: {
          type: DataTypes.ENUM('male', 'female'),
          columnName: 'male_female',
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
      await this.UserWithAge.bulkCreate([
        { age: 2, order: 3 },
        { age: 3, order: 5 },
      ]);
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
        this.UserSpecialSync = await this.UserSpecial.withSchema('special').sync({ force: true });
      });

      it('should be able to drop with schemas', async function () {
        await this.UserSpecial.drop();
      });

      it('should describeTable using the default schema settings', async function () {
        const UserPublic = this.sequelize.define('Public', {
          username: DataTypes.STRING,
        });

        let test = 0;

        await UserPublic.sync({ force: true });
        await UserPublic.withSchema('special').sync({ force: true });

        let table = await this.sequelize.queryInterface.describeTable('Publics', {
          logging(sql) {
            if (dialectName === 'sqlite3' && sql.includes('TABLE_INFO')) {
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

        table = await this.sequelize.queryInterface.describeTable(
          { tableName: 'Publics', schema: 'special' },
          {
            logging(sql) {
              if (dialectName === 'sqlite3' && sql.includes('TABLE_INFO')) {
                test++;
                expect(sql).to.contain('special');
              } else if (['mysql', 'mssql', 'mariadb', 'db2', 'ibmi'].includes(dialectName)) {
                test++;
                expect(sql).to.contain('special');
              }
            },
          },
        );

        if (dialectName === 'postgres') {
          test++;
          expect(table.id.defaultValue).to.contain('special');
        }

        expect(test).to.equal(2);
      });

      it('should be able to reference a table with a schema set', async function () {
        const UserPub = this.sequelize.define(
          'UserPub',
          {
            username: DataTypes.STRING,
          },
          { schema: 'prefix' },
        );

        const ItemPub = this.sequelize.define(
          'ItemPub',
          {
            name: DataTypes.STRING,
          },
          { schema: 'prefix' },
        );

        UserPub.hasMany(ItemPub, { foreignKeyConstraints: true });

        await this.sequelize.queryInterface.createSchema('prefix');

        let test = false;

        await UserPub.sync({ force: true });
        await ItemPub.sync({
          force: true,
          logging: afterLodash(
            2,
            once(sql => {
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
            }),
          ),
        });

        expect(test).to.be.true;
      });

      it('should be able to create and update records under any valid schematic', async function () {
        let logged = 0;
        const UserPublicSync = await this.UserPublic.sync({ force: true });

        await UserPublicSync.create(
          { age: 3 },
          {
            logging: UserPublic => {
              logged++;
              expect(this.UserSpecialSync.table).to.deep.equal({
                tableName: 'UserSpecials',
                schema: 'special',
                delimiter: '.',
              });
              switch (dialectName) {
                case 'postgres':
                case 'db2':
                case 'ibmi': {
                  expect(UserPublic).to.include('INSERT INTO "UserPublics"');

                  break;
                }

                case 'mssql': {
                  expect(UserPublic).to.include('INSERT INTO [UserPublics]');

                  break;
                }

                case 'mysql':
                case 'mariadb':
                default: {
                  expect(UserPublic.indexOf('INSERT INTO `UserPublics`')).to.be.above(-1);

                  break;
                }
              }
            },
          },
        );

        const UserSpecial = await this.UserSpecialSync.withSchema('special').create(
          { age: 3 },
          {
            logging(UserSpecial) {
              logged++;
              switch (dialectName) {
                case 'postgres':
                case 'db2':
                case 'ibmi': {
                  expect(UserSpecial).to.include('INSERT INTO "special"."UserSpecials"');

                  break;
                }

                case 'sqlite3': {
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
          },
        );

        await UserSpecial.update(
          { age: 5 },
          {
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
          },
        );

        expect(logged).to.equal(3);
      });
    });
  } else {
    describe('fake schematic support', () => {
      it('should take schemaDelimiter into account if applicable', async function () {
        let test = 0;
        const UserSpecialUnderscore = this.sequelize.define(
          'UserSpecialUnderscore',
          {
            age: DataTypes.INTEGER,
          },
          { schema: 'hello', schemaDelimiter: '_' },
        );
        const UserSpecialDblUnderscore = this.sequelize.define('UserSpecialDblUnderscore', {
          age: DataTypes.INTEGER,
        });
        const User = await UserSpecialUnderscore.sync({ force: true });
        const DblUser = await UserSpecialDblUnderscore.withSchema({
          schema: 'hello',
          schemaDelimiter: '__',
        }).sync({ force: true });
        await DblUser.create(
          { age: 3 },
          {
            logging(sql) {
              test++;
              expect(sql).to.exist;
              expect(sql).to.include('INSERT INTO `hello__UserSpecialDblUnderscores`');
            },
          },
        );
        await User.create(
          { age: 3 },
          {
            logging(sql) {
              test++;
              expect(sql).to.exist;
              expect(sql).to.include('INSERT INTO `hello_UserSpecialUnderscores`');
            },
          },
        );
        expect(test).to.equal(2);
      });
    });
  }

  describe('references', () => {
    beforeEach(async function () {
      this.Author = this.sequelize.define('author', { firstName: DataTypes.STRING });

      await this.sequelize.queryInterface.dropTable('posts', { force: true });
      await this.sequelize.queryInterface.dropTable('authors', { force: true });

      await this.Author.sync();
    });

    it('uses an existing dao factory and references the author table', async function () {
      const authorIdColumn = {
        type: DataTypes.INTEGER,
        references: { model: this.Author, key: 'id' },
      };

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING,
        authorId: authorIdColumn,
      });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      await Post.sync();

      const foreignKeys = await this.sequelize.queryInterface.showConstraints(Post, {
        constraintType: 'FOREIGN KEY',
      });

      expect(foreignKeys.length).to.eq(1);
      expect(foreignKeys[0].columnNames).to.deep.eq(['authorId']);
      expect(foreignKeys[0].referencedTableName).to.eq('authors');
      expect(foreignKeys[0].referencedColumnNames).to.deep.eq(['id']);
    });

    it('uses a table name as a string and references the author table', async function () {
      const authorIdColumn = {
        type: DataTypes.INTEGER,
        references: { table: 'authors', key: 'id' },
      };

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING,
        authorId: authorIdColumn,
      });

      this.Author.hasMany(Post);
      Post.belongsTo(this.Author);

      // The posts table gets dropped in the before filter.
      await Post.sync();

      const foreignKeys = await this.sequelize.queryInterface.showConstraints(Post, {
        constraintType: 'FOREIGN KEY',
      });

      expect(foreignKeys.length).to.eq(1);
      expect(foreignKeys[0].columnNames).to.deep.eq(['authorId']);
      expect(foreignKeys[0].referencedTableName).to.eq('authors');
      expect(foreignKeys[0].referencedColumnNames).to.deep.eq(['id']);
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
        if (dialectName === 'sqlite3') {
          // sorry ... but sqlite is too stupid to understand whats going on ...
          expect(1).to.equal(1);
        } else {
          // the parser should not end up here ...
          expect(2).to.equal(1);
        }
      } catch (error) {
        switch (dialectName) {
          case 'mysql': {
            expect(error.message).to.match(/Failed to open the referenced table '4uth0r5'/);

            break;
          }

          case 'sqlite3': {
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
            expect(error).to.be.instanceOf(AggregateError);
            expect(error.errors.at(-2).message).to.match(/Could not create constraint/);

            break;
          }

          case 'db2': {
            expect(error.message).to.match(/ is an undefined name/);

            break;
          }

          case 'ibmi': {
            expect(error.message).to.match(
              /[a-zA-Z0-9[\] /-]+?"4uth0r5" in SEQUELIZE type \*FILE not found\./,
            );

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
      this.Project = this.sequelize.define(
        'Project',
        { title: DataTypes.STRING },
        { paranoid: true },
      );

      this.Project.belongsToMany(this.User, { through: 'project_user' });
      this.User.belongsToMany(this.Project, { through: 'project_user' });

      await this.sequelize.sync({ force: true });

      await this.User.bulkCreate([
        {
          username: 'leia',
        },
        {
          username: 'luke',
        },
        {
          username: 'vader',
        },
      ]);

      await this.Project.bulkCreate([
        {
          title: 'republic',
        },
        {
          title: 'empire',
        },
      ]);

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

    it('should not fail with an include', async function () {
      const users = await this.User.findAll({
        where: this.sequelize.literal(
          `${this.sequelize.queryGenerator.quoteIdentifiers('projects.title')} = ${this.sequelize.queryGenerator.escape('republic')}`,
        ),
        include: [{ model: this.Project }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('luke');
    });

    it('should not overwrite a specified deletedAt by setting paranoid: false', async function () {
      let tableName = '';
      if (this.User.name) {
        tableName = `${this.sequelize.queryGenerator.quoteIdentifier(this.User.name)}.`;
      }

      const users = await this.User.findAll({
        paranoid: false,
        where: this.sequelize.literal(
          `${tableName + this.sequelize.queryGenerator.quoteIdentifier('deletedAt')} IS NOT NULL `,
        ),
        include: [{ model: this.Project }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('leia');
    });

    it('should not overwrite a specified deletedAt (complex query) by setting paranoid: false', async function () {
      const res = await this.User.findAll({
        paranoid: false,
        where: [
          this.sequelize.or({ username: 'leia' }, { username: 'luke' }),
          this.sequelize.and(
            { id: [1, 2, 3] },
            this.sequelize.or({ deletedAt: null }, { deletedAt: { [Op.gte]: new Date(0) } }),
          ),
        ],
      });

      expect(res).to.have.length(2);
    });
  });

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
      const data = [{ username: null }, { username: null }, { username: null }];

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
      expect(
        user.bulkCreate(data, {
          validate: true,
          individualHooks: true,
        }),
      ).to.be.rejectedWith(AggregateError);
    });

    it('should not use setter when renaming fields in dataValues', async function () {
      const user = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          columnName: 'data',
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
      if (dialectName === 'sqlite3') {
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

  describe('BulkUpdate', () => {
    it('should update correctly when model defined has attributes with custom getters', async function () {
      const User = this.sequelize.define('users', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: sql.uuidV4,
        },
        status: {
          type: DataTypes.STRING,
          defaultValue: 'active',
        },
        roles: {
          type: DataTypes.STRING,
          allowNull: false,
          get() {
            return this.getDataValue('roles').split(',');
          },
          set(val) {
            this.setDataValue('roles', val.join(','));
          },
        },
      });
      await User.sync({ force: true });
      const u1 = await User.create({
        roles: ['authenticated user'],
      });
      const u2 = await User.create({
        roles: ['authenticated user'],
      });
      await User.update(
        { status: 'blocked' },
        {
          where: {
            id: {
              [Op.ne]: null,
            },
          },
        },
      );
      const a1 = await User.findOne({ where: { id: u1.id } });
      const a2 = await User.findOne({ where: { id: u2.id } });
      expect(a1.get('status')).to.eq('blocked');
      expect(a2.get('status')).to.eq('blocked');
    });
  });
});
