'use strict';

const chai = require('chai'),
  { Sequelize, Deferrable, DataTypes } = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect();

const sequelize = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('sync', () => {
    beforeEach(async function() {
      this.testSync = this.sequelize.define('testSync', {
        dummy: Sequelize.STRING
      });
      await this.testSync.drop();
    });

    it('should remove a column if it exists in the databases schema but not the model', async function() {
      const User = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER,
        badgeNumber: { type: Sequelize.INTEGER, field: 'badge_number' }
      });
      await this.sequelize.sync();
      this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });
      await this.sequelize.sync({ alter: true });
      const data = await User.describe();
      expect(data).to.not.have.ownProperty('age');
      expect(data).to.not.have.ownProperty('badge_number');
      expect(data).to.not.have.ownProperty('badgeNumber');
      expect(data).to.have.ownProperty('name');
    });

    it('should add a column if it exists in the model but not the database', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER,
        height: { type: Sequelize.INTEGER, field: 'height_cm' }
      });

      await this.sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('age');
      expect(data).to.have.ownProperty('height_cm');
      expect(data).not.to.have.ownProperty('height');
    });

    it('should not remove columns if drop is set to false in alter configuration', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });

      await this.sequelize.sync({ alter: { drop: false } });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('name');
      expect(data).to.have.ownProperty('age');
    });

    it('should remove columns if drop is set to true in alter configuration', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });

      await this.sequelize.sync({ alter: { drop: true } });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('name');
      expect(data).not.to.have.ownProperty('age');
    });

    it('should alter a column using the correct column name (#9515)', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        badgeNumber: { type: Sequelize.INTEGER, field: 'badge_number' }
      });

      await this.sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('badge_number');
      expect(data).not.to.have.ownProperty('badgeNumber');
    });

    it('should change a column if it exists in the model but is different in the database', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      await this.sequelize.sync();

      await this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
      });

      await this.sequelize.sync({ alter: true });
      const data = await testSync.describe();
      expect(data).to.have.ownProperty('age');
      expect(data.age.type).to.have.string('CHAR'); // CHARACTER VARYING, VARCHAR(n)
    });

    it('should not alter table if data type does not change', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
      });
      await this.sequelize.sync();
      await testSync.create({ name: 'test', age: '1' });
      await this.sequelize.sync({ alter: true });
      const data = await testSync.findOne();
      expect(data.dataValues.name).to.eql('test');
      expect(data.dataValues.age).to.eql('1');
    });

    it('should properly create composite index without affecting individual fields', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
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

    it('should properly create composite index that fails on constraint violation', async function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
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

    it('supports creating tables with cyclic associations', async () => {
      const A = sequelize.define('A', {}, { timestamps: false });
      const B = sequelize.define('B', {}, { timestamps: false });

      // These models both have a foreign key that references the other model.
      // Sequelize should be able to create them.
      A.belongsTo(B, { foreignKey: { allowNull: false } });
      B.belongsTo(A, { foreignKey: { allowNull: false } });

      await sequelize.sync();

      const [aFks, bFks] = await Promise.all([
        sequelize.queryInterface.getForeignKeyReferencesForTable(A.getTableName()),
        sequelize.queryInterface.getForeignKeyReferencesForTable(B.getTableName())
      ]);

      expect(aFks.length).to.eq(1);
      expect(aFks[0].referencedTableName).to.eq('Bs');
      expect(aFks[0].referencedColumnName).to.eq('id');
      expect(aFks[0].columnName).to.eq('BId');

      expect(bFks.length).to.eq(1);
      expect(bFks[0].referencedTableName).to.eq('As');
      expect(bFks[0].referencedColumnName).to.eq('id');
      expect(bFks[0].columnName).to.eq('AId');
    });

    it('supports creating two identically named tables in different schemas', async () => {
      await sequelize.queryInterface.createSchema('custom_schema');

      const Model1 = sequelize.define('A1', {}, { schema: 'custom_schema', tableName: 'a', timestamps: false });
      const Model2 = sequelize.define('A2', {}, { tableName: 'a', timestamps: false });

      await Model1.sync();
      await Model2.sync();

      await Model1.create();
      await Model2.create();
    });

    describe('with { alter: true }', () => {
      it('should properly alter tables when there are foreign keys', async function() {
        const foreignKeyTestSyncA = this.sequelize.define('foreignKeyTestSyncA', {
          dummy: Sequelize.STRING
        });

        const foreignKeyTestSyncB = this.sequelize.define('foreignKeyTestSyncB', {
          dummy: Sequelize.STRING
        });

        foreignKeyTestSyncA.hasMany(foreignKeyTestSyncB);
        foreignKeyTestSyncB.belongsTo(foreignKeyTestSyncA);

        await this.sequelize.sync({ alter: true });
        await this.sequelize.sync({ alter: true });
      });

      // TODO: sqlite's foreign_key_list pragma does not return the DEFERRABLE status of the column
      //  so sync({ alter: true }) cannot know whether the column must be updated.
      //  so for now, deferrableConstraints is disabled for sqlite (as it's only used in tests)
      if (sequelize.dialect.supports.deferrableConstraints) {
        it('updates the deferrable property of a foreign key', async () => {
          const A = sequelize.define('A', {
            BId: {
              type: DataTypes.INTEGER,
              references: {
                deferrable: Deferrable.INITIALLY_IMMEDIATE()
              }
            }
          });
          const B = sequelize.define('B');

          A.belongsTo(B);

          await sequelize.sync();

          {
            const aFks = await sequelize.queryInterface.getForeignKeyReferencesForTable(A.getTableName());

            expect(aFks.length).to.eq(1);
            expect(aFks[0].deferrable).to.eq(Deferrable.INITIALLY_IMMEDIATE);
          }

          A.rawAttributes.BId.references.deferrable = Deferrable.INITIALLY_DEFERRED;
          await sequelize.sync({ alter: true });

          {
            const aFks = await sequelize.queryInterface.getForeignKeyReferencesForTable(A.getTableName());

            expect(aFks.length).to.eq(1);
            expect(aFks[0].deferrable).to.eq(Deferrable.INITIALLY_DEFERRED);
          }
        });
      }

      // TODO add support for db2 and mssql dialects
      if (!['db2', 'mssql'].includes(dialect)) {
        it('does not recreate existing enums (#7649)', async () => {
          sequelize.define('Media', {
            type: DataTypes.ENUM([
              'video', 'audio'
            ])
          });
          await sequelize.sync({ alter: true });
          sequelize.define('Media', {
            type: DataTypes.ENUM([
              'image', 'video', 'audio'
            ])
          });
          await sequelize.sync({ alter: true });
        });
      }
    });

    describe('indexes', () => {
      describe('with alter:true', () => {
        it('should not duplicate named indexes after multiple sync calls', async function() {
          const User = this.sequelize.define('testSync', {
            email: {
              type: Sequelize.STRING
            },
            phone: {
              type: Sequelize.STRING
            },
            mobile: {
              type: Sequelize.STRING
            }
          }, {
            indexes: [
              { name: 'another_index_email_mobile', fields: ['email', 'mobile'] },
              { name: 'another_index_phone_mobile', fields: ['phone', 'mobile'], unique: true },
              { name: 'another_index_email', fields: ['email'] },
              { name: 'another_index_mobile', fields: ['mobile'] }
            ]
          });

          await User.sync({ sync: true });
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

        it('should not duplicate unnamed indexes after multiple sync calls', async function() {
          const User = this.sequelize.define('testSync', {
            email: {
              type: Sequelize.STRING
            },
            phone: {
              type: Sequelize.STRING
            },
            mobile: {
              type: Sequelize.STRING
            }
          }, {
            indexes: [
              { fields: ['email', 'mobile'] },
              { fields: ['phone', 'mobile'], unique: true },
              { fields: ['email'] },
              { fields: ['mobile'] }
            ]
          });

          await User.sync({ sync: true });
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
        });
      });

      it('should create only one unique index for unique:true column', async function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: true
          }
        });

        await User.sync({ force: true });
        const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
        if (dialect === 'sqlite') {
          // SQLite doesn't treat primary key as index
          expect(results).to.have.length(1);
        } else {
          expect(results).to.have.length(2);
          expect(results.filter(r => r.primary)).to.have.length(1);
        }

        expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
      });

      it('should create only one unique index for unique:true columns', async function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: true
          },
          phone: {
            type: Sequelize.STRING,
            unique: true
          }
        });

        await User.sync({ force: true });
        const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
        if (dialect === 'sqlite') {
          // SQLite doesn't treat primary key as index
          expect(results).to.have.length(2);
        } else {
          expect(results).to.have.length(3);
          expect(results.filter(r => r.primary)).to.have.length(1);
        }

        expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(2);
      });

      it('should create only one unique index for unique:true columns taking care of options.indexes', async function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: true
          },
          phone: {
            type: Sequelize.STRING,
            unique: true
          }
        }, {
          indexes: [
            { name: 'wow_my_index', fields: ['email', 'phone'], unique: true }
          ]
        });

        await User.sync({ force: true });
        const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
        if (dialect === 'sqlite') {
          // SQLite doesn't treat primary key as index
          expect(results).to.have.length(3);
        } else {
          expect(results).to.have.length(4);
          expect(results.filter(r => r.primary)).to.have.length(1);
        }

        expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(3);
        expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
      });

      it('should create only one unique index for unique:name column', async function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: 'wow_my_index'
          }
        });

        await User.sync({ force: true });
        const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
        if (dialect === 'sqlite') {
          // SQLite doesn't treat primary key as index
          expect(results).to.have.length(1);
        } else {
          expect(results).to.have.length(2);
          expect(results.filter(r => r.primary)).to.have.length(1);
        }

        expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);

        if (!['postgres', 'sqlite'].includes(dialect)) {
          // Postgres/SQLite doesn't support naming indexes in create table
          expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
        }
      });

      it('should create only one unique index for unique:name columns', async function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: 'wow_my_index'
          },
          phone: {
            type: Sequelize.STRING,
            unique: 'wow_my_index'
          }
        });

        await User.sync({ force: true });
        const results = await this.sequelize.getQueryInterface().showIndex(User.getTableName());
        if (dialect === 'sqlite') {
          // SQLite doesn't treat primary key as index
          expect(results).to.have.length(1);
        } else {
          expect(results).to.have.length(2);
          expect(results.filter(r => r.primary)).to.have.length(1);
        }

        expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
        if (!['postgres', 'sqlite'].includes(dialect)) {
          // Postgres/SQLite doesn't support naming indexes in create table
          expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
        }
      });
    });
  });
});
