'use strict';

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const _ = require('lodash');
const moment = require('moment');
const Sequelize = require('../../../../index');
const Support = require(__dirname + '/../../support');
const current = Support.sequelize;
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');

const debug = require('debug')('sequelize:test:integration:dialects:postgres');

if (dialect === 'postgres') {
  describe('[POSTGRES Specific] Data Types', () => {
    describe('DATE', () => {
      // quick test of DATE methods
      it('should validate Infinity/-Infinity as true', () => {
        expect(DataTypes[dialect].DATE().validate(Infinity)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(-Infinity)).to.equal(true);
      });

      it('should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATE().stringify(Infinity)).to.equal('infinity');
        expect(DataTypes[dialect].DATE().stringify(-Infinity)).to.equal('-infinity');
      });
    });

    describe('DATE SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', function() {
        this.sequelize.options.typeValidation = true;

        const User = this.sequelize.define('User', {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATE
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: Infinity
          }
        }, {
          timestamps: true
        });

        return User.sync({
          force: true
        }).then(() => {
          return User.create({
            username: 'bob',
            anotherTime: Infinity
          }, {
            validate: true
          });
        }).then(user => {
          expect(user.username).to.equal('bob');
          expect(user.beforeTime).to.equal(-Infinity);
          expect(user.sometime).to.not.equal(Infinity);
          expect(user.anotherTime).to.equal(Infinity);
          expect(user.afterTime).to.equal(Infinity);

          return user.update({
            sometime: Infinity
          });
        }).then(user => {
          expect(user.sometime).to.equal(Infinity);

          return user.update({
            sometime: this.sequelize.fn('NOW')
          });
        }).then(user => {
          expect(user.sometime).to.not.equal(Infinity);

          // find
          return User.findAll();
        }).then(users => {
          expect(users[0].beforeTime).to.equal(-Infinity);
          expect(users[0].sometime).to.not.equal(Infinity);
          expect(users[0].afterTime).to.equal(Infinity);
        });
      });

    });

    // REMOVE AFTER FINISHING!
    describe('BOOLEAN', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: { type: DataTypes.STRING },
          uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
          uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
          touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
          aNumber: { type: DataTypes.INTEGER },
          bNumber: { type: DataTypes.INTEGER },
          aDate: { type: DataTypes.DATE },

          validateTest: {
            type: DataTypes.INTEGER,
            allowNull: true,
            validate: {isInt: true}
          },
          validateCustom: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {len: {msg: 'Length failed.', args: [1, 20]}}
          },

          dateAllowNullTrue: {
            type: DataTypes.DATE,
            allowNull: true
          },

          isSuperUser: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          }
        });
        return this.User.sync({ force: true });
      });

      it('should override default when given truthy boolean-int (1)', function() {
        return this.User.build({
          username: 'a user',
          isSuperUser: 1
        })
          .save()
          .bind(this)
          .then(function() {
            return this.User.findOne({
              where: {
                username: 'a user'
              }
            })
              .then(user => {
                expect(user.isSuperUser).to.be.true;
              });
          });
      });

      it('should be just "null" and not Date with Invalid Date', function() {
        const self = this;
        return this.User.build({ username: 'a user'}).save().then(() => {
          return self.User.findOne({where: {username: 'a user'}}).then(user => {
            expect(user.dateAllowNullTrue).to.be.null;
          });
        });
      });
    });

    describe('when nothing changed', () => {
      beforeEach(function() {
        this.clock = sinon.useFakeTimers();
      });

      afterEach(function() {
        this.clock.restore();
      });

      it('does not update timestamps', function() {
        this.sequelize.options.typeValidation = true;

        const User = this.sequelize.define('User', {
          username: this.sequelize.Sequelize.STRING
        }, {
          timestamps: true
        });

        return User.sync({
          force: true
        }).then(() => {
          return User.create({ username: 'John' }).then(() => {
            return User.findOne({ where: { username: 'John' } }).then(user => {
              const updatedAt = user.updatedAt;
              this.clock.tick(2000);
              return user.save().then(newlySavedUser => {
                expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
                return User.findOne({ where: { username: 'John' } }).then(newlySavedUser => {
                  expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
                });
              });
            });
          });
        });

      });
    });

    describe('when nothing changed', () => {
      it('doesn\'t set timestamps', function() {
        const User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        const user = User.build({}, {
          isNewRecord: false
        });

        user.set({
          createdAt: new Date(2000, 1, 1),
          updatedAt: new Date(2000, 1, 1)
        });

        expect(user.get('createdAt')).not.to.be.ok;
        expect(user.get('updatedAt')).not.to.be.ok;
      });

      it('doesn\'t set underscored timestamps', function() {
        const User = this.sequelize.define('User', {
          identifier: {type: DataTypes.STRING, primaryKey: true}
        }, {
          underscored: true
        });

        const user = User.build({}, {
          isNewRecord: false
        });

        user.set({
          created_at: new Date(2000, 1, 1),
          updated_at: new Date(2000, 1, 1)
        });

        expect(user.get('created_at')).not.to.be.ok;
        expect(user.get('updated_at')).not.to.be.ok;
      });

    });

    describe('on update', () => {
      beforeEach(function() {
        this.clock = sinon.useFakeTimers();
      });

      afterEach(function() {
        this.clock.restore();
      });

      it('doesn\'t update primary keys or timestamps', function() {
        const User = this.sequelize.define('User', {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          identifier: {type: DataTypes.STRING, primaryKey: true}
        });

        return User.sync({ force: true }).bind(this).then(() => {
          return User.create({
            name: 'snafu',
            identifier: 'identifier'
          });
        }).then(function(user) {
          const oldCreatedAt = user.createdAt,
            oldUpdatedAt = user.updatedAt,
            oldIdentifier = user.identifier;

          this.clock.tick(1000);
          return user.update({
            name: 'foobar',
            createdAt: new Date(2000, 1, 1),
            identifier: 'another identifier'
          }).then(user => {
            expect(new Date(user.createdAt)).to.equalDate(new Date(oldCreatedAt));
            expect(new Date(user.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
            expect(user.identifier).to.equal(oldIdentifier);
          });
        });
      });
    });

    describe('null values', () => {
      it('stores and restores null values', function() {
        const Download = this.sequelize.define('download', {
          startedAt: DataTypes.DATE,
          canceledAt: DataTypes.DATE,
          finishedAt: DataTypes.DATE
        });

        return Download.sync().then(() => {
          return Download.create({
            startedAt: new Date()
          }).then(download => {
            expect(download.startedAt instanceof Date).to.be.true;
            expect(download.canceledAt).to.not.be.ok;
            expect(download.finishedAt).to.not.be.ok;

            return download.update({
              canceledAt: new Date()
            }).then(download => {
              expect(download.startedAt instanceof Date).to.be.true;
              expect(download.canceledAt instanceof Date).to.be.true;
              expect(download.finishedAt).to.not.be.ok;

              return Download.findAll({
                where: {finishedAt: null}
              }).then(downloads => {
                downloads.forEach(download => {
                  expect(download.startedAt instanceof Date).to.be.true;
                  expect(download.canceledAt instanceof Date).to.be.true;
                  expect(download.finishedAt).to.not.be.ok;
                });
              });
            });
          });
        });
      });
    });

    describe(Support.getTestDialectTeaser('DataTypes'), () => {
      afterEach(function() {
        // Restore some sanity by resetting all parsers
        switch (dialect) {
          case 'postgres':
            const types = require('pg-types');

            _.each(DataTypes, dataType => {
              if (dataType.types && dataType.types.postgres) {
                dataType.types.postgres.oids.forEach(oid => {
                  types.setTypeParser(oid, _.identity);
                });
              }
            });

            require('pg-types/lib/binaryParsers').init((oid, converter) => {
              types.setTypeParser(oid, 'binary', converter);
            });
            require('pg-types/lib/textParsers').init((oid, converter) => {
              types.setTypeParser(oid, 'text', converter);
            });
            break;
          default:
            this.sequelize.connectionManager._clearTypeParser();
        }

        this.sequelize.connectionManager.refreshTypeParser(DataTypes[dialect]); // Reload custom parsers
      });

      it('allows me to return values from a custom parse function', () => {
        const parse = Sequelize.DATE.parse = sinon.spy(value => {
          return moment(value, 'YYYY-MM-DD HH:mm:ss');
        });

        const stringify = Sequelize.DATE.prototype.stringify = sinon.spy(function(value, options) {
          if (!moment.isMoment(value)) {
            value = this._applyTimezone(value, options);
          }
          return value.format('YYYY-MM-DD HH:mm:ss');
        });

        const set = Sequelize.DataTypes[dialect].DATE.prototype.set = sinon.spy(value => {
          return value;
        });

        const compare = Sequelize.DataTypes[dialect].DATE.prototype.compare = sinon.spy((value, originalValue, key, options) => {
          if (!options.raw && !!value) {
            if (originalValue) {
              if (!value.diff(originalValue)) {
                return false;
              }
            }

            return true;
          }
        });

        current.refreshTypes();

        const User = current.define('user', {
          dateField: Sequelize.DATE
        }, {
          timestamps: false
        });

        return current.sync({ force: true }).then(() => {
          return User.create({
            dateField: moment('2011 10 31', 'YYYY MM DD')
          });
        }).then(() => {
          return User.findAll().get(0);
        }).then(user => {
          expect(parse).to.have.been.called;
          expect(stringify).to.have.been.called;
          expect(set).to.have.been.called;
          expect(compare).to.have.been.called;

          expect(moment.isMoment(user.dateField)).to.be.ok;

          delete Sequelize.DATE.parse;
          delete Sequelize.DataTypes[dialect].DATE.prototype.compare;
          delete Sequelize.DataTypes[dialect].DATE.prototype.set;
        });
      });
    });

    describe('changed', () => {
      beforeEach(function() {
        this.User = current.define('User', {
          name: DataTypes.STRING,
          birthdate: DataTypes.DATE,
          meta: DataTypes.JSON
        });
      });

      it('should return false for two instances with same value', function() {
        const milliseconds = 1436921941088;
        const firstDate = new Date(milliseconds);
        const secondDate = new Date(milliseconds);

        const user = this.User.build({
          birthdate: firstDate
        }, {
          isNewRecord: false,
          raw: true
        });

        user.set('birthdate', secondDate);
        expect(user.changed('birthdate')).to.equal(false);
      });
    });

  });
}
