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

    describe('alter', () => {
      it('should add a column if it exists in the model but not in the database', function() {
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

      it('should change column type', function() {
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

      it('should change default value', function() {
        const testSync = this.sequelize.define('testSync', {
          name: Sequelize.STRING,
          age: Sequelize.INTEGER,
          position: Sequelize.STRING
        });
        return this.sequelize.sync()
          .then(() => testSync.describe())
          .then(data => {
            expect(data.position.default).to.not.exist;
          })
          .then(() => this.sequelize.define('testSync', {
            position: {
              type: Sequelize.STRING,
              defaultValue: 'Manager'
            }
          }))
          .then(() => this.sequelize.sync({alter: true}))
          .then(() => testSync.describe())
          .then(data => {
            expect(data.position.defaultValue).to.equal('Manager');
          });
      });

      it('should change not null', function() {
        const testSync = this.sequelize.define('testSync', {
          name: {
            type: Sequelize.STRING,
            allowNull: false
          },
          age: Sequelize.INTEGER
        });
        return this.sequelize.sync()
          .then(() => testSync.describe())
          .then(data => {
            expect(data.name.allowNull).to.be.false;
          })
          .then(() => this.sequelize.define('testSync', {
            name: {
              type: Sequelize.STRING
            }
          }))
          .then(() => this.sequelize.sync({alter: true}))
          .then(() => testSync.describe())
          .then(data => {
            expect(data.name.allowNull).to.be.true;
          });
      });

      // No support for other dialects
      if (Support.sequelize.options.dialect === 'postgres') {
        it('should change unique', function() {
          const testSync = this.sequelize.define('testSync', {
            name: {
              type: Sequelize.STRING,
              unique: true
            }
          });
          return this.sequelize.sync()
            .then(() => testSync.create({name: 'test'}))
            .then(() => {
              expect(testSync.create({name: 'test'})).to.eventually.be.rejectedWith(Sequelize.SequelizeUniqueConstraintError);
            })
            .then(() => this.sequelize.define('testSync', {
              name: {
                type: Sequelize.STRING
              }
            }))
            .then(() => this.sequelize.sync({alter: true}))
            .then(() => testSync.create({name: 'test'}))
            .then(() => testSync.findAll({ where: { name: 'test'}}))
            .then(records => {
              expect(records).to.have.length(2);
            });
        });
      }

      it('should not drop database columns not present in model', function() {
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
            expect(data).to.have.ownProperty('name');
            expect(data).to.have.ownProperty('age');
          });
      });
    });

    describe('alter and dropColumn', () => {
      it('should drop column when not present in model and dropColumn option = true', function() {
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
          .then(() => this.sequelize.sync({alter: true, dropColumn: true}))
          .then(() => User.describe())
          .then(data => {
            expect(data).to.not.have.ownProperty('age');
            expect(data).to.have.ownProperty('name');
          });
      });
    });
  });
});
