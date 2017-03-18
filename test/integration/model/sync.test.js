'use strict';

/* jshint -W030 */
/* jshint -W110 */
const chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('sync', () => {
    beforeEach(() => {
      this.testSync = this.sequelize.define('testSync', {
        dummy: Sequelize.STRING
      });

      return this.testSync.drop();
    });

    it('should remove a column if it exists in the databases schema but not the model', () => {
      let User = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      return this.sequelize.sync()
        .bind(this)
        .then(() => {
          this.sequelize.define('testSync', {
            name: Sequelize.STRING
          });
        })
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => {
          return User.describe().then((data) => {
            expect(data).to.not.ownProperty('age');
          });
        });
    });

    it('should add a column if it exists in the model but not the database', () => {
      let testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING
      });
      return this.sequelize.sync()
        .bind(this)
        .then(() => {
          this.sequelize.define('testSync', {
            name: Sequelize.STRING,
            age: Sequelize.INTEGER
          });
        })
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => {
          return testSync.describe().then((data) => {
            expect(data).to.ownProperty('age');
          });
        });
    });

    it('should change a column if it exists in the model but is different in the database', () => {
      let testSync = this.sequelize.define('testSync', {
        name: Sequelize.STRING,
        age: Sequelize.INTEGER
      });
      return this.sequelize.sync()
        .bind(this)
        .then(() => {
          this.sequelize.define('testSync', {
            name: Sequelize.STRING,
            age: Sequelize.STRING
          });
        })
        .then(() => this.sequelize.sync({alter: true}))
        .then(() => {
          return testSync.describe().then((data) => {
            expect(data).to.ownProperty('age');
            expect(data.age.type).to.have.string('CHAR'); // CHARACTER VARYING, VARCHAR(n)
          });
        });
    });

    it('should not modify data if the data type does not change', () => {
      let testSync = this.sequelize.define('testSync', {
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
