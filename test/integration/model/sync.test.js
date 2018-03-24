'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('sync', () => {
    beforeEach(function() {
      this.testSync = this.sequelize.define('testSync', {
        dummy: Sequelize.STRING
      });
      return this.testSync.drop();
    });

    it('should remove a column if it exists in the databases schema but not the model', function() {
      const User = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      return this.sequelize.sync()
        .then(() => {
          this.sequelize.define('testSync', {
            name: Sequelize.STRING
          });
        })
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => User.describe())
        .then(data => {
          expect(data).to.not.have.ownProperty('age');
          expect(data).to.have.ownProperty('name');
        });
    });

    it('should add a column if it exists in the model but not the database', function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });
      return this.sequelize.sync()
        .then(() => this.sequelize.define('testSync', {
          name: Sequelize.STRING,
          age: Sequelize.INTEGER
        }))
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => testSync.describe())
        .then(data => expect(data).to.have.ownProperty('age'));
    });

    it('should change a column if it exists in the model but is different in the database', function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      return this.sequelize.sync()
        .then(() => this.sequelize.define('testSync', {
          name: Sequelize.STRING,
          age: Sequelize.STRING
        }))
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => testSync.describe())
        .then(data => {
          expect(data).to.have.ownProperty('age');
          expect(data.age.type).to.have.string('CHAR'); // CHARACTER VARYING, VARCHAR(n)
        });
    });

    it('should not alter table if data type does not change', function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
      });
      return this.sequelize.sync()
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => testSync.findOne())
        .then(data => {
          expect(data.dataValues.name).to.eql('test');
          expect(data.dataValues.age).to.eql('1');
        });
    });

    it('should properly create composite index without affecting individual fields', function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
      }, {indexes: [{unique: true, fields: ['name', 'age']}]});
      return this.sequelize.sync()
        .then(() => testSync.create({name: 'test'}))
        .then(() => testSync.create({name: 'test2'}))
        .then(() => testSync.create({name: 'test3'}))
        .then(() => testSync.create({age: '1'}))
        .then(() => testSync.create({age: '2'}))
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => testSync.create({name: 'test', age: '2'}))
        .then(() => testSync.create({name: 'test2', age: '2'}))
        .then(() => testSync.create({name: 'test3', age: '2'}))
        .then(() => testSync.create({name: 'test3', age: '1'}))
        .then(data => {
          expect(data.dataValues.name).to.eql('test3');
          expect(data.dataValues.age).to.eql('1');
        });
    });
    it('should properly create composite index that fails on constraint violation', function() {
      const testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.STRING
      }, {indexes: [{unique: true, fields: ['name', 'age']}]});
      return this.sequelize.sync()
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(() => testSync.create({name: 'test', age: '1'}))
        .then(data => expect(data).not.to.be.ok, error => expect(error).to.be.ok);
    });

    it('should properly alter tables when there are foreign keys', function() {
      const foreignKeyTestSyncA = this.sequelize.define('foreignKeyTestSyncA', {
        dummy: Sequelize.STRING
      });

      const foreignKeyTestSyncB = this.sequelize.define('foreignKeyTestSyncB', {
        dummy: Sequelize.STRING
      });

      foreignKeyTestSyncA.hasMany(foreignKeyTestSyncB);
      foreignKeyTestSyncB.belongsTo(foreignKeyTestSyncA);

      return this.sequelize.sync({ alter: true })
        .then(() => this.sequelize.sync({ alter: true }));
    });

    describe('indexes', () => {
      describe('with alter:true', () => {
        it('should not duplicate named indexes after multiple sync calls', function() {
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
              { name: 'another_index_mobile', fields: ['mobile'] },
            ]
          });

          return User.sync({ sync: true })
            .then(() => User.sync({ alter: true }))
            .then(() => User.sync({ alter: true }))
            .then(() => User.sync({ alter: true }))
            .then(() => this.sequelize.getQueryInterface().showIndex(User.getTableName()))
            .then(results => {
              if (dialect === 'sqlite') {
                // SQLite doesn't treat primary key as index
                expect(results).to.have.length(4);
              } else {
                expect(results).to.have.length(4 + 1);
                expect(results.filter(r => r.primary)).to.have.length(1);
              }

              expect(results.filter(r => r.name === 'another_index_email_mobile')).to.have.length(1);
              expect(results.filter(r => r.name === 'another_index_phone_mobile')).to.have.length(1);
              expect(results.filter(r => r.name === 'another_index_email')).to.have.length(1);
              expect(results.filter(r => r.name === 'another_index_mobile')).to.have.length(1);
            });
        });

        it('should not duplicate unnamed indexes after multiple sync calls', function() {
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
              { fields: ['mobile'] },
            ]
          });

          return User.sync({ sync: true })
            .then(() => User.sync({ alter: true }))
            .then(() => User.sync({ alter: true }))
            .then(() => User.sync({ alter: true }))
            .then(() => this.sequelize.getQueryInterface().showIndex(User.getTableName()))
            .then(results => {
              if (dialect === 'sqlite') {
                // SQLite doesn't treat primary key as index
                expect(results).to.have.length(4);
              } else {
                expect(results).to.have.length(4 + 1);
                expect(results.filter(r => r.primary)).to.have.length(1);
              }
            });
        });
      });

      it('should create only one unique index for unique:true column', function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: true
          }
        });

        return User.sync({ force: true }).then(() => {
          return this.sequelize.getQueryInterface().showIndex(User.getTableName());
        }).then(results => {
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            expect(results).to.have.length(1);
          } else {
            expect(results).to.have.length(2);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }

          expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
        });
      });

      it('should create only one unique index for unique:true columns', function() {
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

        return User.sync({ force: true }).then(() => {
          return this.sequelize.getQueryInterface().showIndex(User.getTableName());
        }).then(results => {
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            expect(results).to.have.length(2);
          } else {
            expect(results).to.have.length(3);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }

          expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(2);
        });
      });

      it('should create only one unique index for unique:true columns taking care of options.indexes', function() {
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

        return User.sync({ force: true }).then(() => {
          return this.sequelize.getQueryInterface().showIndex(User.getTableName());
        }).then(results => {
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
      });

      it('should create only one unique index for unique:name column', function() {
        const User = this.sequelize.define('testSync', {
          email: {
            type: Sequelize.STRING,
            unique: 'wow_my_index'
          }
        });

        return User.sync({ force: true }).then(() => {
          return this.sequelize.getQueryInterface().showIndex(User.getTableName());
        }).then(results => {
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            expect(results).to.have.length(1);
          } else {
            expect(results).to.have.length(2);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }

          expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);

          if (['postgres', 'sqlite'].indexOf(dialect) === -1) {
            // Postgres/SQLite doesn't support naming indexes in create table
            expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
          }
        });
      });

      it('should create only one unique index for unique:name columns', function() {
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

        return User.sync({ force: true }).then(() => {
          return this.sequelize.getQueryInterface().showIndex(User.getTableName());
        }).then(results => {
          if (dialect === 'sqlite') {
            // SQLite doesn't treat primary key as index
            expect(results).to.have.length(1);
          } else {
            expect(results).to.have.length(2);
            expect(results.filter(r => r.primary)).to.have.length(1);
          }

          expect(results.filter(r => r.unique === true && r.primary === false)).to.have.length(1);
          if (['postgres', 'sqlite'].indexOf(dialect) === -1) {
            // Postgres/SQLite doesn't support naming indexes in create table
            expect(results.filter(r => r.name === 'wow_my_index')).to.have.length(1);
          }
        });
      });
    });
  });
});
