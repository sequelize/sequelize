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
  });
});
