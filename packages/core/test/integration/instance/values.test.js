'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');

const dialect = Support.getTestDialect();
const { Col, DataTypes, Fn } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('DAO'), () => {
  describe('Values', () => {
    describe('set', () => {
      it("doesn't overwrite generated primary keys", function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });

        const user = User.build({ id: 1, name: 'Mick' });

        expect(user.get('id')).to.equal(1);
        expect(user.get('name')).to.equal('Mick');
        user.set({
          id: 2,
          name: 'Jan',
        });
        expect(user.get('id')).to.equal(1);
        expect(user.get('name')).to.equal('Jan');
      });

      it("doesn't overwrite defined primary keys", function () {
        const User = this.sequelize.define('User', {
          identifier: { type: DataTypes.STRING, primaryKey: true },
        });

        const user = User.build({ identifier: 'identifier' });

        expect(user.get('identifier')).to.equal('identifier');
        user.set('identifier', 'another identifier');
        expect(user.get('identifier')).to.equal('identifier');
      });

      it("doesn't set timestamps", function () {
        const User = this.sequelize.define('User', {
          identifier: { type: DataTypes.STRING, primaryKey: true },
        });

        const user = User.build(
          {},
          {
            isNewRecord: false,
          },
        );

        user.set({
          createdAt: new Date(2000, 1, 1),
          updatedAt: new Date(2000, 1, 1),
        });

        expect(user.get('createdAt')).not.to.be.ok;
        expect(user.get('updatedAt')).not.to.be.ok;
      });

      it("doesn't set underscored timestamps", function () {
        const User = this.sequelize.define(
          'User',
          {
            identifier: { type: DataTypes.STRING, primaryKey: true },
          },
          {
            underscored: true,
          },
        );

        const user = User.build(
          {},
          {
            isNewRecord: false,
          },
        );

        user.set({
          created_at: new Date(2000, 1, 1),
          updated_at: new Date(2000, 1, 1),
        });

        expect(user.get('created_at')).not.to.be.ok;
        expect(user.get('updated_at')).not.to.be.ok;
      });

      it('allows use of sequelize.fn and sequelize.col in date and bool fields', async function () {
        const User = this.sequelize.define(
          'User',
          {
            d: DataTypes.DATE,
            b: DataTypes.BOOLEAN,
            always_false: {
              type: DataTypes.BOOLEAN,
              defaultValue: false,
            },
          },
          { timestamps: false },
        );

        await User.sync({ force: true });
        const user = await User.create({});
        // Create the user first to set the proper default values. PG does not support column references in insert,
        // so we must create a record with the right value for always_false, then reference it in an update
        const now =
          dialect === 'sqlite3'
            ? this.sequelize.fn('', this.sequelize.fn('datetime', 'now'))
            : dialect === 'mssql'
              ? this.sequelize.fn('', this.sequelize.fn('getdate'))
              : this.sequelize.fn('NOW');

        user.set({
          d: now,
          b: this.sequelize.col('always_false'),
        });

        expect(user.get('d')).to.be.instanceof(Fn);
        expect(user.get('b')).to.be.instanceof(Col);

        await user.save();
        await user.reload();
        expect(user.d).to.equalDate(new Date());
        expect(user.b).to.equal(false);
      });

      describe('includes', () => {
        it('should support basic includes', function () {
          const Product = this.sequelize.define('product', {
            title: DataTypes.STRING,
          });
          const Tag = this.sequelize.define('tag', {
            name: DataTypes.STRING,
          });
          const User = this.sequelize.define('user', {
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          const product = Product.build(
            {},
            {
              include: [User, Tag],
            },
          );

          product.set({
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
          });

          expect(product.tags).to.be.ok;
          expect(product.tags.length).to.equal(2);
          expect(product.tags[0]).to.be.instanceof(Tag);
          expect(product.user).to.be.ok;
          expect(product.user).to.be.instanceof(User);
        });

        it('should support basic includes (with raw: true)', function () {
          const Product = this.sequelize.define('Product', {
            title: DataTypes.STRING,
          });
          const Tag = this.sequelize.define('tag', {
            name: DataTypes.STRING,
          });
          const User = this.sequelize.define('user', {
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          });

          Product.hasMany(Tag);
          Product.belongsTo(User);

          const product = Product.build(
            {},
            {
              include: [User, Tag],
            },
          );

          product.set(
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
            { raw: true },
          );

          expect(product.tags).to.be.ok;
          expect(product.tags.length).to.equal(2);
          expect(product.tags[0]).to.be.instanceof(Tag);
          expect(product.user).to.be.ok;
          expect(product.user).to.be.instanceof(User);
        });
      });
    });

    describe('get', () => {
      it('should use custom attribute getters in get(key)', function () {
        const Product = this.sequelize.define('Product', {
          price: {
            type: DataTypes.FLOAT,
            get() {
              return this.dataValues.price * 100;
            },
          },
        });

        const product = Product.build({
          price: 10,
        });
        expect(product.get('price')).to.equal(1000);
      });

      it('should work with save', async function () {
        const Contact = this.sequelize.define('Contact', {
          first: { type: DataTypes.STRING },
          last: { type: DataTypes.STRING },
          tags: {
            type: DataTypes.STRING,
            get(field) {
              const val = this.getDataValue(field);

              return JSON.parse(val);
            },
            set(val, field) {
              this.setDataValue(field, JSON.stringify(val));
            },
          },
        });

        await this.sequelize.sync();
        const contact = Contact.build({
          first: 'My',
          last: 'Name',
          tags: ['yes', 'no'],
        });
        expect(contact.get('tags')).to.deep.equal(['yes', 'no']);

        const me = await contact.save();
        expect(me.get('tags')).to.deep.equal(['yes', 'no']);
      });

      describe('plain', () => {
        it('should return plain values when true', function () {
          const Product = this.sequelize.define('product', {
            title: DataTypes.STRING,
          });
          const User = this.sequelize.define('user', {
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          });

          Product.belongsTo(User);

          const product = Product.build(
            {},
            {
              include: [User],
            },
          );

          product.set(
            {
              id: 1,
              title: 'Chair',
              user: {
                id: 1,
                first_name: 'Mick',
                last_name: 'Hansen',
              },
            },
            { raw: true },
          );

          expect(product.get('user', { plain: true })).not.to.be.instanceof(User);
          expect(product.get({ plain: true }).user).not.to.be.instanceof(User);
        });
      });

      describe('clone', () => {
        it('should copy the values', function () {
          const Product = this.sequelize.define('product', {
            title: DataTypes.STRING,
          });

          const product = Product.build(
            {
              id: 1,
              title: 'Chair',
            },
            { raw: true },
          );

          const values = product.get({ clone: true });
          delete values.title;

          expect(product.get({ clone: true }).title).to.be.ok;
        });
      });
    });

    describe('changed', () => {
      it('should return false if object was built from database', async function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });

        await User.sync();
        const user0 = await User.create({ name: 'Jan Meier' });
        expect(user0.changed('name')).to.be.false;
        expect(user0.changed()).not.to.be.ok;
        const [user] = await User.bulkCreate([{ name: 'Jan Meier' }]);
        expect(user.changed('name')).to.be.false;
        expect(user.changed()).not.to.be.ok;
      });

      it('should return true if previous value is different', function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });

        const user = User.build({
          name: 'Jan Meier',
        });
        user.set('name', 'Mick Hansen');
        expect(user.changed('name')).to.be.true;
        expect(user.changed()).to.be.ok;
      });

      it('should return false immediately after saving', async function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });

        await User.sync();
        const user = User.build({
          name: 'Jan Meier',
        });
        user.set('name', 'Mick Hansen');
        expect(user.changed('name')).to.be.true;
        expect(user.changed()).to.be.ok;

        await user.save();
        expect(user.changed('name')).to.be.false;
        expect(user.changed()).not.to.be.ok;
      });

      it('should be available to a afterUpdate hook', async function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });
        let changed;

        User.afterUpdate(instance => {
          changed = instance.changed();
        });

        await User.sync({ force: true });

        const user0 = await User.create({
          name: 'Ford Prefect',
        });

        const user = await user0.update({
          name: 'Arthur Dent',
        });

        expect(changed).to.be.ok;
        expect(changed.length).to.be.ok;
        expect(changed).to.include('name');
        expect(user.changed()).not.to.be.ok;
      });
    });

    describe('previous', () => {
      it('should return an object with the previous values', function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
          title: { type: DataTypes.STRING },
        });

        const user = User.build({
          name: 'Jan Meier',
          title: 'Mr',
        });

        user.set('name', 'Mick Hansen');
        user.set('title', 'Dr');

        expect(user.previous()).to.eql({ name: 'Jan Meier', title: 'Mr' });
      });

      it('should return the previous value', function () {
        const User = this.sequelize.define('User', {
          name: { type: DataTypes.STRING },
        });

        const user = User.build({
          name: 'Jan Meier',
        });
        user.set('name', 'Mick Hansen');

        expect(user.previous('name')).to.equal('Jan Meier');
        expect(user.get('name')).to.equal('Mick Hansen');
      });
    });
  });
});
