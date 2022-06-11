'use strict';

const chai = require('chai');
const { DataTypes } = require('@sequelize/core');

const expect = chai.expect;
const Support = require('../support');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('sync', () => {
    beforeEach(async function () {
      this.testSync = this.sequelize.define('testSync', {
        dummy: DataTypes.STRING,
      });
      await this.testSync.drop();
    });

    it('should remove a column if it exists in the databases schema but not the model', async function () {
      const User = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        badgeNumber: { type: DataTypes.INTEGER, field: 'badge_number' },
      });
      await this.sequelize.sync();
      this.sequelize.define('testSync', {
        name: DataTypes.STRING,
      });
      await this.sequelize.sync({ alter: true });
      const data = await User.describe();
      expect(data).to.not.have.ownProperty('age');
      expect(data).to.not.have.ownProperty('badge_number');
      expect(data).to.not.have.ownProperty('badgeNumber');
      expect(data).to.have.ownProperty('name');
    });

    it('should add a column if it exists in the model but not the database', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        height: { type: DataTypes.INTEGER, field: 'height_cm' },
      });

      await this.sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('age');
      expect(data).to.have.ownProperty('height_cm');
      expect(data).not.to.have.ownProperty('height');
    });

    it('should not remove columns if drop is set to false in alter configuration', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: DataTypes.STRING,
      });

      await this.sequelize.sync({ alter: { drop: false } });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('name');
      expect(data).to.have.ownProperty('age');
    });

    it('should remove columns if drop is set to true in alter configuration', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: DataTypes.STRING,
      });

      await this.sequelize.sync({ alter: { drop: true } });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('name');
      expect(data).not.to.have.ownProperty('age');
    });

    it('should alter a column using the correct column name (#9515)', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        badgeNumber: { type: DataTypes.INTEGER, field: 'badge_number' },
      });

      await this.sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('badge_number');
      expect(data).not.to.have.ownProperty('badgeNumber');
    });

    // IBM i can't alter INTEGER -> STRING
    if (dialect !== 'ibmi') {
      it('should change a column if it exists in the model but is different in the database', async function () {
        const testSync = this.sequelize.define('testSync', {
          name: DataTypes.STRING,
          age: DataTypes.INTEGER,
        });
        await this.sequelize.sync();

        await this.sequelize.define('testSync', {
          name: DataTypes.STRING,
          age: DataTypes.STRING,
        });

        await this.sequelize.sync({ alter: true });
        const data = await testSync.describe();
        expect(data).to.have.ownProperty('age');
        expect(data.age.type).to.have.string('VAR'); // CHARACTER VARYING, VARCHAR(n)
      });
    }

    it('should not alter table if data type does not change', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.STRING,
      });
      await this.sequelize.sync();
      await testSync.create({ name: 'test', age: '1' });
      await this.sequelize.sync({ alter: true });
      const data = await testSync.findOne();
      expect(data.dataValues.name).to.eql('test');
      expect(data.dataValues.age).to.eql('1');
    });

    it('should properly create composite index without affecting individual fields', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.STRING,
      }, { indexes: [{ unique: true, fields: ['name', 'age'] }] });
      await this.sequelize.sync();
      await testSync.create({ name: 'test' });
      await testSync.create({ name: 'test2' });
      await testSync.create({ name: 'test3' });
      await testSync.create({ age: '1' });
      await testSync.create({ age: '2' });
      await testSync.create({ name: 'test', age: '1' });
      await testSync.create({ name: 'test', age: '2' });
      await testSync.create({ name: 'test2', age: '2' });
      await testSync.create({ name: 'test3', age: '2' });
      const data = await testSync.create({ name: 'test3', age: '1' });
      expect(data.dataValues.name).to.eql('test3');
      expect(data.dataValues.age).to.eql('1');
    });

    it('should properly create composite index that fails on constraint violation', async function () {
      const testSync = this.sequelize.define('testSync', {
        name: DataTypes.STRING,
        age: DataTypes.STRING,
      }, { indexes: [{ unique: true, fields: ['name', 'age'] }] });

      try {
        await this.sequelize.sync();
        await testSync.create({ name: 'test', age: '1' });
        const data = await testSync.create({ name: 'test', age: '1' });
        await expect(data).not.to.be.ok;
      } catch (error) {
        await expect(error).to.be.ok;
      }
    });

    it('should properly alter tables when there are foreign keys', async function () {
      const foreignKeyTestSyncA = this.sequelize.define('foreignKeyTestSyncA', {
        dummy: DataTypes.STRING,
      });

      const foreignKeyTestSyncB = this.sequelize.define('foreignKeyTestSyncB', {
        dummy: DataTypes.STRING,
      });

      foreignKeyTestSyncA.hasMany(foreignKeyTestSyncB);
      foreignKeyTestSyncB.belongsTo(foreignKeyTestSyncA);

      await this.sequelize.sync({ alter: true });
      await this.sequelize.sync({ alter: true });
    });

    describe('indexes', () => {
      describe('with alter:true', () => {
        it('should not duplicate named indexes after multiple sync calls', async function () {
          const User = this.sequelize.define('testSync', {
            email: {
              type: DataTypes.STRING,
            },
            phone: {
              type: DataTypes.STRING,
            },
            mobile: {
              type: DataTypes.STRING,
            },
          }, {
            indexes: [
              { name: 'another_index_email_mobile', fields: ['email', 'mobile'] },
              { name: 'another_index_phone_mobile', fields: ['phone', 'mobile'], unique: true },
              { name: 'another_index_email', fields: ['email'] },
              { name: 'another_index_mobile', fields: ['mobile'] },
            ],
          });

          await User.sync();
          await User.sync({ alter: true });
          await User.sync({ alter: true });
          await User.sync({ alter: true });
          const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            // However it does create an extra "autoindex", except primary == false
            expect(results).to.have.length(4 + 1);
          } else {
            expect(results).to.have.length(4 + 1);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }

          if (dialect === 'sqlite') {
            expect(results.filter(r => r.name === 'sqlite_autoindex_testSyncs_1')).to.have.length(1);
          }

          expect(results.filter(r => r.name === 'another_index_email_mobile')).to.have.length(1);
          expect(results.filter(r => r.name === 'another_index_phone_mobile')).to.have.length(1);
          expect(results.filter(r => r.name === 'another_index_email')).to.have.length(1);
          expect(results.filter(r => r.name === 'another_index_mobile')).to.have.length(1);
        });

        it('should not duplicate unnamed indexes after multiple sync calls', async function () {
          const User = this.sequelize.define('testSync', {
            email: {
              type: DataTypes.STRING,
            },
            phone: {
              type: DataTypes.STRING,
            },
            mobile: {
              type: DataTypes.STRING,
            },
          }, {
            indexes: [
              { fields: ['email', 'mobile'] },
              { fields: ['phone', 'mobile'], unique: true },
              { fields: ['email'] },
              { fields: ['mobile'] },
            ],
          });

          const initialEmailUnique = User.rawAttributes.email.unique;
          expect(initialEmailUnique).not.to.be.ok;

          await User.sync();

          // db2 had a broken implementation which marked all attributes that were part of an index as 'unique'
          //  during the call to QueryInterface#createTable
          // This was a terrible idea with unpredictable side effects, this test is there to ensure it's not added back.
          // https://github.com/sequelize/sequelize/pull/14572#issuecomment-1152578770
          expect(User.rawAttributes.email.unique).to.eq(initialEmailUnique, 'User.sync should not modify attributes!');

          await User.sync({ alter: true });
          await User.sync({ alter: true });
          await User.sync({ alter: true });

          expect(User.rawAttributes.email.unique).to.eq(initialEmailUnique);

          const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            // However it does create an extra "autoindex", except primary == false
            expect(results).to.have.length(4 + 1);
          } else {
            expect(results).to.have.length(4 + 1);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }
        });

        it('should be able to add a unique index to an existing table (unique attribute option)', async function () {
          const User1 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
            },
          }, { timestamps: false });

          // create without the unique index
          await User1.sync({ force: true });

          // replace model (to emulate code changes)
          const User2 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
              unique: true,
            },
          }, { timestamps: false });

          const out1 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out1).to.have.length(1);

          // alter to add the unique index
          await User2.sync({ alter: true });

          const out2 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out2).to.have.length(2);

          const uniques = out2.filter(index => index.primary !== true);
          expect(uniques).to.have.length(1);
          expect(uniques[0].unique).to.eq(true, 'index should be unique');
        });

        it('should be able to add a unique index to an existing table (index option)', async function () {
          const User1 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
            },
          }, { timestamps: false });

          // create without the unique index
          await User1.sync({ force: true });

          // replace model (to emulate code changes)
          const User2 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
            },
          }, {
            timestamps: false,
            indexes: [
              { fields: ['email'], unique: true },
            ],
          });

          const out1 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out1).to.have.length(1);

          // alter to add the unique index
          await User2.sync({ alter: true });

          const out2 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out2).to.have.length(2);
          const uniques = out2.filter(index => index.primary !== true);
          expect(uniques).to.have.length(1);
          expect(uniques[0].unique).to.be.true;
        });

        it('should be able to add a non-unique index to an existing table', async function () {
          const User1 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
            },
          }, { timestamps: false });

          // create without the unique index
          await User1.sync({ force: true });

          // replace model (to emulate code changes)
          const User2 = this.sequelize.define('User', {
            email: {
              type: DataTypes.STRING,
            },
          }, {
            timestamps: false,
            indexes: [
              { fields: ['email'] },
            ],
          });

          const out1 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out1).to.have.length(1);

          // alter to add the unique index
          await User2.sync({ alter: true });

          const out2 = await this.sequelize.getQueryInterface().showIndex(User1.getTableName());
          expect(out2).to.have.length(2);
          const nonUniques = out2.filter(index => index.primary !== true);
          expect(nonUniques).to.have.length(1);
          expect(nonUniques[0].unique).to.be.false;
        });
      });

      it('creates one unique index for unique:true column', async function () {
        const User = this.sequelize.define('testSync', {
          email: {
            type: DataTypes.STRING,
            unique: true,
          },
        });

        await User.sync({ force: true });
        await User.sync({ alter: true });

        const results = (await this.sequelize.getQueryInterface().showIndex(User.getTableName()))
          .filter(r => !r.primary);

        expect(results).to.have.length(1);
      });

      it('throws if a name collision occurs between two indexes', async function () {
        expect(() => {
          this.sequelize.define('testSync', {
            email: {
              type: DataTypes.STRING,
              unique: true,
            },
          }, {
            timestamps: false,
            indexes: [
              { fields: ['email'], unique: true },
            ],
          });
        }).to.throw('Sequelize tried to give the name "test_syncs_email_unique" to index');
      });

      it('creates one unique index per unique:true columns, and per entry in options.indexes', async function () {
        const User = this.sequelize.define('testSync', {
          email: {
            type: DataTypes.STRING,
            unique: true,
          },
          phone: {
            type: DataTypes.STRING,
            unique: true,
          },
        }, {
          timestamps: false,
          indexes: [
            { name: 'wow_my_index', fields: ['email', 'phone'], unique: true },
          ],
        });

        await User.sync({ force: true });
        await User.sync({ alter: true });

        const results = (await this.sequelize.getQueryInterface().showIndex(User.getTableName()))
          .filter(r => !r.primary);

        results.sort((a, b) => a.name.localeCompare(b.name));

        expect(results).to.have.length(3);
        expect(results[0].name).to.eq('test_syncs_email_unique');
        expect(results[0].fields.map(f => f.attribute)).to.deep.eq(['email']);

        expect(results[1].name).to.eq('test_syncs_phone_unique');
        expect(results[1].fields.map(f => f.attribute)).to.deep.eq(['phone']);

        expect(results[2].name).to.eq('wow_my_index');
        expect(results[2].fields.map(f => f.attribute).sort()).to.deep.eq(['email', 'phone']);

        expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
      });

      it('should create only one unique index for unique:name column', async function () {
        const User = this.sequelize.define('testSync', {
          email: {
            type: DataTypes.STRING,
            unique: 'wow_my_index',
          },
        });

        await User.sync({ force: true });
        await User.sync({ alter: true });

        const results = (await this.sequelize.getQueryInterface().showIndex(User.getTableName()))
          .filter(r => !r.primary);

        expect(results).to.have.length(1);
        expect(results[0].name).to.eq('wow_my_index');
        expect(results[0].fields.map(field => field.attribute).sort()).to.deep.eq(['email']);
      });

      it('should create only one unique index for unique:name columns', async function () {
        const User = this.sequelize.define('testSync', {
          email: {
            type: DataTypes.STRING,
            unique: 'wow_my_index',
          },
          phone: {
            type: DataTypes.STRING,
            unique: 'wow_my_index',
          },
        });

        await User.sync({ force: true });
        await User.sync({ alter: true });

        const results = (await this.sequelize.getQueryInterface().showIndex(User.getTableName()))
          .filter(r => !r.primary);

        expect(results).to.have.length(1);
        expect(results[0].name).to.eq('wow_my_index');
        expect(results[0].fields.map(field => field.attribute).sort()).to.deep.eq(['email', 'phone']);
      });
    });
  });
});
