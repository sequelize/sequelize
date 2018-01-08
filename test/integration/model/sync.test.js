'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../support');

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
  });
});
